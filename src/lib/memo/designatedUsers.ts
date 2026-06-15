import type { MemoTypeSlug, User } from '@/types';
import { getUserRoleSlug } from '@/lib/auth/profile';
import { HR_MEMO_CREATOR_EMAIL } from '@/lib/workflow/hrWorkflowSteps';
import {
  BUSINESS_HEAD_EMAIL,
  MARKETING_HEAD_EMAIL,
} from '@/lib/workflow/marketingWorkflowSteps';
import { IT_FIRST_CHECKER_EMAIL, IT_SECOND_CHECKER_EMAIL } from '@/lib/workflow/itCheckers';

/** Final approver (CEO) for all memos except those authored by the CEO. */
export const CEO_APPROVER_EMAIL = 'rowena.turinawe@rukapay.co.ug';

/** CEO memos are authored by Rowena and approved by the Chairman. */
export const CEO_MEMO_CREATOR_EMAIL = CEO_APPROVER_EMAIL;

/** Chairman — final approver for memos created by the CEO. */
export const CHAIRMAN_APPROVER_EMAIL = 'douglasrk@rukapay.co.ug';

/** Finance department head (Amara). Reviews Finance Request memos from Christine. */
export const CFO_EMAIL = 'amara.oto@rukapay.co.ug';

/** IT department heads. */
export const IT_DEPT_HEAD_EMAILS = [IT_FIRST_CHECKER_EMAIL, IT_SECOND_CHECKER_EMAIL] as const;

/** Department heads for payment / procurement / general / leave (by target department on form). */
export const DESIGNATED_DEPT_HEAD_EMAILS: Record<string, readonly string[]> = {
  IT: IT_DEPT_HEAD_EMAILS,
  HR: [HR_MEMO_CREATOR_EMAIL],
  FIN: [CFO_EMAIL],
  OPS: [IT_FIRST_CHECKER_EMAIL],
  /** Marketing department head (Margaret). */
  MKT: [MARKETING_HEAD_EMAIL],
  /** Business department — Norman; marketing_request workflow uses business_head step. */
  BD: [BUSINESS_HEAD_EMAIL],
};

export function emailsMatch(a: string | undefined, b: string): boolean {
  return Boolean(a?.toLowerCase() === b.toLowerCase());
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
  if (!user?.email) return false;
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
