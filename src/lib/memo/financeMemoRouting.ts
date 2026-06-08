import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '@/lib/workflow/interdeptFinanceReviewer';
import type { Memo, User } from '@/types';

export function isFinanceRequestMemo(memoTypeSlug: string | undefined): boolean {
  return memoTypeSlug === 'finance_request';
}

export function isInterdeptFinanceReviewer(
  user: Pick<User, 'email'> | null | undefined
): boolean {
  return Boolean(
    user?.email?.toLowerCase() === INTERDEPT_FINANCE_REVIEWER_EMAIL.toLowerCase()
  );
}

/** Memo types where Christine reviews the finance step. */
export const INTERDEPT_FINANCE_MEMO_TYPE_SLUGS = [
  'hr_request',
  'marketing_request',
  'it_request',
  'payment_request',
  'procurement_request',
  'general_internal',
] as const;

const FINANCE_STEP_MEMO_TYPES = new Set<string>([
  ...INTERDEPT_FINANCE_MEMO_TYPE_SLUGS,
  'finance_request',
]);

function isFinanceStepMemo(memo: Memo): boolean {
  const slug = memo.memo_type?.slug;
  return Boolean(slug && FINANCE_STEP_MEMO_TYPES.has(slug));
}

/** Christine reviews all finance steps, then CEO approves. */
export function designatedFinanceStepReviewerCanApprove(user: User, memo: Memo): boolean {
  if (memo.status?.slug !== 'pending_finance') return false;
  if (!isInterdeptFinanceReviewer(user)) return false;
  if (!isFinanceStepMemo(memo)) return false;
  if (memo.memo_type?.slug === 'finance_request') {
    return memo.creator_id !== user.id;
  }
  return true;
}

export function designatedFinanceStepReviewerCanView(user: User, memo: Memo): boolean {
  if (!isInterdeptFinanceReviewer(user)) return false;
  if (!['pending_finance', 'pending_ceo', 'approved', 'submitted'].includes(memo.status?.slug || '')) {
    return false;
  }
  return isFinanceStepMemo(memo);
}
