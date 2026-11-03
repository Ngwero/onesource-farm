'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, HardHat, LayoutGrid, Loader2, Search, Wheat } from 'lucide-react';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate } from '@/lib/farm/format';

type FarmSearchResult = {
  q: string;
  blocks: { id: string; code: string; name: string; status: string; href: string }[];
  workers: { id: string; code: string; name: string; status: string; href: string }[];
  harvestBatches: { id: string; code: string; date: string; crop: string | null; href: string }[];
};

type Tab = 'memos' | 'farm';

/**
 * Top-bar search: memos (navigate to /memos?q=) and farm entities via /api/farm/search.
 */
export function MemoGlobalSearch() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const [value, setValue] = useState('');
  const [tab, setTab] = useState<Tab>('memos');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [farmResults, setFarmResults] = useState<FarmSearchResult | null>(null);
  const [farmError, setFarmError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const canFarm =
    can('farm.view') || can('workforce.view') || can('harvest.view') || can('traceability.view');

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (tab !== 'farm' || value.trim().length < 2) {
      setFarmResults(null);
      setFarmError(null);
      return;
    }
    const q = value.trim();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFarmError(null);
      farmFetch<FarmSearchResult>(`/api/farm/search?q=${encodeURIComponent(q)}`)
        .then((data) => setFarmResults(data))
        .catch((err) => {
          setFarmResults(null);
          setFarmError(errorMessage(err));
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, value]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length < 2) return;
    if (tab === 'memos') {
      setOpen(false);
      router.push(`/memos?q=${encodeURIComponent(q)}`);
      return;
    }
    setOpen(true);
  }

  const farmEmpty =
    farmResults &&
    farmResults.blocks.length === 0 &&
    farmResults.workers.length === 0 &&
    farmResults.harvestBatches.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <form onSubmit={onSubmit} className="memo-search memo-search--compact" data-tour-id="tour-search">
        <Search className="memo-search__icon" size={17} aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={tab === 'memos' ? 'Search memos…' : 'Search farm…'}
          className="memo-search__input"
          aria-label={tab === 'memos' ? 'Search memos' : 'Search farm'}
        />
      </form>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border bg-white shadow-lg">
          <div className="flex border-b text-xs font-medium">
            <button
              type="button"
              className={`flex-1 px-3 py-2 ${tab === 'memos' ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setTab('memos')}
            >
              Memos
            </button>
            {canFarm ? (
              <button
                type="button"
                className={`flex-1 px-3 py-2 ${tab === 'farm' ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setTab('farm')}
              >
                Farm
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {tab === 'memos' ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  const q = value.trim();
                  if (q.length < 2) return;
                  setOpen(false);
                  router.push(`/memos?q=${encodeURIComponent(q)}`);
                }}
              >
                <FileText className="size-4 text-brand-700" />
                {value.trim().length >= 2 ? (
                  <span>
                    Search memos for <strong>{value.trim()}</strong>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Type at least 2 characters</span>
                )}
              </button>
            ) : loading ? (
              <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </p>
            ) : farmError ? (
              <p className="px-2 py-3 text-sm text-red-600">{farmError}</p>
            ) : value.trim().length < 2 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Type at least 2 characters</p>
            ) : farmEmpty ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No farm matches</p>
            ) : (
              <div className="space-y-3">
                {farmResults?.blocks.length ? (
                  <section>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Blocks</p>
                    {farmResults.blocks.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setOpen(false);
                          router.push(b.href);
                        }}
                      >
                        <LayoutGrid className="size-4 text-brand-700" />
                        <span className="font-mono text-xs">{b.code}</span>
                        <span className="truncate">{b.name}</span>
                      </button>
                    ))}
                  </section>
                ) : null}
                {farmResults?.workers.length ? (
                  <section>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Workers</p>
                    {farmResults.workers.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setOpen(false);
                          router.push(w.href);
                        }}
                      >
                        <HardHat className="size-4 text-brand-700" />
                        <span className="font-mono text-xs">{w.code}</span>
                        <span className="truncate">{w.name}</span>
                      </button>
                    ))}
                  </section>
                ) : null}
                {farmResults?.harvestBatches.length ? (
                  <section>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Harvests</p>
                    {farmResults.harvestBatches.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setOpen(false);
                          router.push(h.href);
                        }}
                      >
                        <Wheat className="size-4 text-brand-700" />
                        <span className="font-mono text-xs">{h.code}</span>
                        <span className="truncate text-muted-foreground">
                          {h.crop ?? ''} · {fmtDate(h.date)}
                        </span>
                      </button>
                    ))}
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
