import type { MemoStatusSlug } from '@/types';

/** First token of full name (e.g. "Christine Kangume" → "Christine"). */
export function firstNameFromFullName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

const PENDING_FALLBACK: Partial<Record<MemoStatusSlug, string>> = {
  pending_department_head: 'Pending approval',
  pending_business_head: 'Pending business head',
  pending_it_review: 'Pending IT review',
  pending_it_checker_first: 'Pending IT check',
  pending_it_checker_second: 'Pending IT check',
  pending_finance: 'Pending finance',
  pending_hr: 'Pending HR',
  pending_ceo: 'Pending CEO',
  pending_exco: 'Pending EXCO',
};

const STATIC_LABELS: Partial<Record<MemoStatusSlug, string>> = {
  draft: 'Draft',
  submitted: 'Submitted',
  returned: 'Returned',
  rejected: 'Rejected',
  approved: 'Approved',
  withdrawn: 'Withdrawn',
  archived: 'Archived',
  deleted: 'Deleted',
};

function titleCaseSlug(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-readable status for badges — pending steps use approver first name when known. */
export function formatMemoStatusLabel(
  statusSlug?: string | null,
  assigneeFullName?: string | null,
  options?: { assigneeIsCurrentUser?: boolean }
): string {
  const slug = (statusSlug || 'draft') as MemoStatusSlug;

  if (slug.startsWith('pending_')) {
    if (options?.assigneeIsCurrentUser) return 'Pending You';
    const first = firstNameFromFullName(assigneeFullName);
    if (first) return `Pending ${first}`;
    return PENDING_FALLBACK[slug] || titleCaseSlug(slug);
  }

  return STATIC_LABELS[slug] || titleCaseSlug(slug);
}

export const PENDING_STATUS_TO_ROLE: Partial<Record<MemoStatusSlug, string>> = {
  pending_department_head: 'department_head',
  pending_business_head: 'business_head',
  pending_it_review: 'it_checker_first',
  pending_it_checker_first: 'it_checker_first',
  pending_it_checker_second: 'it_checker_second',
  pending_finance: 'finance_reviewer',
  pending_hr: 'hr_reviewer',
  pending_ceo: 'ceo',
  pending_exco: 'exco_member',
};
