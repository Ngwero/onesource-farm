import type { Memo } from '@/types';

export const LEAVE_TYPES = [
  'Annual leave',
  'Sick leave',
  'Maternity / paternity leave',
  'Compassionate leave',
  'Study leave',
  'Unpaid leave',
  'Other',
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export type LeaveTemplateFields = {
  leave_start: string;
  leave_end: string;
  leave_type: string;
  reason: string;
  duties_not_delegated: string;
  handover_contact: string;
};

export const EMPTY_LEAVE_FIELDS: LeaveTemplateFields = {
  leave_start: '',
  leave_end: '',
  leave_type: 'Annual leave',
  reason: '',
  duties_not_delegated: '',
  handover_contact: '',
};

type LeaveMeta = {
  _leave_v: 1;
  start: string;
  end: string;
  type: string;
};

export type MemoTypeRel = {
  memo_type?: { slug?: string } | null;
  memo_types?: { slug?: string } | { slug?: string }[] | null;
};

export function memoTypeSlugFromMemo(memo: MemoTypeRel): string | undefined {
  if (memo.memo_type?.slug) return memo.memo_type.slug;
  const rel = memo.memo_types;
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.slug;
  return rel.slug;
}

export function isLeaveMemo(memo: MemoTypeRel): boolean {
  return memoTypeSlugFromMemo(memo) === 'leave_request';
}

function parseLeaveMeta(financialImplication?: string | null): LeaveMeta | null {
  const raw = financialImplication?.trim();
  if (!raw?.startsWith('{')) return null;
  try {
    const meta = JSON.parse(raw) as Partial<LeaveMeta & { _leave_y?: number }>;
    const version = meta._leave_v ?? meta._leave_y;
    const hasDates = Boolean(meta.start || meta.end);
    if (version !== 1 && !hasDates) return null;
    if (!hasDates) return null;
    return {
      _leave_v: 1,
      start: meta.start || '',
      end: meta.end || '',
      type: meta.type || '',
    };
  } catch {
    return null;
  }
}

function leaveTypeFromBackground(background?: string | null): string {
  const match = (background || '').match(/^Type of leave:\s*(.+?)(?:\n|$)/im);
  return match?.[1]?.trim() || '';
}

function reasonFromBackground(background?: string | null, leaveType?: string): string {
  const text = (background || '').trim();
  if (!text) return '';
  const prefix = leaveType ? `Type of leave: ${leaveType}` : 'Type of leave:';
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length).trim().replace(/^\n+/, '');
  }
  return text;
}

function backgroundFromLeave(leaveType: string, reason: string): string {
  const typeLine = leaveType.trim() ? `Type of leave: ${leaveType.trim()}` : '';
  const reasonText = reason.trim();
  if (typeLine && reasonText) return `${typeLine}\n\n${reasonText}`;
  return typeLine || reasonText;
}

export function formatLeaveDate(date: string): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Inclusive count of Mon–Fri days between start and end (YYYY-MM-DD). */
export function leaveDurationDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return null;

  let workingDays = 0;
  const cursor = new Date(s);
  while (cursor <= e) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) workingDays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return workingDays;
}

export function formatLeavePeriod(start: string, end: string): string {
  if (!start && !end) return '';
  const startLabel = start ? formatLeaveDate(start) : '—';
  const endLabel = end ? formatLeaveDate(end) : '—';
  const days = leaveDurationDays(start, end);
  const range = `${startLabel} to ${endLabel}`;
  if (days === null) return range;
  return `${range} (${days} working day${days === 1 ? '' : 's'})`;
}

export function parseLeaveFromMemo(
  memo: Pick<Memo, 'background' | 'financial_implication' | 'justification' | 'recommendation'>
): LeaveTemplateFields {
  const meta = parseLeaveMeta(memo.financial_implication);
  if (meta) {
    return {
      leave_start: meta.start,
      leave_end: meta.end,
      leave_type: meta.type || 'Annual leave',
      reason: reasonFromBackground(memo.background, meta.type),
      duties_not_delegated: memo.recommendation || '',
      handover_contact: memo.justification || '',
    };
  }

  return {
    ...EMPTY_LEAVE_FIELDS,
    leave_type: leaveTypeFromBackground(memo.background) || 'Annual leave',
    reason: reasonFromBackground(memo.background, leaveTypeFromBackground(memo.background)),
    duties_not_delegated: memo.recommendation || '',
    handover_contact: memo.justification || '',
  };
}

