import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoleSlug } from '@/types';

const APPROVER_ROLES: RoleSlug[] = [
  'department_head',
  'it_checker_first',
  'it_checker_second',
  'finance_reviewer',
  'hr_reviewer',
  'ceo',
  'exco_member',
];

/**
 * Memo IDs for the "Approved" tab / filter.
 * - Approvers: memos they have signed off (any step).
 * - Staff: own memos that are fully approved or have at least one approver signature.
 * - Admin: null → caller should filter by status slug `approved` only.
 */
export async function fetchMemoIdsForApprovedTab(
  supabase: SupabaseClient,
  userId: string,
  role: RoleSlug
): Promise<string[] | null> {
  if (role === 'admin') {
    return null;
  }

  if (APPROVER_ROLES.includes(role)) {
    const ids = new Set<string>();

    const { data: signatures } = await supabase
      .from('signature_records')
      .select('memo_id')
      .eq('approver_id', userId);

    for (const row of signatures || []) {
      ids.add(row.memo_id as string);
    }

    if (role === 'exco_member') {
      const { data: exco } = await supabase
        .from('exco_approvals')
        .select('memo_id')
        .eq('approver_id', userId)
        .eq('action', 'approve');

      for (const row of exco || []) {
        ids.add(row.memo_id as string);
      }
    }

    return [...ids];
  }

  if (role === 'staff') {
    const ids = new Set<string>();

    const { data: approvedStatus } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'approved')
      .single();

    if (approvedStatus?.id) {
      const { data: fullyApproved } = await supabase
        .from('memos')
        .select('id')
        .eq('creator_id', userId)
        .eq('status_id', approvedStatus.id);

      for (const row of fullyApproved || []) {
        ids.add(row.id as string);
      }
    }

    const { data: ownMemos } = await supabase.from('memos').select('id').eq('creator_id', userId);
    const ownIds = (ownMemos || []).map((m) => m.id as string);

    if (ownIds.length > 0) {
      const { data: signatures } = await supabase
        .from('signature_records')
        .select('memo_id')
        .in('memo_id', ownIds);

      for (const row of signatures || []) {
        ids.add(row.memo_id as string);
      }
    }

    return [...ids];
  }

  return null;
}
