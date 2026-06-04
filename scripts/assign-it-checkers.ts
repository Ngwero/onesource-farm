/**
 * Assign Emma (1st) and Jim (2nd) as IT memo checkers and rebuild IT workflow steps.
 * Usage: npm run assign:it-checkers
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  ADMIN_EMAIL,
  IT_FIRST_CHECKER_EMAIL,
  IT_SECOND_CHECKER_EMAIL,
} from '../src/lib/workflow/itCheckers';
import { IT_REQUEST_APPROVAL_STEPS } from '../src/lib/workflow/itWorkflowSteps';

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

async function ensureRole(
  supabase: ReturnType<typeof createClient>,
  slug: string,
  name: string
): Promise<string> {
  let { data: role } = await supabase.from('roles').select('id').eq('slug', slug).maybeSingle();
  if (!(role as { id?: string } | null)?.id) {
    const { data: created, error } = await supabase
      .from('roles')
      .insert({ name, slug, description: name })
      .select('id')
      .single();
    if (error) throw error;
    role = created as { id: string };
  }
  return (role as { id: string }).id;
}

async function ensureStatus(
  supabase: ReturnType<typeof createClient>,
  slug: string,
  name: string,
  sortOrder: number
) {
  const { data: existing } = await supabase
    .from('memo_statuses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!existing?.id) {
    await supabase.from('memo_statuses').insert({ name, slug, sort_order: sortOrder });
  }
}

/** Keep admin role when the designated 1st IT checker is also system admin (Emma). */
async function assignItFirstChecker(
  supabase: ReturnType<typeof createClient>,
  email: string,
  itCheckerFirstRoleId: string,
  deptId: string | null
) {
  const { data: existing } = await supabase
    .from('users')
    .select('id, roles(slug)')
    .eq('email', email)
    .maybeSingle();

  if (!existing?.id) {
    throw new Error(`Could not assign ${email}: user not found`);
  }

  const roleSlug = (existing.roles as { slug?: string } | null)?.slug;
  const title =
    email === ADMIN_EMAIL
      ? 'System Administrator & IT Checker (1st)'
      : 'IT Checker (1st)';

  const updates: { department_id: string | null; title: string; role_id?: string } = {
    department_id: deptId,
    title,
  };

  if (roleSlug !== 'admin') {
    updates.role_id = itCheckerFirstRoleId;
  }

  const { data: profile, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', existing.id)
    .select('full_name, email')
    .single();

  if (error || !profile) {
    throw new Error(`Could not assign ${email}: ${error?.message || 'update failed'}`);
  }
  return profile;
}

async function assignUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  roleId: string,
  deptId: string | null,
  title: string
) {
  const { data: profile, error } = await supabase
    .from('users')
    .update({ role_id: roleId, department_id: deptId, title })
    .eq('email', email)
    .select('full_name, email')
    .single();

  if (error || !profile) {
    throw new Error(`Could not assign ${email}: ${error?.message || 'user not found'}`);
  }
  return profile;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  await ensureStatus(supabase, 'pending_it_checker_first', 'Pending IT Check (1st)', 5);
  await ensureStatus(supabase, 'pending_it_checker_second', 'Pending IT Check (2nd)', 6);

  const firstRoleId = await ensureRole(supabase, 'it_checker_first', 'IT Checker (1st)');
  const secondRoleId = await ensureRole(supabase, 'it_checker_second', 'IT Checker (2nd)');

  const { data: itDept } = await supabase.from('departments').select('id').eq('code', 'IT').single();

  const emma = await assignItFirstChecker(
    supabase,
    IT_FIRST_CHECKER_EMAIL,
    firstRoleId,
    itDept?.id ?? null
  );
  const jim = await assignUser(
    supabase,
    IT_SECOND_CHECKER_EMAIL,
    secondRoleId,
    itDept?.id ?? null,
    'IT Checker (2nd) — Jim'
  );

  const { data: memoType } = await supabase
    .from('memo_types')
    .select('id')
    .eq('slug', 'it_request')
    .single();

  if (memoType?.id) {
    const { data: workflow } = await supabase
      .from('approval_workflows')
      .select('id')
      .eq('memo_type_id', memoType.id)
      .eq('is_default', true)
      .maybeSingle();

    if (workflow?.id) {
      await supabase.from('approval_workflows').update({ requires_finance: true }).eq('id', workflow.id);
      await supabase.from('approval_steps').delete().eq('workflow_id', workflow.id);
      await supabase.from('approval_steps').insert(
        IT_REQUEST_APPROVAL_STEPS.map((step) => ({
          workflow_id: workflow.id,
          step_order: step.step_order,
          role_slug: step.role_slug,
          step_name: step.step_name,
          sla_hours: step.sla_hours,
        }))
      );
      console.log('✓ IT Request workflow: Emma (1st) → Jim (2nd) → Christine (Finance) → CEO');
    }

    const { data: pendingDept } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'pending_department_head')
      .maybeSingle();
    const { data: pendingFirst } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'pending_it_checker_first')
      .maybeSingle();

    if (pendingDept?.id && pendingFirst?.id) {
      const { data: moved } = await supabase
        .from('memos')
        .update({
          status_id: pendingFirst.id,
          current_step_order: 1,
          requires_finance: true,
          updated_at: new Date().toISOString(),
        })
        .eq('memo_type_id', memoType.id)
        .eq('status_id', pendingDept.id)
        .select('reference_number');

      if (moved?.length) {
        console.log(
          `✓ Moved ${moved.length} IT memo(s) from Department Head → Emma (1st check):`,
          moved.map((m) => m.reference_number).join(', ')
        );
      }
    }
  }

  console.log(`✓ ${emma.full_name} (${emma.email}) — 1st IT checker`);
  console.log(`✓ ${jim.full_name} (${jim.email}) — 2nd IT checker`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
