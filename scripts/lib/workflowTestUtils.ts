import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { findApproversForStep } from '../../src/lib/memo/approvers';
import { getStatusForStep } from '../../src/lib/workflow/engine';
import { resolveWorkflow } from '../../src/lib/workflow/resolve';
import { HR_MEMO_CREATOR_EMAIL } from '../../src/lib/workflow/hrWorkflowSteps';
import { CFO_EMAIL } from '../../src/lib/memo/designatedUsers';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '../../src/lib/workflow/interdeptFinanceReviewer';
import {
  FINANCE_MEMO_APPROVER_EMAIL,
  FINANCE_MEMO_CREATOR_EMAIL,
} from '../../src/lib/workflow/financeWorkflowSteps';
import { BUSINESS_HEAD_EMAIL, MARKETING_DEPARTMENT_CODE } from '../../src/lib/workflow/marketingWorkflowSteps';
import {
  IT_FIRST_CHECKER_EMAIL,
  IT_SECOND_CHECKER_EMAIL,
} from '../../src/lib/workflow/itCheckers';
import { IT_DEPT_HEAD_EMAILS } from '../../src/lib/memo/designatedUsers';
import type { MemoTypeSlug, MemoStatusSlug } from '../../src/types';

export const TEST_SIGNATURE_PATH = 'test-fixtures/smoke-signature.png';

export type TestUser = {
  id: string;
  email: string;
  full_name: string;
  role_slug: string;
  department_code: string | null;
};

export type ApprovalStepExpectation = {
  label: string;
  status: MemoStatusSlug;
  approverEmail: string;
  /** All of these emails must appear in the approver queue for this step. */
  queueMustInclude?: string[];
};

export type WorkflowTestCase = {
  id: string;
  department: string;
  memoTypeSlug: MemoTypeSlug;
  description: string;
  creatorEmail: string | 'auto:staff';
  creatorDeptCode?: string;
  requires_finance?: boolean;
  importance_level?: 'normal' | 'exco';
  steps: ApprovalStepExpectation[];
};

export function createTestSupabase(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<TestUser | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, roles(slug), departments(code)')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();

  if (!data?.id) return null;
  const role = data.roles as { slug: string } | { slug: string }[] | null;
  const dept = data.departments as { code: string } | { code: string }[] | null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role_slug: Array.isArray(role) ? role[0]?.slug : role?.slug || '',
    department_code: Array.isArray(dept) ? dept[0]?.code : dept?.code || null,
  };
}

export async function fetchCeoUser(supabase: SupabaseClient): Promise<TestUser | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, roles!inner(slug), departments(code)')
    .eq('roles.slug', 'ceo')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  const dept = data.departments as { code: string } | { code: string }[] | null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role_slug: 'ceo',
    department_code: Array.isArray(dept) ? dept[0]?.code : dept?.code || null,
  };
}

/** Any staff account (for “open create” tests). */
export async function fetchAnyStaff(supabase: SupabaseClient): Promise<TestUser | null> {
  const preferred = await fetchUserByEmail(supabase, 'ngabo.sevelin@rukapay.co.ug');
  if (preferred?.role_slug === 'staff') return preferred;

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, roles!inner(slug), departments(code)')
    .eq('roles.slug', 'staff')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  const dept = data.departments as { code: string } | { code: string }[] | null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role_slug: 'staff',
    department_code: Array.isArray(dept) ? dept[0]?.code : dept?.code || null,
  };
}

export async function fetchStaffInDept(
  supabase: SupabaseClient,
  deptCode: string
): Promise<TestUser | null> {
  const { data: dept } = await supabase.from('departments').select('id').eq('code', deptCode).maybeSingle();
  if (!dept?.id) return null;

  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name, roles!inner(slug), departments(code)')
    .eq('department_id', dept.id)
    .eq('roles.slug', 'staff')
    .eq('is_active', true)
    .limit(5);

  const pick = (users || [])[0] as {
    id: string;
    email: string;
    full_name: string;
    roles: { slug: string };
    departments: { code: string };
  } | undefined;

  if (!pick?.id) return null;
  return {
    id: pick.id,
    email: pick.email,
    full_name: pick.full_name,
    role_slug: 'staff',
    department_code: deptCode,
  };
}

export async function fetchDeptHead(
  supabase: SupabaseClient,
  deptCode: string
): Promise<TestUser | null> {
  const { data: dept } = await supabase.from('departments').select('id').eq('code', deptCode).maybeSingle();
  if (!dept?.id) return null;

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, roles!inner(slug), departments(code)')
    .eq('department_id', dept.id)
    .eq('roles.slug', 'department_head')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role_slug: 'department_head',
    department_code: deptCode,
  };
}

export async function fetchHrReviewer(supabase: SupabaseClient): Promise<TestUser | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, roles!inner(slug), departments(code)')
    .eq('roles.slug', 'hr_reviewer')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  const dept = data.departments as { code: string } | { code: string }[] | null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role_slug: 'hr_reviewer',
    department_code: Array.isArray(dept) ? dept[0]?.code : dept?.code || null,
  };
}

