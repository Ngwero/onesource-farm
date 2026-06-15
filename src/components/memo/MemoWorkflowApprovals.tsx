'use client';

import type { Memo } from '@/types';
import { SignatureImage } from '@/components/memo/SignatureImage';
import { formatSignerLine } from '@/lib/memo/coverLetterDefaults';
import {
  resolveSignatureForBlock,
  type SignatureRecordForDisplay,
} from '@/lib/memo/signatureBlocks';
import {
  workflowStepsForDocumentApprovals,
  type WorkflowTimelineStep,
} from '@/lib/memo/workflowTimelineTypes';

type MemoWorkflowApprovalsProps = {
  steps: WorkflowTimelineStep[];
  memo: Memo;
};

function SignatureSlot({ path, label }: { path?: string; label: string }) {
  if (!path) {
    return <div className="memo-doc-workflow-row__sig memo-doc-workflow-row__sig--empty" aria-hidden />;
  }
  return (
    <div className="memo-doc-workflow-row__sig">
      <SignatureImage src={`/api/files/${path}`} alt={`${label} signature`} />
    </div>
  );
}

function ApprovalRow({
  role,
  displayName,
  signaturePath,
  done,
}: {
  role: string;
  displayName?: string;
  signaturePath?: string;
  done?: boolean;
}) {
  return (
    <div
      className={`memo-doc-workflow-row${done ? ' memo-doc-workflow-row--done' : ''}`}
    >
      <p className="memo-doc-workflow-row__role">{role}</p>
      <p
        className={`memo-doc-workflow-row__name${
          displayName ? '' : ' memo-doc-workflow-row__name--pending'
        }`}
      >
        {displayName || 'Pending'}
      </p>
      <SignatureSlot path={signaturePath} label={role} />
    </div>
  );
}

export function MemoWorkflowApprovals({ steps, memo }: MemoWorkflowApprovalsProps) {
  const approvalSteps = workflowStepsForDocumentApprovals(steps);
  const signatures = (memo.signature_records || []) as SignatureRecordForDisplay[];

  const preparedSig = resolveSignatureForBlock('prepared', signatures, {
    creator_id: memo.creator_id,
    creator: memo.creator
      ? {
          id: memo.creator.id,
          full_name: memo.creator.full_name,
          title: memo.creator.title,
          signature_path: memo.creator.signature_path,
        }
      : null,
    submitted_at: memo.submitted_at,
    updated_at: memo.updated_at,
    created_at: memo.created_at,
  });

  const preparedDisplayName = preparedSig
    ? formatSignerLine(preparedSig.approver_name, preparedSig.approver_title)
    : memo.creator?.full_name
      ? formatSignerLine(memo.creator.full_name, memo.creator.title)
      : undefined;
  const preparedSignature = preparedSig?.signature_path?.trim() || undefined;

  if (approvalSteps.length === 0 && !preparedDisplayName) return null;

  return (
    <section className="memo-doc-approvals" aria-label="Approvals">
      <h2 className="memo-doc-approvals-heading">Approvals</h2>
      <div className="memo-doc-workflow-approvals">
        <ApprovalRow
          role="Prepared By"
          displayName={preparedDisplayName}
          signaturePath={preparedSignature}
          done={Boolean(preparedDisplayName)}
        />
        {approvalSteps.map((step, index) => (
          <ApprovalRow
            key={`${step.name}-${index}`}
            role={step.name}
            displayName={step.approver}
            signaturePath={step.signature_path}
            done={step.status === 'completed'}
          />
        ))}
      </div>
    </section>
  );
}
