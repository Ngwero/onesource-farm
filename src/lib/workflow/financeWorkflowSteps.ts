import { emailsMatch } from '@/lib/memo/designatedUsers';
import {
  sortedWorkflowSteps,
  type WorkflowDefinition,
  type WorkflowStep,
} from '@/lib/workflow/engine';

/** Finance Request (from finance dept): Christine → CEO */
export const FINANCE_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review (Christine)',
    is_parallel: false,
    sla_hours: 48,
  },
  {
    step_order: 2,
    role_slug: 'ceo',
    step_name: 'CEO Approval',
    is_parallel: false,
    sla_hours: 72,
  },
];

export const FINANCE_MEMO_CREATOR_EMAIL = 'christine.kangume@rukapay.co.ug';
/** Finance step approver for all memo types (including Finance Request). */
export const FINANCE_MEMO_APPROVER_EMAIL = 'christine.kangume@rukapay.co.ug';
export const FINANCE_DEPT_HEAD_EMAIL = 'amara.oto@rukapay.co.ug';

/** Christine's Finance Request memos skip finance review and go straight to the CEO. */
export function financeRequestSkipsFinanceReview(
  creatorEmail: string | null | undefined
): boolean {
  return emailsMatch(creatorEmail ?? undefined, FINANCE_MEMO_CREATOR_EMAIL);
}

export function isFinanceRequestCreator(
  user: { email?: string | null } | null | undefined
): boolean {
  return financeRequestSkipsFinanceReview(user?.email);
}

export function workflowForFinanceCreator(
  workflow: WorkflowDefinition,
  memoTypeSlug: string | undefined,
  creatorEmail: string | null | undefined
): WorkflowDefinition {
  if (memoTypeSlug !== 'finance_request' || !financeRequestSkipsFinanceReview(creatorEmail)) {
    return workflow;
  }
  return {
    ...workflow,
    steps: sortedWorkflowSteps(workflow).filter((s) => s.role_slug !== 'finance_reviewer'),
  };
}

export function resolveFinanceRequestSubmitStep(
  workflow: WorkflowDefinition,
  creatorEmail: string | null | undefined
): WorkflowStep {
  const steps = sortedWorkflowSteps(workflow);
  if (financeRequestSkipsFinanceReview(creatorEmail)) {
    const ceoStep = steps.find((s) => s.role_slug === 'ceo');
    if (ceoStep) return ceoStep;
  }
  return steps[0];
}
