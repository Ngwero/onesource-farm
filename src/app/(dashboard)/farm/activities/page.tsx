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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { ActivityFormSheet } from '@/components/farm/forms/ActivityFormSheet';
import { farmKeys, useActivityTypes, useBlocks, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtNumber, todayIso } from '@/lib/farm/format';
import type { ActivityRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 8;

function ActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const blocks = useBlocks();
  const types = useActivityTypes();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(todayIso());
  const [blockId, setBlockId] = useState(searchParams.get('block_id') ?? ALL);
  const [typeId, setTypeId] = useState(ALL);

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (blockId !== ALL) params.set('block_id', blockId);
  const qs = params.toString();

  const activities = useQuery({
    queryKey: [...farmKeys.activities, qs],
    queryFn: () => farmFetch<{ activities: ActivityRow[] }>(`/api/farm/activities?${qs}`).then((r) => r.activities),
  });

  const filtered = useMemo(
    () => (activities.data ?? []).filter((a) => typeId === ALL || a.activity_type_id === typeId),
    [activities.data, typeId]
  );
  const totals = useMemo(() => {
    const labour = filtered.reduce((s, a) => s + Number(a.worker_labour_cost) + Number(a.other_labour_cost), 0);
    const inputs = filtered.reduce((s, a) => s + Number(a.input_cost), 0);
    const total = filtered.reduce((s, a) => s + Number(a.total_cost), 0);
    const hours = filtered.reduce((s, a) => s + a.workers.reduce((h, w) => h + Number(w.hours_worked), 0), 0);
    return { labour, inputs, total, hours };
  }, [filtered]);

  const createDefaults = useMemo(() => (blockId !== ALL ? { block_id: blockId } : undefined), [blockId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activities"
        subtitle="Field work by block and planting, with labour, inputs and cost."
        actions={
          can('activities.record') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Record activity
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Activities" value={filtered.length} hint={`${fmtNumber(totals.hours)} worker hours`} />
        <KpiCard label="Labour cost" value={fmtMoney(totals.labour, currency)} />
        <KpiCard label="Input cost" value={fmtMoney(totals.inputs, currency)} />
        <KpiCard label="Total cost" value={fmtMoney(totals.total, currency)} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All activities</SelectItem>
            {(types.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activities.error ? (
        <ErrorState message={errorMessage(activities.error)} onRetry={() => activities.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Block / crop</TableHead>
                <TableHead className="text-right">Workers</TableHead>
                <TableHead className="text-right">Labour</TableHead>
                <TableHead className="text-right">Inputs</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
                <TableHead>Supervisor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title="No activities in this range"
                  description="Record spraying, fertilizer, weeding and other field work to track cost per block."
                  action={
                    can('activities.record') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> Record activity
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((a) => {
                  const hours = a.workers.reduce((s, w) => s + Number(w.hours_worked), 0);
                  return (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/farm/activities/${a.id}`)}>
                      <TableCell className="whitespace-nowrap">{fmtDate(a.activity_date)}</TableCell>
                      <TableCell>
                        <Link
                          href={`/farm/activities/${a.id}`}
                          className="font-semibold text-brand-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.activity_type?.name}
                        </Link>
                        {a.inputs.length ? (
                          <p className="line-clamp-1 text-xs text-muted-foreground">{a.inputs.map((i) => i.input_name).join(', ')}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {a.block?.code}
                        <p className="text-xs text-muted-foreground">{a.crop?.name ?? 'No planting'}</p>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {a.workers.length}
                        <p className="text-xs text-muted-foreground">
                          {fmtNumber(hours)} h{Number(a.casual_labour_days) ? ` + ${fmtNumber(a.casual_labour_days)} casual days` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmtMoney(Number(a.worker_labour_cost) + Number(a.other_labour_cost), currency)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{Number(a.input_cost) ? fmtMoney(a.input_cost, currency) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{fmtMoney(a.total_cost, currency)}</TableCell>
                      <TableCell>{a.supervisor?.full_name ?? '—'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {filtered.length ? (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(totals.labour, currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(totals.inputs, currency)}</TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">{fmtMoney(totals.total, currency)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      )}

      <ActivityFormSheet
        open={creating}
        onOpenChange={setCreating}
        defaults={createDefaults}
        onSaved={(id) => router.push(`/farm/activities/${id}`)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="activities.view">
      <Suspense>
        <ActivitiesPage />
      </Suspense>
    </RequirePermission>
  );
}
