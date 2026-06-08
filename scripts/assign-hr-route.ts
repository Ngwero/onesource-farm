/**
 * HR memos: Dorothy (HR staff) creates → Christine reviews → CEO.
 * Usage: npm run assign:hr
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { HR_REQUEST_APPROVAL_STEPS, HR_MEMO_CREATOR_EMAIL } from '../src/lib/workflow/hrWorkflowSteps';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '../src/lib/workflow/interdeptFinanceReviewer';

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
  const { data: hrDept } = await supabase.from('departments').select('id').eq('code', 'HR').single();
  const { data: finDept } = await supabase.from('departments').select('id').eq('code', 'FIN').single();

  if (!staffRoleId || !hrDept?.id) {
    console.error('Run supabase/seed.sql first.');
    process.exit(1);
  }

  const deptHeadRoleId = roles?.find((r) => r.slug === 'department_head')?.id;
  const dorothyRoleId = deptHeadRoleId || staffRoleId;
  const dorothy = await assignUser(
    supabase,
    HR_MEMO_CREATOR_EMAIL,
    dorothyRoleId,
    hrDept.id,
    deptHeadRoleId ? 'HR — Dept Head' : 'HR — Staff'
  );
  console.log(
    `✓ ${dorothy.email} — ${deptHeadRoleId ? 'Department Head' : 'Staff'} in HR (creates HR memos)`
  );

  const christine = await assignUser(
    supabase,
    INTERDEPT_FINANCE_REVIEWER_EMAIL,
    staffRoleId,
    finDept?.id ?? null,
    'Finance & HR Reviewer'
  );
  console.log(`✓ ${christine.email} — Staff (FIN); HR review queue by email designation`);

  const { data: memoType } = await supabase
    .from('memo_types')
    .select('id')
    .eq('slug', 'hr_request')
    .single();

  if (memoType?.id) {
    const { data: workflow } = await supabase
      .from('approval_workflows')
      .select('id')
      .eq('memo_type_id', memoType.id)
      .eq('is_default', true)
      .maybeSingle();

    if (workflow?.id) {
      await supabase.from('approval_steps').delete().eq('workflow_id', workflow.id);
      await supabase.from('approval_steps').insert(
        HR_REQUEST_APPROVAL_STEPS.map((step) => ({
          workflow_id: workflow.id,
          step_order: step.step_order,
          role_slug: step.role_slug,
          step_name: step.step_name,
          sla_hours: step.sla_hours,
        }))
      );
      console.log('✓ HR Request workflow: Christine → CEO');
    }

    const oldSlugs = ['pending_department_head', 'pending_hr'];
    const { data: oldStatuses } = await supabase
      .from('memo_statuses')
      .select('id, slug')
      .in('slug', oldSlugs);
    const { data: pendingFinance } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'pending_finance')
      .maybeSingle();

    if (pendingFinance?.id && oldStatuses?.length) {
      const oldIds = oldStatuses.map((s) => s.id);
      const { data: moved } = await supabase
        .from('memos')
        .update({
          status_id: pendingFinance.id,
          current_step_order: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('memo_type_id', memoType.id)
        .in('status_id', oldIds)
        .select('reference_number');

      if (moved?.length) {
        console.log(
          `✓ Moved ${moved.length} HR memo(s) to Christine's queue:`,
          moved.map((m) => m.reference_number).join(', ')
        );
      }
    }
  }

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
