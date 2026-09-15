'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api/client';
import { canApproveMemo } from '@/lib/auth/rbac';
import { joinSlug, rowToMemoForAccess } from '@/lib/auth/memoRbacShape';
import { MemoTemplate } from '@/components/memo/MemoTemplate';
import { MemoAttachmentList } from '@/components/memo/MemoAttachmentList';
import { DraftAttachments } from '@/components/memo/DraftAttachments';
import { MemoDocumentExport } from '@/components/memo/MemoDocumentExport';
import { WorkflowTimeline } from '@/components/memo/WorkflowTimeline';
import { MemoActivity } from '@/components/memo/MemoActivity';
import { MemoApprovalActions } from '@/components/memo/MemoApprovalActions';
import { MemoPaymentStatus } from '@/components/memo/MemoPaymentStatus';
import { ReturnedMemoBanner } from '@/components/memo/ReturnedMemoBanner';
import { getLatestReturnFeedback } from '@/lib/memo/returnFeedback';
import type { MemoActivityItem } from '@/lib/memo/memoActivityTypes';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PaymentStatusBadge } from '@/components/memo/PaymentStatusBadge';
import { canViewMemoPaymentStatus } from '@/lib/memo/paymentStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Share2, UserMinus, Pencil, Send, Trash2, RotateCcw } from 'lucide-react';
import { getUserRoleSlug } from '@/lib/auth/profile';
import {
  hasPermission,
  canEditMemo,
  canUploadAttachments,
  canResubmitMemo,
  canAdminResubmitMemo,
  canAdminReturnMemo,
  memoAwaitingFirstApprover,
  hasUploadedSignature,
  SIGNATURE_REQUIRED_FOR_APPROVAL_MESSAGE,
} from '@/lib/auth/rbac';
import type { RoleSlug } from '@/types';
import type { Memo, BrandingSettings, MemoStatusSlug } from '@/types';
import { buildWorkflowSteps } from '@/lib/memo/workflowDisplay';
import type { WorkflowTimelineStep } from '@/lib/memo/workflowTimeline';
type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  user?: { full_name?: string; title?: string };
};

type ShareRow = {
  id: string;
  shared_with: string;
  user?: { full_name?: string; email?: string };
};

