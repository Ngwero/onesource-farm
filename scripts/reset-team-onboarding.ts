/**
 * Reset all team logins for first-time password setup.
 *
 *   npm run reset:onboarding
 *
 * Sets temporary password + must_set_password so each user chooses a new password after sign-in.
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';
import { listAllAuthUsers, ONBOARDING_PASSWORD, resetAuthPasswords } from './lib/teamAuth';

loadEnvLocal();

async function main() {
  const { url, serviceKey } = requireSupabaseEnv();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authUsers = await listAllAuthUsers(supabase);
  if (authUsers.length === 0) {
    console.error('No auth users found.');
    process.exit(1);
  }

  console.log(`Resetting ${authUsers.length} user(s) for onboarding password setup…\n`);

  const { ok, failed, password } = await resetAuthPasswords(supabase, 'onboarding');

  console.log(`  Temporary password: ${password}`);
  console.log('  must_set_password → true (set new password after login)');
  console.log(`\nDone. Updated: ${ok}/${authUsers.length}`);
  if (failed) console.log(`Failed: ${failed}`);
  console.log('\nEach user signs in with their email + temporary password, then creates a new password.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
