'use client';

import { Clock, Calendar, Users, FileStack } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';

export default function HRDashboard() {
  const { memos, loading } = useMemos();
  const all = memos as Array<{ memo_types?: { slug: string }; memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: 'Pending HR approval',
      value: all.filter((m) => m.memo_statuses?.slug === 'pending_hr').length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
    },
    {
      label: 'Leave requests',
      value: all.filter((m) => m.memo_types?.slug === 'leave_request').length,
      variant: 'info' as const,
      icon: <Calendar size={16} />,
    },
    {
      label: 'HR requests',
      value: all.filter((m) => m.memo_types?.slug === 'hr_request').length,
      variant: 'default' as const,
      icon: <Users size={16} />,
    },
    {
      label: 'All HR memos',
      value: all.filter((m) => ['hr_request', 'leave_request'].includes(m.memo_types?.slug || '')).length,
      variant: 'muted' as const,
      icon: <FileStack size={16} />,
    },
  ];

  return (
    <DashboardPage
      title="HR Dashboard"
      stats={stats}
      loading={loading}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      memosTitle="HR-related memos"
    />
  );
}