export default function MemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'return' | 'reject'>('approve');
  const [approvalComments, setApprovalComments] = useState('');
  const refreshMemo = useCallback(async () => {
    const memoRes = await apiFetch(`/api/memos/${id}`);
    const memoData = await memoRes.json();
    if (!memoRes.ok) throw new Error(memoData.error || 'Failed to load memo');
    setMemo(memoData.memo as Memo);
  }, [id]);

  const loadMemo = useCallback(async () => {
    const [memoRes, brandingRes, commentsRes, sharesRes] = await Promise.all([
      apiFetch(`/api/memos/${id}`),
      apiFetch('/api/admin/branding'),
      apiFetch(`/api/memos/${id}/comments`),
      apiFetch(`/api/memos/${id}/share`),
    ]);
    const memoData = await memoRes.json();
    if (!memoRes.ok) throw new Error(memoData.error || 'Failed to load memo');
    const brandingData = await brandingRes.json();
    const commentsData = commentsRes.ok ? await commentsRes.json() : { comments: [] };
    const sharesData = sharesRes.ok ? await sharesRes.json() : { shares: [] };
    setMemo(memoData.memo as Memo);
    setBranding(brandingData.branding || null);
    setComments(commentsData.comments || []);
    setShares(sharesData.shares || []);
  }, [id]);

  useEffect(() => {
    loadMemo()
      .catch((err) => {
        setMemo(null);
        setLoadError(err instanceof Error ? err.message : 'Failed to load memo');
      })
      .finally(() => setLoading(false));
  }, [loadMemo]);

  async function handleApproval() {
    if (!user?.id) return;
    if ((approvalAction === 'return' || approvalAction === 'reject') && !approvalComments) {
      alert('Comments are required for return/reject actions');
      return;
    }
    if (approvalAction === 'approve' && !hasUploadedSignature(user)) {
      const proceed = window.confirm(
        `${SIGNATURE_REQUIRED_FOR_APPROVAL_MESSAGE}\n\nApprove without your signature on this memo?`
      );
      if (!proceed) return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/memos/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: approvalAction,
          comments: approvalComments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowApproval(false);
      setApprovalComments('');
      void refreshMemo();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWithdraw() {
    const reason = prompt('Enter reason for withdrawal:');
    if (!reason || !user?.id) return;
    const res = await apiFetch(`/api/memos/${id}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) void refreshMemo();
    else {
      const data = await res.json();
      alert(data.error || 'Withdraw failed');
    }
  }

  async function handleShare() {
    if (!shareEmail.trim()) return;
    setSharing(true);
    try {
      const res = await apiFetch(`/api/memos/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShares((prev) => [...prev, data.share]);
      setShareEmail('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Share failed');
    } finally {
      setSharing(false);
    }
  }

  async function removeShare(sharedWith: string) {
    const res = await apiFetch(`/api/memos/${id}/share?shared_with=${sharedWith}`, {
      method: 'DELETE',
    });
    if (res.ok) setShares((prev) => prev.filter((s) => s.shared_with !== sharedWith));
  }

  function submitConfirmMessage(asAdmin = false): string {
    const currentStatus =
      joinSlug(
        (memo as { memo_statuses?: { slug: string } | { slug: string }[] } | null)?.memo_statuses
      ) || memo?.status?.slug;
    const prefix = asAdmin ? 'Resubmit this memo on behalf of the author? ' : '';
    if (currentStatus === 'returned') {
      return `${prefix}It will go back to the same approver for review.`;
    }
    if (currentStatus === 'rejected') {
      return `${prefix}It will re-enter approval from the first step.`;
    }
    return `${prefix}Submit this memo for approval? You can still edit it until the first approver acts.`;
  }

  async function handleSubmitDraft(asAdmin = false) {
    if (!user?.id) return;
    if (!confirm(submitConfirmMessage(asAdmin))) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/memos/${id}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      void refreshMemo();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteDraft() {
    if (!confirm('Delete this draft permanently? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/memos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/memos?status=draft');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdminReturn() {
    const comments = prompt('Reason for returning this memo to the author (required):');
    if (!comments?.trim()) return;
    if (
      !confirm(
        'Return this memo to the author for correction? They (or you as admin) can edit and resubmit.'
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/memos/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', comments: comments.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      void refreshMemo();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Return failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdminDelete() {
    const reason = prompt('Reason for deleting this memo (required):');
    if (!reason?.trim()) return;
    if (!confirm('Move this memo to trash? You can restore it from Admin → Trash.')) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/memos/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/admin/trash');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePostComment() {
    if (!comment.trim()) return;
    setPostingComment(true);
    try {
      const res = await apiFetch(`/api/memos/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setComments((prev) => [...prev, data.comment]);
      setComment('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  }

  if (loading) return <div className="text-center py-12">Loading memo...</div>;
  if (!memo) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-red-500 font-medium">Memo not found</p>
        {loadError ? <p className="text-sm text-slate-500 max-w-md mx-auto">{loadError}</p> : null}
        <Link href="/memos?view=mine" className="inline-block text-sm text-brand-600 hover:underline">
          Back to my memos
        </Link>
      </div>
    );
  }

  const statusSlug =
    joinSlug((memo as { memo_statuses?: { slug: string } | { slug: string }[] }).memo_statuses) ||
    memo.status?.slug;
  const memoForRbac = rowToMemoForAccess({
    id: memo.id,
    creator_id: memo.creator_id,
    creator: (memo as { creator?: { email?: string } }).creator,
    department_id: memo.department_id,
    requires_exco: memo.requires_exco,
    requires_finance: memo.requires_finance,
    memo_types: (memo as { memo_types?: { slug: string } }).memo_types,
    memo_statuses: (memo as { memo_statuses?: { slug: string } | { slug: string }[] })
      .memo_statuses,
    departments: (memo as { departments?: { code: string; name?: string } }).departments,
  });
  const approvals =
    (memo as {
      approvals?: {
        action: string;
        comments?: string | null;
        signed_at?: string | null;
        approver?: { full_name?: string };
      }[];
    }).approvals || [];
  const memoForEdit = { ...memoForRbac, approvals };
  const returnFeedback = getLatestReturnFeedback(approvals);
  const isReturned = statusSlug === 'returned';
  const canApprove = user ? canApproveMemo(user, memoForRbac) : false;
  const needsSignatureReminder = canApprove && user ? !hasUploadedSignature(user) : false;
  const isCreator = memo.creator_id === user?.id;
  const canEdit = user ? canEditMemo(user, memoForEdit) : false;
  const canAttach = user ? canUploadAttachments(user, memoForRbac) : false;
  const canSubmit = user ? canResubmitMemo(user, memoForEdit) && isCreator : false;
  const roleSlug = getUserRoleSlug(user) as RoleSlug | undefined;
  const isAdmin = roleSlug === 'admin';
  const canAdminResubmit = user ? canAdminResubmitMemo(user, memoForEdit) : false;
  const canAdminReturn = user ? canAdminReturnMemo(user, memoForRbac) : false;
  const pendingFirstStep = memoAwaitingFirstApprover(memoForEdit);
  const isDraft = statusSlug === 'draft';
  const pendingStatuses = [
    'pending_department_head',
    'pending_finance',
    'pending_hr',
    'pending_ceo',
    'pending_exco',
    'pending_it_checker_first',
    'pending_it_checker_second',
    'pending_business_head',
  ];
  const canShare =
    isCreator ||
    (roleSlug && (hasPermission(roleSlug, '*') || hasPermission(roleSlug, 'memo:share')));
  const attachments =
    (memo as {
      memo_attachments?: {
        id: string;
        file_name: string;
        file_path: string;
        file_size?: number;
        mime_type?: string;
      }[];
    }).memo_attachments || [];

  const showPaymentTag = canViewMemoPaymentStatus({
    payment_status: memo.payment_status,
    memo_types: (memo as { memo_types?: { slug: string } | { slug: string }[] }).memo_types,
    memo_statuses: (memo as { memo_statuses?: { slug: string } | { slug: string }[] })
      .memo_statuses,
  });

  const workflowSteps: WorkflowTimelineStep[] =
    (memo as { workflow_timeline?: WorkflowTimelineStep[] }).workflow_timeline ??
    buildWorkflowSteps(statusSlug, {
      createdAt: memo.created_at,
      submittedAt: memo.submitted_at,
    });
  return (
    <div className={`space-y-6 memo-detail-page${canApprove ? ' memo-detail-page--approver' : ''}`}>
      <PageHeader
        title={memo.reference_number}
        titleMono
        subtitle={memo.subject}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={statusSlug}
              assigneeName={
                (memo as { pending_assignee_name?: string | null }).pending_assignee_name
              }
              assigneeId={(memo as { pending_assignee_id?: string | null }).pending_assignee_id}
              assigneeIsYou={
                (memo as { pending_assignee_is_you?: boolean }).pending_assignee_is_you
              }
            />
            {showPaymentTag ? (
              <PaymentStatusBadge status={memo.payment_status ?? 'not_paid'} />
            ) : null}
          </div>
        }
      />

      {canEdit && isReturned ? (
        <ReturnedMemoBanner
          memoId={id}
          returnFeedback={returnFeedback}
          actionLoading={actionLoading}
          onResubmit={() => handleSubmitDraft(false)}
        />
      ) : null}

      {canEdit && !isReturned ? (
        <div className="card p-4 bg-brand-50 border-brand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-brand-900">
              {isDraft
                ? 'This memo is a draft'
                : pendingFirstStep
                  ? 'Waiting on first approval — you can still edit'
                  : 'Rejected — you can revise and resubmit'}
            </p>
            <p className="text-sm text-brand-800/80 mt-0.5">
              {pendingFirstStep
                ? 'Update fields or attachments while no one has approved yet.'
                : 'Edit fields and attachments, then submit when ready.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href={`/memos/${id}/edit`} className="btn-primary inline-flex items-center gap-2 text-sm">
              <Pencil size={16} />
              Edit
            </Link>
            {canSubmit ? (
              <button
                type="button"
                onClick={() => handleSubmitDraft(false)}
                disabled={actionLoading}
                className="btn-secondary inline-flex items-center gap-2 text-sm"
              >
                <Send size={16} />
                {statusSlug === 'rejected' ? 'Resubmit' : 'Submit'}
              </button>
            ) : null}
            {isDraft && (
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={actionLoading}
                className="btn-danger inline-flex items-center gap-2 text-sm"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 xl:gap-6">
        <div className="xl:col-span-2 space-y-5 order-2 xl:order-1">
          <MemoDocumentExport memoId={id} referenceNumber={memo.reference_number} />
          <div className="memo-doc-view">
            <p className="memo-doc-view__label">Memo preview</p>
            <MemoTemplate
              memo={memo}
              branding={branding || undefined}
              workflowSteps={workflowSteps}
            />
          </div>

          {canAttach ? (
            <div className="space-y-2">
              {!canEdit ? (
                <p className="text-xs text-slate-500 px-1">
                  You can add supporting files until this memo is fully approved.
                </p>
              ) : null}
              <DraftAttachments memoId={id} />
            </div>
          ) : (
            <MemoAttachmentList attachments={attachments} />
          )}
        </div>

        <div className="space-y-4 order-1 xl:order-2">
          <WorkflowTimeline steps={workflowSteps} />

          {canApprove ? (
            <MemoApprovalActions
              showApproval={showApproval}
              setShowApproval={setShowApproval}
              approvalAction={approvalAction}
              setApprovalAction={setApprovalAction}
              approvalComments={approvalComments}
              setApprovalComments={setApprovalComments}
              actionLoading={actionLoading}
              onConfirm={handleApproval}
              needsSignatureReminder={needsSignatureReminder}
            />
          ) : null}

          <MemoPaymentStatus
            memo={memo}
            user={user}
            onUpdated={(updates) => setMemo((prev) => (prev ? { ...prev, ...updates } : prev))}
          />

          <MemoActivity
            items={
              ((memo as { activity?: MemoActivityItem[] }).activity || []) as MemoActivityItem[]
            }
          />

          {isCreator && pendingStatuses.includes(statusSlug || '') && (
            <button onClick={handleWithdraw} className="btn-secondary w-full text-sm">
              Withdraw / Cancel Memo
            </button>
          )}

          {isAdmin && statusSlug !== 'deleted' && (
            <div className="card p-4 border-slate-200">
              <h3 className="font-semibold mb-2 text-slate-800">Admin</h3>
              {canAdminReturn || canAdminResubmit ? (
                <div className="space-y-2 mb-4">
                  {canAdminReturn ? (
                    <>
                      <p className="text-xs text-slate-500">
                        Send this memo back to the author for correction. After they update it,
                        use Resubmit memo or the author can resubmit.
                      </p>
                      <button
                        type="button"
                        onClick={handleAdminReturn}
                        disabled={actionLoading}
                        className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                      >
                        <RotateCcw size={16} />
                        Return for correction
                      </button>
                    </>
                  ) : null}
                  {canAdminResubmit ? (
                    <>
                      <p className="text-xs text-slate-500">
                        {isReturned
                          ? 'Resubmit on behalf of the author — goes back to the same approver.'
                          : 'Submit or resubmit this memo on behalf of the author.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSubmitDraft(true)}
                        disabled={actionLoading}
                        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                      >
                        <Send size={16} />
                        {isReturned || statusSlug === 'rejected' ? 'Resubmit memo' : 'Submit memo'}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-slate-500 mb-3">
                Move this memo to trash. Restore or permanently delete from Admin → Trash.
              </p>
              <button
                type="button"
                onClick={handleAdminDelete}
                disabled={actionLoading}
                className="btn-danger w-full flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 size={16} />
                Delete memo
              </button>
            </div>
          )}

          {canShare && (
            <div className="card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Share2 size={16} /> Share (view only)
              </h3>
              {shares.length > 0 && (
                <ul className="space-y-2 mb-3 text-sm">
                  {shares.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 min-w-0">
                      <span className="min-w-0 truncate">
                        {s.user?.full_name}{' '}
                        <span className="text-slate-400">({s.user?.email})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeShare(s.shared_with)}
                        className="text-slate-400 hover:text-red-600 shrink-0"
                        aria-label="Remove share"
                      >
                        <UserMinus size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  className="input-field flex-1 text-base sm:text-sm"
                  placeholder="colleague@rukapay.co.ug"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing || !shareEmail.trim()}
                  className="btn-secondary text-sm shrink-0 min-h-[44px] sm:min-h-0"
                >
                  Share
                </button>
              </div>
            </div>
          )}

          <div className="card p-4">
            <h3 className="font-semibold mb-3">Comments</h3>
            {comments.length > 0 && (
              <ul className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm border-b border-slate-100 pb-2">
                    <p className="font-medium text-slate-700">
                      {c.user?.full_name || 'User'}
                      {c.user?.title ? (
                        <span className="text-slate-400 font-normal"> · {c.user.title}</span>
                      ) : null}
                    </p>
                    <p className="text-slate-600 mt-0.5">{c.content}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="input-field min-h-[60px] mb-2"
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={postingComment || !comment.trim()}
              className="btn-secondary w-full text-sm disabled:opacity-50"
            >
              {postingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
