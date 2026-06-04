/**
 * End-to-end workflow smoke tests for all department routes.
 * Usage: npm run test:workflows
 */

import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';
import {
  buildAllTestCases,
  createTestSupabase,
  ensureAllActiveUserSignatures,
  ensureTestSignatures,
  fetchCeoUser,
  fetchDeptHead,
  fetchAnyStaff,
  fetchStaffInDept,
  fetchUserByEmail,
  getMemoSnapshot,
  getMemoTypeId,
  TEST_SIGNATURE_PATH,
  promoteUserForTest,
  verifyApprovers,
  verifyWorkflowSteps,
  WORKFLOW_STEP_EXPECTATIONS,
  type WorkflowTestCase,
} from './lib/workflowTestUtils';
import { FINANCE_MEMO_CREATOR_EMAIL } from '../src/lib/workflow/financeWorkflowSteps';
import { HR_MEMO_CREATOR_EMAIL } from '../src/lib/workflow/hrWorkflowSteps';
import {
  IT_FIRST_CHECKER_EMAIL,
  IT_SECOND_CHECKER_EMAIL,
} from '../src/lib/workflow/itCheckers';
import {
  MARKETING_HEAD_EMAIL,
  BUSINESS_HEAD_EMAIL,
  MARKETING_DEPARTMENT_CODE,
} from '../src/lib/workflow/marketingWorkflowSteps';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '../src/lib/workflow/interdeptFinanceReviewer';
import { FINANCE_MEMO_APPROVER_EMAIL } from '../src/lib/workflow/financeWorkflowSteps';

loadEnvLocal();

type StepResult = {
  step: string;
  expectedStatus: string;
  actualStatus: string;
  expectedApprover: string;
  approverQueueOk: boolean;
  pass: boolean;
  detail: string;
};

type CaseResult = {
  id: string;
  department: string;
  memoType: string;
  description: string;
  reference?: string;
  workflowDefOk: boolean;
  workflowDefDetail: string;
  steps: StepResult[];
  pass: boolean;
  error?: string;
};

async function resolveCreator(
  supabase: ReturnType<typeof createTestSupabase>,
  testCase: WorkflowTestCase
) {
  if (testCase.creatorEmail !== 'auto:staff') {
    const user = await fetchUserByEmail(supabase, testCase.creatorEmail);
    if (!user) throw new Error(`Creator not found: ${testCase.creatorEmail}`);
    return user;
  }
  const user = await fetchAnyStaff(supabase);
  if (!user) throw new Error('No staff user found for open-create test');
  return user;
}

