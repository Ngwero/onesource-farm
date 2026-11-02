/**
 * Assign Finance Reviewer role + department to a user (default: Christine).
 * Usage: npm run assign:finance -- christine.kangume@onesourcefresh.com
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

const DEFAULT_EMAIL = 'christine.kangume@onesourcefresh.com';

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('slug', 'finance_reviewer')
    .single();

  const { data: dept } = await supabase.from('departments').select('id').eq('code', 'FIN').single();

  if (!role?.id || !dept?.id) {
    console.error('Run supabase/seed.sql first (roles/departments missing).');
    process.exit(1);
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .update({
      role_id: role.id,
      department_id: dept.id,
      title: 'Finance Reviewer',
    })
    .eq('email', email)
    .select('id, full_name, email')
    .single();

  if (profileError || !profile) {
    console.error(`User not found or update failed: ${email}`);
    process.exit(1);
  }

  const { data: memoType } = await supabase
    .from('memo_types')
    .select('id')
    .eq('slug', 'general_internal')
    .single();

  if (memoType?.id) {
    await supabase
      .from('approval_workflows')
      .update({ requires_finance: true })
      .eq('memo_type_id', memoType.id)
      .eq('is_default', true);

    const { data: workflow } = await supabase
      .from('approval_workflows')
      .select('id')
      .eq('memo_type_id', memoType.id)
      .eq('is_default', true)
      .maybeSingle();

    if (workflow?.id) {
      const { data: steps } = await supabase
        .from('approval_steps')
        .select('id, step_order, role_slug')
        .eq('workflow_id', workflow.id)
        .order('step_order');

      const hasFinance = (steps || []).some((s) => s.role_slug === 'finance_reviewer');

      if (!hasFinance && steps?.length) {
        const toShift = steps.filter((s) => s.step_order >= 2).sort((a, b) => b.step_order - a.step_order);
        for (const step of toShift) {
          await supabase
            .from('approval_steps')
            .update({ step_order: step.step_order + 1 })
            .eq('id', step.id);
        }
        await supabase.from('approval_steps').insert({
          workflow_id: workflow.id,
          step_order: 2,
          role_slug: 'finance_reviewer',
          step_name: 'Finance Review',
          sla_hours: 48,
        });
        console.log('✓ Added Finance Review step to General Internal Memo workflow');
      } else if (hasFinance) {
        console.log('✓ General Internal workflow already includes Finance Review');
      }
    }
  }

  console.log(`✓ ${profile.full_name} (${email}) is now Finance Reviewer (Finance department)`);
  console.log('  General internal memos route: Dept Head → Finance → CEO after this change.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
