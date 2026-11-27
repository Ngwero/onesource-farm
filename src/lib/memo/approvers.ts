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
  if (!email?.trim()) return [];
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

async function approverIdsForRole(
  supabase: ReturnType<typeof createServiceClient>,
  roleSlug: string,
  departmentId?: string | null
): Promise<string[]> {
  let query = supabase
    .from('users')
    .select('id, roles!inner(slug)')
    .eq('is_active', true)
    .eq('roles.slug', roleSlug);
  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }
  const { data } = await query;
  const ids = (data || []).map((h) => h.id as string);
  return appendDelegations(supabase, ids);
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
    const email = resolveCeoApproverEmail(creatorEmail);
    if (email) return approverIdsForEmail(supabase, email);
    return approverIdsForRole(supabase, 'ceo');
  }

  if (roleSlug === 'business_head') {
    if (BUSINESS_HEAD_EMAIL) return approverIdsForEmail(supabase, BUSINESS_HEAD_EMAIL);
    return approverIdsForRole(supabase, 'business_head');
  }

  if (roleSlug === 'it_checker_first') {
    if (IT_FIRST_CHECKER_EMAIL) return approverIdsForEmail(supabase, IT_FIRST_CHECKER_EMAIL);
    return approverIdsForRole(supabase, 'it_checker_first');
  }

  if (roleSlug === 'it_checker_second') {
    if (IT_SECOND_CHECKER_EMAIL) return approverIdsForEmail(supabase, IT_SECOND_CHECKER_EMAIL);
    return approverIdsForRole(supabase, 'it_checker_second');
  }

  if (roleSlug === 'finance_reviewer') {
    const emails = resolveFinanceReviewerEmails(type, creatorEmail);
    if (emails.length) return approverIdsForEmails(supabase, emails);
    return approverIdsForRole(supabase, 'finance_reviewer');
  }

  if (roleSlug === 'hr_reviewer') {
    return approverIdsForRole(supabase, 'hr_reviewer');
  }

  if (roleSlug === 'department_head') {
    const deptCode = await deptCodeForId(supabase, departmentId);
    const headEmails = deptCode ? DESIGNATED_DEPT_HEAD_EMAILS[deptCode] : undefined;
    if (headEmails?.length) {
      const others = creatorEmail
        ? headEmails.filter((e) => e.toLowerCase() !== creatorEmail.toLowerCase())
        : headEmails;
      const fromEmails = await approverIdsForEmails(supabase, others.length ? others : headEmails);
      if (fromEmails.length) return fromEmails;
    }
    return approverIdsForRole(supabase, 'department_head', departmentId);
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
