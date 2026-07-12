'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export type StatVariant = 'default' | 'pending' | 'success' | 'warning' | 'danger' | 'muted' | 'info';

export interface DashboardStat {
  label: string;
  value: number;
  variant?: StatVariant;
  icon?: ReactNode;
  href?: string;
}

const VARIANT_CLASS: Record<StatVariant, string> = {
  default: 'stat-card--default',
  pending: 'stat-card--pending',
  success: 'stat-card--success',
  warning: 'stat-card--warning',
  danger: 'stat-card--danger',
  muted: 'stat-card--muted',
  info: 'stat-card--info',
};

export function StatsCards({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
      {stats.map((stat) => {
        const className = `stat-card ${VARIANT_CLASS[stat.variant || 'default']}${stat.href ? ' stat-card--link' : ''}`;
        const inner = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 leading-tight">
                {stat.label}
              </p>
              {stat.icon ? (
                <span className="stat-card-icon shrink-0" aria-hidden>
                  {stat.icon}
                </span>
              ) : null}
            </div>
            <p className="stat-card-value">{stat.value}</p>
          </>
        );
        return stat.href ? (
          <Link key={stat.label} href={stat.href} className={className}>
            {inner}
          </Link>
        ) : (
          <div key={stat.label} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
