import type { SupabaseClient } from '@supabase/supabase-js';
import type { Memo, User } from '@/types';

type StatusIds = { draftId?: string; deletedId?: string };

let cachedStatusIds: StatusIds | null = null;

export async function getPrivateMemoStatusIds(
  supabase: SupabaseClient
): Promise<StatusIds> {
  if (cachedStatusIds) return cachedStatusIds;

  const { data } = await supabase
    .from('memo_statuses')
    .select('id, slug')
    .in('slug', ['draft', 'deleted']);

  const draftId = data?.find((row) => row.slug === 'draft')?.id as string | undefined;
  const deletedId = data?.find((row) => row.slug === 'deleted')?.id as string | undefined;
  cachedStatusIds = { draftId, deletedId };
  return cachedStatusIds;
}

export function userInMemoDepartment(
  user: Pick<User, 'department_id'>,
  memo: Pick<Memo, 'department_id'>
): boolean {
  return Boolean(
    user.department_id && memo.department_id && user.department_id === memo.department_id
  );
}

/**
 * List filter: own drafts + submitted memos in the user's department (exclude deleted).
 */
export function applyDepartmentMemoListFilter<
  T extends { or: (filter: string) => T; eq: (col: string, val: string) => T; neq: (col: string, val: string) => T },
>(
  query: T,
  userId: string,
  userDepartmentId: string | null | undefined,
  statusIds: StatusIds
): T {
  let next = query;

  if (!userDepartmentId) {
    next = next.eq('creator_id', userId);
  } else if (statusIds.draftId) {
    next = next.or(
      `creator_id.eq.${userId},and(department_id.eq.${userDepartmentId},status_id.neq.${statusIds.draftId})`
    );
  } else {
    next = next.or(`creator_id.eq.${userId},department_id.eq.${userDepartmentId}`);
  }

  if (statusIds.deletedId) {
    next = next.neq('status_id', statusIds.deletedId);
  }

  return next;
}

export function shouldUseRoleScopedMemoList(params: {
  status?: string | null;
  view?: string | null;
  sharedOnly?: boolean;
  financeStaffQueue?: boolean;
}): boolean {
  if (params.sharedOnly || params.view === 'active') return true;
  if (params.financeStaffQueue) return true;
  if (!params.status) return false;
  return params.status.startsWith('pending_');
}
