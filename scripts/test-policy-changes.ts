/**
 * Tests: open create (any staff), department targeting, IT dual heads in queue.
 * Usage: npm run test:policy
 */

import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';
import { printWorkflowRoutes } from './lib/workflowRoutes';
import {
  createTestSupabase,
  ensureTestSignatures,
  fetchStaffInDept,
  fetchUserByEmail,
  getApproverQueueEmails,
  getMemoTypeId,
  TEST_SIGNATURE_PATH,
} from './lib/workflowTestUtils';
import { canCreateMemoType } from '../src/lib/memo/designatedUsers';
import { IT_DEPT_HEAD_EMAILS } from '../src/lib/memo/designatedUsers';
import { IT_FIRST_CHECKER_EMAIL } from '../src/lib/workflow/itCheckers';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '../src/lib/workflow/interdeptFinanceReviewer';
import { FINANCE_MEMO_APPROVER_EMAIL } from '../src/lib/workflow/financeWorkflowSteps';

loadEnvLocal();

type PolicyResult = { name: string; pass: boolean; detail: string };

async function main() {
  printWorkflowRoutes();

  const { url, serviceKey } = requireSupabaseEnv();
  const supabase = createTestSupabase(url, serviceKey);
  const results: PolicyResult[] = [];

  const ngabo = await fetchUserByEmail(supabase, 'ngabo.sevelin@rukapay.co.ug');
  const emma = await fetchUserByEmail(supabase, IT_FIRST_CHECKER_EMAIL);
  const jim = await fetchUserByEmail(supabase, 'jim.ntare@rukapay.co.ug');

  if (!ngabo) {
    console.error('Need ngabo.sevelin@rukapay.co.ug (staff). Run seed:team.');
    process.exit(1);
  }

  await ensureTestSignatures(supabase, [
    ngabo.email,
    emma?.email || IT_FIRST_CHECKER_EMAIL,
    jim?.email || 'jim.ntare@rukapay.co.ug',
  ]);

  const memoTypes = [
    'hr_request',
    'finance_request',
    'it_request',
    'marketing_request',
    'payment_request',
    'general_internal',
  ] as const;

  const createChecks = memoTypes.map((slug) =>
    canCreateMemoType({ role: { slug: ngabo.role_slug as 'staff', name: '', id: '' } }, slug)
  );
  results.push({
    name: 'Any staff can create all memo types',
    pass: createChecks.every(Boolean),
    detail: memoTypes
      .map((s, i) => `${s}: ${createChecks[i] ? 'yes' : 'no'}`)
      .join(', '),
  });

  const hrDeptId = (await supabase.from('departments').select('id').eq('code', 'HR').single()).data
    ?.id;
  const itDeptId = (await supabase.from('departments').select('id').eq('code', 'IT').single()).data
    ?.id;

  if (hrDeptId && itDeptId) {
    const { createMemo, submitMemo } = await import('../src/lib/memo/service');
    const hrTypeId = await getMemoTypeId(supabase, 'hr_request');
    const payTypeId = await getMemoTypeId(supabase, 'payment_request');

    const hrMemo = await createMemo(ngabo.id, hrDeptId, {
      memo_type_id: hrTypeId,
      subject: `[TEST-POLICY] HR from ${ngabo.email} targeting HR dept`,
      background: 'Policy test',
      justification: 'Test',
      recommendation: 'Approve',
    });
    const hrSubmit = await submitMemo(hrMemo.id, ngabo.id);
    const hrQueue = await getApproverQueueEmails(
      'finance_reviewer',
      hrDeptId,
      'hr_request',
      1
    );
    results.push({
      name: 'Cross-dept create: staff submits HR memo (target dept HR)',
      pass:
        hrSubmit.status === 'pending_finance' &&
        hrQueue.includes(INTERDEPT_FINANCE_REVIEWER_EMAIL.toLowerCase()),
      detail: `status=${hrSubmit.status}, queue=[${hrQueue.join(', ')}]`,
    });

    const payMemo = await createMemo(ngabo.id, itDeptId, {
      memo_type_id: payTypeId,
      subject: `[TEST-POLICY] Payment from ${ngabo.email} targeting IT dept`,
      background: 'Policy test',
      justification: 'Test',
      recommendation: 'Approve',
      requires_finance: true,
    });
    const paySubmit = await submitMemo(payMemo.id, ngabo.id);
    const payQueue = await getApproverQueueEmails(
      'department_head',
      itDeptId,
      'payment_request',
      1
    );
    const hasBothHeads = IT_DEPT_HEAD_EMAILS.every((e) =>
      payQueue.includes(e.toLowerCase())
    );
    results.push({
      name: 'IT payment: queue includes Emmanuel + Jim',
      pass: paySubmit.status === 'pending_department_head' && hasBothHeads,
      detail: `status=${paySubmit.status}, queue=[${payQueue.join(', ')}]`,
    });

    const finDeptId = (await supabase.from('departments').select('id').eq('code', 'FIN').single()).data
      ?.id;
    if (finDeptId) {
      const finTypeId = await getMemoTypeId(supabase, 'finance_request');
      const finMemo = await createMemo(ngabo.id, finDeptId, {
        memo_type_id: finTypeId,
        subject: `[TEST-POLICY] Finance request targeting FIN`,
        background: 'Policy test',
        justification: 'Test',
        recommendation: 'Approve',
      });
      const finSubmit = await submitMemo(finMemo.id, ngabo.id);
      const finQueue = await getApproverQueueEmails(
        'finance_reviewer',
        finDeptId,
        'finance_request',
        1
      );
      results.push({
        name: 'Finance Request: queue is Amara (CFO)',
        pass:
          finSubmit.status === 'pending_finance' &&
          finQueue.includes(FINANCE_MEMO_APPROVER_EMAIL.toLowerCase()) &&
          !finQueue.includes(INTERDEPT_FINANCE_REVIEWER_EMAIL.toLowerCase()),
        detail: `status=${finSubmit.status}, queue=[${finQueue.join(', ')}]`,
      });
    }
  } else {
    results.push({
      name: 'Cross-dept / IT queue tests',
      pass: false,
      detail: 'HR or IT department missing in DB',
    });
  }

  console.log('POLICY TEST RESULTS');
  console.log('-'.repeat(72));
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
    console.log(`       ${r.detail}`);
  }
  console.log('-'.repeat(72));
  const failed = results.filter((r) => !r.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
