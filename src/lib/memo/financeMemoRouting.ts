import { isDesignatedCfo } from '@/lib/memo/designatedUsers';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '@/lib/workflow/interdeptFinanceReviewer';
import type { Memo, User } from '@/types';

export function isFinanceRequestMemo(memoTypeSlug: string | undefined): boolean {
  return memoTypeSlug === 'finance_request';
}

/** Amara (CFO) — Finance Request memos from the finance department only. */
export function isDesignatedFinanceApprover(
  user: Pick<User, 'email'> | null | undefined
): boolean {
  return isDesignatedCfo(user);
}

export function isInterdeptFinanceReviewer(
  user: Pick<User, 'email'> | null | undefined
): boolean {
  return Boolean(
    user?.email?.toLowerCase() === INTERDEPT_FINANCE_REVIEWER_EMAIL.toLowerCase()
  );
}

/** Memo types where Christine reviews the finance step (not Amara's finance_request). */
export const INTERDEPT_FINANCE_MEMO_TYPE_SLUGS = [
  'hr_request',
  'marketing_request',
  'it_request',
  'payment_request',
  'procurement_request',
  'general_internal',
] as const;

const INTERDEPT_FINANCE_MEMO_TYPES = new Set<string>(INTERDEPT_FINANCE_MEMO_TYPE_SLUGS);

function isInterdeptFinanceMemo(memo: Memo): boolean {
  const slug = memo.memo_type?.slug;
  return Boolean(slug && INTERDEPT_FINANCE_MEMO_TYPES.has(slug));
}

/** Christine (staff): finance step on memos from other departments. Amara: finance_request only. */
export function designatedFinanceStepReviewerCanApprove(user: User, memo: Memo): boolean {
  if (memo.status?.slug !== 'pending_finance') return false;

  if (memo.memo_type?.slug === 'finance_request') {
    return isDesignatedCfo(user) && memo.creator_id !== user.id;
  }

  if (isInterdeptFinanceMemo(memo)) {
    return isInterdeptFinanceReviewer(user);
  }

  return false;
}

export function designatedFinanceStepReviewerCanView(user: User, memo: Memo): boolean {
  if (!['pending_finance', 'pending_ceo', 'approved', 'submitted'].includes(memo.status?.slug || '')) {
    return false;
  }

  if (memo.memo_type?.slug === 'finance_request') {
    return isDesignatedCfo(user) || isInterdeptFinanceReviewer(user);
  }

  if (isInterdeptFinanceMemo(memo)) {
    return isInterdeptFinanceReviewer(user);
  }

  return false;
}
