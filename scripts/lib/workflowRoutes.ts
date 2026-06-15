/**
 * Canonical workflow routes (keep in sync with src/lib/workflow/* and designatedUsers.ts).
 */

import {
  CEO_APPROVER_EMAIL,
  CEO_MEMO_CREATOR_EMAIL,
  CHAIRMAN_APPROVER_EMAIL,
  DESIGNATED_DEPT_HEAD_EMAILS,
  IT_DEPT_HEAD_EMAILS,
} from '../../src/lib/memo/designatedUsers';
import { MARKETING_HEAD_EMAIL } from '../../src/lib/workflow/marketingWorkflowSteps';
import { FINANCE_MEMO_APPROVER_EMAIL } from '../../src/lib/workflow/financeWorkflowSteps';
import { INTERDEPT_FINANCE_REVIEWER_EMAIL } from '../../src/lib/workflow/interdeptFinanceReviewer';
import { HR_MEMO_CREATOR_EMAIL } from '../../src/lib/workflow/hrWorkflowSteps';
import { BUSINESS_HEAD_EMAIL } from '../../src/lib/workflow/marketingWorkflowSteps';

export type WorkflowRouteRow = {
  memoType: string;
  targetDepartment: string;
  whoCanCreate: string;
  financeStep: string;
  route: string[];
};

export const WORKFLOW_ROUTES: WorkflowRouteRow[] = [
  {
    memoType: 'HR Request',
    targetDepartment: 'Any (select HR on form)',
    whoCanCreate: 'Any staff / dept head',
    financeStep: `Christine (${INTERDEPT_FINANCE_REVIEWER_EMAIL})`,
    route: ['Christine', `CEO (${CEO_APPROVER_EMAIL})`],
  },
  {
    memoType: 'Finance Request',
    targetDepartment: 'FIN (typically)',
    whoCanCreate: 'Any staff / dept head',
    financeStep: `Amara CFO (${FINANCE_MEMO_APPROVER_EMAIL}) — finance dept memos only`,
    route: ['Amara', `CEO (${CEO_APPROVER_EMAIL})`],
  },
  {
    memoType: 'Marketing Request',
    targetDepartment: 'MKT / Business',
    whoCanCreate: 'Any staff / dept head',
    financeStep: `Christine (${INTERDEPT_FINANCE_REVIEWER_EMAIL})`,
    route: [`Norman (${BUSINESS_HEAD_EMAIL})`, 'Christine', `CEO (${CEO_APPROVER_EMAIL})`],
  },
  {
    memoType: 'IT Request',
    targetDepartment: 'IT',
    whoCanCreate: 'Any staff / dept head',
    financeStep: `Christine (${INTERDEPT_FINANCE_REVIEWER_EMAIL})`,
    route: [
      `Emma (${IT_DEPT_HEAD_EMAILS[0]})`,
      `Jim (${IT_DEPT_HEAD_EMAILS[1]})`,
      'Christine',
      `CEO (${CEO_APPROVER_EMAIL})`,
    ],
  },
  {
    memoType: 'Payment / Procurement / General',
    targetDepartment: 'Selected on form',
    whoCanCreate: 'Any staff / dept head',
    financeStep: `Christine (${INTERDEPT_FINANCE_REVIEWER_EMAIL})`,
    route: ['Dept head(s)', 'Christine', `CEO (${CEO_APPROVER_EMAIL})`],
  },
  {
    memoType: 'Leave Request',
    targetDepartment: 'Selected on form',
    whoCanCreate: 'Any staff / dept head',
    financeStep: '—',
    route: [
      `Dept head (e.g. HR: ${HR_MEMO_CREATOR_EMAIL}, MKT: ${MARKETING_HEAD_EMAIL})`,
      `CEO (${CEO_APPROVER_EMAIL})`,
    ],
  },
  {
    memoType: 'CEO memos',
    targetDepartment: 'CEO Office',
    whoCanCreate: `CEO (${CEO_MEMO_CREATOR_EMAIL})`,
    financeStep: '—',
    route: [`Chairman (${CHAIRMAN_APPROVER_EMAIL})`],
  },
];

export function printWorkflowRoutes(): void {
  console.log('\n' + '='.repeat(72));
  console.log('RukaPay e-Memo — Workflow routes');
  console.log('='.repeat(72));
  console.log('\nFinance review split:');
  console.log(`  • Finance Request → ${FINANCE_MEMO_APPROVER_EMAIL} (Amara, CFO)`);
  console.log(`  • All other types (finance step) → ${INTERDEPT_FINANCE_REVIEWER_EMAIL} (Christine)\n`);

  for (const row of WORKFLOW_ROUTES) {
    console.log(`${row.memoType}`);
    console.log(`  Target dept:   ${row.targetDepartment}`);
    console.log(`  Finance step:  ${row.financeStep}`);
    console.log(`  Route:         ${row.route.join(' → ')}`);
    console.log('');
  }

  console.log('Department heads (payment / procurement / general / leave step 1):');
  for (const [code, emails] of Object.entries(DESIGNATED_DEPT_HEAD_EMAILS)) {
    console.log(`  ${code}: ${emails.join(', ')}`);
  }
  console.log(`Marketing workflow (marketing_request): Business head ${BUSINESS_HEAD_EMAIL}`);
  console.log(`CEO memos: ${CEO_MEMO_CREATOR_EMAIL} → Chairman ${CHAIRMAN_APPROVER_EMAIL}`);
  console.log('='.repeat(72) + '\n');
}
