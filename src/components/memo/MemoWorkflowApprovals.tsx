'use client';

import {
  workflowStepsForDocumentApprovals,
  type WorkflowTimelineStep,
} from '@/lib/memo/workflowTimeline';

type MemoWorkflowApprovalsProps = {
  steps: WorkflowTimelineStep[];
};

export function MemoWorkflowApprovals({ steps }: MemoWorkflowApprovalsProps) {
  const approvalSteps = workflowStepsForDocumentApprovals(steps);
  if (approvalSteps.length === 0) return null;

  return (
    <section className="memo-doc-approvals" aria-label="Approvals">
      <h2 className="memo-doc-approvals-heading">Approvals</h2>
      <div className="memo-doc-workflow-approvals">
        {approvalSteps.map((step, index) => (
          <div
            key={`${step.name}-${index}`}
            className={`memo-doc-workflow-row${
              step.status === 'completed' ? ' memo-doc-workflow-row--done' : ''
            }`}
          >
            <p className="memo-doc-workflow-row__role">{step.name}</p>
            <p
              className={`memo-doc-workflow-row__name${
                step.approver ? '' : ' memo-doc-workflow-row__name--pending'
              }`}
            >
              {step.approver || 'Pending'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
