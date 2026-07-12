'use client';

import { CheckCircle, RotateCcw, XCircle } from 'lucide-react';
import { SignatureRequiredNotice } from '@/components/memo/SignatureRequiredNotice';

type ApprovalAction = 'approve' | 'return' | 'reject';

type MemoApprovalActionsProps = {
  showApproval: boolean;
  setShowApproval: (show: boolean) => void;
  approvalAction: ApprovalAction;
  setApprovalAction: (action: ApprovalAction) => void;
  approvalComments: string;
  setApprovalComments: (comments: string) => void;
  actionLoading: boolean;
  onConfirm: () => void;
  needsSignatureReminder?: boolean;
};

function ApprovalForm({
  approvalAction,
  approvalComments,
  setApprovalComments,
  actionLoading,
  onConfirm,
  onCancel,
  needsSignatureReminder = false,
  className = '',
}: {
  approvalAction: ApprovalAction;
  approvalComments: string;
  setApprovalComments: (comments: string) => void;
  actionLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  needsSignatureReminder?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-sm font-medium capitalize">{approvalAction} memo</p>
      {needsSignatureReminder && approvalAction === 'approve' ? (
        <SignatureRequiredNotice variant="approve" compact />
      ) : null}
      <textarea
        value={approvalComments}
        onChange={(e) => setApprovalComments(e.target.value)}
        placeholder={
          approvalAction === 'approve' ? 'Optional comments…' : 'Required comments…'
        }
        className="input-field min-h-[88px] text-base sm:text-sm"
      />
      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary w-full sm:w-auto min-h-[44px]">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={actionLoading}
          className="btn-primary flex-1 min-h-[44px]"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function ActionButtons({
  onSelect,
  compact = false,
}: {
  onSelect: (action: ApprovalAction) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1'}`}>
      <button
        type="button"
        onClick={() => onSelect('approve')}
        aria-label="Approve"
        className={`btn-primary flex items-center justify-center gap-2 min-h-[44px] ${
          compact ? 'text-sm px-2' : 'w-full'
        }`}
      >
        <CheckCircle size={compact ? 18 : 16} />
        <span className={compact ? 'hidden min-[380px]:inline' : undefined}>Approve</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect('return')}
        aria-label="Return for correction"
        className={`btn-secondary flex items-center justify-center gap-2 min-h-[44px] ${
          compact ? 'text-sm px-2' : 'w-full'
        }`}
      >
        <RotateCcw size={compact ? 18 : 16} />
        <span className={compact ? 'hidden min-[380px]:inline' : undefined}>
          {compact ? 'Return' : 'Return for Correction'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onSelect('reject')}
        aria-label="Reject"
        className={`btn-danger flex items-center justify-center gap-2 min-h-[44px] ${
          compact ? 'text-sm px-2' : 'w-full'
        }`}
      >
        <XCircle size={compact ? 18 : 16} />
        <span className={compact ? 'hidden min-[380px]:inline' : undefined}>Reject</span>
      </button>
    </div>
  );
}

export function MemoApprovalActions({
  showApproval,
  setShowApproval,
  approvalAction,
  setApprovalAction,
  approvalComments,
  setApprovalComments,
  actionLoading,
  onConfirm,
  needsSignatureReminder = false,
}: MemoApprovalActionsProps) {
  function openAction(action: ApprovalAction) {
    setApprovalAction(action);
    setShowApproval(true);
  }

  function closeApproval() {
    setShowApproval(false);
  }

  return (
    <>
      <div className="hidden xl:block card p-4">
        <h3 className="font-semibold mb-3">Approval Actions</h3>
        {needsSignatureReminder ? (
          <SignatureRequiredNotice variant="approve" compact />
        ) : null}
        {!showApproval ? (
          <ActionButtons onSelect={openAction} />
        ) : (
          <ApprovalForm
            approvalAction={approvalAction}
            approvalComments={approvalComments}
            setApprovalComments={setApprovalComments}
            actionLoading={actionLoading}
            onConfirm={onConfirm}
            onCancel={closeApproval}
            needsSignatureReminder={needsSignatureReminder}
          />
        )}
      </div>

      <div className="xl:hidden memo-approval-bar" aria-label="Approval actions">
        {showApproval ? (
          <>
            <button
              type="button"
              className="memo-approval-bar__backdrop"
              aria-label="Close approval form"
              onClick={closeApproval}
            />
            <div className="memo-approval-bar__sheet" role="dialog" aria-modal="true">
              <ApprovalForm
                approvalAction={approvalAction}
                approvalComments={approvalComments}
                setApprovalComments={setApprovalComments}
                actionLoading={actionLoading}
                onConfirm={onConfirm}
                onCancel={closeApproval}
                needsSignatureReminder={needsSignatureReminder}
              />
            </div>
          </>
        ) : (
          <div className="memo-approval-bar__actions">
            {needsSignatureReminder ? (
              <div className="px-3 pb-2">
                <SignatureRequiredNotice variant="approve" compact />
              </div>
            ) : null}
            <ActionButtons onSelect={openAction} compact />
          </div>
        )}
      </div>
    </>
  );
}
