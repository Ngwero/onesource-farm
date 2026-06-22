'use client';

import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import {
  canUpdateMemoPaymentStatus,
  canViewMemoPaymentStatus,
  paymentStatusLabel,
} from '@/lib/memo/paymentStatus';
import { PaymentStatusBadge } from '@/components/memo/PaymentStatusBadge';
import type { Memo, PaymentStatus, User } from '@/types';
import { MEMO_PAYMENT_UPDATED_EVENT } from '@/hooks/useMemos';

type MemoPaymentStatusProps = {
  memo: Memo;
  user: User | null;
  onUpdated?: (updates: Partial<Memo>) => void;
};

function formatPaidAt(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MemoPaymentStatus({ memo, user, onUpdated }: MemoPaymentStatusProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    memo.payment_status ?? null
  );
  const [paymentNote, setPaymentNote] = useState(memo.payment_note || '');
  const [paidAt, setPaidAt] = useState(memo.paid_at ?? null);
  const [paidByName, setPaidByName] = useState(memo.paid_by_user?.full_name ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setPaymentStatus(memo.payment_status ?? null);
    setPaymentNote(memo.payment_note || '');
    setPaidAt(memo.paid_at ?? null);
    setPaidByName(memo.paid_by_user?.full_name ?? null);
  }, [memo.payment_status, memo.payment_note, memo.paid_at, memo.paid_by_user?.full_name]);

  const memoForAccess = {
    payment_status: paymentStatus,
    memo_type: memo.memo_type,
    memo_types: (memo as { memo_types?: { slug: string } | { slug: string }[] }).memo_types,
    status: memo.status,
    memo_statuses: (memo as { memo_statuses?: { slug: string } | { slug: string }[] })
      .memo_statuses,
  };

  if (!canViewMemoPaymentStatus(memoForAccess)) return null;

  const canEdit = canUpdateMemoPaymentStatus(user, memoForAccess);

  async function handleSave(nextStatus: PaymentStatus) {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const res = await apiFetch(`/api/memos/${memo.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: nextStatus,
          payment_note: paymentNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status');

      const updated = data.memo as Memo;
      setPaymentStatus(updated.payment_status ?? nextStatus);
      setPaymentNote(updated.payment_note || '');
      setPaidAt(updated.paid_at ?? (nextStatus === 'paid' ? new Date().toISOString() : null));
      setPaidByName(
        nextStatus === 'paid' ? user?.full_name ?? null : null
      );
      onUpdated?.({
        payment_status: updated.payment_status,
        payment_note: updated.payment_note,
        paid_at: updated.paid_at,
        paid_by: updated.paid_by,
      });
      setSavedMessage(
        nextStatus === 'paid' ? 'Marked as paid.' : 'Saved as not yet paid.'
      );
      window.dispatchEvent(
        new CustomEvent(MEMO_PAYMENT_UPDATED_EVENT, { detail: { memoId: memo.id } })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const displayStatus: PaymentStatus = paymentStatus ?? 'not_paid';

  return (
    <div className="card p-4 border-slate-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Banknote size={18} className="text-brand-600 shrink-0" />
          <h3 className="font-semibold text-slate-800">Payment</h3>
        </div>
        <PaymentStatusBadge status={displayStatus} />
      </div>

      {displayStatus === 'paid' ? (
        <div className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Marked as paid</p>
            {paidAt ? (
              <p className="text-xs text-emerald-700/90 mt-0.5">{formatPaidAt(paidAt)}</p>
            ) : null}
            {paidByName ? (
              <p className="text-xs text-emerald-700/90">Updated by {paidByName}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          <Clock size={16} className="shrink-0 mt-0.5" />
          <p>Awaiting payment processing after full approval.</p>
        </div>
      )}

      {paymentNote && !canEdit ? (
        <p className="text-sm text-slate-600 mb-3">
          <span className="font-medium text-slate-700">Note:</span> {paymentNote}
        </p>
      ) : null}

      {canEdit ? (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Update status
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('not_paid')}
                className={`payment-toggle${displayStatus === 'not_paid' ? ' payment-toggle--active payment-toggle--pending' : ''}`}
              >
                Not yet paid
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('paid')}
                className={`payment-toggle${displayStatus === 'paid' ? ' payment-toggle--active payment-toggle--paid' : ''}`}
              >
                Paid
              </button>
            </div>
          </fieldset>

          <div>
            <label htmlFor="payment-note" className="block text-xs font-semibold text-slate-600 mb-1">
              Payment note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="payment-note"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={2}
              placeholder="Reference, date paid, bank details..."
              className="input-field text-sm w-full resize-y min-h-[4rem]"
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(displayStatus)}
            className="btn-primary w-full text-sm"
          >
            {saving ? 'Saving…' : 'Save payment details'}
          </button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {savedMessage ? (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {savedMessage}
            </p>
          ) : null}

          <p className="text-xs text-slate-500">
            Current status: {paymentStatusLabel(displayStatus)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
