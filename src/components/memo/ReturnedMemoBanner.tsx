'use client';

import { AlertCircle, Pencil, Send } from 'lucide-react';
import Link from 'next/link';
import type { MemoReturnFeedback } from '@/lib/memo/returnFeedback';

type Props = {
  memoId: string;
  returnFeedback?: MemoReturnFeedback | null;
  actionLoading?: boolean;
  onResubmit: () => void;
};

export function ReturnedMemoBanner({
  memoId,
  returnFeedback,
  actionLoading,
  onResubmit,
}: Props) {
  return (
    <div className="card p-4 bg-amber-50 border-amber-200 flex flex-col gap-4">
      <div className="flex gap-3">
        <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
        <div className="min-w-0">
          <p className="font-semibold text-amber-950">Returned for correction</p>
          <p className="text-sm text-amber-900/90 mt-1">
            Make the requested changes, then resubmit. The memo goes back to the same approver
            for review — you do not start the workflow from the beginning.
          </p>
          {returnFeedback ? (
            <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/70 p-3 text-sm">
              <p className="font-medium text-slate-800">
                Feedback from {returnFeedback.approverName}
                {returnFeedback.signedAt
                  ? ` · ${new Date(returnFeedback.signedAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}`
                  : null}
              </p>
              <p className="text-slate-700 mt-1 whitespace-pre-wrap">{returnFeedback.comments}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:pl-8">
        <Link
          href={`/memos/${memoId}/edit`}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Pencil size={16} />
          Edit memo
        </Link>
        <button
          type="button"
          onClick={onResubmit}
          disabled={actionLoading}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <Send size={16} />
          Resubmit for approval
        </button>
      </div>
    </div>
  );
}
