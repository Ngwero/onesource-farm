'use client';

import { Clock, FileStack, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import type { MemoStatusSlug, RoleSlug } from '@/types';

const PENDING_BY_ROLE: Partial<Record<RoleSlug, MemoStatusSlug>> = {
  it_checker_first: 'pending_it_checker_first',
  it_checker_second: 'pending_it_checker_second',
};

export default function ItCheckerDashboard() {
  const { user } = useAuth();
  const role = user?.role?.slug as RoleSlug | undefined;
  const pendingStatus = (role && PENDING_BY_ROLE[role]) || 'pending_it_checker_first';
  const isFirst = role === 'it_checker_first';

  const { memos, loading, paymentTrackingEnabled } = useMemos({ status: pendingStatus });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: isFirst ? 'Awaiting my check (1st)' : 'Awaiting my check (2nd)',
      value: all.filter((m) => m.memo_statuses?.slug === pendingStatus).length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
      href: `/memos?status=${pendingStatus}`,
    },
    {
      label: 'In my queue',
      value: all.length,
      variant: 'info' as const,
      icon: <FileStack size={16} />,
    },
    {
      label: 'Approved by me',
      value: approvedByMe.length,
      variant: 'success' as const,
      icon: <CheckCircle2 size={16} />,
      href: '/memos?status=approved',
    },
  ];

  return (
    <DashboardPage
      title={isFirst ? 'IT Check — Emmanuel (1st)' : 'IT Check — Jim (2nd)'}
      banner={
        isFirst
          ? 'You are the first IT checker. After you approve, memos go to Jim for the second check.'
          : 'You are the second IT checker. Memos reach you after Emmanuel’s first approval.'
      }
      stats={stats}
      loading={loading || loadingApproved}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      paymentTrackingEnabled={paymentTrackingEnabled}
      memosTitle="IT memos awaiting your check"
      emptyMessage="No IT memos pending your review"
    />
  );
}
