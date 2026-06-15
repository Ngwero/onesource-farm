import { createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import {
  canUpdateMemoPaymentStatus,
  memoTypeSlugFromMemo,
  memoTypeTracksPayment,
  type PaymentStatus,
} from '@/lib/memo/paymentStatus';
import type { User } from '@/types';

type MemoPaymentRow = {
  id: string;
  payment_status: PaymentStatus | null;
  payment_note: string | null;
  paid_at: string | null;
  paid_by: string | null;
  memo_types?: { slug: string } | { slug: string }[] | null;
  memo_statuses?: { slug: string } | { slug: string }[] | null;
};

function joinSlug(
  row: { slug: string } | { slug: string }[] | null | undefined
): string | undefined {
  if (!row) return undefined;
  return Array.isArray(row) ? row[0]?.slug : row.slug;
}

export async function updateMemoPaymentStatus(
  user: User,
  memoId: string,
  input: { payment_status: PaymentStatus; payment_note?: string | null }
): Promise<MemoPaymentRow> {
  const supabase = createServiceClient();

  const { data: memo, error } = await supabase
    .from('memos')
    .select(
      'id, payment_status, payment_note, paid_at, paid_by, memo_types(slug), memo_statuses(slug), paid_by_user:users!paid_by(full_name)'
    )
    .eq('id', memoId)
    .single();

  if (error || !memo) {
    throw new Error('Memo not found');
  }

  const memoForAccess = {
    payment_status: memo.payment_status as PaymentStatus | null,
    memo_type: { slug: joinSlug(memo.memo_types) },
    status: { slug: joinSlug(memo.memo_statuses) },
  };

  if (!canUpdateMemoPaymentStatus(user, memoForAccess)) {
    throw new Error('Forbidden');
  }

  const memoTypeSlug = joinSlug(memo.memo_types);
  if (!memoTypeTracksPayment(memoTypeSlug)) {
    throw new Error('This memo type does not track payment');
  }

  const now = new Date().toISOString();
  const paid = input.payment_status === 'paid';
  const note = input.payment_note?.trim() || null;

  const { data: updated, error: updateError } = await supabase
    .from('memos')
    .update({
      payment_status: input.payment_status,
      payment_note: note,
      paid_at: paid ? now : null,
      paid_by: paid ? user.id : null,
      updated_at: now,
    })
    .eq('id', memoId)
    .select(
      'id, payment_status, payment_note, paid_at, paid_by, memo_types(slug), memo_statuses(slug), paid_by_user:users!paid_by(full_name)'
    )
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || 'Update failed');
  }

  await logAudit({
    memoId,
    userId: user.id,
    action: 'payment_updated',
    oldValues: {
      payment_status: memo.payment_status,
      payment_note: memo.payment_note,
    },
    newValues: {
      payment_status: input.payment_status,
      payment_note: note,
    },
  });

  return updated as MemoPaymentRow;
}

export { memoTypeSlugFromMemo };
