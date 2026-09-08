import type { SupabaseClient } from '@supabase/supabase-js';
import { findApproversForStep } from '@/lib/memo/approvers';
import { PENDING_STATUS_TO_ROLE } from '@/lib/memo/statusLabel';
import type { MemoTypeSlug, MemoStatusSlug } from '@/types';

type MemoRowForAssignee = {
  id: string;
  department_id?: string | null;
  current_step_order?: number | null;
  memo_statuses?: { slug?: string } | { slug?: string }[] | null;
  memo_types?: { slug?: string } | { slug?: string }[] | null;
  creator?: { email?: string } | { email?: string }[] | null;
  creator_id?: string | null;
};

function joinSlug<T extends { slug?: string }>(
  row: T | T[] | null | undefined
): string | undefined {
  if (!row) return undefined;
  if (Array.isArray(row)) return row[0]?.slug;
  return row.slug;
}

async function userLabelsForIds(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<{ id: string; full_name: string }[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds);
  const byId = new Map(
    (data || [])
      .filter((u) => u.full_name?.trim())
      .map((u) => [u.id as string, { id: u.id as string, full_name: (u.full_name as string).trim() }])
  );
  return userIds.map((id) => byId.get(id)).filter(Boolean) as { id: string; full_name: string }[];
}

async function resolveAssigneeFromWorkflow(
  supabase: SupabaseClient,
  memo: MemoRowForAssignee
): Promise<{ id: string; full_name: string; allIds: string[] } | null> {
  const statusSlug = joinSlug(memo.memo_statuses) as MemoStatusSlug | undefined;
  if (!statusSlug?.startsWith('pending_')) return null;

  const roleSlug = PENDING_STATUS_TO_ROLE[statusSlug];
  if (!roleSlug || !memo.department_id) return null;

  const memoTypeSlug = joinSlug(memo.memo_types) as MemoTypeSlug | string | undefined;
  const creatorRel = memo.creator;
  const creatorEmail = Array.isArray(creatorRel) ? creatorRel[0]?.email : creatorRel?.email;
  const approverIds = await findApproversForStep(
    roleSlug,
    memo.department_id,
    memoTypeSlug,
    memo.current_step_order ?? undefined,
    creatorEmail
  );
  if (approverIds.length === 0) return null;

  const labels = await userLabelsForIds(supabase, approverIds);
  if (labels.length === 0) return null;

  const full_name =
    labels.length === 1
      ? labels[0].full_name
      : labels.map((l) => l.full_name.split(/\s+/)[0]).join(' / ');

  return { id: labels[0].id, full_name, allIds: labels.map((l) => l.id) };
}

export type PendingAssigneeFields = {
  pending_assignee_id?: string | null;
  pending_assignee_name?: string | null;
  pending_assignee_is_you?: boolean;
};

/** Attach assignee fields for list/detail rows (from active SLA or workflow routing). */
export async function attachPendingAssigneeNames<T extends MemoRowForAssignee>(
  supabase: SupabaseClient,
  memos: T[],
  viewingUserId?: string | null
): Promise<(T & PendingAssigneeFields)[]> {
  const pending = memos.filter((m) => joinSlug(m.memo_statuses)?.startsWith('pending_'));
  if (pending.length === 0) {
    return memos.map((m) => ({
      ...m,
      pending_assignee_id: null,
      pending_assignee_name: null,
      pending_assignee_is_you: false,
    }));
  }

  const pendingIds = pending.map((m) => m.id);
  const { data: slaRows } = await supabase
    .from('sla_tracking')
    .select('memo_id, assignee:users!assigned_to(id, full_name)')
    .in('memo_id', pendingIds)
    .eq('status', 'active');

  const assigneeByMemo = new Map<
    string,
    { id: string; full_name: string; allIds?: string[] }
  >();

  for (const row of slaRows || []) {
    const memoId = row.memo_id as string;
    if (assigneeByMemo.has(memoId)) continue;
    const assignee = row.assignee as
      | { id?: string; full_name?: string }
      | { id?: string; full_name?: string }[]
      | null;
    const person = Array.isArray(assignee) ? assignee[0] : assignee;
    if (person?.id && person.full_name?.trim()) {
      assigneeByMemo.set(memoId, { id: person.id, full_name: person.full_name.trim() });
    }
  }

  await Promise.all(
    pending.map(async (m) => {
      const existing = assigneeByMemo.get(m.id);
      const resolved = await resolveAssigneeFromWorkflow(supabase, m);
      if (!resolved) return;
      if (!existing) {
        assigneeByMemo.set(m.id, resolved);
        return;
      }
      // Keep SLA primary name, but include all eligible approvers for "is you".
      assigneeByMemo.set(m.id, {
        ...existing,
        allIds: [...new Set([...(existing.allIds ?? [existing.id]), ...resolved.allIds])],
      });
    })
  );

  return memos.map((m) => {
    const assignee = assigneeByMemo.get(m.id);
    const assigneeId = assignee?.id ?? null;
    const allIds = assignee?.allIds ?? (assigneeId ? [assigneeId] : []);
    return {
      ...m,
      pending_assignee_id: assigneeId,
      pending_assignee_name: assignee?.full_name ?? null,
      pending_assignee_is_you: Boolean(
        viewingUserId && allIds.length > 0 && allIds.includes(viewingUserId)
      ),
    };
  });
}
