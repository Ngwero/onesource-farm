import type { WorkflowStep } from '@/lib/workflow/engine';

export const MARKETING_DEPARTMENT_CODE = 'MKT';

/**
 * Marketing request (under Business): Norman (business head) → Christine → CEO.
 * MKT department head (Margaret) handles payment/leave/general targeting MKT — see designatedUsers.
 */
export const MARKETING_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'business_head',
    step_name: 'Business Head (Norman)',
    is_parallel: false,
    sla_hours: 24,
  },
  {
    step_order: 2,
    role_slug: 'finance_reviewer',
    step_name: 'Finance Review (Christine)',
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

export const MARKETING_HEAD_EMAIL = 'margaret.nassiwa@rukapay.co.ug';
export const BUSINESS_HEAD_EMAIL = 'norman.nowamani@rukapay.co.ug';
