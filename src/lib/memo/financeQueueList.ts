import type { SupabaseClient } from '@supabase/supabase-js';
import {
  INTERDEPT_FINANCE_MEMO_TYPE_SLUGS,
  isInterdeptFinanceReviewer,
} from '@/lib/memo/financeMemoRouting';
import type { User } from '@/types';

export const FINANCE_STEP_MEMO_TYPE_SLUGS = [
  ...INTERDEPT_FINANCE_MEMO_TYPE_SLUGS,
  'finance_request',
] as const;

export async function financeStepMemoTypeIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data } = await supabase
    .from('memo_types')
    .select('id')
    .in('slug', [...FINANCE_STEP_MEMO_TYPE_SLUGS]);
  return (data || []).map((r) => r.id as string);
}

/** Christine: pending_finance queue across all memo types with a finance step. */
export function usesChristineFinanceQueue(
  user: User,
  status: string | null
): boolean {
  return (
    isInterdeptFinanceReviewer(user) &&
    status === 'pending_finance' &&
    (user.role?.slug === 'staff' || user.role?.slug === 'finance_reviewer')
  );
}
