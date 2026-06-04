/**
 * Finance memos: Christine (FIN staff) creates → Amara reviews → CEO.
 * Usage: npm run assign:finance
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  FINANCE_REQUEST_APPROVAL_STEPS,
  FINANCE_MEMO_CREATOR_EMAIL,
  FINANCE_MEMO_APPROVER_EMAIL,
} from '../src/lib/workflow/financeWorkflowSteps';

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

  const { data: roles } = await supabase.from('roles').select('id, slug');
  const staffRoleId = roles?.find((r) => r.slug === 'staff')?.id;
  const financeRoleId = roles?.find((r) => r.slug === 'finance_reviewer')?.id;

  const { data: finDept } = await supabase.from('departments').select('id').eq('code', 'FIN').single();

  if (!staffRoleId || !financeRoleId || !finDept?.id) {
    console.error('Run supabase/seed.sql first.');
    process.exit(1);
  }

  const christine = await assignUser(
    supabase,
    FINANCE_MEMO_CREATOR_EMAIL,
    staffRoleId,
    finDept.id,
    'Finance — Staff (creates finance memos)'
  );
  console.log(`✓ ${christine.email} — Staff in Finance (creates Finance Request memos)`);

  const amara = await assignUser(
    supabase,
    FINANCE_MEMO_APPROVER_EMAIL,
    financeRoleId,
    finDept.id,
    'Finance Reviewer'
  );
  console.log(`✓ ${amara.email} — Finance reviewer (Finance Request queue)`);

  let { data: memoType } = await supabase
    .from('memo_types')
    .select('id')
    .eq('slug', 'finance_request')
    .maybeSingle();

  if (!memoType?.id) {
    const { data: created } = await supabase
      .from('memo_types')
      .insert({
        name: 'Finance Request',
        slug: 'finance_request',
        description: 'Finance department internal request',
      })
      .select('id')
      .single();
    memoType = created;
    console.log('✓ Created memo type: finance_request');
  }

  if (memoType?.id) {
    let { data: workflow } = await supabase
      .from('approval_workflows')
      .select('id')
      .eq('memo_type_id', memoType.id)
      .eq('is_default', true)
      .maybeSingle();

    if (!workflow?.id) {
      const { data: created } = await supabase
        .from('approval_workflows')
        .insert({
          name: 'Finance Request Workflow',
          memo_type_id: memoType.id,
          is_default: true,
          requires_finance: true,
        })
        .select('id')
        .single();
      workflow = created;
    } else {
      await supabase
        .from('approval_workflows')
        .update({ requires_finance: true })
        .eq('id', workflow.id);
    }

    if (workflow?.id) {
      await supabase.from('approval_steps').delete().eq('workflow_id', workflow.id);
      await supabase.from('approval_steps').insert(
        FINANCE_REQUEST_APPROVAL_STEPS.map((step) => ({
          workflow_id: workflow!.id,
          step_order: step.step_order,
          role_slug: step.role_slug,
          step_name: step.step_name,
          sla_hours: step.sla_hours,
        }))
      );
      console.log('✓ Finance Request workflow: Amara (review) → CEO');
    }
  }

  console.log('\nChristine still approves HR & marketing finance steps by email (run assign:hr / assign:marketing if needed).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