export async function ensureTestSignatures(
  supabase: SupabaseClient,
  emails: string[]
): Promise<void> {
  const unique = [...new Set(emails.map((e) => e.toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return;
  await supabase
    .from('users')
    .update({ signature_path: TEST_SIGNATURE_PATH })
    .in('email', unique);
}

/** Set dummy signature on every active user (for full journey tests). */
export async function ensureAllActiveUserSignatures(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('users')
    .update({ signature_path: TEST_SIGNATURE_PATH })
    .eq('is_active', true)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

export async function getMemoTypeId(
  supabase: SupabaseClient,
  slug: MemoTypeSlug
): Promise<string> {
  const { data } = await supabase.from('memo_types').select('id').eq('slug', slug).single();
  if (!data?.id) throw new Error(`Memo type not found: ${slug}`);
  return data.id;
}

export async function getMemoSnapshot(supabase: SupabaseClient, memoId: string) {
  const { data } = await supabase
    .from('memos')
    .select('id, reference_number, current_step_order, requires_finance, memo_types(slug), memo_statuses(slug)')
    .eq('id', memoId)
    .single();
  if (!data) throw new Error('Memo not found');
  const typeSlug = Array.isArray(data.memo_types)
    ? data.memo_types[0]?.slug
    : (data.memo_types as { slug: string } | null)?.slug;
  const statusSlug = Array.isArray(data.memo_statuses)
    ? data.memo_statuses[0]?.slug
    : (data.memo_statuses as { slug: string } | null)?.slug;
  return { ...data, typeSlug, statusSlug };
}

export async function verifyWorkflowSteps(
  supabase: SupabaseClient,
  memoTypeId: string,
  memoTypeSlug: MemoTypeSlug,
  expectedRoleSlugs: string[]
): Promise<{ ok: boolean; message: string }> {
  const workflow = await resolveWorkflow(memoTypeId, memoTypeSlug, {});
  const actual = workflow.steps.map((s) => s.role_slug);
  const match =
    actual.length === expectedRoleSlugs.length &&
    actual.every((r, i) => r === expectedRoleSlugs[i]);
  return {
    ok: match,
    message: match
      ? `steps: ${actual.join(' → ')}`
      : `expected [${expectedRoleSlugs.join(' → ')}], got [${actual.join(' → ')}]`,
  };
}

export async function getApproverQueueEmails(
  roleSlug: string,
  departmentId: string,
  memoTypeSlug: MemoTypeSlug,
  stepOrder: number
): Promise<string[]> {
  const ids = await findApproversForStep(roleSlug, departmentId, memoTypeSlug, stepOrder);
  if (ids.length === 0) return [];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: users } = await supabase.from('users').select('email').in('id', ids);
  return (users || []).map((u) => u.email.toLowerCase());
}

export async function verifyApprovers(
  roleSlug: string,
  departmentId: string,
  memoTypeSlug: MemoTypeSlug,
  stepOrder: number,
  expectedEmail: string,
  queueMustInclude?: string[]
): Promise<{ ok: boolean; message: string }> {
  const emails = await getApproverQueueEmails(roleSlug, departmentId, memoTypeSlug, stepOrder);
  if (emails.length === 0) {
    return { ok: false, message: 'no approvers returned' };
  }
  const required = [
    expectedEmail.toLowerCase(),
    ...(queueMustInclude || []).map((e) => e.toLowerCase()),
  ];
  const missing = [...new Set(required)].filter((e) => !emails.includes(e));
  const ok = missing.length === 0;
  return {
    ok,
    message: ok
      ? `queue: [${emails.join(', ')}]`
      : `missing [${missing.join(', ')}], got [${emails.join(', ')}]`,
  };
}

export function buildAllTestCases(ceoEmail: string, extras: {
  itStaffEmail: string;
  itDeptHeadEmail: string;
  hrDeptHeadEmail: string;
  mktCreatorEmail: string;
  opsStaffEmail: string;
  opsDeptHeadEmail: string;
}): WorkflowTestCase[] {
  return [
    {
      id: 'hr',
      department: 'HR',
      memoTypeSlug: 'hr_request',
      description: 'Any staff (cross-dept) → Christine → CEO',
      creatorEmail: 'auto:staff',
      creatorDeptCode: 'HR',
      steps: [
        { label: 'Finance review', status: 'pending_finance', approverEmail: INTERDEPT_FINANCE_REVIEWER_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
    {
      id: 'finance',
      department: 'Finance',
      memoTypeSlug: 'finance_request',
      description: 'Any staff → Amara → CEO',
      creatorEmail: 'auto:staff',
      creatorDeptCode: 'FIN',
      steps: [
        { label: 'Finance review', status: 'pending_finance', approverEmail: FINANCE_MEMO_APPROVER_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
    {
      id: 'marketing',
      department: 'Marketing',
      memoTypeSlug: 'marketing_request',
      description: 'Any staff → Norman → Christine → CEO',
      creatorEmail: 'auto:staff',
      creatorDeptCode: MARKETING_DEPARTMENT_CODE,
      requires_finance: true,
      steps: [
        { label: 'Business head', status: 'pending_business_head', approverEmail: BUSINESS_HEAD_EMAIL },
        { label: 'Finance review', status: 'pending_finance', approverEmail: INTERDEPT_FINANCE_REVIEWER_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
    {
      id: 'it',
      department: 'IT',
      memoTypeSlug: 'it_request',
      description: 'Any staff → Emma → Jim → Christine → CEO',
      creatorEmail: 'auto:staff',
      creatorDeptCode: 'IT',
      requires_finance: true,
      steps: [
        { label: 'IT 1st check', status: 'pending_it_checker_first', approverEmail: IT_FIRST_CHECKER_EMAIL },
        { label: 'IT 2nd check', status: 'pending_it_checker_second', approverEmail: IT_SECOND_CHECKER_EMAIL },
        { label: 'Finance review', status: 'pending_finance', approverEmail: INTERDEPT_FINANCE_REVIEWER_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
    {
      id: 'payment-it',
      department: 'IT',
      memoTypeSlug: 'payment_request',
      description: 'Any staff → Emmanuel & Jim → Christine → CEO',
      creatorEmail: extras.itStaffEmail,
      creatorDeptCode: 'IT',
      requires_finance: true,
      steps: [
        {
          label: 'Dept head',
          status: 'pending_department_head',
          approverEmail: IT_FIRST_CHECKER_EMAIL,
          queueMustInclude: [...IT_DEPT_HEAD_EMAILS],
        },
        { label: 'Finance review', status: 'pending_finance', approverEmail: INTERDEPT_FINANCE_REVIEWER_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
    {
      id: 'procurement-ops',
      department: 'Operations',
      memoTypeSlug: 'procurement_request',
      description: 'Staff → Emmanuel (OPS head) → Christine → CEO',
      creatorEmail: extras.opsStaffEmail,
      creatorDeptCode: 'OPS',
      requires_finance: true,
      steps: [
        {
          label: 'Dept head',
          status: 'pending_department_head',
          approverEmail: IT_FIRST_CHECKER_EMAIL,
        },
        { label: 'Finance review', status: 'pending_finance', approverEmail: INTERDEPT_FINANCE_REVIEWER_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
    {
      id: 'leave-hr',
      department: 'HR',
      memoTypeSlug: 'leave_request',
      description: 'Staff → Dept head → CEO',
      creatorEmail: HR_MEMO_CREATOR_EMAIL,
      creatorDeptCode: 'HR',
      steps: [
        { label: 'Dept head', status: 'pending_department_head', approverEmail: HR_MEMO_CREATOR_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
    {
      id: 'general-it',
      department: 'IT',
      memoTypeSlug: 'general_internal',
      description: 'Staff → IT Dept Head → Finance → CEO',
      creatorEmail: extras.itStaffEmail,
      creatorDeptCode: 'IT',
      requires_finance: true,
      steps: [
        { label: 'Dept head', status: 'pending_department_head', approverEmail: extras.itDeptHeadEmail },
        { label: 'Finance review', status: 'pending_finance', approverEmail: INTERDEPT_FINANCE_REVIEWER_EMAIL },
        { label: 'CEO', status: 'pending_ceo', approverEmail: ceoEmail },
      ],
    },
  ];
}

export const WORKFLOW_STEP_EXPECTATIONS: Record<string, string[]> = {
  hr_request: ['finance_reviewer', 'ceo'],
  finance_request: ['finance_reviewer', 'ceo'],
  marketing_request: ['business_head', 'finance_reviewer', 'ceo'],
  it_request: ['it_checker_first', 'it_checker_second', 'finance_reviewer', 'ceo'],
  payment_request: ['department_head', 'finance_reviewer', 'ceo'],
  procurement_request: ['department_head', 'finance_reviewer', 'ceo'],
  leave_request: ['department_head', 'ceo'],
  general_internal: ['department_head', 'finance_reviewer', 'ceo'],
};

export function statusForFirstStep(roleSlug: string): MemoStatusSlug {
  return getStatusForStep(roleSlug) as MemoStatusSlug;
}

export async function roleIdFor(supabase: SupabaseClient, slug: string): Promise<string> {
  const { data } = await supabase.from('roles').select('id').eq('slug', slug).single();
  if (!data?.id) throw new Error(`Role not found: ${slug}`);
  return data.id;
}

/** Promote a team member for smoke tests when no dept head exists in that department. */
export async function promoteUserForTest(
  supabase: SupabaseClient,
  email: string,
  roleSlug: string,
  deptCode: string,
  title: string
): Promise<TestUser | null> {
  const { data: dept } = await supabase.from('departments').select('id').eq('code', deptCode).maybeSingle();
  if (!dept?.id) return null;
  const roleId = await roleIdFor(supabase, roleSlug);
  const { data, error } = await supabase
    .from('users')
    .update({
      role_id: roleId,
      department_id: dept.id,
      title,
    })
    .eq('email', email.toLowerCase())
    .select('id, email, full_name, roles(slug), departments(code)')
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role_slug: roleSlug,
    department_code: deptCode,
  };
}
