import {
  BUSINESS_HEAD_EMAIL,
  MARKETING_DEPARTMENT_CODE,
  MARKETING_HEAD_EMAIL,
} from '@/lib/workflow/marketingWorkflowSteps';
import type { Memo, User } from '@/types';

export function isMarketingMemo(memoTypeSlug: string | undefined): boolean {
  return memoTypeSlug === 'marketing_request';
}

/** Marketing department head — MKT dept memos, not marketing_request business step. */
export function isDesignatedMarketingHead(
  user: Pick<User, 'email' | 'role' | 'department'> | null | undefined
): boolean {
  if (MARKETING_HEAD_EMAIL && user?.email?.toLowerCase() === MARKETING_HEAD_EMAIL.toLowerCase()) {
    return true;
  }
  return user?.role?.slug === 'department_head' && user.department?.code === MARKETING_DEPARTMENT_CODE;
}

export function isBusinessHead(user: User): boolean {
  if (user.role?.slug === 'business_head') return true;
  if (!BUSINESS_HEAD_EMAIL || !user.email) return false;
  return user.email.toLowerCase() === BUSINESS_HEAD_EMAIL.toLowerCase();
}

export function marketingWorkflowCanViewMemo(user: User, memo: Memo): boolean {
  if (!isMarketingMemo(memo.memo_type?.slug)) return false;
  if (isBusinessHead(user)) {
    return [
      'pending_business_head',
      'pending_finance',
      'pending_ceo',
      'approved',
      'submitted',
    ].includes(memo.status?.slug || '');
  }
  if (isDesignatedMarketingHead(user)) {
    return memo.department?.code === MARKETING_DEPARTMENT_CODE;
  }
  return (
    user.department?.code === MARKETING_DEPARTMENT_CODE &&
    memo.department_id === user.department_id
  );
}

export function marketingDeptHeadCanViewMemo(user: User, memo: Memo): boolean {
  return marketingWorkflowCanViewMemo(user, memo);
}

export function marketingDeptHeadCanApproveMemo(user: User, memo: Memo): boolean {
  return businessHeadCanApproveMemo(user, memo);
}

export function businessHeadCanApproveMemo(user: User, memo: Memo): boolean {
  if (memo.memo_type?.slug !== 'marketing_request') return false;
  if (memo.status?.slug !== 'pending_business_head') return false;
  if (memo.creator_id === user.id) return false;
  return isBusinessHead(user);
}
