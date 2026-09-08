import { CFO_EMAIL, isDesignatedCfo } from '@/lib/memo/designatedUsers';
import { isFinanceRequestCreator } from '@/lib/workflow/financeWorkflowSteps';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '@/lib/workflow/interdeptFinanceReviewer';
import type { Memo, User } from '@/types';

type MemoWithCreator = Memo & {
  creator?: { email?: string | null } | null;
};

function creatorEmailForMemo(memo: MemoWithCreator): string | undefined {
  return memo.creator?.email ?? undefined;
}

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

/** Christine or Amara — either may complete the finance step. */
export function isSharedFinanceApprover(
  user: Pick<User, 'email'> | null | undefined
): boolean {
  return isInterdeptFinanceReviewer(user) || isDesignatedCfo(user);
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

const FINANCE_VIEW_STATUSES = [
  'pending_finance',
  'pending_ceo',
  'approved',
  'submitted',
] as const;

/**
 * Amara (CFO) may approve any pending finance-step memo (covers for Christine),
 * except memos she authored.
 */
export function designatedCfoFinanceRequestCanApprove(user: User, memo: MemoWithCreator): boolean {
  if (memo.status?.slug !== 'pending_finance') return false;
  if (!isDesignatedCfo(user)) return false;
  if (!isFinanceStepMemo(memo)) return false;
  if (memo.creator_id === user.id) return false;
  return true;
}

/** Amara can view all finance-step memos (same breadth as Christine's queue). */
export function designatedCfoFinanceRequestCanView(user: User, memo: MemoWithCreator): boolean {
  if (!isDesignatedCfo(user)) return false;
  if (!isFinanceStepMemo(memo)) return false;
  return FINANCE_VIEW_STATUSES.includes(
    (memo.status?.slug || '') as (typeof FINANCE_VIEW_STATUSES)[number]
  );
}

/** Christine reviews finance steps (not her own Finance Request memos). */
export function designatedFinanceStepReviewerCanApprove(user: User, memo: MemoWithCreator): boolean {
  if (memo.status?.slug !== 'pending_finance') return false;
  if (!isInterdeptFinanceReviewer(user)) return false;
  if (!isFinanceStepMemo(memo)) return false;
  if (memo.memo_type?.slug === 'finance_request') {
    return memo.creator_id !== user.id;
  }
  return true;
}

export function designatedFinanceStepReviewerCanView(user: User, memo: MemoWithCreator): boolean {
  if (!isInterdeptFinanceReviewer(user)) return false;
  if (!FINANCE_VIEW_STATUSES.includes((memo.status?.slug || '') as (typeof FINANCE_VIEW_STATUSES)[number])) {
    return false;
  }
  if (!isFinanceStepMemo(memo)) return false;
  if (memo.memo_type?.slug === 'finance_request' && memo.creator_id === user.id) {
    return false;
  }
  return true;
}

/** @deprecated Prefer isSharedFinanceApprover — kept for call sites checking CFO-only finance_request creators. */
export function isChristineFinanceRequestForAmara(memo: MemoWithCreator): boolean {
  return (
    memo.memo_type?.slug === 'finance_request' &&
    isFinanceRequestCreator({ email: creatorEmailForMemo(memo) })
  );
}

export { CFO_EMAIL, INTERDEPT_FINANCE_REVIEWER_EMAIL };
