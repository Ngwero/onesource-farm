/**
 * CEO / Chairman routing: Rowena creates memos → Douglas (Chairman) approves.
 * Usage: npm run assign:ceo-chairman
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  CEO_MEMO_CREATOR_EMAIL,
  CHAIRMAN_APPROVER_EMAIL,
} from '../src/lib/memo/designatedUsers';

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

function fullNameFromEmail(email: string): string {
  const local = email.split('@')[0] || '';
  return local
    .split('.')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

async function ensureAuthUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  full_name: string,
  password: string
): Promise<string | null> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError && !authError.message.toLowerCase().includes('already')) {
    console.error(`✗ ${email} auth: ${authError.message}`);
    return null;
  }

  if (authData?.user?.id) return authData.user.id;

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  return existing?.id ?? null;
}

async function assignUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  roleSlug: string,
  deptCode: string | null,
  title: string,
  password: string
) {
  const full_name = fullNameFromEmail(email);
  const userId = await ensureAuthUser(supabase, email, full_name, password);
  if (!userId) return;

  const { data: role } = await supabase.from('roles').select('id').eq('slug', roleSlug).single();
  let deptId: string | null = null;
  if (deptCode) {
    const { data: dept } = await supabase.from('departments').select('id').eq('code', deptCode).single();
    deptId = dept?.id ?? null;
  }
  if (!role?.id) throw new Error(`Role ${roleSlug} missing`);

  const { error } = await supabase.from('users').upsert({
    id: userId,
    email,
    full_name,
    title,
    role_id: role.id,
    department_id: deptId,
    is_active: true,
    must_set_password: false,
  });

  if (error) {
    console.error(`✗ ${email} profile: ${error.message}`);
    return;
  }

  console.log(`✓ ${email} — ${title}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing .env.local Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const password =
    process.env.TEST_UNIFIED_PASSWORD ||
    process.env.TEAM_INITIAL_PASSWORD ||
    'Welcome@RukaPay2026';

  console.log('CEO / Chairman routing\n');
  console.log(`  Creator:  ${CEO_MEMO_CREATOR_EMAIL} (Rowena — CEO)`);
  console.log(`  Approver: ${CHAIRMAN_APPROVER_EMAIL} (Douglas — Chairman)\n`);

  await assignUser(supabase, CEO_MEMO_CREATOR_EMAIL, 'ceo', 'CEO', 'Chief Executive Officer', password);
  await assignUser(supabase, CHAIRMAN_APPROVER_EMAIL, 'ceo', 'CEO', 'Chairman', password);

  console.log('\nDone. Rowena memos route directly to Douglas for Chairman approval.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
