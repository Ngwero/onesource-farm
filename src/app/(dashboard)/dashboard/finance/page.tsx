'use client';

import { Clock, FileStack, CheckCircle2, FileText, Banknote } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import { isDesignatedCfo } from '@/lib/memo/designatedUsers';
import { isInterdeptFinanceReviewer } from '@/lib/memo/financeMemoRouting';

export default function FinanceDashboard() {
  const { user } = useAuth();
  const financeReviewer = isInterdeptFinanceReviewer(user);
  const cfoFinanceChecker = isDesignatedCfo(user);

  const { memos, loading } = useMemos({ status: 'pending_finance' });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const { memos: awaitingPayment, loading: loadingUnpaid } = useMemos({
    status: 'approved',
    payment_status: 'not_paid',
  });
  const { memos: paidMemos, loading: loadingPaid } = useMemos({
    status: 'approved',
    payment_status: 'paid',
  });
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;

  const stats = financeReviewer
    ? [
        {
          label: 'Awaiting my review',
          value: all.filter((m) => m.memo_statuses?.slug === 'pending_finance').length,
          variant: 'pending' as const,
          icon: <Clock size={16} />,
          href: '/memos?status=pending_finance',
        },
        {
          label: 'Awaiting payment',
          value: awaitingPayment.length,
          variant: 'info' as const,
          icon: <Banknote size={16} />,
          href: '/memos?status=approved&payment_status=not_paid',
        },
        {
          label: 'Paid',
          value: paidMemos.length,
          variant: 'success' as const,
          icon: <CheckCircle2 size={16} />,
          href: '/memos?status=approved&payment_status=paid',
        },
      ]
    : [
        {
          label: cfoFinanceChecker ? 'Pending finance' : 'Pending finance',
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

  const quickLinks = cfoFinanceChecker
    ? [
        {
          href: '/memos?status=pending_finance&memo_type=finance_request',
          label: 'Christine — Finance memos',
          description: 'Finance Request memos awaiting your review',
          icon: <FileText size={20} />,
        },
      ]
    : financeReviewer
      ? [
          {
            href: '/memos?status=approved&payment_status=not_paid',
            label: 'Mark payments',
            description: 'Approved memos not yet paid — update status when payment is done',
            icon: <Banknote size={20} />,
          },
        ]
      : undefined;

  return (
    <DashboardPage
      title={
        cfoFinanceChecker
          ? 'Finance Review — Amara (CFO)'
          : financeReviewer
            ? 'Finance Review — Christine'
            : 'Finance Dashboard'
      }
      banner={
        cfoFinanceChecker
          ? 'You review Finance Request memos from Christine, then they go to the CEO for final approval.'
          : financeReviewer
            ? 'Review the finance step on inter-department memos, then mark approved memos as paid once payment is processed.'
            : undefined
      }
      stats={stats}
      quickLinks={quickLinks}
      quickLinksTitle={quickLinks ? 'Your queue' : undefined}
      loading={loading || loadingApproved || loadingUnpaid || loadingPaid}
      memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
      memosTitle="Memos awaiting finance review"
      emptyMessage="No memos pending finance review"
    />
  );
}
