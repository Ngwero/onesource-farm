'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { HarvestBatchSheet } from '@/components/farm/forms/HarvestBatchSheet';
import { farmKeys, useBlocks, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtPct, fmtQty, todayIso } from '@/lib/farm/format';
import { gradingStats } from '@/lib/farm/grading';
import type { HarvestBatchRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 8;

function batchLabourCost(b: HarvestBatchRow): number {
  return Number(b.worker_labour_cost) + Number(b.other_labour_cost);
}

function HarvestBatchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const blocks = useBlocks();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(todayIso());
  const [blockId, setBlockId] = useState(searchParams.get('block_id') ?? ALL);
  const [status, setStatus] = useState(ALL);

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (blockId !== ALL) params.set('block_id', blockId);
  if (status !== ALL) params.set('status', status);
  const qs = params.toString();

  const batches = useQuery({
    queryKey: [...farmKeys.harvests, qs],
    queryFn: () => farmFetch<{ batches: HarvestBatchRow[] }>(`/api/farm/harvests?${qs}`).then((r) => r.batches),
  });

  const list = useMemo(() => batches.data ?? [], [batches.data]);
  const summary = useMemo(() => {
    const byUnit = new Map<string, number>();
    let exportable = 0;
    let gradedQty = 0;
    for (const b of list) {
      byUnit.set(b.unit, (byUnit.get(b.unit) ?? 0) + Number(b.quantity));
      if (b.grading) {
        const s = gradingStats(b.grading.lines, Number(b.quantity));
        exportable += s.exportable;
        gradedQty += Number(b.quantity);
      }
    }
    return {
      harvested: [...byUnit.entries()].map(([unit, q]) => fmtQty(q, unit)).join(' + ') || '0',
      pending: list.filter((b) => b.status === 'pending_grading').length,
      exportablePct: gradedQty > 0 ? (exportable / gradedQty) * 100 : null,
      labour: list.reduce((s, b) => s + batchLabourCost(b), 0),
    };
  }, [list]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Harvest Batches"
        subtitle="Every harvest gets a batch number that follows the produce through grading, packing and shipment."
        actions={
          can('harvest.record') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Record harvest
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Harvested" value={summary.harvested} hint={`${list.length} batches`} />
        <KpiCard label="Awaiting grading" value={summary.pending} />
        <KpiCard label="Exportable" value={fmtPct(summary.exportablePct)} hint="Of graded quantity" />
        <KpiCard label="Harvest labour" value={fmtMoney(summary.labour, currency)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input type="date" className="w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
        <Select value={blockId} onValueChange={setBlockId}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All blocks</SelectItem>
            {(blocks.data ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.code} · {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="pending_grading">Pending grading</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {batches.error ? (
        <ErrorState message={errorMessage(batches.error)} onRetry={() => batches.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Harvested</TableHead>
                <TableHead>Block / crop</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Pickers</TableHead>
                <TableHead className="text-right">Labour cost</TableHead>
                <TableHead className="text-right">Exportable</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : list.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title="No harvest batches in this range"
                  action={
                    can('harvest.record') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> Record harvest
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                list.map((b) => {
                  const s = b.grading ? gradingStats(b.grading.lines, Number(b.quantity)) : null;
                  return (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/harvest/batches/${b.id}`)}>
                      <TableCell>
                        <Link
                          href={`/harvest/batches/${b.id}`}
                          className="font-mono text-sm font-semibold text-brand-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {b.batch_no}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(b.harvest_date)}</TableCell>
                      <TableCell>
                        {b.block?.code}
                        <p className="text-xs text-muted-foreground">
                          {b.crop?.name}
                          {b.variety ? ` · ${b.variety.name}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{fmtQty(b.quantity, b.unit)}</TableCell>
                      <TableCell className="text-right">{b.workers.length || (Number(b.casual_labour_days) ? 'Casuals' : '—')}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(batchLabourCost(b), currency)}</TableCell>
                      <TableCell className="text-right">
                        {s ? (
                          <>
                            {fmtPct(s.exportablePct)}
                            <p className="text-xs text-muted-foreground">{fmtPct(s.rejectionPct)} rejected</p>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={b.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <HarvestBatchSheet open={creating} onOpenChange={setCreating} onSaved={(b) => router.push(`/harvest/batches/${b.id}`)} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="harvest.view">
      <Suspense>
        <HarvestBatchesPage />
      </Suspense>
    </RequirePermission>
  );
}
