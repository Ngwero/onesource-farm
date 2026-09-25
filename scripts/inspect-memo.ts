/**
 * Print a memo's routing state by reference number.
 * Usage: npx tsx scripts/inspect-memo.ts RPS/EMEMO/2026/0172
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

async function main() {
  const ref = process.argv[2];
  if (!ref) throw new Error('Pass a reference number');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: memo, error } = await supabase
    .from('memos')
    .select(
      'id, reference_number, subject, current_step_order, workflow_id, requires_finance, memo_types(slug, name), memo_statuses(slug), departments(code), creator:users!creator_id(full_name, email)'
    )
    .eq('reference_number', ref)
    .maybeSingle();
  if (error) throw error;
  if (!memo) {
    console.log('Memo not found');
    return;
  }
  console.log(JSON.stringify(memo, null, 2));

  const [{ data: approvals }, { data: sla }, { data: sigs }] = await Promise.all([
    supabase
      .from('approvals')
      .select('step_order, action, approver_id, signed_at')
      .eq('memo_id', memo.id)
      .order('signed_at'),
    supabase
      .from('sla_tracking')
      .select('step_order, assigned_to, status')
      .eq('memo_id', memo.id),
    supabase
      .from('signature_records')
      .select('block_type, approver_name')
      .eq('memo_id', memo.id),
  ]);
  console.log('approvals', approvals);
  console.log('sla', sla);
  console.log('signatures', sigs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
