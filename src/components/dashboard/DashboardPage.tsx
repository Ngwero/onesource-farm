'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { FileText, Loader2, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canStartMemo } from '@/lib/auth/rbac';
import type { RoleSlug } from '@/types';
import { StatsCards, type DashboardStat } from './StatsCards';
import { DashboardQuickLinks, type QuickLink } from './DashboardQuickLinks';
import { MemoList } from '@/components/memo/MemoList';
import { FinancialSummary } from '@/components/memo/FinancialSummary';
import type { MemoFinancialSummary } from '@/lib/memo/financial';

interface DashboardPageProps {
  title: string;
  /** Optional note below title (e.g. EXCO parallel approval) */
  banner?: string;
  stats: DashboardStat[];
  quickLinks?: QuickLink[];
  quickLinksTitle?: string;
  memosTitle?: string;
  loading: boolean;
  memos: Parameters<typeof MemoList>[0]['memos'];
  financialSummary?: MemoFinancialSummary | null;
  financialSummaryTitle?: string;
  emptyMessage?: string;
  action?: {
    href: string;
    label: string;
    icon: ReactNode;
  };
}

export function DashboardPage({
  title,
  banner,
  stats,
  quickLinks,
  quickLinksTitle,
  memosTitle = 'Recent memos',
  loading,
  memos,
  financialSummary,
  financialSummaryTitle,
  emptyMessage,
  action,
}: DashboardPageProps) {
  const { user } = useAuth();
  const today = format(new Date(), 'EEEE, d MMMM yyyy');
  const roleName = user?.role?.name || 'Team member';
  const department = user?.department?.name;
  const roleSlug = (user?.role?.slug || (user as { roles?: { slug: string } })?.roles?.slug) as
    | RoleSlug
    | undefined;

  const pendingCount = stats.find((s) => s.label.toLowerCase().includes('pending'))?.value ?? 0;

  const primaryAction =
    action ??
    (canStartMemo(user)
      ? { href: '/memos/create', label: 'Create memo', icon: <PlusCircle size={18} /> }
      : undefined);

  return (
    <div className="space-y-0">
      <header className="dashboard-hero mb-8">
        <div className="dashboard-hero-inner">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="dashboard-badge">{roleName}</span>
                {department ? (
                  <span className="dashboard-badge dashboard-badge--muted">{department}</span>
                ) : null}
              </div>
              <h1 className="dashboard-hero-title">{title}</h1>
              <p className="dashboard-hero-greeting">
                Welcome back, <strong>{user?.full_name || 'Colleague'}</strong>
              </p>
              <p className="dashboard-hero-date">{today}</p>
              {banner ? <p className="dashboard-hero-banner">{banner}</p> : null}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              {pendingCount > 0 ? (
                <div className="dashboard-pending-pill">
                  <span className="dashboard-pending-dot" />
                  {pendingCount} awaiting action
                </div>
              ) : null}
              {primaryAction ? (
                <Link
                  href={primaryAction.href}
                  className="btn-primary inline-flex items-center justify-center gap-2"
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </Link>
              ) : null}
              <Link
                href="/memos"
                className={
                  primaryAction
                    ? 'btn-secondary-on-dark inline-flex items-center justify-center gap-2'
                    : 'btn-primary inline-flex items-center justify-center gap-2'
                }
              >
                <FileText size={18} />
                View all memos
              </Link>
            </div>
          </div>
        </div>
      </header>

      <StatsCards stats={stats} />

      {quickLinks?.length ? (
        <DashboardQuickLinks links={quickLinks} title={quickLinksTitle} />
      ) : null}

      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="dashboard-section-title">{memosTitle}</h2>
          {!loading && memos.length > 0 ? (
            <Link href="/memos" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              See all →
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="card dashboard-loading">
            <Loader2 className="animate-spin text-brand-600" size={28} />
            <p>Loading memos…</p>
          </div>
        ) : (
          <>
            {financialSummary ? (
              <FinancialSummary summary={financialSummary} title={financialSummaryTitle} />
            ) : null}
            <MemoList memos={memos} currentUserId={user?.id} emptyMessage={emptyMessage} />
          </>
        )}
      </section>
    </div>
  );
}
