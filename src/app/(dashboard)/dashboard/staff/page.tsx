'use client';

import {
  FileEdit,
  Send,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Archive,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';

export default function StaffDashboard() {
  const { memos, loading, paymentTrackingEnabled } = useMemos({ view: 'mine' });
  const { memos: approvedMemos, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: 'My Drafts',
      value: all.filter((m) => m.memo_statuses?.slug === 'draft').length,
      variant: 'muted' as const,
      icon: <FileEdit size={16} />,
      href: '/memos?status=draft',
    },
    {
      label: 'In progress',
      value: all.filter((m) => !['draft', 'approved', 'rejected', 'withdrawn'].includes(m.memo_statuses?.slug || '')).length,
      variant: 'info' as const,
      icon: <Send size={16} />,
      href: '/memos?view=active',
    },
    {
      label: 'Returned',
      value: all.filter((m) => m.memo_statuses?.slug === 'returned').length,
      variant: 'warning' as const,
      icon: <RotateCcw size={16} />,
      href: '/memos?status=returned',
    },
    {
      label: 'Approved',
      value: approvedMemos.length,
      variant: 'success' as const,
      icon: <CheckCircle2 size={16} />,
      href: '/memos?status=approved',
    },
    {
      label: 'Rejected',
      value: all.filter((m) => m.memo_statuses?.slug === 'rejected').length,
      variant: 'danger' as const,
      icon: <XCircle size={16} />,
      href: '/memos?status=rejected',
    },
    {
      label: 'Withdrawn',
      value: all.filter((m) => m.memo_statuses?.slug === 'withdrawn').length,
      variant: 'muted' as const,
      icon: <Archive size={16} />,
      href: '/memos?status=withdrawn',
    },
  ];

  return (
    <DashboardPage
      title="Staff Dashboard"
      stats={stats}
      loading={loading || loadingApproved}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      paymentTrackingEnabled={paymentTrackingEnabled}
      memosTitle="My memos"
    />
  );
}
