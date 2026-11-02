import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type KpiCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function KpiCard({ label, value, hint, icon, className }: KpiCardProps) {
  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="stat-card-icon">{icon}</span> : null}
      </div>
      <p className="stat-card-value">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
