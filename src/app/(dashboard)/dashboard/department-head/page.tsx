'use client';

import { Clock, FileStack, CheckCircle2, RotateCcw } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';

export default function DepartmentHeadDashboard() {
  const { memos, financialSummary, loading } = useMemos();
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: 'Pending my approval',
      value: all.filter((m) => m.memo_statuses?.slug === 'pending_department_head').length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
    },
    {
      label: 'Department memos',
      value: all.length,
      variant: 'default' as const,
      icon: <FileStack size={16} />,
    },
    {
      label: 'Approved by me',
      value: approvedByMe.length,
      variant: 'success' as const,
      icon: <CheckCircle2 size={16} />,
      href: '/memos?status=approved',
    },
    {
      label: 'Returned by me',
      value: all.filter((m) => m.memo_statuses?.slug === 'returned').length,
      variant: 'warning' as const,
      icon: <RotateCcw size={16} />,
    },
  ];

  return (
    <>
      <DashboardPage
        title="Department Head Dashboard"
        stats={stats}
        loading={loading || loadingApproved}
        memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
        financialSummary={financialSummary}
        financialSummaryTitle="Department financial total"
        memosTitle="Department memos"
      />
    </>
  );
}
