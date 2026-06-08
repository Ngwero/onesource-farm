'use client';

import { Clock, FileStack, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import { isInterdeptFinanceReviewer } from '@/lib/memo/financeMemoRouting';

export default function FinanceDashboard() {
  const { user } = useAuth();
  const financeReviewer = isInterdeptFinanceReviewer(user);

  const { memos, financialSummary, loading } = useMemos({ status: 'pending_finance' });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: financeReviewer ? 'Awaiting my review' : 'Pending finance',
      value: all.filter((m) => m.memo_statuses?.slug === 'pending_finance').length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
      href: '/memos?status=pending_finance',
    },
    {
      label: 'In finance queue',
      value: all.length,
      variant: 'info' as const,
      icon: <FileStack size={16} />,
    },
    {
      label: 'Reviewed by me',
      value: approvedByMe.length,
      variant: 'success' as const,
      icon: <CheckCircle2 size={16} />,
      href: '/memos?status=approved',
    },
  ];

  return (
    <DashboardPage
      title={financeReviewer ? 'Finance Review — Christine' : 'Finance Dashboard'}
      banner={
        financeReviewer
          ? 'You review the finance step on all memo types (including Finance Request), then memos go to the CEO for final approval.'
          : undefined
      }
      stats={stats}
      loading={loading || loadingApproved}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      financialSummary={financialSummary}
      financialSummaryTitle="Total financial implication (finance queue)"
      memosTitle="Memos awaiting finance review"
      emptyMessage="No memos pending finance review"
    />
  );
}
