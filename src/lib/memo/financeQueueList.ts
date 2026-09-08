import type { SupabaseClient } from '@supabase/supabase-js';
import { isDesignatedCfo } from '@/lib/memo/designatedUsers';
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

/** Christine or Amara: pending_finance across all memo types with a finance step. */
export function usesSharedFinanceQueue(user: User, status: string | null): boolean {
  if (status !== 'pending_finance') return false;
  if (isInterdeptFinanceReviewer(user)) {
    return user.role?.slug === 'staff' || user.role?.slug === 'finance_reviewer';
  }
  if (isDesignatedCfo(user)) {
    const role = user.role?.slug;
    return role === 'finance_reviewer' || role === 'exco_member' || role === 'staff';
  }
  return false;
}

/** @deprecated Use usesSharedFinanceQueue */
export function usesChristineFinanceQueue(
  user: User,
  status: string | null
): boolean {
  return usesSharedFinanceQueue(user, status) && isInterdeptFinanceReviewer(user);
}

/** @deprecated Use usesSharedFinanceQueue — Amara now shares Christine's full pending queue. */
export function usesAmaraFinanceRequestQueue(user: User, status: string | null): boolean {
  return usesSharedFinanceQueue(user, status) && isDesignatedCfo(user);
}

/** Exclude the viewer's own Finance Request memos from the shared pending queue. */
export function financeQueueExcludeOwnFinanceRequestFilter(
  financeRequestTypeId: string | undefined,
  userId: string
): string | null {
  if (!financeRequestTypeId) return null;
  return `memo_type_id.neq.${financeRequestTypeId},creator_id.neq.${userId}`;
}
