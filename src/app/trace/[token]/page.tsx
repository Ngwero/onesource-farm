'use client';

import { use, useEffect, useState } from 'react';
import { Package, Sprout, Truck, Wheat } from 'lucide-react';
import { OneSourceLogo } from '@/components/brand/OneSourceLogo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtDate, fmtNumber } from '@/lib/farm/format';
import type { PublicTrace } from '@/lib/farm/publicTrace';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}

export default function PublicTracePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [trace, setTrace] = useState<PublicTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/public/trace/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Trace not found');
        if (!cancelled) setTrace(data.trace as PublicTrace);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Trace not found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <OneSourceLogo width={140} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Public batch trace</p>
            <p className="text-sm text-slate-500">Read-only provenance — no commercial or personal data</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading trace…</p>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Sprout className="mx-auto size-10 text-slate-400" />
              <p className="mt-3 font-medium text-slate-800">Trace unavailable</p>
              <p className="mt-1 text-sm text-slate-500">{error}</p>
            </CardContent>
          </Card>
        ) : trace ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{trace.farmName}</CardTitle>
                {trace.tokenLabel ? <p className="text-sm text-muted-foreground">{trace.tokenLabel}</p> : null}
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact label="Crop" value={[trace.crop, trace.variety].filter(Boolean).join(' · ') || null} />
                  <Fact label="Harvest date" value={fmtDate(trace.harvestDate)} />
                  <Fact
                    label="Harvest batch"
                    value={trace.harvestBatchNo ? <span className="font-mono">{trace.harvestBatchNo}</span> : null}
                  />
                  <Fact label="Block" value={trace.blockCode} />
                  <Fact label="QC result" value={trace.qcResult} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="size-4 text-brand-700" /> Packing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trace.packing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No packing recorded yet.</p>
                ) : (
                  trace.packing.map((p) => (
                    <div key={p.packingNo} className="rounded-lg border bg-white px-3 py-2.5">
                      <p className="font-mono text-sm font-semibold">{p.packingNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(p.packingDate)}
                        {p.grade ? ` · ${p.grade}` : ''}
                        {` · ${p.packageCount} pkgs`}
                        {p.netWeight != null ? ` · ${fmtNumber(p.netWeight)} kg` : ''}
                        {` · QC ${p.qcStatus}`}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {(trace.dispatch.length > 0 || trace.shipment.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Truck className="size-4 text-brand-700" /> Dispatch & shipment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trace.dispatch.map((d, i) => (
                    <div key={`${d.reference}-${i}`} className="text-sm">
                      <Wheat className="mr-1 inline size-3.5 text-brand-700" />
                      {d.reference ?? 'Dispatch'} · {d.packages} pkgs · {fmtDate(d.movedAt)}
                    </div>
                  ))}
                  {trace.shipment.map((s) => (
                    <div key={s.shipmentNo} className="rounded-lg border bg-white px-3 py-2.5 text-sm">
                      <p className="font-mono font-semibold">{s.shipmentNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.status}
                        {s.destination ? ` · ${s.destination}` : ''}
                        {s.etd ? ` · ETD ${fmtDate(s.etd)}` : ''}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
