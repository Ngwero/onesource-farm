import type { SupabaseClient } from '@supabase/supabase-js';
import {
  designatedFinanceStepReviewerCanApprove,
  designatedFinanceStepReviewerCanView,
  isInterdeptFinanceReviewer,
} from '@/lib/memo/financeMemoRouting';
import { financeStepMemoTypeIds } from '@/lib/memo/financeQueueList';
import { rowToMemoForAccess, type MemoAccessRow } from '@/lib/auth/memoRbacShape';
import type { User } from '@/types';

type MemoRowForInvolvement = Pick<MemoAccessRow, 'id' | 'creator_id'> & {
  memo_types?: { slug?: string } | { slug?: string }[] | null;
  memo_statuses?: { slug?: string } | { slug?: string }[] | null;
  creator?: { email?: string | null } | { email?: string | null }[] | null;
};

/** Memos the user created, approved, was shared on, or is the current finance reviewer for. */
export async function fetchMemoIdsInvolvingUser(
  supabase: SupabaseClient,
  user: User
): Promise<string[]> {
  const ids = new Set<string>();

  const [
    { data: created },
    { data: approvals },
    { data: signatures },
    { data: shared },
    { data: slaRows },
  ] = await Promise.all([
    supabase.from('memos').select('id').eq('creator_id', user.id),
    supabase.from('approvals').select('memo_id').eq('approver_id', user.id),
    supabase.from('signature_records').select('memo_id').eq('approver_id', user.id),
    supabase.from('shared_memo_access').select('memo_id').eq('shared_with', user.id),
    supabase
      .from('sla_tracking')
      .select('memo_id')
      .eq('assigned_to', user.id)
      .eq('status', 'active'),
  ]);

  for (const row of created || []) ids.add(row.id as string);
  for (const row of approvals || []) ids.add(row.memo_id as string);
  for (const row of signatures || []) ids.add(row.memo_id as string);
  for (const row of shared || []) ids.add(row.memo_id as string);
  for (const row of slaRows || []) ids.add(row.memo_id as string);

  if (isInterdeptFinanceReviewer(user)) {
    const financeQueueIds = await fetchFinanceReviewerQueueMemoIds(supabase, user);
    for (const id of financeQueueIds) ids.add(id);
  }

  return [...ids];
}

async function fetchFinanceReviewerQueueMemoIds(
  supabase: SupabaseClient,
  user: User
): Promise<string[]> {
  const [typeIds, { data: finType }, { data: pendingFinance }] = await Promise.all([
    financeStepMemoTypeIds(supabase),
    supabase.from('memo_types').select('id').eq('slug', 'finance_request').maybeSingle(),
    supabase.from('memo_statuses').select('id').eq('slug', 'pending_finance').maybeSingle(),
  ]);

  if (typeIds.length === 0 || !pendingFinance?.id) return [];

  const { data } = await supabase
    .from('memos')
    .select('id, creator_id, memo_type_id')
    .in('memo_type_id', typeIds)
    .eq('status_id', pendingFinance.id);

  const result: string[] = [];
  for (const row of data || []) {
    if (finType?.id && row.memo_type_id === finType.id && row.creator_id === user.id) {
      continue;
    }
    result.push(row.id as string);
  }
  return result;
}

/** True when the user is part of this memo's workflow (not merely same department). */
export async function userIsInvolvedInMemo(
  supabase: SupabaseClient,
  user: User,
  memoId: string,
  row?: MemoRowForInvolvement
): Promise<boolean> {
  if (row?.creator_id === user.id) return true;

  const [shared, approval, signature, sla] = await Promise.all([
    supabase
      .from('shared_memo_access')
      .select('memo_id')
      .eq('memo_id', memoId)
      .eq('shared_with', user.id)
      .maybeSingle(),
    supabase
      .from('approvals')
      .select('id')
      .eq('memo_id', memoId)
      .eq('approver_id', user.id)
      .limit(1),
    supabase
      .from('signature_records')
      .select('id')
      .eq('memo_id', memoId)
      .eq('approver_id', user.id)
      .limit(1),
    supabase
      .from('sla_tracking')
      .select('id')
      .eq('memo_id', memoId)
      .eq('assigned_to', user.id)
      .eq('status', 'active')
      .limit(1),
  ]);

  if (shared.data) return true;
  if ((approval.data || []).length > 0) return true;
  if ((signature.data || []).length > 0) return true;
  if ((sla.data || []).length > 0) return true;

  if (isInterdeptFinanceReviewer(user) && row) {
    const memo = rowToMemoForAccess(row as unknown as MemoAccessRow);
    if (designatedFinanceStepReviewerCanApprove(user, memo)) return true;
    if (designatedFinanceStepReviewerCanView(user, memo)) return true;
  }

  return false;
}