async function runCase(
  testCase: WorkflowTestCase,
  supabase: ReturnType<typeof createTestSupabase>,
  services: {
    createMemo: typeof import('../src/lib/memo/service').createMemo;
    submitMemo: typeof import('../src/lib/memo/service').submitMemo;
    processApproval: typeof import('../src/lib/memo/service').processApproval;
  }
): Promise<CaseResult> {
  const result: CaseResult = {
    id: testCase.id,
    department: testCase.department,
    memoType: testCase.memoTypeSlug,
    description: testCase.description,
    workflowDefOk: false,
    workflowDefDetail: '',
    steps: [],
    pass: false,
  };

  const memoIds: string[] = [];

  try {
    const creator = await resolveCreator(supabase, testCase);
    const memoTypeId = await getMemoTypeId(supabase, testCase.memoTypeSlug);

    const stepExpect = WORKFLOW_STEP_EXPECTATIONS[testCase.memoTypeSlug];
    if (stepExpect) {
      const defCheck = await verifyWorkflowSteps(supabase, memoTypeId, testCase.memoTypeSlug, stepExpect);
      result.workflowDefOk = defCheck.ok;
      result.workflowDefDetail = defCheck.message;
    } else {
      result.workflowDefOk = true;
      result.workflowDefDetail = 'no static expectation';
    }

    const deptCode = testCase.creatorDeptCode || creator.department_code || 'IT';
    const departmentId = await deptId(supabase, deptCode);

    const memo = await services.createMemo(creator.id, departmentId, {
      memo_type_id: memoTypeId,
      subject: `[TEST] ${testCase.department} — ${testCase.memoTypeSlug} — ${Date.now()}`,
      background: 'Automated workflow test',
      justification: 'Smoke test',
      recommendation: 'Approve',
      requires_finance: testCase.requires_finance,
      importance_level: testCase.importance_level || 'normal',
    });

    memoIds.push(memo.id);
    result.reference = memo.reference_number;

    const submit = await services.submitMemo(memo.id, creator.id);
    let snap = await getMemoSnapshot(supabase, memo.id);

    const firstStep = testCase.steps[0];
    const firstRole = stepExpect?.[0];
    const submitApproverCheck = firstRole
      ? await verifyApprovers(
          firstRole,
          memo.department_id,
          testCase.memoTypeSlug,
          1,
          firstStep.approverEmail,
          firstStep.queueMustInclude
        )
      : { ok: true, message: 'skipped queue check' };

    result.steps.push({
      step: 'Submit',
      expectedStatus: firstStep.status,
      actualStatus: snap.statusSlug || submit.status,
      expectedApprover: firstStep.approverEmail,
      approverQueueOk: submitApproverCheck.ok,
      pass:
        (snap.statusSlug === firstStep.status || submit.status === firstStep.status) &&
        submitApproverCheck.ok,
      detail: submitApproverCheck.message,
    });

    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i];
      snap = await getMemoSnapshot(supabase, memo.id);

      if (snap.statusSlug !== step.status) {
        result.steps.push({
          step: step.label,
          expectedStatus: step.status,
          actualStatus: snap.statusSlug || '?',
          expectedApprover: step.approverEmail,
          approverQueueOk: false,
          pass: false,
          detail: `stuck before approval (expected status ${step.status})`,
        });
        break;
      }

      const roleSlug = stepExpect?.[i] || 'ceo';
      const queueCheck = await verifyApprovers(
        roleSlug,
        memo.department_id,
        testCase.memoTypeSlug,
        i + 1,
        step.approverEmail,
        step.queueMustInclude
      );

      const approver = await fetchUserByEmail(supabase, step.approverEmail);
      if (!approver) {
        result.steps.push({
          step: step.label,
          expectedStatus: step.status,
          actualStatus: snap.statusSlug || '?',
          expectedApprover: step.approverEmail,
          approverQueueOk: queueCheck.ok,
          pass: false,
          detail: `approver account missing: ${step.approverEmail}`,
        });
        break;
      }

      const approval = await services.processApproval(memo.id, approver.id, {
        action: 'approve',
        comments: `[TEST] ${step.label}`,
      });

      const after = await getMemoSnapshot(supabase, memo.id);
      const nextStep = testCase.steps[i + 1];
      const expectedAfter = nextStep ? nextStep.status : 'approved';

      result.steps.push({
        step: step.label,
        expectedStatus: expectedAfter,
        actualStatus: after.statusSlug || approval.status,
        expectedApprover: step.approverEmail,
        approverQueueOk: queueCheck.ok,
        pass:
          queueCheck.ok &&
          (after.statusSlug === expectedAfter || approval.status === expectedAfter),
        detail: queueCheck.message,
      });
    }

    const finalSnap = await getMemoSnapshot(supabase, memo.id);
    const lastExpected = testCase.steps[testCase.steps.length - 1];
    result.pass =
      result.workflowDefOk &&
      result.steps.every((s) => s.pass) &&
      finalSnap.statusSlug === 'approved';

    if (!result.pass && finalSnap.statusSlug !== 'approved') {
      result.error = `Final status: ${finalSnap.statusSlug}`;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.pass = false;
  }

  return result;
}

async function deptId(supabase: ReturnType<typeof createTestSupabase>, code: string) {
  const { data } = await supabase.from('departments').select('id').eq('code', code).single();
  if (!data?.id) throw new Error(`Department not found: ${code}`);
  return data.id;
}

function printReport(results: CaseResult[]) {
  console.log('\n' + '='.repeat(72));
  console.log('WORKFLOW TEST REPORT');
  console.log('='.repeat(72));

  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`\n[${icon}] ${r.department} / ${r.memoType} — ${r.description}`);
    if (r.reference) console.log(`     Memo: ${r.reference}`);
    console.log(`     Workflow def: ${r.workflowDefOk ? 'OK' : 'FAIL'} — ${r.workflowDefDetail}`);
    for (const s of r.steps) {
      const sIcon = s.pass ? '✓' : '✗';
      console.log(
        `     ${sIcon} ${s.step}: status ${s.actualStatus} (want ${s.expectedStatus}) | ${s.expectedApprover} | ${s.detail}`
      );
    }
    if (r.error) console.log(`     Error: ${r.error}`);
  }

  const passed = results.filter((r) => r.pass).length;
  console.log('\n' + '-'.repeat(72));
  console.log(`Total: ${passed}/${results.length} passed`);
  console.log('='.repeat(72) + '\n');
}

