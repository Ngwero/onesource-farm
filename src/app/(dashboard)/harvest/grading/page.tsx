'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { GradingSheet } from '@/components/farm/forms/GradingSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtPct, fmtQty, todayIso } from '@/lib/farm/format';
import { gradingStats } from '@/lib/farm/grading';
import type { HarvestBatchDetail, HarvestBatchRow } from '@/lib/farm/types';

function GradeLauncher({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const detail = useQuery({
    queryKey: farmKeys.harvest(batchId),
    queryFn: () => farmFetch<{ batch: HarvestBatchDetail }>(`/api/farm/harvests/${batchId}`).then((r) => r.batch),
  });
  if (detail.error) {
    return <p className="text-sm text-destructive">{errorMessage(detail.error)}</p>;
  }
  if (!detail.data) return null;
  return <GradingSheet open onOpenChange={(open) => !open && onClose()} batch={detail.data} />;
}

function GradingPage() {
  const { can } = useFarmAccess();
  const canGrade = can('grading.record');
  const [gradingId, setGradingId] = useState<string | null>(null);
  const today = todayIso();
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const pending = useQuery({
    queryKey: [...farmKeys.harvests, 'status=pending_grading'],
    queryFn: () =>
      farmFetch<{ batches: HarvestBatchRow[] }>('/api/farm/harvests?status=pending_grading').then((r) =>
        [...r.batches].sort((a, b) => a.harvest_date.localeCompare(b.harvest_date))
      ),
  });
  const graded = useQuery({
    queryKey: [...farmKeys.harvests, `status=graded&from=${since}`],
    queryFn: () => farmFetch<{ batches: HarvestBatchRow[] }>(`/api/farm/harvests?status=graded&from=${since}`).then((r) => r.batches),
  });

  const byCrop = useMemo(() => {
    const map = new Map<string, { crop: string; unit: string; harvested: number; exportable: number; rejected: number; batches: number }>();
    for (const b of graded.data ?? []) {
      if (!b.grading) continue;
      const s = gradingStats(b.grading.lines, Number(b.quantity));
      const key = `${b.crop_id}|${b.unit}`;
      const row = map.get(key) ?? { crop: b.crop?.name ?? '—', unit: b.unit, harvested: 0, exportable: 0, rejected: 0, batches: 0 };
      row.harvested += Number(b.quantity);
      row.exportable += s.exportable;
      row.rejected += s.rejected;
      row.batches += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.harvested - a.harvested);
  }, [graded.data]);

  const totals = useMemo(() => {
    const h = byCrop.reduce((s, r) => s + r.harvested, 0);
    return {
      exportablePct: h > 0 ? (byCrop.reduce((s, r) => s + r.exportable, 0) / h) * 100 : null,
      rejectionPct: h > 0 ? (byCrop.reduce((s, r) => s + r.rejected, 0) / h) * 100 : null,
    };
  }, [byCrop]);
  const oldest = pending.data?.[0];

  return (
    <div className="space-y-5">
      <PageHeader title="Grading" subtitle="Batches waiting to be graded, and grade results for the last 30 days." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Awaiting grading" value={pending.data?.length ?? '—'} />
        <KpiCard
          label="Oldest waiting"
          value={oldest ? `${differenceInCalendarDays(parseISO(today), parseISO(oldest.harvest_date))} days` : '—'}
          hint={oldest?.batch_no}
        />
        <KpiCard label="Exportable" value={fmtPct(totals.exportablePct)} hint="Graded in the last 30 days" />
        <KpiCard label="Rejected" value={fmtPct(totals.rejectionPct)} hint="Graded in the last 30 days" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waiting for grading</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {pending.error ? (
            <ErrorState message={errorMessage(pending.error)} onRetry={() => pending.refetch()} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Batch</TableHead>
                  <TableHead>Harvested</TableHead>
                  <TableHead>Block / crop</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="pr-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.isLoading ? (
                  <LoadingRows columns={5} rows={3} />
                ) : !pending.data?.length ? (
                  <EmptyRow columns={5} title="Nothing waiting" description="New harvest batches appear here until they are graded." />
                ) : (
                  pending.data.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="pl-6">
                        <Link href={`/harvest/batches/${b.id}`} className="font-mono text-sm font-semibold text-brand-700 hover:underline">
                          {b.batch_no}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(b.harvest_date)}</TableCell>
                      <TableCell>
                        {b.block?.code}
                        <p className="text-xs text-muted-foreground">{b.crop?.name}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{fmtQty(b.quantity, b.unit)}</TableCell>
                      <TableCell className="pr-6 text-right">
                        {canGrade ? (
                          <Button size="sm" onClick={() => setGradingId(b.id)} disabled={gradingId === b.id}>
                            {gradingId === b.id ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                            Grade
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results by crop · last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Crop</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Graded</TableHead>
                  <TableHead className="text-right">Exportable</TableHead>
                  <TableHead className="pr-6 text-right">Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {graded.isLoading ? (
                  <LoadingRows columns={5} rows={2} />
                ) : byCrop.length === 0 ? (
                  <EmptyRow columns={5} title="No batches graded in the last 30 days" />
                ) : (
                  byCrop.map((r) => (
                    <TableRow key={`${r.crop}-${r.unit}`}>
                      <TableCell className="pl-6 font-medium">{r.crop}</TableCell>
                      <TableCell className="text-right">{r.batches}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtQty(r.harvested, r.unit)}</TableCell>
                      <TableCell className="text-right">{fmtPct(r.harvested ? (r.exportable / r.harvested) * 100 : null)}</TableCell>
                      <TableCell className="pr-6 text-right">{fmtPct(r.harvested ? (r.rejected / r.harvested) * 100 : null)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently graded</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Batch</TableHead>
                  <TableHead>Graded</TableHead>
                  <TableHead className="text-right">Exportable</TableHead>
                  <TableHead className="pr-6 text-right">Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {graded.error ? (
                  <EmptyRow columns={4} title={errorMessage(graded.error)} />
                ) : graded.isLoading ? (
                  <LoadingRows columns={4} rows={2} />
                ) : !graded.data?.length ? (
                  <EmptyRow columns={4} title="No batches graded in the last 30 days" />
                ) : (
                  graded.data.slice(0, 10).map((b) => {
                    const s = b.grading ? gradingStats(b.grading.lines, Number(b.quantity)) : null;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="pl-6">
                          <Link href={`/harvest/batches/${b.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                            {b.batch_no}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(b.grading?.graded_date)}</TableCell>
                        <TableCell className="text-right">{fmtPct(s?.exportablePct)}</TableCell>
                        <TableCell className="pr-6 text-right">{fmtPct(s?.rejectionPct)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {gradingId ? <GradeLauncher key={gradingId} batchId={gradingId} onClose={() => setGradingId(null)} /> : null}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="harvest.view">
      <GradingPage />
    </RequirePermission>
  );
}
