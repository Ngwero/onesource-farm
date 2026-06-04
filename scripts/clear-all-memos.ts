/**
 * Delete all memos and related data (keeps users, roles, workflows).
 * Run: npm run clear:memos
 */

import { readFileSync, existsSync } from 'fs';
import { readdir as readdirAsync, unlink as unlinkAsync, rm } from 'fs/promises';
import { resolve, join } from 'path';
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

async function deleteAllRows(table: string): Promise<number> {
  let total = 0;
  for (;;) {
    const { data, error: selectError } = await supabase.from(table).select('id').limit(500);
    if (selectError) {
      console.warn(`  skip ${table}: ${selectError.message}`);
      return total;
    }
    if (!data?.length) break;

    const ids = data.map((r: { id: string }) => r.id);
    const { error } = await supabase.from(table).delete().in('id', ids);
    if (error) {
      console.warn(`  ${table} delete: ${error.message}`);
      return total;
    }
    total += ids.length;
    if (data.length < 500) break;
  }
  return total;
}

async function clearAttachmentFiles() {
  const attachmentsDir = resolve(process.cwd(), 'uploads', 'attachments');
  if (!existsSync(attachmentsDir)) return 0;

  let removed = 0;
  const walk = async (dir: string) => {
    const entries = await readdirAsync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        try {
          await rm(full, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      } else {
        await unlinkAsync(full);
        removed += 1;
      }
    }
  };

  await walk(attachmentsDir);
  return removed;
}

async function resetMemoSequences() {
  const year = new Date().getFullYear();
  const { error } = await supabase.from('memo_sequences').upsert(
    { year, last_sequence: 0 },
    { onConflict: 'year' }
  );
  if (error) console.warn(`  memo_sequences reset: ${error.message}`);
}

async function clearMemos() {
  console.log('Erasing all memos and related records…\n');

  const trash = await deleteAllRows('trash_records');
  console.log(`  trash_records: ${trash}`);

  const sla = await deleteAllRows('sla_tracking');
  console.log(`  sla_tracking: ${sla}`);

  const shared = await deleteAllRows('shared_memo_access');
  console.log(`  shared_memo_access: ${shared}`);

  const memos = await deleteAllRows('memos');
  console.log(`  memos: ${memos}`);

  const audit = await deleteAllRows('audit_logs');
  console.log(`  audit_logs: ${audit}`);

  const notifications = await deleteAllRows('notifications');
  console.log(`  notifications: ${notifications}`);

  await resetMemoSequences();
  console.log('  memo_sequences: reset for current year');

  const files = await clearAttachmentFiles();
  console.log(`  attachment files removed: ${files}`);

  const { count } = await supabase.from('memos').select('*', { count: 'exact', head: true });
  console.log(`\nDone. Remaining memos: ${count ?? 0}`);
  console.log('Users, roles, and workflows are unchanged.');
}

clearMemos().catch((err) => {
  console.error(err);
  process.exit(1);
});
