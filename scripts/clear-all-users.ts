/**
 * Removes all application and auth users (and memo data tied to them).
 * Run: npm run clear:users
 * Re-seed after: npm run seed:users
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function deleteAllRows(table: string) {
  const { data, error: selectError } = await supabase.from(table).select('id').limit(5000);
  if (selectError) {
    console.warn(`  skip ${table}: ${selectError.message}`);
    return 0;
  }
  if (!data?.length) return 0;

  const ids = data.map((r: { id: string }) => r.id);
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) {
    console.warn(`  ${table} delete: ${error.message}`);
    return 0;
  }
  return ids.length;
}

async function clearUsers() {
  console.log('Clearing memo-related data…');
  await deleteAllRows('trash_records');
  await deleteAllRows('sla_tracking');
  await deleteAllRows('delegations');
  await deleteAllRows('shared_memo_access');
  const memoCount = await deleteAllRows('memos');
  console.log(`  removed ${memoCount} memo(s)`);

  await deleteAllRows('audit_logs');
  await deleteAllRows('notifications');

  const { data: profiles } = await supabase.from('users').select('id, email');
  const profileList = profiles || [];
  console.log(`\nRemoving ${profileList.length} profile(s) and auth account(s)…`);

  let page = 1;
  const authIds = new Set<string>();
  for (;;) {
    const { data: list, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of list.users) authIds.add(u.id);
    if (list.users.length < 200) break;
    page += 1;
  }

  const allIds = new Set([...profileList.map((p) => p.id), ...authIds]);

  for (const id of allIds) {
    const email =
      profileList.find((p) => p.id === id)?.email ||
      [...authIds].find((aid) => aid === id);
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      console.error(`  ✗ ${email || id}: ${error.message}`);
    } else {
      console.log(`  ✓ removed ${email || id}`);
    }
  }

  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
  console.log(`\nDone. Remaining users in DB: ${count ?? 0}`);
  console.log('Run npm run seed:users to create demo accounts again.');
}

clearUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
