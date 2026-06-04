'use client';

import { formatMemoStatusLabel } from '@/lib/memo/statusLabel';
import { useAuth } from '@/context/AuthContext';

const STATUS_CLASS: Record<string, string> = {
  draft: 'status-badge--draft',
  submitted: 'status-badge--submitted',
  pending_department_head: 'status-badge--pending_department_head',
  pending_business_head: 'status-badge--pending_business_head',
  pending_it_review: 'status-badge--pending_it_review',
  pending_it_checker_first: 'status-badge--pending_it_checker_first',
  pending_it_checker_second: 'status-badge--pending_it_checker_second',
  pending_finance: 'status-badge--pending_finance',
  pending_hr: 'status-badge--pending_hr',
  pending_ceo: 'status-badge--pending_ceo',
  pending_exco: 'status-badge--pending_exco',
  returned: 'status-badge--returned',
  rejected: 'status-badge--rejected',
  approved: 'status-badge--approved',
  withdrawn: 'status-badge--withdrawn',
  archived: 'status-badge--archived',
  deleted: 'status-badge--deleted',
};

export function StatusBadge({
  status,
  assigneeName,
  assigneeId,
  assigneeIsYou,
  /** @deprecated Use assigneeName */
  name,
}: {
  status?: string;
  assigneeName?: string | null;
  assigneeId?: string | null;
  assigneeIsYou?: boolean;
  name?: string | null;
}) {
  const { user } = useAuth();
  const slug = status || 'draft';
  const variant = STATUS_CLASS[slug] || STATUS_CLASS.draft;

  const isCurrentUser =
    assigneeIsYou ??
    Boolean(
      assigneeId &&
        user?.id &&
        assigneeId === user.id
    );

  const label = formatMemoStatusLabel(slug, assigneeName ?? name, {
    assigneeIsCurrentUser: isCurrentUser,
  });

  return <span className={`status-badge ${variant}`}>{label}</span>;
}
