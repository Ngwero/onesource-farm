import type { WorkflowStep } from '@/lib/workflow/engine';

/** HR Request: Christine (finance step) → CEO */
export const HR_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
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

export const HR_MEMO_CREATOR_EMAIL = 'dorothy.kubakurungi@onesourcefresh.com';
