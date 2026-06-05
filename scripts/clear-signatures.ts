/**
 * Clear all user signature uploads (DB paths + stored files).
 * Keeps signature_records on submitted memos (historical stamps).
 * Run: npm run clear:signatures
 */

import { existsSync } from 'fs';
import { readdir, rm, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';

loadEnvLocal();

const { url, serviceKey } = requireSupabaseEnv();
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listStoragePaths(bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    console.warn(`  storage list ${prefix || '/'}: ${error.message}`);
    return paths;
  }

  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      paths.push(full);
    } else {
      paths.push(...(await listStoragePaths(bucket, full)));
    }
  }
  return paths;
}

async function clearLocalSignatureFiles(): Promise<number> {
  const dir = resolve(process.cwd(), 'uploads', 'signatures');
  if (!existsSync(dir)) return 0;

  let removed = 0;
  const walk = async (current: string) => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        await rm(full, { recursive: true, force: true });
      } else {
        await unlink(full);
        removed += 1;
      }
    }
  };

  await walk(dir);
  return removed;
}

async function clearSupabaseSignatureFiles(bucket: string): Promise<number> {
  const paths = await listStoragePaths(bucket, 'signatures');
  if (!paths.length) return 0;

  const batchSize = 100;
  let removed = 0;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.warn(`  storage remove: ${error.message}`);
    } else {
      removed += batch.length;
    }
  }
  return removed;
}

async function main() {
  console.log('Clearing uploaded signatures…\n');

  const { data: withSig, error: selectError } = await supabase
    .from('users')
    .select('id, email, signature_path')
    .not('signature_path', 'is', null);

  if (selectError) throw selectError;

  console.log(`  users with signature_path: ${withSig?.length ?? 0}`);

  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  const filesRemoved = bucket
    ? await clearSupabaseSignatureFiles(bucket)
    : await clearLocalSignatureFiles();
  console.log(`  signature files removed: ${filesRemoved}`);

  const { data: cleared, error: updateError } = await supabase
    .from('users')
    .update({ signature_path: null, signature_uploaded_at: null })
    .not('signature_path', 'is', null)
    .select('id');

  if (updateError) throw updateError;

  console.log(`  users cleared in DB: ${cleared?.length ?? 0}`);
  console.log('\nDone. Users must upload a new signature before creating memos.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
