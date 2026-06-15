/** Client-safe workflow timeline types and display helpers (no server imports). */

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
  approver_title?: string;
  date?: string;
  note?: string;
  signature_path?: string;
}

const DOCUMENT_APPROVAL_SKIP = new Set(['Created', 'Submitted', 'Approved']);

/** Workflow steps shown on the memo document approvals section (roles + names only). */
export function workflowStepsForDocumentApprovals(
  steps: WorkflowTimelineStep[]
): WorkflowTimelineStep[] {
  return steps.filter((step) => !DOCUMENT_APPROVAL_SKIP.has(step.name));
}
