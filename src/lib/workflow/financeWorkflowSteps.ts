import type { WorkflowStep } from '@/lib/workflow/engine';

/** Finance Request (from finance dept): Christine → CEO */
export const FINANCE_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review (Christine)',
    is_parallel: false,
    sla_hours: 48,
  },
  {
    step_order: 2,
    role_slug: 'ceo',
    step_name: 'CEO Approval',
    is_parallel: false,
    sla_hours: 72,
  },
];

export const FINANCE_MEMO_CREATOR_EMAIL = 'christine.kangume@rukapay.co.ug';
/** Finance step approver for all memo types (including Finance Request). */
export const FINANCE_MEMO_APPROVER_EMAIL = 'christine.kangume@rukapay.co.ug';
export const FINANCE_DEPT_HEAD_EMAIL = 'amara.oto@rukapay.co.ug';
