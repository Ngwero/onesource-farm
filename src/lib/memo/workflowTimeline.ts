import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { findApproversForStep } from '@/lib/memo/approvers';
import { formatNameWithDepartmentCode } from '@/lib/memo/personLine';
import { resolveWorkflow } from '@/lib/workflow/resolve';
import { PENDING_STATUS_TO_ROLE, sortedWorkflowSteps, type WorkflowStep } from '@/lib/workflow/engine';
import type { ImportanceLevel, MemoTypeSlug, SignatureRecord } from '@/types';

export type WorkflowTimelineStepStatus =
  | 'completed'
  | 'current'
  | 'pending'
  | 'rejected'
  | 'returned';

export interface WorkflowTimelineStep {
  name: string;
  status: WorkflowTimelineStepStatus;
  approver?: string;
  date?: string;
}

type MemoForTimeline = {
  id: string;
  department_id: string;
  memo_type_id: string;
  requires_finance?: boolean | null;
  importance_level?: ImportanceLevel | null;
  created_at: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  current_step_order?: number | null;
  pending_assignee_id?: string | null;
  pending_assignee_name?: string | null;
  memo_types?: { slug: string } | { slug: string }[] | null;
  memo_statuses?: { slug: string } | { slug: string }[] | null;
  signature_records?: SignatureRecord[] | null;
};

type UserDeptRow = {
  full_name: string;
  department_code: string | null;
};

function joinSlug(
  row: { slug: string } | { slug: string }[] | null | undefined
): string | undefined {
  if (!row) return undefined;
  return Array.isArray(row) ? row[0]?.slug : row.slug;
}

function deptCodeFromJoin(
  departments: { code?: string } | { code?: string }[] | null | undefined
): string | null {
  if (!departments) return null;
  const row = Array.isArray(departments) ? departments[0] : departments;
  return row?.code?.trim() || null;
}

async function loadUserDeptLabels(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, UserDeptRow>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, UserDeptRow>();
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from('users')
    .select('id, full_name, departments(code)')
    .in('id', unique);

  for (const row of data || []) {
    const id = row.id as string;
    const full_name = (row.full_name as string)?.trim();
    if (!full_name) continue;
    map.set(id, {
      full_name,
      department_code: deptCodeFromJoin(
        row.departments as { code?: string } | { code?: string }[] | null
      ),
    });
  }

  return map;
}

function blockTypeForRole(roleSlug: string): SignatureRecord['block_type'] {
  const map: Record<string, SignatureRecord['block_type']> = {
    department_head: 'checked',
    business_head: 'checked',
    it_checker_first: 'checked',
    it_checker_second: 'checked',
    finance_reviewer: 'reviewed',
    hr_reviewer: 'reviewed',
    ceo: 'approved',
    exco_member: 'approved',
  };
  return map[roleSlug] || 'approved';
}

function approverLine(
  userLabels: Map<string, UserDeptRow>,
  userId: string | null | undefined,
  fallbackName: string | null | undefined,
  viewingUserId?: string
): string | undefined {
  if (userId) {
    const row = userLabels.get(userId);
    if (row) {
      return formatNameWithDepartmentCode(row.full_name, row.department_code, {
        userId,
        viewingUserId,
      });
    }
  }
  return formatNameWithDepartmentCode(fallbackName, null, {
    userId: userId ?? undefined,
    viewingUserId,
  });
}

function indexByPendingRole(
  steps: WorkflowStep[],
  statusSlug: string | undefined
): number {
  if (!statusSlug) return -1;
  const role = PENDING_STATUS_TO_ROLE[statusSlug];
  if (!role) return -1;
  return steps.findIndex((s) => s.role_slug === role);
}

function assignSignaturesToSteps(
  steps: WorkflowStep[],
  signatures: SignatureRecord[]
): Map<number, SignatureRecord> {
  const result = new Map<number, SignatureRecord>();
  const pools: Record<string, SignatureRecord[]> = {};

  for (const sig of signatures) {
    if (sig.block_type === 'prepared') continue;
    const key = sig.block_type;
    if (!pools[key]) pools[key] = [];
    pools[key].push(sig);
  }

  for (const key of Object.keys(pools)) {
    pools[key].sort(
      (a, b) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime()
    );
  }

  const used = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const block = blockTypeForRole(steps[i].role_slug);
    const pool = pools[block] || [];
    const sig = pool.find((s) => !used.has(s.id));
    if (sig) {
      used.add(sig.id);
      result.set(i, sig);
    }
  }

  return result;
}

