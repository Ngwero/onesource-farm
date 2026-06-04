'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

type MemoSearchBarProps = {
  /** URL query param name (default: q) */
  param?: string;
  placeholder?: string;
  className?: string;
  /** Inside memo-filters-panel — no outer card chrome */
  embedded?: boolean;
};

export function MemoSearchBar({
  param = 'q',
  placeholder = 'Search by reference, subject, routing, or creator…',
  className = '',
  embedded = false,
}: MemoSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get(param) || '';

  const [value, setValue] = useState(urlQuery);

  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  const pushQuery = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();
      if (trimmed.length >= 2) {
        params.set(param, trimmed);
      } else {
        params.delete(param);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [param, pathname, router, searchParams]
  );

  useEffect(() => {
    if (value === urlQuery) return;
    const t = window.setTimeout(() => pushQuery(value), 350);
    return () => window.clearTimeout(t);
  }, [value, urlQuery, pushQuery]);

  function clear() {
    setValue('');
    pushQuery('');
  }

  return (
    <div
      className={`memo-search${embedded ? ' memo-search--embedded' : ''}${className ? ` ${className}` : ''}`}
    >
      <Search className="memo-search__icon" size={18} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="memo-search__input"
        aria-label="Search memos"
        autoComplete="off"
      />
      {value ? (
        <button type="button" onClick={clear} className="memo-search__clear" aria-label="Clear search">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
