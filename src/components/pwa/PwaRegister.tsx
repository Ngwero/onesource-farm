'use client';

import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { flushOutbox, listOutbox } from '@/lib/offline/outbox';

export function PwaRegister() {
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshPending = () => {
      listOutbox()
        .then((items) => setPending(items.length))
        .catch(() => setPending(0));
    };

    const onOnline = async () => {
      setOffline(false);
      const result = await flushOutbox();
      refreshPending();
      if (result.sent) toast.success(`Synced ${result.sent} offline record${result.sent === 1 ? '' : 's'}`);
      if (result.failed) toast.error(`${result.failed} offline record${result.failed === 1 ? '' : 's'} still pending`);
    };
    const onOffline = () => {
      setOffline(true);
      toast.message('You are offline — field entries will queue until you reconnect');
    };

    setOffline(!navigator.onLine);
    refreshPending();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => undefined);
        })
        .catch(() => undefined);

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'FLUSH_OUTBOX') onOnline();
      });
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline && pending === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-brand-200 bg-white/95 px-4 py-2.5 text-sm shadow-lg backdrop-blur">
        {offline ? (
          <CloudOff className="size-4 shrink-0 text-amber-600" />
        ) : (
          <Wifi className="size-4 shrink-0 text-brand-600" />
        )}
        <p className="min-w-0 flex-1 text-slate-700">
          {offline
            ? 'Offline mode — changes will sync when you are back online'
            : `${pending} queued record${pending === 1 ? '' : 's'} waiting to sync`}
        </p>
        {!offline && pending > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
            onClick={async () => {
              const result = await flushOutbox();
              setPending((await listOutbox()).length);
              if (result.sent) toast.success(`Synced ${result.sent}`);
            }}
          >
            <RefreshCw className="size-3.5" /> Sync
          </button>
        ) : null}
      </div>
    </div>
  );
}
