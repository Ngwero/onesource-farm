import type { SupabaseClient } from '@supabase/supabase-js';
import { isDesignatedCfo } from '@/lib/memo/designatedUsers';
import {
  INTERDEPT_FINANCE_MEMO_TYPE_SLUGS,
  isInterdeptFinanceReviewer,
} from '@/lib/memo/financeMemoRouting';
import { FINANCE_MEMO_CREATOR_EMAIL } from '@/lib/workflow/financeWorkflowSteps';
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

/** Amara (CFO / finance_reviewer): Christine's Finance Request memos at pending_finance. */
export function usesAmaraFinanceRequestQueue(user: User, status: string | null): boolean {
  if (status !== 'pending_finance' || !isDesignatedCfo(user)) return false;
  const role = user.role?.slug;
  return role === 'finance_reviewer' || role === 'exco_member';
}

export async function amaraFinanceRequestCreatorId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('email', FINANCE_MEMO_CREATOR_EMAIL.toLowerCase())
    .maybeSingle();
  return (data?.id as string) ?? null;
}
