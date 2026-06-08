'use client';

import { Clock, CheckCircle2, GitBranch, FileText } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import { useAuth } from '@/context/AuthContext';
import { isDesignatedCfo } from '@/lib/memo/designatedUsers';

export default function EXCODashboard() {
  const { user } = useAuth();
  const { memos, loading } = useMemos({ status: 'pending_exco' });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: 'Pending EXCO',
      value: all.filter((m) => m.memo_statuses?.slug === 'pending_exco').length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
    },
    {
      label: 'I approved',
      value: approvedByMe.length,
      variant: 'success' as const,
      icon: <CheckCircle2 size={16} />,
      href: '/memos?status=approved',
    },
    {
      label: 'Parallel reviews',
      value: all.length,
      variant: 'info' as const,
      icon: <GitBranch size={16} />,
    },
  ];

  const quickLinks =
    user && isDesignatedCfo(user)
      ? [
          {
            href: '/memos?status=pending_finance&memo_type=finance_request',
            label: 'Christine — Finance memos',
            description: 'Finance Request memos awaiting CFO review',
            icon: <FileText size={20} />,
          },
        ]
      : undefined;

  return (
    <DashboardPage
      title="EXCO Dashboard"
      banner="EXCO approvals run in parallel. All four members (CEO, CBDO, CTO, CFO) must approve."
      stats={stats}
      quickLinks={quickLinks}
      quickLinksTitle={quickLinks ? 'CFO review' : undefined}
      loading={loading || loadingApproved}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      memosTitle="Pending EXCO memos"
      emptyMessage="No memos pending EXCO approval"
    />
  );
}
