import { createServiceClient } from '@/lib/supabase/server';
import { getStatusForStep, getNextStepAfterStatus, isExcoWorkflow } from '@/lib/workflow/engine';
import { resolveWorkflow } from '@/lib/workflow/resolve';
import { startSlaTracking, resolveSlaTracking } from '@/lib/sla/service';
import { logAudit } from '@/lib/audit/logger';
import type { SubmitSideEffectsPayload } from '@/lib/memo/submitSideEffects';
import {
  notifyCtxFromMemo,
  type ApprovalSideEffectsPayload,
} from '@/lib/memo/approvalSideEffects';
import { findApproversForStep } from '@/lib/memo/approvers';
import { isDesignatedItFirstChecker } from '@/lib/workflow/itCheckers';
import { generateReferenceNumber } from './reference';
import { joinSlug } from '@/lib/auth/memoAccess';
import type { CreateMemoInput, ApprovalInput, MemoTypeSlug } from '@/types';

export async function createMemo(creatorId: string, departmentId: string, input: CreateMemoInput) {
  const supabase = createServiceClient();

  const year = new Date().getFullYear();
  const { data: seqData } = await supabase
    .from('memo_sequences')
    .select('last_sequence')
    .eq('year', year)
    .single();

  let nextSeq = (seqData?.last_sequence || 0) + 1;
  if (!seqData) {
    await supabase.from('memo_sequences').insert({ year, last_sequence: 1 });
    nextSeq = 1;
  } else {
    await supabase.from('memo_sequences').update({ last_sequence: nextSeq }).eq('year', year);
  }

  const referenceNumber = generateReferenceNumber(year, nextSeq);

  const { data: draftStatus } = await supabase
    .from('memo_statuses')
    .select('id')
    .eq('slug', 'draft')
    .single();

  const { data: memoType } = await supabase
    .from('memo_types')
    .select('slug')
    .eq('id', input.memo_type_id)
    .single();

  const workflow = await resolveWorkflow(input.memo_type_id, memoType?.slug as MemoTypeSlug, {
    requiresFinance: input.requires_finance,
    importanceLevel: input.importance_level,
  });

  const { data: workflowRecord } = await supabase
    .from('approval_workflows')
    .select('id')
    .eq('memo_type_id', input.memo_type_id)
    .eq('is_default', true)
    .single();

  const { data: memo, error } = await supabase
    .from('memos')
    .insert({
      reference_number: referenceNumber,
      memo_type_id: input.memo_type_id,
      status_id: draftStatus!.id,
      creator_id: creatorId,
      department_id: departmentId,
      workflow_id: workflowRecord?.id,
      memo_from: input.memo_from,
      memo_thru: input.memo_thru,
      memo_to: input.memo_to,
      memo_date: input.memo_date || new Date().toISOString().split('T')[0],
      subject: input.subject,
      background: input.background,
      financial_implication: input.financial_implication,
      justification: input.justification,
      recommendation: input.recommendation,
      requires_finance:
        memoType?.slug === 'it_request' ||
          memoType?.slug === 'marketing_request' ||
          memoType?.slug === 'finance_request'
          ? true
          : input.requires_finance || workflow.requires_finance || false,
      requires_exco: workflow.requires_exco || false,
      importance_level: input.importance_level || 'normal',
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('memo_versions').insert({
    memo_id: memo.id,
    version_number: 1,
    subject: input.subject,
    background: input.background,
    financial_implication: input.financial_implication,
    justification: input.justification,
    recommendation: input.recommendation,
    changed_by: creatorId,
    change_reason: 'Initial creation',
  });

  await logAudit({
    memoId: memo.id,
    userId: creatorId,
    action: 'memo_created',
    newValues: { reference_number: referenceNumber },
  });

  return memo;
}

export async function submitMemo(memoId: string, userId: string) {
  const supabase = createServiceClient();

  const { data: memo } = await supabase
    .from('memos')
    .select('*, memo_types(slug), memo_statuses(slug), creator:users!creator_id(full_name)')
    .eq('id', memoId)
    .single();

  if (!memo || memo.creator_id !== userId) throw new Error('Unauthorized');

  const currentStatus = joinSlug(
    memo.memo_statuses as { slug: string } | { slug: string }[] | null
  );
  const submitable = ['draft', 'returned', 'rejected'];
  if (!currentStatus || !submitable.includes(currentStatus)) {
    throw new Error('Memo cannot be submitted in current status');
  }

  const memoTypeSlug = joinSlug(
    memo.memo_types as { slug: string } | { slug: string }[] | null
  ) as MemoTypeSlug;
  if (!memoTypeSlug) {
    throw new Error('Memo type is missing. Save the memo and try again.');
  }

  const workflow = await resolveWorkflow(memo.memo_type_id, memoTypeSlug, {
    requiresFinance: memo.requires_finance,
    importanceLevel: memo.importance_level,
  });

  const firstStep = workflow.steps[0];
  const statusSlug = getStatusForStep(firstStep.role_slug);

  const { data: status } = await supabase
    .from('memo_statuses')
    .select('id')
    .eq('slug', statusSlug)
    .single();

  if (!status) {
    throw new Error(`Approval status "${statusSlug}" is not configured. Contact your administrator.`);
  }

  const { error: updateError } = await supabase
    .from('memos')
    .update({
      status_id: status.id,
      current_step_order: firstStep.step_order,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', memoId);

  if (updateError) throw updateError;

  const creator = memo.creator as { full_name?: string } | null;

  const sideEffects: SubmitSideEffectsPayload = {
    memoId,
    userId,
    departmentId: memo.department_id as string,
    memoTypeSlug,
    firstStep,
    notifyCtx: {
      referenceNumber: memo.reference_number,
      subject: memo.subject,
      memoFrom: memo.memo_from,
      actorName: creator?.full_name,
      stepName: firstStep.step_name || firstStep.role_slug.replace(/_/g, ' '),
    },
  };

  return { success: true, status: statusSlug, sideEffects };
}

export type ProcessApprovalResult = {
  status: string;
  partial?: boolean;
  sideEffects?: ApprovalSideEffectsPayload;
};

export async function processApproval(
  memoId: string,
  approverId: string,
  input: ApprovalInput
): Promise<ProcessApprovalResult> {
  const supabase = createServiceClient();

  const { data: approver } = await supabase
    .from('users')
    .select('*, roles(slug)')
    .eq('id', approverId)
    .single();

  if (!approver?.signature_path) {
    throw new Error('Signature required before approval. Please upload your signature.');
  }

  const { data: memo } = await supabase
    .from('memos')
    .select('*, memo_types(slug), memo_statuses(slug)')
    .eq('id', memoId)
    .single();

  if (!memo) throw new Error('Memo not found');

  if (input.action === 'reject' && !input.comments) {
    throw new Error('Rejection reason is required');
  }
  if (input.action === 'return' && !input.comments) {
    throw new Error('Return comments are required');
  }

  const delegation = await getActiveDelegation(approverId);

  if (input.action === 'reject') {
    const { data: rejectedStatus } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'rejected')
      .single();

    await supabase
      .from('memos')
      .update({
        status_id: rejectedStatus!.id,
        rejection_reason: input.comments,
      })
      .eq('id', memoId);

    await resolveSlaTracking(memoId);
    const rejectCtx = notifyCtxFromMemo(memo, approver);
    return {
      status: 'rejected',
      sideEffects: {
        memoId,
        approverId,
        audit: { action: 'memo_rejected', newValues: { reason: input.comments } },
        notifications: [
          {
            kind: 'single',
            userId: memo.creator_id,
            type: 'memo_rejected',
            context: rejectCtx,
            comments: input.comments,
            title: 'Memo Rejected',
            message: `Your memo ${memo.reference_number} has been rejected. Reason: ${input.comments}`,
          },
        ],
      },
    };
  }

  if (input.action === 'return') {
    const { data: returnedStatus } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'returned')
      .single();

    await supabase
      .from('memos')
      .update({ status_id: returnedStatus!.id })
      .eq('id', memoId);

    await resolveSlaTracking(memoId);
    const returnCtx = notifyCtxFromMemo(memo, approver);
    return {
      status: 'returned',
      sideEffects: {
        memoId,
        approverId,
        audit: { action: 'memo_returned', newValues: { comments: input.comments } },
        notifications: [
          {
            kind: 'single',
            userId: memo.creator_id,
            type: 'memo_returned',
            context: returnCtx,
            comments: input.comments,
            title: 'Memo Returned for Correction',
            message: `Your memo ${memo.reference_number} has been returned. ${input.comments}`,
          },
        ],
      },
    };
  }

  // Approve
  const delegationNote = delegation
    ? `Approved by ${approver.full_name} on behalf of ${delegation.original_name}`
    : undefined;

  await supabase.from('signature_records').insert({
    memo_id: memoId,
    approver_id: approverId,
    approver_name: approver.full_name,
    approver_title: approver.title,
    signature_path: approver.signature_path,
    block_type: resolveApprovalBlockType(approver, memo),
    delegated_from_id: delegation?.original_approver_id,
    delegation_note: delegationNote,
  });

  const memoTypeSlug = joinSlug(
    memo.memo_types as { slug: string } | { slug: string }[] | null
  ) as MemoTypeSlug;
  const currentStatusSlug = joinSlug(
    memo.memo_statuses as { slug: string } | { slug: string }[] | null
  );

  const workflow = await resolveWorkflow(memo.memo_type_id, memoTypeSlug, {
    requiresFinance: memo.requires_finance,
    importanceLevel: memo.importance_level,
  });

  if (isExcoWorkflow(workflow) || currentStatusSlug === 'pending_exco') {
    return processExcoApproval(supabase, memo, approver, input);
  }

  const nextStep = getNextStepAfterStatus(
    workflow,
    currentStatusSlug,
    memo.current_step_order ?? 0
  );

  if (!nextStep) {
    const { data: approvedStatus } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'approved')
      .single();

    await supabase
      .from('memos')
      .update({
        status_id: approvedStatus!.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', memoId);

    await resolveSlaTracking(memoId);
    const approvedCtx = notifyCtxFromMemo(memo, approver);
    return {
      status: 'approved',
      sideEffects: {
        memoId,
        approverId,
        audit: { action: 'memo_approved' },
        notifications: [
          {
            kind: 'single',
            userId: memo.creator_id,
            type: 'memo_fully_approved',
            context: approvedCtx,
            title: 'Memo Fully Approved',
            message: `Your memo ${memo.reference_number} has been fully approved.`,
          },
        ],
      },
    };
  }

  const statusSlug = getStatusForStep(nextStep.role_slug);
  const { data: nextStatus } = await supabase
    .from('memo_statuses')
    .select('id')
    .eq('slug', statusSlug)
    .single();

  await supabase
    .from('memos')
    .update({
      status_id: nextStatus!.id,
      current_step_order: nextStep.step_order,
    })
    .eq('id', memoId);

  const approverIds = await findApproversForStep(
    nextStep.role_slug,
    memo.department_id,
    memoTypeSlug,
    nextStep.step_order
  );
  await resolveSlaTracking(memoId);
  await startSlaTracking(memoId, nextStep.step_order, nextStep.role_slug, approverIds[0] ?? null);

  const routeCtx = notifyCtxFromMemo(memo, approver, {
    stepName: nextStep.step_name || nextStep.role_slug.replace(/_/g, ' '),
  });

  return {
    status: statusSlug,
    sideEffects: {
      memoId,
      approverId,
      audit: { action: 'memo_approved' },
      notifications: [
        {
          kind: 'approvers',
          userIds: approverIds,
          type: 'memo_routed',
          context: routeCtx,
        },
      ],
    },
  };
}

async function processExcoApproval(
  supabase: ReturnType<typeof createServiceClient>,
  memo: Record<string, unknown>,
  approver: { id: string; full_name: string; title?: string | null; signature_path?: string | null },
  input: ApprovalInput
): Promise<ProcessApprovalResult> {
  const approverId = approver.id;
  const memoId = memo.id as string;

  const { data: excoMember } = await supabase
    .from('exco_members')
    .select('id')
    .eq('user_id', approverId)
    .single();

  if (!excoMember) throw new Error('Not an EXCO member');

  await supabase.from('exco_approvals').upsert({
    memo_id: memoId,
    exco_member_id: excoMember.id,
    approver_id: approverId,
    action: 'approve',
    comments: input.comments,
    signed_at: new Date().toISOString(),
  });

  const { data: allExco } = await supabase.from('exco_members').select('id').eq('is_active', true);
  const { data: approvals } = await supabase
    .from('exco_approvals')
    .select('action')
    .eq('memo_id', memoId)
    .eq('action', 'approve');

  if ((approvals?.length || 0) >= (allExco?.length || 4)) {
    const { data: approvedStatus } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'approved')
      .single();

    await supabase
      .from('memos')
      .update({
        status_id: approvedStatus!.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', memoId);

    await resolveSlaTracking(memoId);
    const approvedCtx = notifyCtxFromMemo(
      memo as { reference_number: string; subject?: string | null; memo_from?: string | null },
      approver
    );
    return {
      status: 'approved',
      sideEffects: {
        memoId,
        approverId,
        audit: { action: 'memo_approved' },
        notifications: [
          {
            kind: 'single',
            userId: memo.creator_id as string,
            type: 'memo_fully_approved',
            context: approvedCtx,
            title: 'Memo Fully Approved',
            message: `Your memo ${approvedCtx.referenceNumber} has been fully approved by EXCO.`,
          },
        ],
      },
    };
  }

  const pendingExcoIds = await findApproversForStep('exco_member', memo.department_id as string);
  const alreadyApproved = await supabase
    .from('exco_approvals')
    .select('approver_id')
    .eq('memo_id', memoId)
    .eq('action', 'approve');
  const doneIds = new Set((alreadyApproved.data || []).map((r) => r.approver_id));
  const remaining = pendingExcoIds.filter((id) => !doneIds.has(id) && id !== approverId);

  const sideEffects: ApprovalSideEffectsPayload = {
    memoId,
    approverId,
    audit: { action: 'memo_approved' },
    notifications: [],
  };

  if (remaining.length > 0) {
    const excoCtx = notifyCtxFromMemo(
      memo as { reference_number: string; subject?: string | null; memo_from?: string | null },
      approver,
      { stepName: 'EXCO parallel approval' }
    );
    sideEffects.notifications.push({
      kind: 'approvers',
      userIds: remaining,
      type: 'memo_routed',
      context: excoCtx,
    });
  }

  return { status: 'pending_exco', partial: true, sideEffects };
}

async function getActiveDelegation(approverId: string) {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('delegations')
    .select('*, original:users!original_approver_id(full_name)')
    .eq('delegated_to_id', approverId)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .single();

  if (!data) return null;
  return {
    original_approver_id: data.original_approver_id,
    original_name: (data.original as { full_name: string })?.full_name,
  };
}

async function ensureCreatorPreparedSignature(memoId: string, creatorId: string) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('signature_records')
    .select('id')
    .eq('memo_id', memoId)
    .eq('block_type', 'prepared')
    .maybeSingle();

  if (existing) return;

  const { data: creator } = await supabase
    .from('users')
    .select('full_name, title, signature_path')
    .eq('id', creatorId)
    .single();

  if (!creator?.signature_path) return;

  await supabase.from('signature_records').insert({
    memo_id: memoId,
    approver_id: creatorId,
    approver_name: creator.full_name,
    approver_title: creator.title,
    signature_path: creator.signature_path,
    block_type: 'prepared',
  });
}

function resolveApprovalBlockType(
  approver: {
    email?: string;
    roles: { slug: string } | { slug: string }[];
  },
  memo: {
    memo_types?: { slug: string } | { slug: string }[];
    memo_statuses?: { slug: string } | { slug: string }[];
  }
): 'prepared' | 'checked' | 'reviewed' | 'approved' {
  const roleSlug = joinSlug(approver.roles as { slug: string } | { slug: string }[] | null) || '';
  const memoTypeSlug = joinSlug(memo.memo_types as { slug: string } | { slug: string }[] | null);
  const statusSlug = joinSlug(memo.memo_statuses as { slug: string } | { slug: string }[] | null);

  if (
    roleSlug === 'admin' &&
    isDesignatedItFirstChecker(approver) &&
    memoTypeSlug === 'it_request' &&
    statusSlug === 'pending_it_checker_first'
  ) {
    return 'checked';
  }

  return mapRoleToBlockType(roleSlug);
}

function mapRoleToBlockType(roleSlug: string): 'prepared' | 'checked' | 'reviewed' | 'approved' {
  const map: Record<string, 'prepared' | 'checked' | 'reviewed' | 'approved'> = {
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

export async function withdrawMemo(memoId: string, userId: string, reason: string) {
  if (!reason) throw new Error('Withdrawal reason is required');

  const supabase = createServiceClient();
  const { data: memo } = await supabase.from('memos').select('*').eq('id', memoId).single();

  if (!memo || memo.creator_id !== userId) throw new Error('Unauthorized');
  if (memo.approved_at) throw new Error('Cannot withdraw approved memo');

  const { data: withdrawnStatus } = await supabase
    .from('memo_statuses')
    .select('id')
    .eq('slug', 'withdrawn')
    .single();

  await supabase
    .from('memos')
    .update({
      status_id: withdrawnStatus!.id,
      withdrawal_reason: reason,
    })
    .eq('id', memoId);

  await resolveSlaTracking(memoId);
  await logAudit({
    memoId,
    userId,
    action: 'memo_withdrawn',
    newValues: { reason },
  });

  return { success: true };
}
