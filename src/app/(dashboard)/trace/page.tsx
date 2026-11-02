'use client';

import { Suspense, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bug,
  ClipboardCheck,
  Layers,
  MapPin,
  Package,
  Search,
  Sprout,
  Tractor,
  Truck,
  Wheat,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorState } from '@/components/farm/DataStates';
import { InspectionTable, MovementTable } from '@/components/farm/Packhouse';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { QcStatusChip, StatusChip } from '@/components/farm/StatusChip';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtHa, fmtMoney, fmtNumber, fmtQty } from '@/lib/farm/format';
import type { TraceMatch } from '@/lib/farm/packhouse';
import type { TraceResult } from '@/lib/farm/types';

type TraceResponse = { trace: TraceResult | null; matches?: TraceMatch[] };

function Stage({ icon, title, meta, children }: { icon: ReactNode; title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <li className="relative pl-12">
      <span className="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700">
        {icon}
      </span>
      <div className="flex flex-wrap items-center gap-2 pt-1.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
        {meta}
      </div>
      <div className="mt-3">{children}</div>
    </li>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function ChainSummary({ t }: { t: TraceResult }) {
  const received = t.packing.filter((p) => p.received_date).length;
  const dispatched = t.packing.reduce((s, p) => s + p.stock.dispatched, 0);
  const steps = [
    { label: 'Block', value: t.harvest.block?.code ?? '—' },
    { label: 'Planting', value: t.cycle ? fmtDate(t.cycle.planting_date) : '—' },
    { label: 'Harvest', value: fmtDate(t.harvest.harvest_date) },
    { label: 'Grading', value: t.harvest.grading ? fmtDate(t.harvest.grading.graded_date) : 'Pending' },
    { label: 'QC', value: plural(t.inspections.length + t.packing.reduce((s, p) => s + p.inspections.length, 0), 'inspection') },
    { label: 'Packed', value: plural(t.packing.length, 'batch', 'batches') },
    { label: 'Warehouse', value: `${received} received` },
    { label: 'Dispatched', value: `${dispatched} pkgs` },
  ];
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-sm font-medium">{s.value}</p>
          </div>
          {i < steps.length - 1 ? <span className="text-muted-foreground">→</span> : null}
        </div>
      ))}
    </div>
  );
}

