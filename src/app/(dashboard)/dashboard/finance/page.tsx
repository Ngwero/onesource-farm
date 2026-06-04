'use client';

import { Clock, FileStack, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import {
  isInterdeptFinanceReviewer,
  isDesignatedFinanceApprover,
} from '@/lib/memo/financeMemoRouting';

export default function FinanceDashboard() {
  const { user } = useAuth();
  const interdeptReviewer = isInterdeptFinanceReviewer(user);
  const cfoQueue = isDesignatedFinanceApprover(user);

  const { memos, financialSummary, loading } = useMemos({ status: 'pending_finance' });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: interdeptReviewer ? 'Awaiting my review' : 'Pending finance',
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

  const title = interdeptReviewer
    ? 'Finance Review — Christine'
    : cfoQueue
      ? 'Finance Dashboard — Amara (CFO)'
      : 'Finance Dashboard';

  const banner = interdeptReviewer
    ? 'You review the finance step on IT, HR, marketing, payment, procurement, and general memos. Finance Request memos are routed to Amara (CFO).'
    : cfoQueue
      ? 'You review Finance Request memos. Other departments are reviewed by Christine at the finance step.'
      : undefined;

  return (
    <DashboardPage
      title={title}
      banner={banner}
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
