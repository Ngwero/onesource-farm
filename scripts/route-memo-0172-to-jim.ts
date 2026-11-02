/**
 * RPS/EMEMO/2026/0172 (leave by Emmanuel): assign the Dept Head step to Jim (then CEO).
 * Usage: npx tsx scripts/route-memo-0172-to-jim.ts
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

const REF = 'RPS/EMEMO/2026/0172';
const JIM_EMAIL = 'jim.ntare@onesourcefresh.com';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: memo }, { data: jim }, { data: pendingDeptHead }] = await Promise.all([
    supabase.from('memos').select('id, subject').eq('reference_number', REF).single(),
    supabase.from('users').select('id, full_name').eq('email', JIM_EMAIL).single(),
    supabase.from('memo_statuses').select('id').eq('slug', 'pending_department_head').single(),
  ]);
  if (!memo || !jim || !pendingDeptHead) throw new Error('Memo, Jim or status not found');

  await supabase
    .from('memos')
    .update({ status_id: pendingDeptHead.id, current_step_order: 1 })
    .eq('id', memo.id);

  await supabase
    .from('sla_tracking')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('memo_id', memo.id)
    .eq('status', 'active');

  const { error: slaErr } = await supabase.from('sla_tracking').insert({
    memo_id: memo.id,
    step_order: 1,
    assigned_to: jim.id,
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  });
  if (slaErr) throw slaErr;

  const { error: notifErr } = await supabase.from('notifications').insert({
    user_id: jim.id,
    memo_id: memo.id,
    title: 'Memo awaiting your approval',
    message: `${REF} — ${memo.subject?.trim()} (leave request from Emmanuel Ngwero) needs your Department Head approval. After you approve it goes to the CEO.`,
    type: 'memo_routed',
    email_sent: false,
  });
  if (notifErr) throw notifErr;

  console.log(`${REF} assigned to ${jim.full_name} (Dept Head) → CEO`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