function TraceView({ t }: { t: TraceResult }) {
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const h = t.harvest;
  const focusPacking = t.focus.type === 'packing_batch' ? t.focus.id : null;
  const packing = [...t.packing].sort((a, b) => Number(b.id === focusPacking) - Number(a.id === focusPacking));
  const totalLabour = t.activities?.reduce((s, a) => s + (a.labourCost ?? 0), 0) ?? 0;
  const totalInputs = t.activities?.reduce((s, a) => s + (a.inputCost ?? 0), 0) ?? 0;
  const gradedTotal = Number(h.grading?.total_quantity ?? 0);

  return (
    <div className="space-y-6">
      <ChainSummary t={t} />

      <ol className="space-y-8 border-l border-dashed border-slate-200 pl-0 [&>li]:-ml-px">
        <Stage icon={<MapPin className="size-4" />} title="Origin">
          <Card>
            <CardContent className="pt-6">
              <Facts
                items={[
                  [
                    'Block',
                    h.block ? (
                      can('farm.view') ? (
                        <Link href={`/farm/blocks/${h.block.id}`} className="text-brand-700 hover:underline">
                          {h.block.code} · {h.block.name}
                        </Link>
                      ) : (
                        `${h.block.code} · ${h.block.name}`
                      )
                    ) : null,
                  ],
                  ['Crop / variety', `${h.crop?.name ?? ''}${t.cycle?.variety ? ` · ${t.cycle.variety.name}` : ''}`],
                  ['Planted', t.cycle ? `${fmtDate(t.cycle.planting_date)}${t.cycle.season_label ? ` · ${t.cycle.season_label}` : ''}` : null],
                  ['Planted area', t.cycle?.planted_area_ha != null ? fmtHa(t.cycle.planted_area_ha) : null],
                ]}
              />
            </CardContent>
          </Card>
        </Stage>

        <Stage
          icon={<Tractor className="size-4" />}
          title="Field work before harvest"
          meta={
            t.activities && t.costs ? (
              <span className="text-xs text-muted-foreground">
                Labour {fmtMoney(totalLabour, currency)} · Inputs {fmtMoney(totalInputs, currency)}
              </span>
            ) : null
          }
        >
          {t.activities === null ? (
            <p className="text-sm text-muted-foreground">You do not have access to farm activity records.</p>
          ) : t.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities recorded on this planting before the harvest.</p>
          ) : (
            <Card>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Date</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Inputs</TableHead>
                      <TableHead className="text-right">Workers</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      {t.costs ? <TableHead className="pr-6 text-right">Cost</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.activities.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="pl-6 whitespace-nowrap">{fmtDate(a.activity_date)}</TableCell>
                        <TableCell>
                          <Link href={`/farm/activities/${a.id}`} className="text-brand-700 hover:underline">
                            {a.type}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.inputs.join(', ') || '—'}</TableCell>
                        <TableCell className="text-right">{a.workers}</TableCell>
                        <TableCell className="text-right">{fmtNumber(a.hours)}</TableCell>
                        {t.costs ? (
                          <TableCell className="pr-6 text-right whitespace-nowrap">
                            {fmtMoney((a.labourCost ?? 0) + (a.inputCost ?? 0), currency)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {t.incidents && t.incidents.length > 0 ? (
            <div className="mt-3 space-y-2">
              {t.incidents.map((i) => (
                <Link
                  key={i.id}
                  href={`/farm/incidents/${i.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-white px-4 py-2.5 text-sm hover:bg-slate-50"
                >
                  <Bug className="size-4 text-amber-600" />
                  <span className="font-medium">{i.name}</span>
                  <span className="text-muted-foreground">
                    {i.incident_type} · {fmtDate(i.date_identified)}
                  </span>
                  <span className="ml-auto flex gap-2">
                    <StatusChip status={i.severity} />
                    <StatusChip status={i.status} />
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </Stage>

        <Stage
          icon={<Wheat className="size-4" />}
          title="Harvest"
          meta={t.focus.type === 'harvest_batch' ? <span className="rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">Searched</span> : null}
        >
          <Card className={t.focus.type === 'harvest_batch' ? 'ring-2 ring-brand-500' : undefined}>
            <CardContent className="space-y-4 pt-6">
              <Facts
                items={[
                  [
                    'Harvest batch',
                    can('harvest.view') ? (
                      <Link href={`/harvest/batches/${h.id}`} className="font-mono text-brand-700 hover:underline">
                        {h.batch_no}
                      </Link>
                    ) : (
                      <span className="font-mono">{h.batch_no}</span>
                    ),
                  ],
                  ['Harvested', fmtDate(h.harvest_date)],
                  ['Quantity', fmtQty(h.quantity, h.unit)],
                  ['Supervisor', h.supervisor?.full_name],
                ]}
              />
              {h.workers.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground">Pickers ({h.workers.length})</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {h.workers.map((w) => (
                      <span key={w.worker_id} className="rounded-full border bg-slate-50 px-2.5 py-0.5 text-xs">
                        {w.worker?.full_name ?? 'Worker'}
                        {w.quantity_picked != null ? ` · ${fmtQty(w.quantity_picked, h.unit)}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </Stage>

        <Stage icon={<Layers className="size-4" />} title="Grading">
          {h.grading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                  {h.grading.lines.map((l) => (
                    <div key={l.grade_id} className="rounded-lg border bg-white px-3 py-2">
                      <p className="text-xs text-muted-foreground">{l.grade?.name ?? 'Grade'}</p>
                      <p className="text-sm font-semibold">
                        {fmtQty(l.quantity, h.unit)}
                        <span className="ml-1 font-normal text-muted-foreground">
                          {gradedTotal > 0 ? `${fmtNumber((Number(l.quantity) / gradedTotal) * 100, 1)}%` : ''}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Graded {fmtDate(h.grading.graded_date)}
                  {h.grading.inspector ? ` by ${h.grading.inspector.full_name}` : ''}
                  {h.grading.rejections.length
                    ? ` · Rejections: ${h.grading.rejections.map((r) => r.reason?.name).filter(Boolean).join(', ')}`
                    : ''}
                </p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Not graded yet.</p>
          )}
        </Stage>

        <Stage icon={<ClipboardCheck className="size-4" />} title="Harvest QC" meta={<QcStatusChip status={h.qc_status} />}>
          <Card>
            <CardContent className="px-0">
              <InspectionTable inspections={t.inspections} emptyTitle="No inspections on the harvest batch" />
            </CardContent>
          </Card>
        </Stage>

        <Stage icon={<Package className="size-4" />} title="Packed batches" meta={<span className="text-xs text-muted-foreground">{t.packing.length} from this harvest</span>}>
          {packing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing packed from this harvest yet.</p>
          ) : (
            <div className="space-y-4">
              {packing.map((p) => {
                const focused = p.id === focusPacking;
                const dispatches = p.movements.filter((m) => m.movement_type === 'dispatch');
                return (
                  <Card key={p.id} className={focused ? 'ring-2 ring-brand-500' : undefined}>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/packhouse/packing/${p.id}`} className="font-mono text-sm font-semibold text-brand-700 hover:underline">
                          {p.packing_no}
                        </Link>
                        <QcStatusChip status={p.qc_status} />
                        {focused ? <span className="rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">Searched</span> : null}
                      </div>
                      <Facts
                        items={[
                          ['Grade', p.grade?.name],
                          ['Packed', `${fmtDate(p.packing_date)} · ${p.package_count} × ${p.packaging?.name ?? ''}`],
                          ['Net / gross', `${fmtNumber(p.net_weight)} / ${fmtNumber(p.gross_weight)} kg`],
                          [
                            'Warehouse',
                            p.received_date
                              ? `${p.location?.name ?? '—'} · ${p.stock.available + p.stock.reserved} on hand`
                              : 'Not received',
                          ],
                        ]}
                      />
                      {p.inspections.length > 0 ? (
                        <div className="-mx-6 border-t">
                          <InspectionTable inspections={p.inspections} />
                        </div>
                      ) : null}
                      {p.movements.length > 0 ? (
                        <div className="-mx-6 border-t">
                          <MovementTable movements={p.movements} />
                        </div>
                      ) : null}
                      {dispatches.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Truck className="size-4 text-brand-700" />
                          <span className="text-muted-foreground">Dispatched under</span>
                          {dispatches.map((d) => (
                            <span key={d.id} className="rounded border bg-slate-50 px-2 py-0.5 font-mono text-xs">
                              {d.reference} · {d.packages} pkgs
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </Stage>
      </ol>
    </div>
  );
}

function TracePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const harvestId = searchParams.get('harvest_batch_id');
  const packingId = searchParams.get('packing_batch_id');
  const q = searchParams.get('q');
  const [term, setTerm] = useState(q ?? '');

  const params = harvestId
    ? `harvest_batch_id=${encodeURIComponent(harvestId)}`
    : packingId
      ? `packing_batch_id=${encodeURIComponent(packingId)}`
      : q
        ? `q=${encodeURIComponent(q)}`
        : '';

  const trace = useQuery({
    queryKey: [...farmKeys.trace, params],
    queryFn: () => farmFetch<TraceResponse>(`/api/farm/trace?${params}`),
    enabled: Boolean(params),
  });

  const go = (match: TraceMatch) =>
    router.push(`/trace?${match.type === 'packing_batch' ? 'packing_batch_id' : 'harvest_batch_id'}=${match.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Traceability"
        subtitle="Follow any harvest or packed batch back to its block, field work and pickers, and forward through grading, QC, packing, the warehouse and dispatch."
      />

      <form
        className="flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = term.trim();
          if (value) router.push(`/trace?q=${encodeURIComponent(value)}`);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 font-mono"
            placeholder="PK-CHILLI-A-20261002-001 or CHILLI-BLK-A1-…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Batch number"
          />
        </div>
        <Button type="submit" disabled={!term.trim()}>
          Trace
        </Button>
      </form>

      {!params ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Sprout className="size-10 text-brand-600" />
            <p className="mt-3 font-medium">Search for a batch to see its full chain</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Enter a harvest batch or packed batch number. You can also open the trace from any batch page.
            </p>
          </CardContent>
        </Card>
      ) : trace.error ? (
        <ErrorState message={errorMessage(trace.error)} onRetry={() => trace.refetch()} />
      ) : trace.isLoading ? (
        <div className="dashboard-loading">Tracing…</div>
      ) : trace.data?.trace ? (
        <TraceView t={trace.data.trace} />
      ) : (
        <Card>
          <CardContent className="py-6">
            {trace.data?.matches?.length ? (
              <>
                <p className="mb-3 text-sm font-medium">No exact match for “{q}”. Did you mean:</p>
                <div className="space-y-2">
                  {trace.data.matches.map((m) => (
                    <button
                      key={`${m.type}:${m.id}`}
                      type="button"
                      onClick={() => go(m)}
                      className="flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                    >
                      {m.type === 'packing_batch' ? <Package className="size-4 text-brand-700" /> : <Wheat className="size-4 text-brand-700" />}
                      <span className="font-mono font-medium">{m.code}</span>
                      <span className="text-muted-foreground">
                        {m.crop ?? ''} · {fmtDate(m.date)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No harvest or packed batch matches “{q}”.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="traceability.view">
      <Suspense>
        <TracePage />
      </Suspense>
    </RequirePermission>
  );
}
