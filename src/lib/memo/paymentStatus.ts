import type { SupabaseClient } from '@supabase/supabase-js';
import { isInterdeptFinanceReviewer } from '@/lib/memo/financeMemoRouting';
import { FINANCE_STEP_MEMO_TYPE_SLUGS } from '@/lib/memo/financeQueueList';
import type { Memo, User } from '@/types';

export type PaymentStatus = 'not_paid' | 'paid';

export function memoTypeTracksPayment(memoTypeSlug?: string | null): boolean {
  if (!memoTypeSlug) return false;
  return (FINANCE_STEP_MEMO_TYPE_SLUGS as readonly string[]).includes(memoTypeSlug);
}

/** Initial payment status when a finance-step memo is fully approved. */
export function paymentStatusOnApproval(memoTypeSlug?: string | null): PaymentStatus | null {
  return memoTypeTracksPayment(memoTypeSlug) ? 'not_paid' : null;
}

export function approvedMemoPaymentFields(memoTypeSlug?: string | null): {
  payment_status: PaymentStatus;
  paid_at: null;
  paid_by: null;
  payment_note: null;
} | Record<string, never> {
  const status = paymentStatusOnApproval(memoTypeSlug);
  if (!status) return {};
  return {
    payment_status: status,
    paid_at: null,
    paid_by: null,
    payment_note: null,
  };
}

export function paymentStatusLabel(status?: PaymentStatus | null): string {
  if (status === 'paid') return 'Paid';
  return 'Not yet paid';
}

let paymentColumnsReady: boolean | null = null;

/** True once migration 020 has been applied (payment_status column exists). */
export async function hasPaymentTrackingColumns(
  supabase: SupabaseClient
): Promise<boolean> {
  if (paymentColumnsReady === true) return true;
  const { error } = await supabase.from('memos').select('payment_status').limit(1);
  if (!error) {
    paymentColumnsReady = true;
    return true;
  }
  return false;
}

export function memoTypeSlugFromMemo(memo: {
  memo_type?: { slug?: string } | null;
  memo_types?: { slug?: string } | { slug?: string }[] | null;
}): string | undefined {
  const direct = memo.memo_type?.slug;
  if (direct) return direct;
  const rel = memo.memo_types;
  if (!rel) return undefined;
  return Array.isArray(rel) ? rel[0]?.slug : rel.slug;
}

export function memoStatusSlugFromMemo(memo: {
  status?: { slug?: string } | null;
  memo_statuses?: { slug?: string } | { slug?: string }[] | null;
}): string | undefined {
  const direct = memo.status?.slug;
  if (direct) return direct;
  const rel = memo.memo_statuses;
  if (!rel) return undefined;
  return Array.isArray(rel) ? rel[0]?.slug : rel.slug;
}

export function canViewMemoPaymentStatus(
  memo: Pick<Memo, 'payment_status'> & {
    memo_type?: { slug?: string } | null;
    memo_types?: { slug?: string } | { slug?: string }[] | null;
    status?: { slug?: string } | null;
    memo_statuses?: { slug?: string } | { slug?: string }[] | null;
  }
): boolean {
  if (memoStatusSlugFromMemo(memo) !== 'approved') return false;
  return memoTypeTracksPayment(memoTypeSlugFromMemo(memo));
}

export function canUpdateMemoPaymentStatus(
  user: User | null | undefined,
  memo: Pick<Memo, 'payment_status'> & {
    memo_type?: { slug?: string } | null;
    memo_types?: { slug?: string } | { slug?: string }[] | null;
    status?: { slug?: string } | null;
    memo_statuses?: { slug?: string } | { slug?: string }[] | null;
  }
): boolean {
  if (!user || !isInterdeptFinanceReviewer(user)) return false;
  return canViewMemoPaymentStatus(memo);
}
