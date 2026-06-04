import type { SupabaseClient } from '@supabase/supabase-js';

export const TEST_PASSWORD =
  process.env.TEST_UNIFIED_PASSWORD ||
  process.env.TEAM_INITIAL_PASSWORD ||
  'Test@RukaPay2026';

export const ONBOARDING_PASSWORD =
  process.env.TEAM_INITIAL_PASSWORD || 'Welcome@RukaPay2026';

export type LoginResetMode = 'test' | 'onboarding';

export async function listAllAuthUsers(
  supabase: SupabaseClient
): Promise<{ id: string; email?: string }[]> {
  const out: { id: string; email?: string }[] = [];
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users || [];
    for (const u of users) {
      if (u.id) out.push({ id: u.id, email: u.email });
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return out;
}

export async function resetAuthPasswords(
  supabase: SupabaseClient,
  mode: LoginResetMode,
  userIds?: string[]
): Promise<{ ok: number; failed: number; password: string }> {
  const password = mode === 'test' ? TEST_PASSWORD : ONBOARDING_PASSWORD;
  const mustSetPassword = mode === 'onboarding';

  let targets = await listAllAuthUsers(supabase);
  if (userIds?.length) {
    const idSet = new Set(userIds);
    targets = targets.filter((u) => idSet.has(u.id));
  }

  let ok = 0;
  let failed = 0;

  for (const { id } of targets) {
    const { error } = await supabase.auth.admin.updateUserById(id, { password });
    if (error) {
      failed += 1;
      continue;
    }
    ok += 1;
  }

  let profileQuery = supabase.from('users').update({ must_set_password: mustSetPassword });

  if (userIds?.length) {
    profileQuery = profileQuery.in('id', userIds);
  } else {
    profileQuery = profileQuery.neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { error: profileError } = await profileQuery;
  if (profileError) throw profileError;

  if (mode === 'onboarding') {
    let welcomeQuery = supabase.from('users').update({ welcome_email_sent_at: null });
    if (userIds?.length) {
      welcomeQuery = welcomeQuery.in('id', userIds);
    } else {
      welcomeQuery = welcomeQuery.not('id', 'is', null);
    }
    const { error: welcomeErr } = await welcomeQuery;
    if (welcomeErr && !welcomeErr.message.includes('welcome_email_sent_at')) {
      throw welcomeErr;
    }
  }

  return { ok, failed, password };
}
