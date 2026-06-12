/**
 * Apply org routing to Supabase workflows + key roles.
 * Usage: npm run assign:org
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { HR_REQUEST_APPROVAL_STEPS } from '../src/lib/workflow/hrWorkflowSteps';
import { MARKETING_REQUEST_APPROVAL_STEPS } from '../src/lib/workflow/marketingWorkflowSteps';
import { IT_REQUEST_APPROVAL_STEPS } from '../src/lib/workflow/itWorkflowSteps';
import { FINANCE_REQUEST_APPROVAL_STEPS } from '../src/lib/workflow/financeWorkflowSteps';
import { LEAVE_REQUEST_APPROVAL_STEPS } from '../src/lib/workflow/leaveWorkflowSteps';
import {
  BUSINESS_HEAD_EMAIL,
  MARKETING_HEAD_EMAIL,
} from '../src/lib/workflow/marketingWorkflowSteps';
import { CFO_EMAIL } from '../src/lib/memo/designatedUsers';
import { HR_MEMO_CREATOR_EMAIL } from '../src/lib/workflow/hrWorkflowSteps';
import { IT_FIRST_CHECKER_EMAIL } from '../src/lib/workflow/itCheckers';

const BD_STAFF_EMAIL = 'mutorine.silas@rukapay.co.ug';

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

async function rebuildWorkflow(
  supabase: ReturnType<typeof createClient>,
  memoSlug: string,
  steps: { step_order: number; role_slug: string; step_name: string; sla_hours: number }[]
) {
  const { data: memoType } = await supabase.from('memo_types').select('id').eq('slug', memoSlug).single();
  if (!memoType?.id) {
    console.log(`  skip ${memoSlug} (type missing)`);
    return;
  }
  const { data: workflow } = await supabase
    .from('approval_workflows')
    .select('id')
    .eq('memo_type_id', memoType.id)
    .eq('is_default', true)
    .maybeSingle();
  if (!workflow?.id) {
    console.log(`  skip ${memoSlug} (workflow missing)`);
    return;
  }
  await supabase.from('approval_steps').delete().eq('workflow_id', workflow.id);
  await supabase.from('approval_steps').insert(
    steps.map((s) => ({ workflow_id: workflow.id, ...s }))
  );
  console.log(`✓ ${memoSlug}: ${steps.map((s) => s.step_name).join(' → ')}`);
}

async function assignUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  roleSlug: string,
  deptCode: string | null,
  title: string
) {
  const { data: role } = await supabase.from('roles').select('id').eq('slug', roleSlug).single();
  let deptId: string | null = null;
  if (deptCode) {
    const { data: dept } = await supabase.from('departments').select('id').eq('code', deptCode).single();
    deptId = dept?.id ?? null;
  }
  if (!role?.id) throw new Error(`Role ${roleSlug} missing`);
  await supabase
    .from('users')
    .update({ role_id: role.id, department_id: deptId, title })
    .eq('email', email);
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

  console.log('Updating workflows…\n');
  await rebuildWorkflow(supabase, 'hr_request', HR_REQUEST_APPROVAL_STEPS);
  await rebuildWorkflow(supabase, 'marketing_request', MARKETING_REQUEST_APPROVAL_STEPS);
  await rebuildWorkflow(supabase, 'it_request', IT_REQUEST_APPROVAL_STEPS);
  await rebuildWorkflow(supabase, 'finance_request', FINANCE_REQUEST_APPROVAL_STEPS);
  await rebuildWorkflow(supabase, 'leave_request', LEAVE_REQUEST_APPROVAL_STEPS);

  console.log('\nKey roles…\n');
  await assignUser(supabase, HR_MEMO_CREATOR_EMAIL, 'department_head', 'HR', 'HR — Dept Head');
  await assignUser(supabase, MARKETING_HEAD_EMAIL, 'department_head', 'MKT', 'Marketing Head');
  await assignUser(supabase, BUSINESS_HEAD_EMAIL, 'business_head', 'BD', 'Business Head (marketing workflow)');
  await assignUser(supabase, CFO_EMAIL, 'finance_reviewer', 'FIN', 'CFO / Finance Reviewer');
  await assignUser(supabase, IT_FIRST_CHECKER_EMAIL, 'admin', 'IT', 'IT Head / Admin / 1st checker');
  await assignUser(supabase, BD_STAFF_EMAIL, 'staff', 'BD', 'Business Development — Staff');

  console.log(
    '\nDone. MKT head: Margaret | Business: Norman | Leave: Dept head → CEO | Finance: Amara / Christine'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
