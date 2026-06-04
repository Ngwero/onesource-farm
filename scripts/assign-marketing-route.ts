/**
 * Marketing memos: Margaret (MKT head) → Norman (business) → Christine → CEO
 * Usage: npm run assign:marketing
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  MARKETING_REQUEST_APPROVAL_STEPS,
  MARKETING_HEAD_EMAIL,
  BUSINESS_HEAD_EMAIL,
  MARKETING_DEPARTMENT_CODE,
} from '../src/lib/workflow/marketingWorkflowSteps';
import { CFO_EMAIL } from '../src/lib/memo/designatedUsers';

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

  await ensureStatus(supabase, 'pending_business_head', 'Pending Business Head', 4);

  const businessHeadRoleId = await ensureRole(supabase, 'business_head', 'Business Head');
  const financeRoleId = await ensureRole(supabase, 'finance_reviewer', 'Finance Reviewer');

  let { data: mktDept } = await supabase
    .from('departments')
    .select('id')
    .eq('code', MARKETING_DEPARTMENT_CODE)
    .maybeSingle();
  if (!mktDept?.id) {
    const { data: created } = await supabase
      .from('departments')
      .insert({ name: 'Marketing', code: MARKETING_DEPARTMENT_CODE })
      .select('id')
      .single();
    mktDept = created;
  }

  const { data: bdDept } = await supabase.from('departments').select('id').eq('code', 'BD').single();

  const deptHeadRoleId = await ensureRole(supabase, 'department_head', 'Department Head');
  const margaret = await assignUser(
    supabase,
    MARKETING_HEAD_EMAIL,
    deptHeadRoleId,
    mktDept?.id ?? null,
    'Marketing Head'
  );
  console.log(`✓ ${margaret.email} — Marketing department head`);

  const norman = await assignUser(
    supabase,
    BUSINESS_HEAD_EMAIL,
    businessHeadRoleId,
    bdDept?.id ?? null,
    'Business Head'
  );
  console.log(`✓ ${norman.email} — Business head (marketing_request workflow)`);

  const { data: finDept } = await supabase.from('departments').select('id').eq('code', 'FIN').single();
  await assignUser(supabase, CFO_EMAIL, financeRoleId, finDept?.id ?? null, 'CFO');
  console.log(`✓ ${CFO_EMAIL} — CFO (Finance Request only; inter-dept finance step is Christine)`);

  let { data: memoType } = await supabase
    .from('memo_types')
    .select('id')
    .eq('slug', 'marketing_request')
    .maybeSingle();

  if (!memoType?.id) {
    const { data: created } = await supabase
      .from('memo_types')
      .insert({
        name: 'Marketing Request',
        slug: 'marketing_request',
        description: 'Marketing request',
      })
      .select('id')
      .single();
    memoType = created;
  }

  let { data: workflow } = await supabase
    .from('approval_workflows')
    .select('id')
    .eq('memo_type_id', memoType!.id)
    .eq('is_default', true)
    .maybeSingle();

  if (!workflow?.id) {
    const { data: created } = await supabase
      .from('approval_workflows')
      .insert({
        name: 'Marketing Request Workflow',
        memo_type_id: memoType!.id,
        is_default: true,
        requires_finance: true,
      })
      .select('id')
      .single();
    workflow = created;
  }

  await supabase.from('approval_workflows').update({ requires_finance: true }).eq('id', workflow!.id);
  await supabase.from('approval_steps').delete().eq('workflow_id', workflow!.id);
  await supabase.from('approval_steps').insert(
    MARKETING_REQUEST_APPROVAL_STEPS.map((step) => ({
      workflow_id: workflow!.id,
      step_order: step.step_order,
      role_slug: step.role_slug,
      step_name: step.step_name,
      sla_hours: step.sla_hours,
    }))
  );
  console.log('✓ Marketing workflow: Margaret → Norman → Christine → CEO');

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
