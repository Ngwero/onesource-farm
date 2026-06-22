'use client';

import { Clock, FileStack, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';

export default function DepartmentHeadDashboard() {
  const { user } = useAuth();
  const isBusinessHead = user?.role?.slug === 'business_head';

  const { memos, loading, paymentTrackingEnabled } = useMemos(
    isBusinessHead ? { memo_type: 'marketing_request' } : undefined
  );
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const pendingSlug = isBusinessHead ? 'pending_business_head' : 'pending_department_head';

  const stats = [
    {
      label: isBusinessHead ? 'Pending my sign-off' : 'Pending my approval',
      value: all.filter((m) => m.memo_statuses?.slug === pendingSlug).length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
      href: isBusinessHead
        ? '/memos?status=pending_business_head&memo_type=marketing_request'
        : '/memos?status=pending_department_head',
    },
    {
      label: isBusinessHead ? 'Marketing memos' : 'Department memos',
      value: all.length,
      variant: 'default' as const,
      icon: <FileStack size={16} />,
      href: isBusinessHead ? '/memos?memo_type=marketing_request' : '/memos',
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
    <DashboardPage
      title={isBusinessHead ? 'Business Head Dashboard' : 'Department Head Dashboard'}
      stats={stats}
      loading={loading || loadingApproved}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      paymentTrackingEnabled={paymentTrackingEnabled}
      memosTitle={isBusinessHead ? 'Marketing memos' : 'Department memos'}
    />
  );
}
