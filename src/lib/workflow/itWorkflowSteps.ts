import type { WorkflowStep } from '@/lib/workflow/engine';

export const IT_MEMO_CREATOR_EMAIL = 'doreen.kembabazi@onesourcefresh.com';

/** IT Request: Emmanuel → Jim → Christine (finance) → CEO */
export const IT_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'it_checker_first',
    step_name: 'IT Check — 1st (Emmanuel)',
    is_parallel: false,
    sla_hours: 24,
  },
  {
    step_order: 2,
    role_slug: 'it_checker_second',
    step_name: 'IT Check — 2nd (Jim)',
    is_parallel: false,
    sla_hours: 24,
  },
  {
    step_order: 3,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review (Christine)',
    is_parallel: false,
    sla_hours: 48,
  },
  {
    step_order: 4,
    role_slug: 'ceo',
    step_name: 'CEO Approval',
    is_parallel: false,
    sla_hours: 72,
  },
];
