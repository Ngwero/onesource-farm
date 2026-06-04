import {
  emailsMatch,
  isDesignatedDeptHead,
  isDesignatedItDeptHead,
} from '@/lib/memo/designatedUsers';
import { IT_SECOND_CHECKER_EMAIL } from '@/lib/workflow/itCheckers';
import type { Memo, MemoStatusSlug, MemoTypeSlug, User } from '@/types';

export const IT_DEPARTMENT_CODE = 'IT';

/** First IT workflow step is approved by the IT department head (any staff department). */
export function isItRequestDeptHeadStep(
  memoTypeSlug: MemoTypeSlug | string | undefined,
  statusSlug: MemoStatusSlug | string | undefined
): boolean {
  return memoTypeSlug === 'it_request' && statusSlug === 'pending_department_head';
}

export function isItDepartmentHead(user: User): boolean {
  return user.role?.slug === 'department_head' && user.department?.code === IT_DEPARTMENT_CODE;
}

export function departmentHeadCanViewMemo(user: User, memo: Memo): boolean {
  if (isItRequestDeptHeadStep(memo.memo_type?.slug, memo.status?.slug)) {
    return isItDepartmentHead(user) || isDesignatedItDeptHead(user);
  }
  if (memo.department?.code && isDesignatedDeptHead(user, memo.department.code)) {
    return ['pending_department_head', 'approved', 'submitted'].includes(memo.status?.slug || '');
  }
  if (user.role?.slug === 'department_head') {
    return memo.department_id === user.department_id;
  }
  return isDesignatedItDeptHead(user) && memo.department?.code === IT_DEPARTMENT_CODE;
}

export function isDesignatedItSecondChecker(user: Pick<User, 'email'> | null | undefined): boolean {
  return emailsMatch(user?.email, IT_SECOND_CHECKER_EMAIL);
}

export function departmentHeadCanApproveMemo(
  user: User,
  memo: Memo,
  memoDeptCode?: string
): boolean {
  if (memo.status?.slug !== 'pending_department_head') return false;
  if (memo.memo_type?.slug === 'marketing_request') {
    return false;
  }
  if (memo.memo_type?.slug === 'it_request') {
    return isItDepartmentHead(user) || isDesignatedItDeptHead(user);
  }
  const code = memoDeptCode || user.department?.code;
  if (!code) return false;
  return isDesignatedDeptHead(user, code);
}
