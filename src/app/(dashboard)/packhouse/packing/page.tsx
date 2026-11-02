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
import { QC_STATUS_LABEL, QcStatusChip } from '@/components/farm/StatusChip';
import { PackingBatchSheet } from '@/components/farm/forms/PackingBatchSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtNumber, todayIso } from '@/lib/farm/format';
import { QC_STATUSES } from '@/lib/farm/schemas';
import type { PackingBatchRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 7;

function PackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(todayIso());
  const [qcStatus, setQcStatus] = useState(searchParams.get('qc_status') ?? ALL);

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (qcStatus !== ALL) params.set('qc_status', qcStatus);
  const qs = params.toString();

  const batches = useQuery({
    queryKey: [...farmKeys.packing, qs],
    queryFn: () => farmFetch<{ batches: PackingBatchRow[] }>(`/api/farm/packing?${qs}`).then((r) => r.batches),
  });
  const list = useMemo(() => batches.data ?? [], [batches.data]);
  const summary = useMemo(
    () => ({
      net: list.reduce((s, b) => s + Number(b.net_weight), 0),
      packages: list.reduce((s, b) => s + Number(b.package_count), 0),
      awaitingQc: list.filter((b) => ['pending', 'rework', 'reinspection'].includes(b.qc_status)).length,
      released: list.filter((b) => b.qc_status === 'released').reduce((s, b) => s + Number(b.net_weight), 0),
    }),
    [list]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Packed Batches"
        subtitle="Graded produce packed into cartons, crates or sacks. Each packed batch is inspected, stored and shipped under its own number."
        actions={
          can('packing.record') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Record packing
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Packed (net)" value={`${fmtNumber(summary.net)} kg`} hint={`${list.length} batches`} />
        <KpiCard label="Packages" value={fmtNumber(summary.packages, 0)} />
        <KpiCard label="Awaiting QC" value={summary.awaitingQc} hint="Pending, rework or reinspection" />
        <KpiCard label="Export released" value={`${fmtNumber(summary.released)} kg`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input type="date" className="w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
        <Select value={qcStatus} onValueChange={setQcStatus}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All QC statuses</SelectItem>
            {QC_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {QC_STATUS_LABEL[s]}
              </SelectItem>
            ))}
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
                <TableHead>Packed batch</TableHead>
                <TableHead>Packed</TableHead>
                <TableHead>Source harvest</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead>QC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : list.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title="No packed batches in this range"
                  description="Pack graded produce from a harvest batch to create export stock."
                  action={
                    can('packing.record') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> Record packing
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                list.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/packhouse/packing/${b.id}`)}>
                    <TableCell>
                      <Link
                        href={`/packhouse/packing/${b.id}`}
                        className="font-mono text-sm font-semibold text-brand-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {b.packing_no}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {b.crop?.name} · {b.grade?.name}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(b.packing_date)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{b.harvest?.batch_no}</span>
                      <p className="text-xs text-muted-foreground">Block {b.harvest?.block?.code}</p>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="font-medium">{fmtNumber(b.net_weight)} kg</span>
                      <p className="text-xs text-muted-foreground">
                        {b.package_count} × {b.packaging?.name} · {fmtNumber(b.gross_weight)} kg gross
                      </p>
                    </TableCell>
                    <TableCell>{b.received_date ? (b.location?.name ?? '—') : <span className="text-sm text-amber-700">Not received</span>}</TableCell>
                    <TableCell className="text-right">
                      {b.received_date ? (
                        <>
                          {b.stock.available + b.stock.reserved}
                          <p className="text-xs text-muted-foreground">of {b.package_count}</p>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <QcStatusChip status={b.qc_status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PackingBatchSheet open={creating} onOpenChange={setCreating} onSaved={(b) => router.push(`/packhouse/packing/${b.id}`)} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="packing.view">
      <Suspense>
        <PackingPage />
      </Suspense>
    </RequirePermission>
  );
}
