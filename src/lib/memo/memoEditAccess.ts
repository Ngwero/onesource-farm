import { joinSlug } from '@/lib/auth/memoRbacShape';
import { canEditMemo } from '@/lib/auth/rbac';
import type { MemoStatusSlug, User } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type MemoListRow = {
  id: string;
  creator_id?: string | null;
  memo_statuses?: unknown;
};

export async function attachCanEditToMemos<T extends MemoListRow>(
  supabase: SupabaseClient,
  user: User,
  memos: T[]
): Promise<(T & { can_edit: boolean })[]> {
  if (memos.length === 0) return [];

  const pendingOwnIds = memos
    .filter((memo) => {
      const slug = joinSlug(memo.memo_statuses as Parameters<typeof joinSlug>[0]) || '';
      return memo.creator_id === user.id && slug.startsWith('pending_');
    })
    .map((memo) => memo.id);

  const approvedMemoIds = new Set<string>();
  if (pendingOwnIds.length > 0) {
    const { data } = await supabase
      .from('approvals')
      .select('memo_id')
      .in('memo_id', pendingOwnIds)
      .eq('action', 'approve');

    for (const row of data || []) {
      approvedMemoIds.add(row.memo_id as string);
    }
  }

  return memos.map((memo) => {
    const statusSlug = joinSlug(memo.memo_statuses as Parameters<typeof joinSlug>[0]) || '';
    const approvals = approvedMemoIds.has(memo.id) ? [{ action: 'approve' as const }] : [];
    const can_edit = canEditMemo(user, {
      creator_id: memo.creator_id || '',
      status: statusSlug
        ? {
            id: '',
            name: '',
            slug: statusSlug as MemoStatusSlug,
            sort_order: 0,
          }
        : undefined,
      approvals,
    });
    return { ...memo, can_edit };
  });
}
