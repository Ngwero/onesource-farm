import type { MemoTypeSlug, MemoStatusSlug, ImportanceLevel } from '@/types';
import { HR_REQUEST_APPROVAL_STEPS } from '@/lib/workflow/hrWorkflowSteps';
import { IT_REQUEST_APPROVAL_STEPS } from '@/lib/workflow/itWorkflowSteps';
import { FINANCE_REQUEST_APPROVAL_STEPS } from '@/lib/workflow/financeWorkflowSteps';
import { MARKETING_REQUEST_APPROVAL_STEPS } from '@/lib/workflow/marketingWorkflowSteps';
import { LEAVE_REQUEST_APPROVAL_STEPS } from '@/lib/workflow/leaveWorkflowSteps';

export interface WorkflowStep {
  step_order: number;
  role_slug: string;
  step_name: string;
  is_parallel: boolean;
  sla_hours: number;
}

export interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
  requires_exco?: boolean;
  requires_finance?: boolean;
}

const DEFAULT_WORKFLOWS: Record<MemoTypeSlug, WorkflowDefinition> = {
  payment_request: {
    name: 'Payment Request',
    requires_finance: true,
    steps: [
      { step_order: 1, role_slug: 'department_head', step_name: 'Department Head', is_parallel: false, sla_hours: 24 },
      { step_order: 2, role_slug: 'finance_reviewer', step_name: 'Finance Review', is_parallel: false, sla_hours: 48 },
      { step_order: 3, role_slug: 'ceo', step_name: 'CEO Approval', is_parallel: false, sla_hours: 72 },
    ],
  },
  procurement_request: {
    name: 'Procurement Request',
    requires_finance: true,
    steps: [
      { step_order: 1, role_slug: 'department_head', step_name: 'Department Head', is_parallel: false, sla_hours: 24 },
      { step_order: 2, role_slug: 'finance_reviewer', step_name: 'Finance Review', is_parallel: false, sla_hours: 48 },
      { step_order: 3, role_slug: 'ceo', step_name: 'CEO Approval', is_parallel: false, sla_hours: 72 },
    ],
  },
  hr_request: {
    name: 'HR Request',
    steps: HR_REQUEST_APPROVAL_STEPS.map((s) => ({ ...s })),
  },
  leave_request: {
    name: 'Leave Request',
    steps: LEAVE_REQUEST_APPROVAL_STEPS.map((s) => ({ ...s })),
  },
  it_request: {
    name: 'IT Request',
    requires_finance: true,
    steps: IT_REQUEST_APPROVAL_STEPS.map((s) => ({ ...s })),
  },
  marketing_request: {
    name: 'Marketing Request',
    requires_finance: true,
    steps: MARKETING_REQUEST_APPROVAL_STEPS.map((s) => ({ ...s })),
  },
  finance_request: {
    name: 'Finance Request',
    requires_finance: true,
    steps: FINANCE_REQUEST_APPROVAL_STEPS.map((s) => ({ ...s })),
  },
  general_internal: {
    name: 'General Internal Memo',
    requires_finance: true,
    steps: [
      { step_order: 1, role_slug: 'department_head', step_name: 'Department Head', is_parallel: false, sla_hours: 24 },
      { step_order: 2, role_slug: 'finance_reviewer', step_name: 'Finance Review', is_parallel: false, sla_hours: 48 },
      { step_order: 3, role_slug: 'ceo', step_name: 'CEO Approval', is_parallel: false, sla_hours: 72 },
    ],
  },
};

const ROLE_TO_STATUS: Record<string, MemoStatusSlug> = {
  department_head: 'pending_department_head',
  business_head: 'pending_business_head',
  it_checker_first: 'pending_it_checker_first',
  it_checker_second: 'pending_it_checker_second',
  finance_reviewer: 'pending_finance',
  hr_reviewer: 'pending_hr',
  ceo: 'pending_ceo',
  exco_member: 'pending_exco',
};

