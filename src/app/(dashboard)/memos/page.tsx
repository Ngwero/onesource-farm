'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { MemoList } from '@/components/memo/MemoList';
import { MemosFilterTabs } from '@/components/memo/MemosFilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { MemoListFilters } from '@/components/memo/MemoListFilters';
import { formatPeriodLabel, parseMemoPeriodFilter } from '@/lib/memo/periodFilter';
import { useAuth } from '@/context/AuthContext';
import { useMemos } from '@/hooks/useMemos';
import { isInterdeptFinanceReviewer } from '@/lib/memo/financeMemoRouting';

const PAGE_TITLES: Record<string, string> = {
  draft: 'My Drafts',
  returned: 'Returned for correction',
  approved: 'Approved memos',
  approved_approver: 'Memos I approved',
  rejected: 'Rejected memos',
};

function MemosContent() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get('status') || undefined;
  const paymentStatus = searchParams.get('payment_status') || undefined;
  const view = searchParams.get('view') || undefined;
  const memoType = searchParams.get('memo_type') || undefined;
  const q = searchParams.get('q') || undefined;
  const year = searchParams.get('year') || undefined;
  const month = searchParams.get('month') || undefined;
  const period = useMemo(
    () => parseMemoPeriodFilter(year ?? null, month ?? null),
    [year, month]
  );

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (status) f.status = status;
    if (paymentStatus) f.payment_status = paymentStatus;
    if (view) f.view = view;
    if (memoType) f.memo_type = memoType;
    if (q && q.trim().length >= 2) f.q = q.trim();
    if (year) f.year = year;
    if (month) f.month = month;
    return Object.keys(f).length ? f : undefined;
  }, [status, paymentStatus, view, memoType, q, year, month]);
  const { memos, loading } = useMemos(filters);

  const query = searchParams.toString();
  const fullPath = query ? `${pathname}?${query}` : pathname;

  const isApproverRole = [
    'department_head',
    'business_head',
    'it_checker_first',
    'it_checker_second',
    'finance_reviewer',
    'hr_reviewer',
    'ceo',
    'exco_member',
  ].includes(user?.role?.slug || '');

  const periodActive = Boolean(period);

  const isChristinePaymentView =
    Boolean(user && isInterdeptFinanceReviewer(user) && status === 'approved' && paymentStatus);

  const title = q && q.trim().length >= 2
    ? 'Search results'
    : period
      ? `Memos — ${formatPeriodLabel(period)}`
      : paymentStatus === 'not_paid'
        ? 'Approved — awaiting payment'
        : paymentStatus === 'paid'
          ? 'Approved — paid'
          : status
            ? status === 'approved' && isApproverRole
              ? PAGE_TITLES.approved_approver
              : PAGE_TITLES[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : view === 'active'
              ? 'Memos in progress'
              : 'My Memos';

  const subtitle =
    q && q.trim().length >= 2
      ? `Showing memos matching “${q.trim()}” in your visible list.`
      : period
        ? `Sorted by memo date (newest first) for ${formatPeriodLabel(period)}.`
        : paymentStatus === 'not_paid' || paymentStatus === 'paid'
          ? 'Update payment status on each memo once funds have been processed.'
          : status === 'draft'
            ? 'Drafts are private until you submit them for approval.'
            : status === 'approved' && isApproverRole
              ? 'Memos you have approved at your step (including those still moving through the workflow).'
              : status === 'approved'
                ? 'Fully approved memos and memos that have received at least one approval.'
                : 'Memos you created or that were shared with you.';

  const searchActive = Boolean(q && q.trim().length >= 2);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <MemoListFilters />
      <MemosFilterTabs
        fullPath={fullPath}
        showApproverApprovedLabel={isApproverRole}
        className="mt-1"
      />
      {loading ? (
        <div className="card dashboard-loading">
          <p>Loading memos…</p>
        </div>
      ) : (
        <>
          <MemoList
            memos={memos as Parameters<typeof MemoList>[0]['memos']}
            currentUserId={user?.id}
            showPaymentColumn={isChristinePaymentView || status === 'approved'}
            emptyMessage={
              searchActive
                ? `No memos found for “${q?.trim()}”. Try reference, subject, or creator name.`
                : periodActive
                  ? `No memos with a memo date in ${formatPeriodLabel(period!)}.`
                  : status === 'draft'
                    ? 'No drafts yet — create a memo and use Save draft'
                    : undefined
            }
            sortByMemoDate={periodActive}
          />
        </>
      )}
    </div>
  );
}

export default function MemosPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MemosContent />
    </Suspense>
  );
}
