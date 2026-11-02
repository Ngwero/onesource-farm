'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, ErrorState } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { BlockFormSheet } from '@/components/farm/forms/BlockFormSheet';
import { PlantingCycleSheet } from '@/components/farm/forms/PlantingCycleSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtHa, fmtNumber, fmtQty } from '@/lib/farm/format';
import type { BlockRow, PlantingCycleRow } from '@/lib/farm/types';

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

function YieldProgress({ cycle }: { cycle: PlantingCycleRow }) {
  const expected = Number(cycle.expected_yield ?? 0);
  const actual = Number(cycle.actual_yield ?? 0);
  const pct = expected > 0 ? Math.min(100, (actual / expected) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Harvested {fmtQty(actual, cycle.yield_unit)}</span>
        <span>Expected {fmtQty(cycle.expected_yield, cycle.yield_unit)}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
      {expected > 0 ? <p className="mt-1 text-xs text-muted-foreground">{fmtNumber(pct, 0)}% of expected yield</p> : null}
    </div>
  );
}

function BlockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const canManage = can('farm.manage');

  const [editingBlock, setEditingBlock] = useState(false);
  const [deletingBlock, setDeletingBlock] = useState(false);
  const [cycleSheet, setCycleSheet] = useState<{ open: boolean; cycle: PlantingCycleRow | null }>({ open: false, cycle: null });
  const [deletingCycle, setDeletingCycle] = useState<PlantingCycleRow | null>(null);

  const block = useQuery({
    queryKey: farmKeys.block(id),
    queryFn: () => farmFetch<{ block: BlockRow }>(`/api/farm/blocks/${id}`).then((r) => r.block),
  });

  const removeBlock = useActionMutation(() => farmFetch(`/api/farm/blocks/${id}`, { method: 'DELETE' }), {
    success: 'Block deleted',
    invalidate: [farmKeys.blocks, farmKeys.overview],
    onDone: () => router.push('/farm/blocks'),
  });

  const removeCycle = useActionMutation(
    (cycleId: string) => farmFetch(`/api/farm/planting-cycles/${cycleId}`, { method: 'DELETE' }),
    {
      success: 'Planting deleted',
      invalidate: [farmKeys.blocks, farmKeys.overview, farmKeys.cycles],
      onDone: () => setDeletingCycle(null),
    }
  );

  if (block.error) return <ErrorState message={errorMessage(block.error)} onRetry={() => block.refetch()} />;
  const b = block.data;
  if (!b) {
    return <div className="dashboard-loading">Loading block…</div>;
  }
  const current = b.current_cycle;
  const hasOpenCycle = b.planting_cycles.some((c) => c.status === 'active' || c.status === 'harvesting');

  return (
    <div className="space-y-6">
      <Link href="/farm/blocks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Blocks
      </Link>

      <PageHeader
        title={`${b.code} · ${b.name}`}
        meta={<StatusChip status={b.status} />}
        subtitle={`${fmtNumber(b.size_value)} ${b.size_unit}${b.size_unit === 'acres' ? ` (${fmtHa(b.area_ha)})` : ''}`}
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setEditingBlock(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => setDeletingBlock(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
              <Button onClick={() => setCycleSheet({ open: true, cycle: null })} disabled={b.status === 'inactive'}>
                <Plus className="size-4" /> New planting
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Block details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Block ID" value={b.code} />
              <Detail label="Area" value={fmtHa(b.area_ha)} />
              <Detail label="Soil" value={b.soil_type} />
              <Detail label="Irrigation" value={b.irrigation_type} />
              <Detail label="Supervisor" value={b.supervisor?.full_name} />
              <Detail label="Plantings" value={b.planting_cycles.length} />
            </dl>
            {b.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{b.notes}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              {can('activities.view') ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/farm/activities?block_id=${b.id}`}>Activities</Link>
                </Button>
              ) : null}
              {can('harvest.view') ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/harvest/batches?block_id=${b.id}`}>Harvests</Link>
                </Button>
              ) : null}
              {can('pest.view') ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/farm/incidents?block_id=${b.id}`}>Pest & disease</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">
              {current?.status === 'planned' ? 'Next planned planting' : 'Current planting'}
            </CardTitle>
            {current ? <StatusChip status={current.status} /> : null}
          </CardHeader>
          <CardContent>
            {current ? (
              <div className="space-y-5">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Detail label="Crop" value={current.crop?.name} />
                  <Detail label="Variety" value={current.variety?.name} />
                  <Detail label="Planted" value={fmtDate(current.planting_date)} />
                  <Detail label="Expected harvest" value={fmtDate(current.expected_harvest_date)} />
                  <Detail label="Season" value={current.season_label} />
                  <Detail label="Planted area" value={fmtHa(current.planted_area_ha ?? b.area_ha)} />
                  <Detail label="Supervisor" value={current.supervisor?.full_name} />
                </dl>
                <YieldProgress cycle={current} />
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="font-medium">Nothing planted in this block</p>
                <p className="text-sm text-muted-foreground">Record a planting to track crop, harvest date and yield.</p>
                {canManage && b.status !== 'inactive' ? (
                  <Button className="mt-4" onClick={() => setCycleSheet({ open: true, cycle: null })}>
                    <Plus className="size-4" /> New planting
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planting history</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Season</TableHead>
                <TableHead>Crop / variety</TableHead>
                <TableHead>Planted</TableHead>
                <TableHead>Expected harvest</TableHead>
                <TableHead className="text-right">Expected yield</TableHead>
                <TableHead className="text-right">Actual yield</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="pr-6 text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.planting_cycles.length === 0 ? (
                <EmptyRow columns={canManage ? 8 : 7} title="No plantings recorded" />
              ) : (
                b.planting_cycles.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6">{c.season_label || '—'}</TableCell>
                    <TableCell>
                      <span className="font-medium">{c.crop?.name}</span>
                      {c.variety ? <span className="text-muted-foreground"> · {c.variety.name}</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(c.planting_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(c.expected_harvest_date)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtQty(c.expected_yield, c.yield_unit)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtQty(c.actual_yield, c.yield_unit)}</TableCell>
                    <TableCell>
                      <StatusChip status={c.status} />
                    </TableCell>
                    {canManage ? (
                      <TableCell className="pr-6 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCycleSheet({ open: true, cycle: c })}
                          aria-label="Edit planting"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingCycle(c)} aria-label="Delete planting">
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {canManage && hasOpenCycle ? (
            <p className="px-6 pt-3 text-xs text-muted-foreground">
              A block can only have one active planting. Mark the current one completed before recording the next.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <BlockFormSheet open={editingBlock} onOpenChange={setEditingBlock} block={b} />
      <PlantingCycleSheet
        open={cycleSheet.open}
        onOpenChange={(open) => setCycleSheet((s) => ({ ...s, open }))}
        block={b}
        cycle={cycleSheet.cycle}
      />
      <ConfirmDialog
        open={deletingBlock}
        onOpenChange={setDeletingBlock}
        title={`Delete block ${b.code}?`}
        description="Blocks with planting history cannot be deleted — mark them inactive instead."
        confirmLabel="Delete block"
        destructive
        pending={removeBlock.isPending}
        onConfirm={() => removeBlock.mutate(undefined)}
      />
      <ConfirmDialog
        open={Boolean(deletingCycle)}
        onOpenChange={(open) => !open && setDeletingCycle(null)}
        title="Delete this planting?"
        description="Use this only for plantings entered by mistake. To end a season, edit the planting and mark it completed."
        confirmLabel="Delete planting"
        destructive
        pending={removeCycle.isPending}
        onConfirm={() => deletingCycle && removeCycle.mutate(deletingCycle.id)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="farm.view">
      <BlockDetailPage />
    </RequirePermission>
  );
}
