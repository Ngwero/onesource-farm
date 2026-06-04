import type { SupabaseClient } from '@supabase/supabase-js';
import { isDesignatedCfo } from '@/lib/memo/designatedUsers';
import {
  INTERDEPT_FINANCE_MEMO_TYPE_SLUGS,
  isInterdeptFinanceReviewer,
} from '@/lib/memo/financeMemoRouting';
import type { User } from '@/types';

export async function interdeptFinanceMemoTypeIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data } = await supabase
    .from('memo_types')
    .select('id')
    .in('slug', [...INTERDEPT_FINANCE_MEMO_TYPE_SLUGS]);
  return (data || []).map((r) => r.id as string);
}

export async function financeRequestMemoTypeId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from('memo_types')
    .select('id')
    .eq('slug', 'finance_request')
    .maybeSingle();
  return data?.id ?? null;
}

/** Christine (staff): list inter-department memos at pending_finance. */
export function staffShouldUseFinanceQueueList(
  user: User,
  status: string | null
): boolean {
  return isInterdeptFinanceReviewer(user) && status === 'pending_finance';
}

/** Amara (finance_reviewer): only Finance Request memos in finance queues. */
export function financeReviewerUsesFinanceRequestOnly(user: User): boolean {
  return user.role?.slug === 'finance_reviewer' && isDesignatedCfo(user);
}
