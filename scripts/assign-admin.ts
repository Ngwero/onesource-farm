/**
 * Promote a user to system admin (full access).
 * Usage: npm run assign:admin
 * Optional: npm run assign:admin -- other@rukapay.co.ug
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL, IT_FIRST_CHECKER_EMAIL } from '../src/lib/workflow/itCheckers';

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

const DEFAULT_ADMIN_EMAIL = ADMIN_EMAIL;
const PREVIOUS_ADMIN_EMAIL = 'rowena.turinawe@rukapay.co.ug';

async function main() {
  const targetEmail = (process.argv[2] || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: adminRole } = await supabase
    .from('roles')
    .select('id')
    .eq('slug', 'admin')
    .single();
  const { data: staffRole } = await supabase
    .from('roles')
    .select('id')
    .eq('slug', 'staff')
    .single();

  if (!adminRole?.id || !staffRole?.id) {
    console.error('Run supabase/seed.sql first (roles missing).');
    process.exit(1);
  }

  const { data: target, error: targetErr } = await supabase
    .from('users')
    .select('id, email, full_name, role_id, roles(slug)')
    .eq('email', targetEmail)
    .single();

  if (targetErr || !target) {
    console.error(`User not found: ${targetEmail}. Run npm run seed:team first.`);
    process.exit(1);
  }

  const { data: itDept } = await supabase.from('departments').select('id').eq('code', 'IT').single();

  const title =
    targetEmail === IT_FIRST_CHECKER_EMAIL
      ? 'System Administrator & IT Checker (1st)'
      : 'System Administrator';

  const profileUpdate: { role_id: string; title: string; department_id?: string | null } = {
    role_id: adminRole.id,
    title,
  };
  if (targetEmail === IT_FIRST_CHECKER_EMAIL) {
    profileUpdate.department_id = itDept?.id ?? null;
  }

  const { error: promoteErr } = await supabase
    .from('users')
    .update(profileUpdate)
    .eq('id', target.id);

  if (promoteErr) {
    console.error('Failed to promote user:', promoteErr.message);
    process.exit(1);
  }

  console.log(`✓ ${target.email} is now admin (${target.full_name})`);

  if (targetEmail !== PREVIOUS_ADMIN_EMAIL) {
    const { data: previous } = await supabase
      .from('users')
      .select('id, email, full_name, roles(slug)')
      .eq('email', PREVIOUS_ADMIN_EMAIL)
      .maybeSingle();

    if (previous?.id && (previous.roles as { slug?: string } | null)?.slug === 'admin') {
      const { error: demoteErr } = await supabase
        .from('users')
        .update({ role_id: staffRole.id, title: previous.full_name })
        .eq('id', previous.id);

      if (demoteErr) {
        console.warn(`Could not demote previous admin ${PREVIOUS_ADMIN_EMAIL}:`, demoteErr.message);
      } else {
        console.log(`✓ ${PREVIOUS_ADMIN_EMAIL} changed to staff (was admin)`);
      }
    }
  }

  console.log('\nSign in as the new admin to use Admin → Users, Workflows, Branding, etc.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
