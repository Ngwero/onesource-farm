import {
  CEO_APPROVER_EMAIL,
  CHAIRMAN_APPROVER_EMAIL,
  isCeoMemoCreator,
} from '@/lib/memo/designatedUsers';
import type { WorkflowDefinition, WorkflowStep } from '@/lib/workflow/engine';
import { resolveFinanceRequestSubmitStep } from '@/lib/workflow/financeWorkflowSteps';

/** CEO memos: Rowena creates → Douglas (Chairman) approves. */
export const CEO_MEMO_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'ceo',
    step_name: 'Chairman Approval',
    is_parallel: false,
    sla_hours: 72,
  },
];

export function resolveCeoApproverEmail(creatorEmail?: string | null): string {
  if (isCeoMemoCreator({ email: creatorEmail })) {
    return CHAIRMAN_APPROVER_EMAIL;
  }
  return CEO_APPROVER_EMAIL;
}

export function workflowForCeoCreator(
  workflow: WorkflowDefinition,
  _memoTypeSlug?: string,
  creatorEmail?: string | null
): WorkflowDefinition {
  if (!isCeoMemoCreator({ email: creatorEmail })) return workflow;
  return {
    name: 'CEO Memo — Chairman Approval',
    steps: CEO_MEMO_APPROVAL_STEPS.map((s) => ({ ...s, is_parallel: false })),
  };
}

export function resolveSubmitStepForCreator(
  workflow: WorkflowDefinition,
  creatorEmail?: string | null
): WorkflowStep {
  if (isCeoMemoCreator({ email: creatorEmail })) {
    return CEO_MEMO_APPROVAL_STEPS[0];
  }
  return resolveFinanceRequestSubmitStep(workflow, creatorEmail);
}
