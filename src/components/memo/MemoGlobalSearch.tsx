'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function MemoGlobalSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length < 2) return;
    router.push(`/memos?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} className="memo-search memo-search--compact">
      <Search className="memo-search__icon" size={17} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search memos…"
        className="memo-search__input"
        aria-label="Search memos"
      />
    </form>
  );
}
