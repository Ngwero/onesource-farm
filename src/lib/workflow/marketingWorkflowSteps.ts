import type { WorkflowStep } from '@/lib/workflow/engine';

export const MARKETING_DEPARTMENT_CODE = 'MKT';

/** Marketing request: business head → finance → CEO. */
export const MARKETING_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'business_head',
    step_name: 'Business Head Approval',
    is_parallel: false,
    sla_hours: 24,
  },
  {
    step_order: 2,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review',
    is_parallel: false,
    sla_hours: 48,
  },
  {
    step_order: 3,
    role_slug: 'ceo',
    step_name: 'CEO Approval',
    is_parallel: false,
    sla_hours: 72,
  },
];

/** Optional designated emails — empty until assigned. */
export const MARKETING_HEAD_EMAIL: string = '';
export const BUSINESS_HEAD_EMAIL: string = '';
