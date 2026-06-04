import type { WorkflowStep } from '@/lib/workflow/engine';

/** Leave: Department Head → CEO (final approver). */
export const LEAVE_REQUEST_APPROVAL_STEPS: WorkflowStep[] = [
  {
    step_order: 1,
    role_slug: 'department_head',
    step_name: 'Department Head Approval',
    is_parallel: false,
    sla_hours: 24,
  },
  {
    step_order: 2,
    role_slug: 'ceo',
    step_name: 'CEO Approval',
    is_parallel: false,
    sla_hours: 72,
  },
];