export async function buildWorkflowTimelineForMemo(
  memo: MemoForTimeline,
  viewingUserId?: string
): Promise<WorkflowTimelineStep[]> {
  const supabase = createServiceClient();
  const memoTypeSlug = joinSlug(memo.memo_types) as MemoTypeSlug | undefined;
  const statusSlug = joinSlug(memo.memo_statuses);

  if (!memoTypeSlug) {
    return [
      {
        name: 'Created',
        status: 'completed',
        date: new Date(memo.created_at).toLocaleString(),
      },
    ];
  }

  const workflow = await resolveWorkflow(memo.memo_type_id, memoTypeSlug, {
    requiresFinance: memo.requires_finance ?? undefined,
    importanceLevel: memo.importance_level ?? undefined,
  });

  const steps = sortedWorkflowSteps(workflow);
  const signatures = memo.signature_records || [];
  const sigByStep = assignSignaturesToSteps(steps, signatures);
  const pendingIdx = indexByPendingRole(steps, statusSlug);
  const approved = statusSlug === 'approved';
  const rejected = statusSlug === 'rejected';
  const returned = statusSlug === 'returned';
  const draft = statusSlug === 'draft';
  const withdrawn = statusSlug === 'withdrawn';

  const expectedApproverIdByStep = await Promise.all(
    steps.map(async (step) => {
      const ids = await findApproversForStep(
        step.role_slug,
        memo.department_id,
        memoTypeSlug,
        step.step_order
      );
      return ids[0] ?? null;
    })
  );

  const userIds = new Set<string>();
  for (const id of expectedApproverIdByStep) {
    if (id) userIds.add(id);
  }
  if (memo.pending_assignee_id) userIds.add(memo.pending_assignee_id);
  for (const sig of signatures) {
    if (sig.approver_id) userIds.add(sig.approver_id);
  }

  const userLabels = await loadUserDeptLabels(supabase, [...userIds]);

  const preamble: WorkflowTimelineStep[] = [
    {
      name: 'Created',
      status: 'completed',
      date: new Date(memo.created_at).toLocaleString(),
    },
    {
      name: 'Submitted',
      status: memo.submitted_at || (!draft && !withdrawn) ? 'completed' : 'pending',
      date: memo.submitted_at
        ? new Date(memo.submitted_at).toLocaleString()
        : undefined,
    },
  ];

  const approvalSteps: WorkflowTimelineStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let status: WorkflowTimelineStepStatus = 'pending';

    if (approved) {
      status = 'completed';
    } else if (rejected && pendingIdx >= 0 && i === pendingIdx) {
      status = 'rejected';
    } else if (returned && pendingIdx >= 0 && i === pendingIdx) {
      status = 'returned';
    } else if (pendingIdx < 0) {
      if (!draft && !withdrawn && memo.submitted_at) {
        status = i === 0 ? 'current' : 'pending';
      }
    } else if (i < pendingIdx) {
      status = 'completed';
    } else if (i === pendingIdx) {
      status = 'current';
    }

    const sig = sigByStep.get(i);
    let approver: string | undefined;
    let date: string | undefined;

    if (sig && (status === 'completed' || approved)) {
      approver = approverLine(
        userLabels,
        sig.approver_id,
        sig.approver_name,
        viewingUserId
      );
      date = new Date(sig.signed_at).toLocaleString();
    } else if (status === 'current' && memo.pending_assignee_id) {
      approver = approverLine(
        userLabels,
        memo.pending_assignee_id,
        memo.pending_assignee_name,
        viewingUserId
      );
    } else if (status === 'current' || status === 'pending') {
      const expectedId = expectedApproverIdByStep[i];
      approver = approverLine(userLabels, expectedId, null, viewingUserId);
    }

    approvalSteps.push({
      name: step.step_name,
      status,
      approver,
      date,
    });
  }

  const footer: WorkflowTimelineStep = {
    name: 'Approved',
    status: approved ? 'completed' : 'pending',
  };

  if (approved) {
    const ceoIdx = steps.findIndex((s) => s.role_slug === 'ceo');
    const lastSig =
      ceoIdx >= 0 ? sigByStep.get(ceoIdx) : sigByStep.get(steps.length - 1);
    if (lastSig) {
      footer.approver = approverLine(
        userLabels,
        lastSig.approver_id,
        lastSig.approver_name,
        viewingUserId
      );
      footer.date = new Date(lastSig.signed_at).toLocaleString();
    } else if (memo.approved_at) {
      footer.date = new Date(memo.approved_at).toLocaleString();
    }
  }

  return [...preamble, ...approvalSteps, footer];
}
