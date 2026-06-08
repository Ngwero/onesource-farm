import { createServiceClient } from '@/lib/supabase/server';
import {
  canViewMemo,
  canEditMemo,
  canApproveMemo,
  canUploadAttachments,
  hasPermission,
} from '@/lib/auth/rbac';
import {
  joinSlug,
  rowToMemoForAccess,
  type MemoAccessRow,
} from '@/lib/auth/memoRbacShape';
import type { Memo, MemoStatusSlug, RoleSlug, User } from '@/types';

export { joinSlug, rowToMemoForAccess, type MemoAccessRow } from '@/lib/auth/memoRbacShape';

export async function getSharedUserIds(memoId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('shared_memo_access')
    .select('shared_with')
    .eq('memo_id', memoId);
  return (data || []).map((r) => r.shared_with as string);
}

export async function assertCanViewMemo(user: User, memoId: string): Promise<MemoAccessRow> {
  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from('memos')
    .select(
      'id, creator_id, department_id, requires_exco, requires_finance, memo_types(slug), memo_statuses(slug), departments(code, name)'
    )
    .eq('id', memoId)
    .single();

  if (error || !row) throw new Error('Memo not found');

  const sharedWith = await getSharedUserIds(memoId);
  const memo = rowToMemoForAccess(row as unknown as MemoAccessRow);
  if (!canViewMemo(user, memo, sharedWith)) {
    throw new Error('Forbidden');
  }
  return row as unknown as MemoAccessRow;
}

export async function assertCanEditMemo(user: User, memoId: string): Promise<void> {
  const row = await assertCanViewMemo(user, memoId);
  const supabase = createServiceClient();
  const { data: approvals } = await supabase
    .from('approvals')
    .select('action')
    .eq('memo_id', memoId);
  const memo = rowToMemoForAccess(row);
  if (!canEditMemo(user, { ...memo, approvals: approvals || [] })) {
    throw new Error('Memo cannot be edited');
  }
}

export async function assertCanApproveMemo(user: User, memoId: string): Promise<void> {
  const row = await assertCanViewMemo(user, memoId);
  const memo = rowToMemoForAccess(row);
  if (!canApproveMemo(user, memo)) throw new Error('Not authorized to approve this memo');
}

export async function assertCanUploadAttachments(user: User, memoId: string): Promise<void> {
  const row = await assertCanViewMemo(user, memoId);
  const memo = rowToMemoForAccess(row);
  if (!canUploadAttachments(user, memo)) throw new Error('Attachments locked');
}

const ROLE_DEFAULT_STATUS: Partial<Record<RoleSlug, MemoStatusSlug>> = {
  department_head: 'pending_department_head',
  business_head: 'pending_business_head',
  it_checker_first: 'pending_it_checker_first',
  it_checker_second: 'pending_it_checker_second',
  finance_reviewer: 'pending_finance',
  hr_reviewer: 'pending_hr',
  ceo: 'pending_ceo',
  exco_member: 'pending_exco',
};

export function defaultStatusForRole(role: RoleSlug): MemoStatusSlug | undefined {
  return ROLE_DEFAULT_STATUS[role];
}

export function canManageUsers(user: User): boolean {
  return hasPermission(user.role?.slug as RoleSlug, '*');
}
