import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type KpiCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
};

export function KpiCard({ label, value, hint, icon, loading, className }: KpiCardProps) {
  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="stat-card-label">{label}</p>
          {loading ? (
            <Skeleton className="mt-2.5 h-7 w-20" />
          ) : (
            <p className="stat-card-value">{value}</p>
          )}
          {hint ? (
            loading ? (
              <Skeleton className="mt-2 h-3 w-28" />
            ) : (
              <p className="stat-card-hint">{hint}</p>
            )
          ) : null}
        </div>
        {icon ? <span className="stat-card-icon shrink-0">{icon}</span> : null}
      </div>
    </div>
  );
}
