'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '../ui/StatusBadge';
import { PaymentStatusBadge } from '@/components/memo/PaymentStatusBadge';
import { canViewMemoPaymentStatus } from '@/lib/memo/paymentStatus';
import type { PaymentStatus } from '@/types';
import { FileText, Eye, Pencil, Download } from 'lucide-react';
import { downloadMemoPdf } from '@/lib/memo/downloadMemoPdf';

const EDITABLE_STATUSES = ['draft', 'returned', 'rejected'];
const PDF_EXPORT_STATUSES = new Set(['draft', 'deleted']);

interface MemoListItem {
  id: string;
  creator_id?: string;
  reference_number: string;
  subject?: string;
  memo_statuses?: { name: string; slug: string };
  pending_assignee_name?: string | null;
  pending_assignee_id?: string | null;
  pending_assignee_is_you?: boolean;
  memo_types?: { name: string; slug?: string };
  departments?: { name: string };
  creator?: { full_name: string };
  memo_date?: string | null;
  created_at: string;
  updated_at?: string;
  submitted_at?: string;
  payment_status?: PaymentStatus | null;
}

function memoShowsPayment(memo: MemoListItem): boolean {
  return canViewMemoPaymentStatus({
    payment_status: memo.payment_status,
    memo_types: memo.memo_types,
    memo_statuses: memo.memo_statuses,
  });
}

function formatListDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MemoList({
  memos,
  currentUserId,
  emptyMessage = 'No memos found',
  sortByMemoDate = false,
  paymentTrackingEnabled = true,
}: {
  memos: MemoListItem[];
  currentUserId?: string;
  emptyMessage?: string;
  /** When true, show memo date column (period filter / sort by memo date). */
  sortByMemoDate?: boolean;
  /** When false, hide payment tags (payment migration not applied). */
  paymentTrackingEnabled?: boolean;
  /** @deprecated Payment tags show inline next to status when applicable. */
  showPaymentColumn?: boolean;
}) {
  const [exportingId, setExportingId] = useState<string | null>(null);

  async function handleDownload(memo: MemoListItem) {
    setExportingId(memo.id);
    try {
      await downloadMemoPdf(memo.id, memo.reference_number);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingId(null);
    }
  }

  if (!memos.length) {
    return (
      <div className="card empty-state">
        <div className="empty-state__icon">
          <FileText size={28} />
        </div>
        <p className="empty-state__title">{emptyMessage}</p>
        <p className="empty-state__desc">Memos you create will appear here</p>
      </div>
    );
  }

  const showPaymentTags = paymentTrackingEnabled && memos.some(memoShowsPayment);

  return (
    <div className="data-table">
      <table className="w-full">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Subject</th>
            <th>Type</th>
            <th>Department</th>
            <th>Status</th>
            {showPaymentTags ? <th>Payment</th> : null}
            <th>{sortByMemoDate ? 'Memo date' : 'Last activity'}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {memos.map((memo) => (
            <tr key={memo.id}>
              <td className="font-mono text-brand-600 text-xs font-semibold">
                {memo.reference_number}
              </td>
              <td className="max-w-xs truncate font-medium text-slate-800">
                {memo.subject || '—'}
              </td>
              <td className="text-slate-600">{memo.memo_types?.name}</td>
              <td className="text-slate-600">{memo.departments?.name}</td>
              <td>
                <StatusBadge
                  status={memo.memo_statuses?.slug}
                  assigneeName={memo.pending_assignee_name}
                  assigneeId={memo.pending_assignee_id}
                  assigneeIsYou={memo.pending_assignee_is_you}
                />
              </td>
              {showPaymentTags ? (
                <td>
                  {memoShowsPayment(memo) ? (
                    <PaymentStatusBadge status={memo.payment_status ?? 'not_paid'} />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              ) : null}
              <td className="text-slate-500 text-xs whitespace-nowrap">
                {sortByMemoDate
                  ? formatListDate(memo.memo_date)
                  : formatListDate(memo.updated_at || memo.submitted_at || memo.created_at)}
              </td>
              <td>
                <div className="flex items-center justify-end gap-3">
                  {currentUserId &&
                    memo.creator_id === currentUserId &&
                    EDITABLE_STATUSES.includes(memo.memo_statuses?.slug || '') && (
                      <Link href={`/memos/${memo.id}/edit`} className="table-action">
                        <Pencil size={15} />
                        Edit
                      </Link>
                    )}
                  {!PDF_EXPORT_STATUSES.has(memo.memo_statuses?.slug || '') ? (
                    <button
                      type="button"
                      onClick={() => handleDownload(memo)}
                      disabled={exportingId === memo.id}
                      className="table-action"
                    >
                      <Download size={15} />
                      {exportingId === memo.id ? 'PDF…' : 'PDF'}
                    </button>
                  ) : null}
                  <Link href={`/memos/${memo.id}`} className="table-action">
                    <Eye size={15} />
                    View
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
