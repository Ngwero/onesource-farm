/** True when Supabase URL points at the real project host, not the app domain. */
export function isValidSupabaseProjectUrl(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.endsWith('.supabase.co') || host === 'supabase.co';
  } catch {
    return false;
  }
}

export function getSupabaseUrlMisconfigMessage(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '(not set)';
  return (
    `NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL (https://<ref>.supabase.co), not the app site. ` +
    `Current value looks wrong: ${url}`
  );
}
