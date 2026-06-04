'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { MemoSearchBar } from '@/components/memo/MemoSearchBar';
import { MemoPeriodFilter } from '@/components/memo/MemoPeriodFilter';
import { formatPeriodLabel, parseMemoPeriodFilter } from '@/lib/memo/periodFilter';

export function MemoListFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q')?.trim() || '';
  const year = searchParams.get('year') || '';
  const month = searchParams.get('month') || '';
  const period = parseMemoPeriodFilter(year || null, month || null);

  const searchActive = q.length >= 2;
  const periodActive = Boolean(period);
  const hasFilters = searchActive || periodActive;

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const clearAll = useCallback(() => {
    replaceParams((params) => {
      params.delete('q');
      params.delete('year');
      params.delete('month');
    });
  }, [replaceParams]);

  const clearSearch = useCallback(() => {
    replaceParams((params) => params.delete('q'));
  }, [replaceParams]);

  const clearPeriod = useCallback(() => {
    replaceParams((params) => {
      params.delete('year');
      params.delete('month');
    });
  }, [replaceParams]);

  return (
    <section
      className={`memo-filters-panel${hasFilters ? ' memo-filters-panel--active' : ''}`}
      aria-label="Search and filter memos"
    >
      <div className="memo-filters-panel__accent" aria-hidden />

      <header className="memo-filters-panel__header">
        <div className="memo-filters-panel__intro">
          <span className="memo-filters-panel__icon-wrap" aria-hidden>
            <SlidersHorizontal size={18} />
          </span>
          <div>
            <h2 className="memo-filters-panel__title">Find & filter memos</h2>
            <p className="memo-filters-panel__subtitle">
              Search across references and content, or narrow by memo date (sorted newest first).
            </p>
          </div>
        </div>
        {hasFilters ? (
          <button type="button" onClick={clearAll} className="memo-filters-panel__reset">
            <RotateCcw size={15} aria-hidden />
            Clear all
          </button>
        ) : null}
      </header>

      <div className="memo-filters-panel__grid">
        <div
          className={`memo-filters-panel__block memo-filters-panel__block--search${searchActive ? ' memo-filters-panel__block--on' : ''}`}
        >
          <div className="memo-filters-panel__block-head">
            <Search size={16} aria-hidden />
            <span>Search</span>
            {searchActive ? <span className="memo-filters-panel__block-badge">On</span> : null}
          </div>
          <MemoSearchBar embedded placeholder="Reference, subject, routing, creator…" />
          <p className="memo-filters-panel__hint">Type at least 2 characters to filter the list.</p>
        </div>

        <div
          className={`memo-filters-panel__block memo-filters-panel__block--period${periodActive ? ' memo-filters-panel__block--on' : ''}`}
        >
          <div className="memo-filters-panel__block-head">
            <CalendarRange size={16} aria-hidden />
            <span>Memo date</span>
            {periodActive ? <span className="memo-filters-panel__block-badge">On</span> : null}
          </div>
          <MemoPeriodFilter embedded />
        </div>
      </div>

      {hasFilters ? (
        <footer className="memo-filters-panel__footer">
          <span className="memo-filters-panel__footer-label">Showing</span>
          <div className="memo-filters-panel__chips">
            {searchActive ? (
              <span className="memo-filter-chip memo-filter-chip--search">
                <Search size={13} aria-hidden className="memo-filter-chip__icon" />
                <span className="memo-filter-chip__text">{q}</span>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="memo-filter-chip__remove"
                  aria-label="Remove search filter"
                >
                  <X size={14} />
                </button>
              </span>
            ) : null}
            {periodActive && period ? (
              <span className="memo-filter-chip memo-filter-chip--period">
                <CalendarRange size={13} aria-hidden className="memo-filter-chip__icon" />
                <span className="memo-filter-chip__text">{formatPeriodLabel(period)}</span>
                <button
                  type="button"
                  onClick={clearPeriod}
                  className="memo-filter-chip__remove"
                  aria-label="Remove date filter"
                >
                  <X size={14} />
                </button>
              </span>
            ) : null}
          </div>
        </footer>
      ) : null}
    </section>
  );
}
