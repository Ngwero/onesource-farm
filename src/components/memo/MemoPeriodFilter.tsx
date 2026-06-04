'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildYearOptions, MEMO_MONTH_OPTIONS } from '@/lib/memo/periodFilter';

export function MemoPeriodFilter({
  className = '',
  embedded = false,
}: {
  className?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYear = new Date().getFullYear();
  const year = searchParams.get('year') || '';
  const month = searchParams.get('month') || '';

  const updateParam = useCallback(
    (key: 'year' | 'month', value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key === 'year' && !value) {
        params.delete('month');
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function clearPeriod() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('year');
    params.delete('month');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const years = buildYearOptions(currentYear, 8);

  return (
    <div
      className={`memo-period-filter${embedded ? ' memo-period-filter--embedded' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="memo-period-filter__row">
        <label className="memo-period-filter__field">
          <span className={`memo-period-filter__label${embedded ? ' sr-only' : ''}`}>Year</span>
          <select
            value={year}
            onChange={(e) => updateParam('year', e.target.value)}
            className="memo-period-filter__select"
            aria-label="Filter by year"
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="memo-period-filter__field">
          <span className={`memo-period-filter__label${embedded ? ' sr-only' : ''}`}>Month</span>
          <select
            value={month}
            onChange={(e) => updateParam('month', e.target.value)}
            className="memo-period-filter__select"
            aria-label="Filter by month"
            disabled={!year}
          >
            <option value="">All months</option>
            {MEMO_MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {year ? (
          <button
            type="button"
            onClick={clearPeriod}
            className="memo-period-filter__clear"
            aria-label="Clear date filter"
            title="Clear date filter"
          >
            {embedded ? 'Clear' : 'Clear period'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
