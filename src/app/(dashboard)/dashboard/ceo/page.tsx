'use client';

import { Clock, CheckCircle2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';

export default function CEODashboard() {
  const { memos, loading } = useMemos({ status: 'pending_ceo' });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: 'Pending CEO approval',
      value: all.filter((m) => m.memo_statuses?.slug === 'pending_ceo').length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
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
      title="CEO Dashboard"
      stats={stats}
      loading={loading || loadingApproved}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      memosTitle="Pending final approval"
      emptyMessage="No memos pending CEO approval"
    />
  );
}
