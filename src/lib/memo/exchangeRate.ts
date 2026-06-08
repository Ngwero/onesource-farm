import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_USD_TO_UGX_RATE = 3700;

export function normalizeUsdToUgxRate(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_USD_TO_UGX_RATE;
  return n;
}

export async function fetchUsdToUgxRate(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('branding_settings')
    .select('usd_to_ugx_rate')
    .limit(1)
    .maybeSingle();

  return normalizeUsdToUgxRate(data?.usd_to_ugx_rate);
}