async function main() {
  const { url, serviceKey } = requireSupabaseEnv();
  const supabase = createTestSupabase(url, serviceKey);

  const ceo = await fetchCeoUser(supabase);
  if (!ceo) {
    console.error('No CEO user found. Assign ceo role or run seed:users.');
    process.exit(1);
  }

  let itStaff =
    (await fetchStaffInDept(supabase, 'IT')) ||
    (await fetchUserByEmail(supabase, 'doreen.kembabazi@rukapay.co.ug'));
  let hrHead =
    (await fetchDeptHead(supabase, 'HR')) ||
    (await promoteUserForTest(
      supabase,
      'portia.nayebare@rukapay.co.ug',
      'department_head',
      'HR',
      'HR — Dept Head (test)'
    ));
  const mktStaff = await fetchStaffInDept(supabase, MARKETING_DEPARTMENT_CODE);
  const mktCreator =
    mktStaff ||
    (await fetchUserByEmail(supabase, MARKETING_HEAD_EMAIL));
  let opsHead =
    (await fetchDeptHead(supabase, 'OPS')) ||
    (await promoteUserForTest(
      supabase,
      'mutorine.silas@rukapay.co.ug',
      'department_head',
      'OPS',
      'OPS — Dept Head (test)'
    ));
  const opsStaff = (await fetchStaffInDept(supabase, 'OPS')) || opsHead;
  if (!itStaff) {
    itStaff = await promoteUserForTest(
      supabase,
      'doreen.kembabazi@rukapay.co.ug',
      'staff',
      'IT',
      'IT — Staff (test)'
    );
  }

  const missing: string[] = [];
  const anyStaff = await fetchAnyStaff(supabase);
  if (!itStaff) itStaff = anyStaff;
  if (!itStaff) missing.push('IT staff creator');
  if (!hrHead) missing.push('HR department head');
  if (!mktCreator) missing.push('Marketing creator');
  if (!opsStaff) missing.push('OPS staff or department head');
  if (!opsHead) missing.push('OPS department head');
  if (missing.length) {
    console.error('Missing users for tests:', missing.join(', '));
    console.error('Run npm run seed:team and assign:* scripts first.');
    process.exit(1);
  }

  console.log('Test actors:');
  console.log(`  IT staff creator: ${itStaff.email}, IT heads: ${IT_FIRST_CHECKER_EMAIL} + ${IT_SECOND_CHECKER_EMAIL}`);
  console.log(`  HR head: ${hrHead.email}`);
  console.log(`  MKT creator: ${mktCreator.email}, OPS: ${opsStaff.email} / head ${opsHead.email}`);

  const allEmails = [
    ceo.email,
    HR_MEMO_CREATOR_EMAIL,
    FINANCE_MEMO_CREATOR_EMAIL,
    FINANCE_MEMO_APPROVER_EMAIL,
    MARKETING_HEAD_EMAIL,
    BUSINESS_HEAD_EMAIL,
    INTERDEPT_FINANCE_REVIEWER_EMAIL,
    IT_FIRST_CHECKER_EMAIL,
    IT_SECOND_CHECKER_EMAIL,
    itStaff.email,
    IT_FIRST_CHECKER_EMAIL,
    IT_SECOND_CHECKER_EMAIL,
    hrHead.email,
    mktCreator.email,
    opsStaff.email,
    opsHead.email,
  ];

  const sigCount = await ensureAllActiveUserSignatures(supabase);
  await ensureTestSignatures(supabase, allEmails);
  console.log(`Signatures set for all ${sigCount} active users (${TEST_SIGNATURE_PATH})`);

  const allCases = buildAllTestCases(ceo.email, {
    itStaffEmail: itStaff.email,
    itDeptHeadEmail: IT_FIRST_CHECKER_EMAIL,
    hrDeptHeadEmail: hrHead.email,
    mktCreatorEmail: mktCreator.email,
    opsStaffEmail: opsStaff.email,
    opsDeptHeadEmail: opsHead.email,
  });

  const filter = process.argv.slice(2).map((a) => a.toLowerCase());
  const cases =
    filter.length > 0
      ? allCases.filter((c) => filter.includes(c.id) || filter.includes(c.memoTypeSlug))
      : allCases;

  if (cases.length === 0) {
    console.error('No tests matched filter:', filter.join(', '));
    console.error('Available ids:', allCases.map((c) => c.id).join(', '));
    process.exit(1);
  }

  const { createMemo, submitMemo, processApproval } = await import('../src/lib/memo/service');

  console.log(`\nRunning ${cases.length} workflow test(s) (CEO: ${ceo.email})…\n`);

  const results: CaseResult[] = [];
  for (const testCase of cases) {
    process.stdout.write(`  • ${testCase.department} / ${testCase.memoTypeSlug}… `);
    const r = await runCase(testCase, supabase, { createMemo, submitMemo, processApproval });
    results.push(r);
    console.log(r.pass ? 'PASS' : 'FAIL');
  }

  printReport(results);

  const failed = results.filter((r) => !r.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
