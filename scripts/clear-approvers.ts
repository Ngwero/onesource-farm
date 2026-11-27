/**
 * Clear all assigned approver people so they can be reassigned.
 * - Demotes approval roles to staff (keeps admin)
 * - Neutralizes person names on approval step labels
 * - Deactivates EXCO memberships
 *
 *   npx tsx scripts/clear-approvers.ts
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

const APPROVER_ROLE_SLUGS = [
  'ceo',
  'finance_reviewer',
  'department_head',
  'business_head',
  'it_checker_first',
  'it_checker_second',
  'hr_reviewer',
  'exco_member',
] as const;

const KEEP_ADMIN_EMAILS = new Set([
  'engwero@gmail.com',
  'emmanuel.ngwero@onesourcefresh.com',
]);

const STEP_RENAMES: Record<string, string> = {
  'IT Check — 1st (Emma)': 'IT Check — 1st',
  'IT Check — 1st (Emmanuel)': 'IT Check — 1st',
  'IT Check — 2nd (Jim)': 'IT Check — 2nd',
  'Finance Review (Christine)': 'Finance Review',
  'Finance Review (Amara - CFO)': 'Finance Review',
  'Business Head (Norman)': 'Business Head Approval',
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: roles, error: rolesErr } = await sb.from('roles').select('id, slug');
  if (rolesErr) throw rolesErr;
  const roleBySlug = new Map((roles ?? []).map((r) => [r.slug, r.id]));
  const staffId = roleBySlug.get('staff');
  if (!staffId) throw new Error('staff role missing');

  const { data: users, error: usersErr } = await sb
    .from('users')
    .select('id, email, full_name, role_id, roles(slug)');
  if (usersErr) throw usersErr;

  let demoted = 0;
  for (const user of users ?? []) {
    const slug = (user.roles as { slug?: string } | null)?.slug;
    if (!slug || !(APPROVER_ROLE_SLUGS as readonly string[]).includes(slug)) continue;
    if (KEEP_ADMIN_EMAILS.has(user.email.toLowerCase())) {
      console.log(`skip admin ${user.email}`);
      continue;
    }
    const { error } = await sb.from('users').update({ role_id: staffId }).eq('id', user.id);
    if (error) throw error;
    console.log(`demoted ${user.email} (${slug} → staff)`);
    demoted += 1;
  }

  const { data: steps } = await sb.from('approval_steps').select('id, step_name');
  let renamed = 0;
  for (const step of steps ?? []) {
    const next = STEP_RENAMES[step.step_name];
    if (!next || next === step.step_name) continue;
    const { error } = await sb.from('approval_steps').update({ step_name: next }).eq('id', step.id);
    if (error) throw error;
    console.log(`step "${step.step_name}" → "${next}"`);
    renamed += 1;
  }

  // Generic cleanup for any remaining person-in-parentheses labels
  for (const step of steps ?? []) {
    if (STEP_RENAMES[step.step_name]) continue;
    const cleaned = step.step_name
      .replace(/\s*\([^)]*(Emma|Emmanuel|Jim|Christine|Amara|Norman|Margaret|Dorothy|Rowena|Douglas)[^)]*\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!cleaned || cleaned === step.step_name) continue;
    const { error } = await sb.from('approval_steps').update({ step_name: cleaned }).eq('id', step.id);
    if (error) throw error;
    console.log(`step cleaned "${step.step_name}" → "${cleaned}"`);
    renamed += 1;
  }

  const { error: excoErr } = await sb.from('exco_members').update({ is_active: false }).eq('is_active', true);
  if (excoErr && !/relation|does not exist/i.test(excoErr.message)) throw excoErr;

  const { data: after } = await sb.from('users').select('email, full_name, roles(slug)').order('email');
  console.log(`\nDemoted: ${demoted}`);
  console.log(`Steps renamed: ${renamed}`);
  console.log('Users:');
  for (const u of after ?? []) {
    console.log(`  ${u.email} → ${(u.roles as { slug?: string } | null)?.slug}`);
  }
  console.log('\nDone. Assign new approvers under Admin → Users (role).\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
