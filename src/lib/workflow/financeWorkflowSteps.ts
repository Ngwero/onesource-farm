import { emailsMatch } from '@/lib/memo/designatedUsers';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '@/lib/workflow/interdeptFinanceReviewer';
import type { WorkflowDefinition, WorkflowStep } from '@/lib/workflow/engine';

/** Finance Request: finance review → CEO (Amara when Christine authors; Christine for other authors). */
export const FINANCE_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review (Amara - CFO)',
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
export const FINANCE_MEMO_APPROVER_EMAIL = 'christine.kangume@rukapay.co.ug';
export const FINANCE_DEPT_HEAD_EMAIL = 'amara.oto@rukapay.co.ug';

export function isFinanceRequestCreator(
  user: { email?: string | null } | null | undefined
): boolean {
  return emailsMatch(user?.email ?? undefined, FINANCE_MEMO_CREATOR_EMAIL);
}

/**
 * Primary finance reviewer email (used for display/SLA primary).
 * Christine's own Finance Requests go to Amara; otherwise Christine.
 */
export function resolveFinanceReviewerEmail(
  memoTypeSlug?: string,
  creatorEmail?: string | null
): string {
  return resolveFinanceReviewerEmails(memoTypeSlug, creatorEmail)[0];
}

/**
 * Who may complete the finance step.
 * - Christine's Finance Request → Amara only (she cannot approve her own).
 * - All other finance steps → Christine and Amara (either may approve).
 */
export function resolveFinanceReviewerEmails(
  memoTypeSlug?: string,
  creatorEmail?: string | null
): string[] {
  if (
    memoTypeSlug === 'finance_request' &&
    emailsMatch(creatorEmail ?? undefined, FINANCE_MEMO_CREATOR_EMAIL)
  ) {
    return [FINANCE_DEPT_HEAD_EMAIL];
  }
  return [INTERDEPT_FINANCE_REVIEWER_EMAIL, FINANCE_DEPT_HEAD_EMAIL];
}

export function workflowForFinanceCreator(
  workflow: WorkflowDefinition,
  _memoTypeSlug?: string,
  _creatorEmail?: string | null
): WorkflowDefinition {
  return workflow;
}

export function resolveFinanceRequestSubmitStep(
  workflow: WorkflowDefinition,
  _creatorEmail?: string | null
): WorkflowStep {
  const steps = [...workflow.steps].sort((a, b) => a.step_order - b.step_order);
  return steps[0];
}
