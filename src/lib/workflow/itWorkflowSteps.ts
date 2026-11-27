import type { WorkflowStep } from '@/lib/workflow/engine';

/** Optional designated IT memo creator — empty until assigned. */
export const IT_MEMO_CREATOR_EMAIL: string = '';

/** IT Request: 1st check → 2nd check → finance → CEO. */
export const IT_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'it_checker_first',
    step_name: 'IT Check — 1st',
    is_parallel: false,
    sla_hours: 24,
  },
  {
    step_order: 2,
    role_slug: 'it_checker_second',
    step_name: 'IT Check — 2nd',
    is_parallel: false,
    sla_hours: 24,
  },
  {
    step_order: 3,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review',
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
