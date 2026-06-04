/**
 * Designated IT memo creator (Doreen).
 * Usage: npm run assign:it-creator
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { IT_MEMO_CREATOR_EMAIL } from '../src/lib/workflow/itWorkflowSteps';

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: staffRole } = await supabase.from('roles').select('id').eq('slug', 'staff').single();
  const { data: itDept } = await supabase.from('departments').select('id').eq('code', 'IT').single();

  if (!staffRole?.id || !itDept?.id) {
    console.error('Run supabase/seed.sql first.');
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      role_id: staffRole.id,
      department_id: itDept.id,
      title: 'IT — Staff (creates IT memos)',
    })
    .eq('email', IT_MEMO_CREATOR_EMAIL)
    .select('email')
    .single();

  if (error || !data) {
    console.error(`Could not assign ${IT_MEMO_CREATOR_EMAIL}`);
    process.exit(1);
  }

  console.log(`✓ ${data.email} — only designated IT Request creator`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
