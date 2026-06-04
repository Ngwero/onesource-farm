import type { MemoStatusSlug } from '@/types';

export type WorkflowStepStatus = 'completed' | 'current' | 'pending';

export interface WorkflowDisplayStep {
  name: string;
  status: WorkflowStepStatus;
  date?: string;
}

const PIPELINE: MemoStatusSlug[] = [
  'draft',
  'submitted',
  'pending_department_head',
  'pending_it_review',
  'pending_it_checker_first',
  'pending_it_checker_second',
  'pending_finance',
  'pending_hr',
  'pending_ceo',
  'pending_exco',
  'approved',
];

function pipelineIndex(slug?: string): number {
  if (!slug) return -1;
  const i = PIPELINE.indexOf(slug as MemoStatusSlug);
  if (i >= 0) return i;
  if (slug === 'returned' || slug === 'rejected' || slug === 'withdrawn') return 0;
  return -1;
}

function stepStatus(
  currentIdx: number,
  gateIdx: number,
  isTerminalApproved: boolean
): WorkflowStepStatus {
  if (isTerminalApproved) return 'completed';
  if (currentIdx < 0) return 'pending';
  if (currentIdx > gateIdx) return 'completed';
  if (currentIdx === gateIdx) return 'current';
  return 'pending';
}

export function buildWorkflowSteps(
  statusSlug: string | undefined,
  opts: { createdAt: string; submittedAt?: string | null }
): WorkflowDisplayStep[] {
  const idx = pipelineIndex(statusSlug);
  const approved = statusSlug === 'approved';
  const financeHrIdx = Math.max(
    PIPELINE.indexOf('pending_finance'),
    PIPELINE.indexOf('pending_hr'),
    PIPELINE.indexOf('pending_it_review'),
    PIPELINE.indexOf('pending_it_checker_first'),
    PIPELINE.indexOf('pending_it_checker_second')
  );
  const ceoExcoIdx = Math.max(
    PIPELINE.indexOf('pending_ceo'),
    PIPELINE.indexOf('pending_exco')
  );

  return [
    {
      name: 'Created',
      status: 'completed',
      date: new Date(opts.createdAt).toLocaleString(),
    },
    {
      name: 'Submitted',
      status: opts.submittedAt || idx >= PIPELINE.indexOf('submitted') || approved
        ? 'completed'
        : 'pending',
    },
    {
      name: 'Department Head',
      status: stepStatus(idx, PIPELINE.indexOf('pending_department_head'), approved),
    },
    {
      name: 'Finance / HR Review',
      status: stepStatus(idx, financeHrIdx, approved),
    },
    {
      name: 'CEO / EXCO Approval',
      status: stepStatus(idx, ceoExcoIdx, approved),
    },
    {
      name: 'Approved',
      status: approved ? 'completed' : 'pending',
    },
  ];
}
