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

  const { memos: pendingFinance, loading } = useMemos({ status: 'pending_finance' });
  const { memos: myMemos, loading: loadingMine } = useMemos({ view: 'mine' });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const { memos: awaitingPayment, loading: loadingUnpaid } = useMemos({
    status: 'approved',
    payment_status: 'not_paid',
  });
  const { memos: paidMemos, loading: loadingPaid } = useMemos({
    status: 'approved',
    payment_status: 'paid',
  });
  const all = pendingFinance as Array<{ memo_statuses?: { slug: string } }>;

  const stats = financeReviewer
    ? [
        {
          label: 'My memos',
          value: myMemos.length,
          variant: 'info' as const,
          icon: <FileStack size={16} />,
          href: '/memos?view=mine',
        },
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
          variant: 'warning' as const,
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
          label: 'Pending finance',
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
            href: '/memos?view=mine',
            label: 'All my memos',
            description: 'Every memo you created — drafts, in progress, approved, and rejected',
            icon: <FileStack size={20} />,
          },
          {
            href: '/memos?status=pending_finance',
            label: 'Pending my review',
            description: 'Inter-department memos waiting for finance sign-off',
            icon: <FileText size={20} />,
          },
          {
            href: '/memos?status=approved&payment_status=not_paid',
            label: 'Mark payments',
            description: 'Approved memos not yet paid',
            icon: <Banknote size={20} />,
          },
        ]
      : undefined;

  const dashboardMemos = financeReviewer ? myMemos : pendingFinance;

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
            ? 'Use My memos for everything you created. Pending Finance is only memos waiting for your review.'
            : undefined
      }
      stats={stats}
      quickLinks={quickLinks}
      quickLinksTitle={quickLinks ? 'Shortcuts' : undefined}
      loading={loading || loadingMine || loadingApproved || loadingUnpaid || loadingPaid}
      memos={dashboardMemos as Parameters<typeof DashboardPage>[0]['memos']}
      memosTitle={financeReviewer ? 'My memos' : 'Memos awaiting finance review'}
      emptyMessage={
        financeReviewer
          ? 'No memos yet — create one from the sidebar'
          : 'No memos pending finance review'
      }
    />
  );
}