export function packLeaveToMemoFields(
  fields: LeaveTemplateFields
): Pick<Memo, 'background' | 'financial_implication' | 'justification' | 'recommendation'> {
  const meta: LeaveMeta = {
    _leave_v: 1,
    start: fields.leave_start,
    end: fields.leave_end,
    type: fields.leave_type,
  };

  return {
    background: backgroundFromLeave(fields.leave_type, fields.reason),
    financial_implication: JSON.stringify(meta),
    justification: fields.handover_contact.trim(),
    recommendation: fields.duties_not_delegated.trim(),
  };
}

export type LeaveDisplaySection = { label: string; content: string };

export function getLeaveDisplaySections(
  memo: Pick<
    Memo,
    'background' | 'financial_implication' | 'justification' | 'recommendation' | 'memo_type'
  > & MemoTypeRel
): LeaveDisplaySection[] {
  const fields = parseLeaveFromMemo(memo);
  const sections: LeaveDisplaySection[] = [];

  if (fields.leave_type) {
    sections.push({ label: 'Type of leave', content: fields.leave_type });
  }

  if (fields.leave_start || fields.leave_end) {
    sections.push({
      label: 'Leave period',
      content: formatLeavePeriod(fields.leave_start, fields.leave_end),
    });
  }

  const reason = fields.reason.trim();
  if (reason && reason.toLowerCase() !== fields.leave_type.trim().toLowerCase()) {
    sections.push({ label: 'Reason', content: reason });
  }

  if (fields.duties_not_delegated.trim()) {
    sections.push({
      label: 'Duties not to be delegated',
      content: fields.duties_not_delegated.trim(),
    });
  }

  if (fields.handover_contact.trim()) {
    sections.push({
      label: 'Handover & contact while on leave',
      content: fields.handover_contact.trim(),
    });
  }

  return sections;
}

/** Structured leave fields for the dedicated preview layout. */
export function getLeavePreviewModel(
  memo: Pick<
    Memo,
    'background' | 'financial_implication' | 'justification' | 'recommendation' | 'memo_type'
  > & MemoTypeRel
) {
  const fields = parseLeaveFromMemo(memo);
  const reason = fields.reason.trim();
  const showReason =
    Boolean(reason) && reason.toLowerCase() !== fields.leave_type.trim().toLowerCase();

  return {
    fields,
    durationDays: leaveDurationDays(fields.leave_start, fields.leave_end),
    showReason,
    detailSections: getLeaveDisplaySections(memo).filter(
      (s) => s.label !== 'Type of leave' && s.label !== 'Leave period'
    ),
  };
}

export function getMemoBodyRowsForExport(
  memo: Pick<
    Memo,
    | 'background'
    | 'financial_implication'
    | 'justification'
    | 'recommendation'
    | 'memo_type'
  >
): [string, string][] {
  if (isLeaveMemo(memo)) {
    return getLeaveDisplaySections(memo).map((s) => [s.label, s.content]);
  }

  return (
    [
      ['Background', memo.background],
      ['Financial Implication', memo.financial_implication],
      ['Justification', memo.justification],
      ['Recommendation', memo.recommendation],
    ] as [string, string | undefined][]
  ).filter((row): row is [string, string] => Boolean(row[1]?.trim()));
}

export function memoDocumentTitle(
  memo: { memo_type?: { slug?: string } | null } & MemoTypeRel
): string {
  return isLeaveMemo(memo) ? 'Leave Application' : 'Internal Memo';
}

export function validateLeaveFields(fields: LeaveTemplateFields): string | null {
  if (!fields.leave_start) return 'Leave start date is required.';
  if (!fields.leave_end) return 'Leave end date is required.';
  if (fields.leave_end < fields.leave_start) {
    return 'Leave end date must be on or after the start date.';
  }
  if (!fields.leave_type.trim()) return 'Type of leave is required.';
  if (!fields.duties_not_delegated.trim()) {
    return 'List the duties that will not be delegated during your leave.';
  }
  return null;
}
