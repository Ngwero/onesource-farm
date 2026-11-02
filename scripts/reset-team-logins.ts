/**
 * Reset all team logins for testing + re-apply org roles/workflows.
 *
 *   npm run reset:logins
 *
 * Sets every account to TEST_UNIFIED_PASSWORD (default Test@OneSource2026),
 * clears must_set_password, then runs assign:org and assign:it-checkers.
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';
import { resetAuthPasswords, TEST_PASSWORD } from './lib/teamAuth';

loadEnvLocal();

async function main() {
  const { url, serviceKey } = requireSupabaseEnv();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Step 1/3 — Reset all login passwords (test mode)…\n');
  const { ok, failed, password } = await resetAuthPasswords(supabase, 'test');
  console.log(`  Updated: ${ok} account(s)`);
  if (failed) console.log(`  Failed: ${failed}`);
  console.log(`  Password: ${password}`);
  console.log('  must_set_password → false\n');

  console.log('Step 2/3 — Org workflows & key roles (assign:org)…\n');
  execSync('npm run assign:org', { stdio: 'inherit', cwd: process.cwd() });

  console.log('\nStep 3/3 — IT checkers (assign:it-checkers)…\n');
  execSync('npm run assign:it-checkers', { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n────────────────────────────────────────');
  console.log('All team logins reset for testing.');
  console.log(`  Sign in: any @onesourcefresh.com email + ${TEST_PASSWORD}`);
  console.log('  Admin → Users: assign department & role per person.');
  console.log('────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
