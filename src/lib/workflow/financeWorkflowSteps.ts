import { emailsMatch } from '@/lib/memo/designatedUsers';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '@/lib/workflow/interdeptFinanceReviewer';
import type { WorkflowDefinition, WorkflowStep } from '@/lib/workflow/engine';

/** Finance Request: finance review → CEO. */
export const FINANCE_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review',
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

/** Optional designated finance creator / approver emails — empty until assigned. */
export const FINANCE_MEMO_CREATOR_EMAIL: string = '';
export const FINANCE_MEMO_APPROVER_EMAIL: string = '';
export const FINANCE_DEPT_HEAD_EMAIL: string = '';

export function isFinanceRequestCreator(
  user: { email?: string | null } | null | undefined
): boolean {
  return emailsMatch(user?.email ?? undefined, FINANCE_MEMO_CREATOR_EMAIL);
}

/**
 * Primary finance reviewer email (used for display/SLA primary).
 */
export function resolveFinanceReviewerEmail(
  memoTypeSlug?: string,
  creatorEmail?: string | null
): string {
  return resolveFinanceReviewerEmails(memoTypeSlug, creatorEmail)[0] ?? '';
}

/**
 * Who may complete the finance step by designated email.
 * Empty list → routing falls back to users with finance_reviewer role.
 */
export function resolveFinanceReviewerEmails(
  memoTypeSlug?: string,
  creatorEmail?: string | null
): string[] {
  if (
    memoTypeSlug === 'finance_request' &&
    FINANCE_MEMO_CREATOR_EMAIL &&
    emailsMatch(creatorEmail ?? undefined, FINANCE_MEMO_CREATOR_EMAIL) &&
    FINANCE_DEPT_HEAD_EMAIL
  ) {
    return [FINANCE_DEPT_HEAD_EMAIL];
  }
  return [INTERDEPT_FINANCE_REVIEWER_EMAIL, FINANCE_DEPT_HEAD_EMAIL].filter(Boolean);
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
