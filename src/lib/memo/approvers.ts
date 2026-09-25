import { createServiceClient } from '@/lib/supabase/server';
import {
  DESIGNATED_DEPT_HEAD_EMAILS,
} from '@/lib/memo/designatedUsers';
import { resolveCeoApproverEmail } from '@/lib/workflow/ceoWorkflowSteps';
import { resolveFinanceReviewerEmails } from '@/lib/workflow/financeWorkflowSteps';
import { BUSINESS_HEAD_EMAIL } from '@/lib/workflow/marketingWorkflowSteps';
import { IT_FIRST_CHECKER_EMAIL, IT_SECOND_CHECKER_EMAIL } from '@/lib/workflow/itCheckers';
import type { MemoTypeSlug } from '@/types';

async function appendDelegations(supabase: ReturnType<typeof createServiceClient>, ids: string[]) {
  if (ids.length === 0) return ids;

  const today = new Date().toISOString().split('T')[0];
  const { data: delegations } = await supabase
    .from('delegations')
    .select('delegated_to_id')
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .in('original_approver_id', ids);

  for (const d of delegations || []) {
    if (d.delegated_to_id) ids.push(d.delegated_to_id);
  }

  return [...new Set(ids)];
}

async function approverIdsForEmail(
  supabase: ReturnType<typeof createServiceClient>,
  email: string
): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  if (!data?.id) return [];
  return appendDelegations(supabase, [data.id]);
}

async function approverIdsForEmails(
  supabase: ReturnType<typeof createServiceClient>,
  emails: readonly string[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const email of emails) {
    ids.push(...(await approverIdsForEmail(supabase, email)));
  }
  return appendDelegations(supabase, [...new Set(ids)]);
}

async function deptCodeForId(
  supabase: ReturnType<typeof createServiceClient>,
  departmentId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('departments')
    .select('code')
    .eq('id', departmentId)
    .maybeSingle();
  return data?.code ?? null;
}

export async function findApproversForStep(
  roleSlug: string,
  departmentId: string,
  memoTypeSlug?: MemoTypeSlug | string,
  _stepOrder?: number,
  creatorEmail?: string | null
): Promise<string[]> {
  const supabase = createServiceClient();
  const type = memoTypeSlug as MemoTypeSlug | undefined;

  if (roleSlug === 'ceo') {
    return approverIdsForEmail(supabase, resolveCeoApproverEmail(creatorEmail));
  }

  if (roleSlug === 'business_head') {
    return approverIdsForEmail(supabase, BUSINESS_HEAD_EMAIL);
  }

  if (roleSlug === 'it_checker_first') {
    return approverIdsForEmail(supabase, IT_FIRST_CHECKER_EMAIL);
  }

  if (roleSlug === 'it_checker_second') {
    return approverIdsForEmail(supabase, IT_SECOND_CHECKER_EMAIL);
  }

  if (roleSlug === 'finance_reviewer') {
    return approverIdsForEmails(
      supabase,
      resolveFinanceReviewerEmails(memoTypeSlug, creatorEmail)
    );
  }

  if (roleSlug === 'department_head') {
    const deptCode = await deptCodeForId(supabase, departmentId);
    const headEmails = deptCode ? DESIGNATED_DEPT_HEAD_EMAILS[deptCode] : undefined;
    if (headEmails?.length) {
      const others = creatorEmail
        ? headEmails.filter((e) => e.toLowerCase() !== creatorEmail.toLowerCase())
        : headEmails;
      return approverIdsForEmails(supabase, others.length ? others : headEmails);
    }
    const { data: heads } = await supabase
      .from('users')
      .select('id, roles!inner(slug)')
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .eq('roles.slug', 'department_head');
    const ids = (heads || []).map((h) => h.id as string);
    return appendDelegations(supabase, ids);
  }

  if (roleSlug === 'exco_member') {
    const { data: exco } = await supabase
      .from('exco_members')
      .select('user_id')
      .eq('is_active', true);
    const ids = (exco || []).map((e) => e.user_id as string).filter(Boolean);
    return appendDelegations(supabase, ids);
  }

  return [];
}
