'use client';

import Link from 'next/link';
import { Clock, CheckCircle2, BarChart3, ArrowRight } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { useMemos } from '@/hooks/useMemos';
import { useFarmAccess } from '@/hooks/useFarmAccess';

export default function CEODashboard() {
  const { memos, loading, paymentTrackingEnabled } = useMemos({ status: 'pending_ceo' });
  const { memos: approvedByMe, loading: loadingApproved } = useMemos({ status: 'approved' });
  const access = useFarmAccess();
  const all = memos as Array<{ memo_statuses?: { slug: string } }>;
  const showFarmExec =
    access.can('farm.view') ||
    access.can('profitability.view') ||
    access.can('reports.view') ||
    access.can('dashboard.view');

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
    <div className="space-y-6">
      {showFarmExec ? (
        <section className="card overflow-hidden border border-brand-200/70 bg-gradient-to-br from-brand-50 via-white to-accent-300/20 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-600 text-white">
                <BarChart3 size={18} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-brand-900">Farm executive view</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Yield per hectare, cost per kilogram, labour and input costs by crop and block,
                  exportable vs rejected quality, payroll against budget, stock ageing, upcoming
                  harvests, and revenue by buyer and shipment.
                </p>
              </div>
            </div>
            <Link
              href="/farm/executive"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Open executive overview <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      ) : null}

      <DashboardPage
        title="CEO Dashboard"
        stats={stats}
        loading={loading || loadingApproved}
        memos={memos as Parameters<typeof DashboardPage>[0]['memos']}
        paymentTrackingEnabled={paymentTrackingEnabled}
        memosTitle="Pending final approval"
        emptyMessage="No memos pending CEO approval"
      />
    </div>
  );
}
