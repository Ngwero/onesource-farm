import type { MemoTypeSlug, User } from '@/types';
import { getUserRoleSlug } from '@/lib/auth/profile';
import { HR_MEMO_CREATOR_EMAIL } from '@/lib/workflow/hrWorkflowSteps';
import {
  BUSINESS_HEAD_EMAIL,
  MARKETING_HEAD_EMAIL,
} from '@/lib/workflow/marketingWorkflowSteps';
import { IT_FIRST_CHECKER_EMAIL, IT_SECOND_CHECKER_EMAIL } from '@/lib/workflow/itCheckers';

/**
 * Designated approver emails — cleared for reassignment.
 * Assign people via Admin → Users (role) or set these emails when known.
 * Empty strings mean "no hardcoded person"; routing falls back to role holders.
 */
export const CEO_APPROVER_EMAIL: string = '';

/** CEO memos use chairman when a CEO email is designated and matches the creator. */
export const CEO_MEMO_CREATOR_EMAIL = CEO_APPROVER_EMAIL;

/** Chairman — final approver for memos created by the designated CEO. */
export const CHAIRMAN_APPROVER_EMAIL: string = '';

/** Finance department head / CFO. */
export const CFO_EMAIL: string = '';

/** IT department heads (optional designated emails). */
export const IT_DEPT_HEAD_EMAILS = [IT_FIRST_CHECKER_EMAIL, IT_SECOND_CHECKER_EMAIL].filter(
  Boolean
) as readonly string[];

/** Department heads by dept code — empty until assigned. */
export const DESIGNATED_DEPT_HEAD_EMAILS: Record<string, readonly string[]> = {
  IT: IT_DEPT_HEAD_EMAILS,
  HR: [HR_MEMO_CREATOR_EMAIL].filter(Boolean),
  FIN: [CFO_EMAIL].filter(Boolean),
  OPS: [],
  MKT: [MARKETING_HEAD_EMAIL].filter(Boolean),
  BD: [BUSINESS_HEAD_EMAIL].filter(Boolean),
};

export function emailsMatch(a: string | undefined, b: string): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function isDesignatedCfo(user: Pick<User, 'email'> | null | undefined): boolean {
  return emailsMatch(user?.email, CFO_EMAIL);
}

export function isDesignatedCeo(user: Pick<User, 'email'> | null | undefined): boolean {
  return emailsMatch(user?.email, CEO_APPROVER_EMAIL);
}

export function isCeoMemoCreator(
  user: { email?: string | null } | null | undefined
): boolean {
  return emailsMatch(user?.email ?? undefined, CEO_MEMO_CREATOR_EMAIL);
}

export function isDesignatedChairman(
  user: Pick<User, 'email'> | null | undefined
): boolean {
  return emailsMatch(user?.email, CHAIRMAN_APPROVER_EMAIL);
}

export function isDesignatedItDeptHead(user: Pick<User, 'email'> | null | undefined): boolean {
  if (!user?.email || !IT_DEPT_HEAD_EMAILS.length) return false;
  return IT_DEPT_HEAD_EMAILS.some((e) => emailsMatch(user.email, e));
}

export function isDesignatedDeptHead(
  user: Pick<User, 'email' | 'department'> | null | undefined,
  deptCode?: string
): boolean {
  const code = deptCode || user?.department?.code;
  if (!code || !user?.email) return false;
  const heads = DESIGNATED_DEPT_HEAD_EMAILS[code];
  if (!heads?.length) return false;
  return heads.some((e) => emailsMatch(user.email, e));
}

export function canCreateMemoType(
  user: Pick<User, 'role'> | Record<string, unknown> | null | undefined,
  _memoTypeSlug: MemoTypeSlug
): boolean {
  return Boolean(getUserRoleSlug(user));
}

export function filterCreatableMemoTypes<T extends { slug: string }>(
  user: User | null | undefined,
  memoTypes: T[] | null | undefined
): T[] {
  if (!user || !memoTypes) return [];
  if (!canCreateMemoType(user, 'general_internal')) return [];
  return memoTypes;
}

export function canCreateAnyMemo(user: User | null | undefined): boolean {
  return canCreateMemoType(user, 'general_internal');
}
