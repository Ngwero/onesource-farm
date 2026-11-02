import type { ReactNode } from 'react';

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value === 0 ? 0 : value || '—'}</dd>
    </div>
  );
}
