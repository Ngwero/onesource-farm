/**
 * Set the same login password for every user (testing only).
 *
 *   npm run test:password
 *
 * Prefer full reset + org setup: npm run reset:logins
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';
import { listAllAuthUsers, resetAuthPasswords, TEST_PASSWORD } from './lib/teamAuth';

loadEnvLocal();

async function main() {
  const { url, serviceKey } = requireSupabaseEnv();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authUsers = await listAllAuthUsers(supabase);
  if (authUsers.length === 0) {
    console.error('No auth users found. Run npm run seed:team first.');
    process.exit(1);
  }

  console.log(`Setting unified test password for ${authUsers.length} user(s)…\n`);
  const { ok, failed, password } = await resetAuthPasswords(supabase, 'test');

  console.log(`  Password: ${password}`);
  console.log('  must_set_password → false\n');
  console.log(`Done. Auth passwords updated: ${ok}/${authUsers.length}`);
  if (failed) console.log(`Failed: ${failed}`);
  console.log('\nSign in as any team email with the password above.');
  console.log(`Example: emmanuel.ngwero@onesourcefresh.com / ${TEST_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
