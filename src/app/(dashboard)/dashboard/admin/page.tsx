'use client';

import {
  Users,
  Building2,
  Settings,
  BarChart3,
  Trash2,
  FileStack,
  Clock,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import { useAuth } from '@/context/AuthContext';
import { isDesignatedItFirstChecker } from '@/lib/workflow/itCheckers';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { memos, financialSummary, loading } = useMemos();
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = [
    {
      label: 'All memos',
      value: all.length,
      variant: 'default' as const,
      icon: <FileStack size={16} />,
    },
    {
      label: 'Pending',
      value: all.filter((m) => m.memo_statuses?.slug?.startsWith('pending')).length,
      variant: 'pending' as const,
      icon: <Clock size={16} />,
    },
    {
      label: 'Approved',
      value: all.filter((m) => m.memo_statuses?.slug === 'approved').length,
      variant: 'success' as const,
      icon: <CheckCircle2 size={16} />,
    },
    {
      label: 'In trash',
      value: all.filter((m) => m.memo_statuses?.slug === 'deleted').length,
      variant: 'danger' as const,
      icon: <Trash2 size={16} />,
    },
  ];

  const quickLinks = [
    ...(user && isDesignatedItFirstChecker(user)
      ? [
          {
            href: '/memos?status=pending_it_checker_first&memo_type=it_request',
            label: 'IT — my check queue',
            description: '1st IT checker (Emmanuel)',
            icon: <FileText size={20} />,
          },
        ]
      : []),
    { href: '/admin/users', label: 'Users', description: 'Roles & access', icon: <Users size={20} /> },
    { href: '/admin/departments', label: 'Departments', icon: <Building2 size={20} /> },
    { href: '/admin/branding', label: 'Branding', icon: <Settings size={20} /> },
    { href: '/admin/audit', label: 'Audit log', icon: <BarChart3 size={20} /> },
    { href: '/admin/trash', label: 'Trash', icon: <Trash2 size={20} /> },
  ];

  return (
    <DashboardPage
      title="Admin Dashboard"
      stats={stats}
      quickLinks={quickLinks}
      quickLinksTitle="System administration"
      loading={loading}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      financialSummary={financialSummary}
      financialSummaryTitle="Total financial implication (all memos)"
      memosTitle="All memos"
    />
  );
}
