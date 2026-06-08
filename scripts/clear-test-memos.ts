/**
 * Delete test memos but keep the earliest N memos (default: 4).
 * Run: npm run clear:test-memos
 * Override: KEEP_MEMOS=6 npm run clear:test-memos
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';

loadEnvLocal();

const keepCount = Math.max(0, parseInt(process.env.KEEP_MEMOS || '4', 10));
const { url, serviceKey } = requireSupabaseEnv();

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function removeAttachmentFiles(memoIds: string[]): Promise<number> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!bucket || memoIds.length === 0) return 0;

  const { data: rows, error } = await supabase
    .from('memo_attachments')
    .select('file_path')
    .in('memo_id', memoIds);

  if (error) {
    console.warn(`  memo_attachments lookup: ${error.message}`);
    return 0;
  }

  const paths = (rows || []).map((r) => r.file_path as string).filter(Boolean);
  if (paths.length === 0) return 0;

  let removed = 0;
  const batchSize = 100;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error: removeError } = await supabase.storage.from(bucket).remove(batch);
    if (removeError) {
      console.warn(`  storage remove: ${removeError.message}`);
    } else {
      removed += batch.length;
    }
  }
  return removed;
}

async function deleteMemosById(ids: string[]): Promise<number> {
  let total = 0;
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase.from('memos').delete().in('id', batch);
    if (error) throw new Error(`memo delete failed: ${error.message}`);
    total += batch.length;
  }
  return total;
}

async function clearTestMemos() {
  console.log(`Keeping the first ${keepCount} memo(s) by created_at; deleting the rest…\n`);

  const { data: memos, error } = await supabase
    .from('memos')
    .select('id, reference_number, created_at')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const all = memos || [];
  if (all.length === 0) {
    console.log('No memos in database.');
    return;
  }

  const kept = all.slice(0, keepCount);
  const toRemove = all.slice(keepCount);

  console.log('Keeping:');
  for (const memo of kept) {
    console.log(`  ${memo.reference_number} (${memo.id})`);
  }

  if (toRemove.length === 0) {
    console.log(`\nNothing to delete (${all.length} memo(s) total).`);
    return;
  }

  console.log('\nDeleting:');
  for (const memo of toRemove) {
    console.log(`  ${memo.reference_number} (${memo.id})`);
  }

  const removeIds = toRemove.map((m) => m.id as string);
  const storageFiles = await removeAttachmentFiles(removeIds);
  console.log(`\n  supabase attachment files removed: ${storageFiles}`);

  const deleted = await deleteMemosById(removeIds);
  console.log(`  memos deleted: ${deleted}`);

  const { count } = await supabase.from('memos').select('*', { count: 'exact', head: true });
  console.log(`\nDone. Remaining memos: ${count ?? kept.length}`);
}

clearTestMemos().catch((err) => {
  console.error(err);
  process.exit(1);
});
