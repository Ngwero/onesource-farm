import type { WorkflowStep } from '@/lib/workflow/engine';

/** Finance Request (from finance dept): Amara (CFO) → CEO */
export const FINANCE_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'finance_reviewer',
    step_name: 'CFO Review (Amara)',
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
export const FINANCE_MEMO_APPROVER_EMAIL = 'amara.oto@rukapay.co.ug';
