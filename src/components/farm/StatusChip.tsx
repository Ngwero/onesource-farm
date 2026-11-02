import { cn } from '@/lib/utils';
import { optionLabel } from '@/lib/farm/schemas';

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lime: 'bg-lime-50 text-lime-800 border-lime-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  red: 'bg-red-50 text-red-700 border-red-200',
} as const;

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  active: 'green',
  harvesting: 'lime',
  planned: 'blue',
  preparation: 'amber',
  fallow: 'amber',
  completed: 'slate',
  inactive: 'slate',
  abandoned: 'red',
  export: 'green',
  local_market: 'blue',
  processing: 'amber',
  waste: 'red',
  terminated: 'red',
  present: 'green',
  absent: 'red',
  leave: 'blue',
  off: 'slate',
  assigned: 'blue',
  in_progress: 'amber',
  cancelled: 'slate',
  overdue: 'red',
  draft: 'amber',
  finalized: 'blue',
  paid: 'green',
  unpaid: 'amber',
  open: 'red',
  treating: 'amber',
  monitoring: 'blue',
  resolved: 'green',
  low: 'slate',
  medium: 'amber',
  high: 'red',
  critical: 'red',
  pending_grading: 'amber',
  graded: 'green',
  pending: 'amber',
  failed: 'red',
  rework: 'amber',
  reinspection: 'blue',
  approved: 'green',
  released: 'lime',
  awaiting_review: 'amber',
  rejected: 'red',
  pass: 'green',
  conditional_pass: 'amber',
  fail: 'red',
  receive: 'green',
  relocate: 'blue',
  dispatch: 'lime',
  damage: 'red',
  spoil: 'red',
  reserve: 'blue',
  unreserve: 'slate',
};

/** Plain-language labels for QC states shown on batches. */
export const QC_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending QC',
  failed: 'Failed QC',
  rework: 'Rework required',
  reinspection: 'Reinspection required',
  approved: 'QC approved',
  released: 'Export released',
};

export function QcStatusChip({ status, className }: { status: string; className?: string }) {
  return <StatusChip status={status} label={QC_STATUS_LABEL[status]} className={className} />;
}

export function StatusChip({ status, label, className }: { status: string; label?: string; className?: string }) {
  const tone = TONES[STATUS_TONE[status] ?? 'slate'];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tone,
        className
      )}
    >
      {label ?? optionLabel(status)}
    </span>
  );
}
