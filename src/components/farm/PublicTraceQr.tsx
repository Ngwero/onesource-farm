'use client';

import { useState } from 'react';
import { Copy, Link2, Printer, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { farmFetch } from '@/lib/farm/client';

type Created = {
  token: { public_token: string; label: string | null };
  urlPath: string;
};

/**
 * Creates a public QR link for a harvest or packing batch.
 * No QR library: shows the URL, token, and a printable label.
 */
export function PublicTraceQrButton({
  subjectType,
  subjectId,
  label,
}: {
  subjectType: 'harvest_batch' | 'packing_batch';
  subjectId: string;
  label?: string;
}) {
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const body =
        subjectType === 'harvest_batch'
          ? { subject_type: subjectType, harvest_batch_id: subjectId, label }
          : { subject_type: subjectType, packing_batch_id: subjectId, label };
      const res = await farmFetch<Created>('/api/farm/trace/token', { method: 'POST', body });
      setCreated(res);
      toast.success('Public trace link created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create link');
    } finally {
      setBusy(false);
    }
  };

  const absoluteUrl = created
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${created.urlPath}`
    : '';

  return (
    <div className="space-y-3">
      {!created ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void create()}>
          <QrCode className="size-4" />
          {busy ? 'Creating…' : 'Create public QR link'}
        </Button>
      ) : (
        <Card className="border-brand-200 bg-brand-50/40 print:border print:bg-white">
          <CardContent className="space-y-3 pt-5" id="public-trace-label">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Public trace label</p>
                <p className="mt-1 font-mono text-sm font-semibold break-all">{created.token.public_token}</p>
                <a href={absoluteUrl} className="mt-1 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline break-all">
                  <Link2 className="size-3.5 shrink-0" />
                  {absoluteUrl}
                </a>
              </div>
              <div
                className="flex size-24 shrink-0 flex-col items-center justify-center rounded border-2 border-dashed border-brand-300 bg-white p-2 text-center"
                aria-hidden
              >
                <QrCode className="size-10 text-brand-700" />
                <span className="mt-1 text-[9px] font-mono leading-tight text-slate-600">
                  {created.token.public_token.slice(0, 8)}…
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(absoluteUrl);
                  toast.success('Link copied');
                }}
              >
                <Copy className="size-4" /> Copy URL
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> Print label
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
