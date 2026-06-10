/**
 * Point every memo signature stamp at each user's current signature upload.
 * Run: npm run repair:signatures
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';

loadEnvLocal();

const { url, serviceKey } = requireSupabaseEnv();
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function needsSync(stored: string | null | undefined, current: string): boolean {
  return !stored?.trim() || stored !== current;
}

async function main() {
  console.log('Repairing stale memo signatures for all users…\n');

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, title, signature_path')
    .not('signature_path', 'is', null);

  if (error) throw error;

  let total = 0;

  for (const user of users || []) {
    const signaturePath = (user.signature_path as string | null)?.trim();
    if (!signaturePath) continue;

    const { data: records } = await supabase
      .from('signature_records')
      .select('id, signature_path')
      .eq('approver_id', user.id);

    const recordIds = (records || [])
      .filter((row) => needsSync(row.signature_path as string | null, signaturePath))
      .map((row) => row.id as string);

    if (recordIds.length > 0) {
      const { error: recordError } = await supabase
        .from('signature_records')
        .update({
          signature_path: signaturePath,
          approver_name: user.full_name,
          approver_title: user.title,
        })
        .in('id', recordIds);
      if (recordError) throw recordError;
      total += recordIds.length;
      console.log(`  ${user.email}: ${recordIds.length} signature record(s)`);
    }

    const { data: approvals } = await supabase
      .from('approvals')
      .select('id, signature_path')
      .eq('approver_id', user.id);

    const approvalIds = (approvals || [])
      .filter((row) => needsSync(row.signature_path as string | null, signaturePath))
      .map((row) => row.id as string);

    if (approvalIds.length > 0) {
      const { error: approvalError } = await supabase
        .from('approvals')
        .update({ signature_path: signaturePath })
        .in('id', approvalIds);
      if (approvalError) throw approvalError;
      total += approvalIds.length;
      console.log(`  ${user.email}: ${approvalIds.length} approval row(s)`);
    }
  }

  console.log(`\nDone. Updated ${total} row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
