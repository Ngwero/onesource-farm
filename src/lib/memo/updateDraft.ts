import { createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { assertCanEditMemo, rowToMemoForAccess } from '@/lib/auth/memoAccess';
import { canEditMemo } from '@/lib/auth/rbac';
import { memoFromLineForUser } from '@/lib/memo/personLine';
import type { User } from '@/types';

export const MEMO_PATCH_FIELDS = [
  'memo_from',
  'memo_thru',
  'memo_to',
  'memo_date',
  'subject',
  'background',
  'financial_implication',
  'justification',
  'recommendation',
  'requires_finance',
  'importance_level',
  'memo_type_id',
] as const;

export function hasMemoPatchFields(body: Record<string, unknown>): boolean {
  return MEMO_PATCH_FIELDS.some((key) => key in body && body[key] !== undefined);
}

export async function patchEditableMemo(
  user: User,
  memoId: string,
  body: Record<string, unknown>,
  changeReason?: string
) {
  const updates = Object.fromEntries(
    Object.entries(body).filter(([key]) =>
      (MEMO_PATCH_FIELDS as readonly string[]).includes(key)
    )
  ) as Record<string, unknown>;
  updates.memo_from = memoFromLineForUser(user);

  await assertCanEditMemo(user, memoId);

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('memos')
    .select('*, memo_statuses(slug), current_version')
    .eq('id', memoId)
    .single();

  if (!existing) throw new Error('Not found');

  const memo = rowToMemoForAccess(existing);
  if (!canEditMemo(user, memo)) {
    throw new Error('Memo cannot be edited');
  }

  const { error } = await supabase.from('memos').update(updates).eq('id', memoId);
  if (error) throw error;

  const newVersion = (existing.current_version || 1) + 1;
  await supabase.from('memo_versions').insert({
    memo_id: memoId,
    version_number: newVersion,
    ...updates,
    changed_by: user.id,
    change_reason: changeReason || 'Memo updated',
  });

  await supabase.from('memos').update({ current_version: newVersion }).eq('id', memoId);

  await logAudit({
    memoId,
    userId: user.id,
    action: 'memo_edited',
    newValues: updates,
  });
}