/** Pending status → workflow role (inverse of ROLE_TO_STATUS). */
export const PENDING_STATUS_TO_ROLE: Record<string, string> = {
  pending_department_head: 'department_head',
  pending_business_head: 'business_head',
  pending_it_checker_first: 'it_checker_first',
  pending_it_checker_second: 'it_checker_second',
  pending_it_review: 'it_checker_second',
  pending_finance: 'finance_reviewer',
  pending_hr: 'hr_reviewer',
  pending_ceo: 'ceo',
  pending_exco: 'exco_member',
};

export const IT_REQUEST_ROLE_SEQUENCE = [
  'it_checker_first',
  'it_checker_second',
  'finance_reviewer',
  'ceo',
] as const;

export function sortedWorkflowSteps(workflow: WorkflowDefinition): WorkflowStep[] {
  return [...workflow.steps].sort((a, b) => a.step_order - b.step_order);
}

export function isCanonicalItWorkflow(workflow: WorkflowDefinition): boolean {
  const roles = sortedWorkflowSteps(workflow).map((s) => s.role_slug);
  return (
    roles.length === IT_REQUEST_ROLE_SEQUENCE.length &&
    roles.every((role, i) => role === IT_REQUEST_ROLE_SEQUENCE[i])
  );
}

export function getWorkflowForMemoType(
  memoTypeSlug: MemoTypeSlug,
  options?: { requiresFinance?: boolean; importanceLevel?: ImportanceLevel }
): WorkflowDefinition {
  const base = { ...DEFAULT_WORKFLOWS[memoTypeSlug] };
  const steps = [...base.steps];

  if (memoTypeSlug === 'general_internal' && options?.importanceLevel === 'exco') {
    return {
      name: 'EXCO Approval',
      requires_exco: true,
      steps: [
        {
          step_order: 1,
          role_slug: 'exco_member',
          step_name: 'EXCO Parallel Approval',
          is_parallel: true,
          sla_hours: 72,
        },
      ],
    };
  }

  return { ...base, steps };
}

export function getStatusForStep(roleSlug: string): MemoStatusSlug {
  return ROLE_TO_STATUS[roleSlug] || 'submitted';
}

export function getWorkflowStepByOrder(
  workflow: WorkflowDefinition,
  stepOrder: number
): WorkflowStep | null {
  return workflow.steps.find((step) => step.step_order === stepOrder) ?? null;
}

export function getNextStep(
  workflow: WorkflowDefinition,
  currentStepOrder: number,
  options?: { skipFinance?: boolean }
): WorkflowStep | null {
  let steps = workflow.steps.filter((s) => s.step_order > currentStepOrder);
  if (options?.skipFinance) {
    steps = steps.filter((s) => s.role_slug !== 'finance_reviewer');
  }
  return steps.sort((a, b) => a.step_order - b.step_order)[0] || null;
}

/**
 * Next step from the memo's current pending status (preferred over step_order alone).
 * Avoids skipping steps when current_step_order is out of sync with status.
 */
export function getNextStepAfterStatus(
  workflow: WorkflowDefinition,
  statusSlug: string | undefined,
  currentStepOrder: number,
  options?: { skipFinance?: boolean }
): WorkflowStep | null {
  const sorted = sortedWorkflowSteps(workflow);
  const currentRole = statusSlug ? PENDING_STATUS_TO_ROLE[statusSlug] : undefined;

  if (currentRole) {
    const idx = sorted.findIndex((s) => s.role_slug === currentRole);
    if (idx >= 0) {
      let remaining = sorted.slice(idx + 1);
      if (options?.skipFinance) {
        remaining = remaining.filter((s) => s.role_slug !== 'finance_reviewer');
      }
      return remaining[0] || null;
    }
  }

  return getNextStep(workflow, currentStepOrder, options);
}

export function isExcoWorkflow(workflow: WorkflowDefinition): boolean {
  return workflow.requires_exco === true ||
    workflow.steps.some((s) => s.is_parallel && s.role_slug === 'exco_member');
}

export function allExcoApproved(
  excoApprovals: { action: string }[],
  requiredCount: number
): boolean {
  const approved = excoApprovals.filter((a) => a.action === 'approve').length;
  return approved >= requiredCount;
}
