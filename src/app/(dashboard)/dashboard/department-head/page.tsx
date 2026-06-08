'use client';

import Link from 'next/link';
import { Clock, FileStack, CheckCircle2, RotateCcw, PenLine } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import { useAuth } from '@/context/AuthContext';
import { hasUploadedSignature } from '@/lib/auth/rbac';

export default function DepartmentHeadDashboard() {
  const { user } = useAuth();
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

  const needsSignature = user && !hasUploadedSignature(user);

  return (
    <>
      {needsSignature ? (
        <div className="card p-4 mb-6 border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-3">
            <PenLine className="text-amber-700 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-amber-900">Upload your signature to create memos</p>
              <p className="text-sm text-amber-800/90 mt-0.5">
                Department heads need a signature on file before creating or approving memos.
              </p>
            </div>
          </div>
          <Link href="/settings/signature" className="btn-primary text-sm inline-flex items-center gap-2 shrink-0">
            <PenLine size={16} />
            Upload signature
          </Link>
        </div>
      ) : null}
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
