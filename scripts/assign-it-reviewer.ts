/**
 * Assign IT Reviewer role (second checker for IT memos). Default: Jim Ntare.
 * Usage: npm run assign:it -- jim.ntare@onesourcefresh.com
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

const DEFAULT_EMAIL = 'jim.ntare@onesourcefresh.com';

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let { data: role } = await supabase.from('roles').select('id').eq('slug', 'it_reviewer').maybeSingle();

  if (!role?.id) {
    const { data: created, error } = await supabase
      .from('roles')
      .insert({
        name: 'IT Reviewer',
        slug: 'it_reviewer',
        description: 'Second-line IT review for IT requests',
      })
      .select('id')
      .single();
    if (error) throw error;
    role = created;
  }

  const { data: pendingStatus } = await supabase
    .from('memo_statuses')
    .select('id')
    .eq('slug', 'pending_it_review')
    .maybeSingle();

  if (!pendingStatus?.id) {
    await supabase.from('memo_statuses').insert({
      name: 'Pending IT Review',
      slug: 'pending_it_review',
      sort_order: 4,
    });
  }

  const { data: itDept } = await supabase.from('departments').select('id').eq('code', 'IT').single();

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .update({
      role_id: role!.id,
      department_id: itDept?.id ?? null,
      title: 'IT Reviewer',
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
      const { data: steps } = await supabase
        .from('approval_steps')
        .select('id, step_order, role_slug')
        .eq('workflow_id', workflow.id)
        .order('step_order');

      const hasItReview = (steps || []).some((s) => s.role_slug === 'it_reviewer');

      if (!hasItReview && steps?.length) {
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
          role_slug: 'it_reviewer',
          step_name: 'IT Second Review',
          sla_hours: 24,
        });
        console.log('✓ Added IT Second Review step to IT Request workflow');
      } else if (hasItReview) {
        console.log('✓ IT Request workflow already includes IT Second Review');
      }
    }
  }

  console.log(`✓ ${profile.full_name} (${email}) is now IT Reviewer (IT department)`);
  console.log('  IT memos route: Dept Head → IT Second Review (Jim) → Finance (if budget) → CEO');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
