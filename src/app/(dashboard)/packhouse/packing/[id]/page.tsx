'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRightLeft,
  ClipboardCheck,
  GitBranch,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Rocket,
  Trash2,
  Truck,
  Undo2,
  Warehouse,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { ErrorState } from '@/components/farm/DataStates';
import { Detail } from '@/components/farm/Detail';
import { KpiCard } from '@/components/farm/KpiCard';
import { InspectionTable, MovementTable, StockBreakdown } from '@/components/farm/Packhouse';
import { PhotoGallery } from '@/components/farm/PhotoGallery';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { QcStatusChip } from '@/components/farm/StatusChip';
import { PackingBatchSheet } from '@/components/farm/forms/PackingBatchSheet';
import { QcInspectionSheet } from '@/components/farm/forms/QcInspectionSheet';
import { StockMovementSheet, type MovementKind } from '@/components/farm/forms/StockMovementSheet';
import { farmKeys, PACKHOUSE_KEYS } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtDateTime, fmtNumber, fmtQty } from '@/lib/farm/format';
import type { PackingBatchDetail } from '@/lib/farm/types';

function PackingBatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const [editing, setEditing] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [movement, setMovement] = useState<MovementKind | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'release' | 'withdraw' | null>(null);

  const batch = useQuery({
    queryKey: farmKeys.packingBatch(id),
    queryFn: () => farmFetch<{ batch: PackingBatchDetail }>(`/api/farm/packing/${id}`).then((r) => r.batch),
  });

  const remove = useActionMutation(() => farmFetch(`/api/farm/packing/${id}`, { method: 'DELETE' }), {
    success: 'Packed batch deleted',
    invalidate: [...PACKHOUSE_KEYS, farmKeys.packingSources],
    onDone: () => router.push('/packhouse/packing'),
  });
  const release = useActionMutation(
    (on: boolean) => farmFetch(`/api/farm/packing/${id}/release`, { method: 'POST', body: { release: on } }),
    {
      success: 'Export release updated',
      invalidate: [...PACKHOUSE_KEYS, farmKeys.packingBatch(id)],
      onDone: () => setConfirm(null),
    }
  );

  if (batch.error) return <ErrorState message={errorMessage(batch.error)} onRetry={() => batch.refetch()} />;
  const b = batch.data;
  if (!b) return <div className="dashboard-loading">Loading packed batch…</div>;

  const received = Boolean(b.received_date);
  const released = b.qc_status === 'released';
  const openInspection = b.inspections.some((i) => i.review_status === 'awaiting_review');
  const perPackage = Number(b.net_weight_per_package);
  const onHand = b.stock.available + b.stock.reserved;
  const locked = received || b.inspections.length > 0;
  const canWarehouse = can('warehouse.manage');
  const factor = b.source.unit === 'tonne' ? 1000 : 1;

  return (
    <div className="space-y-6">
      <Link href="/packhouse/packing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Packed Batches
      </Link>

      <PageHeader
        title={b.packing_no}
        titleMono
        meta={<QcStatusChip status={b.qc_status} />}
        subtitle={`${b.package_count} × ${b.packaging?.name ?? 'package'} of ${b.crop?.name ?? ''} ${b.grade?.name ?? ''}, packed ${fmtDate(b.packing_date)} from ${b.harvest?.batch_no ?? ''}`}
        actions={
          <>
            {can('traceability.view') ? (
              <Button variant="outline" asChild>
                <Link href={`/trace?packing_batch_id=${b.id}`}>
                  <GitBranch className="size-4" /> Trace
                </Link>
              </Button>
            ) : null}
            {can('qc.inspect') && !released && !openInspection ? (
              <Button variant="outline" onClick={() => setInspecting(true)}>
                <ClipboardCheck className="size-4" /> Inspect
              </Button>
            ) : null}
            {can('qc.release') && b.qc_status === 'approved' ? (
              <Button onClick={() => setConfirm('release')}>
                <Rocket className="size-4" /> Release for export
              </Button>
            ) : null}
            {canWarehouse && !received ? (
              <Button onClick={() => setMovement('receive')}>
                <Warehouse className="size-4" /> Receive into warehouse
              </Button>
            ) : null}
            {canWarehouse && released && b.stock.available > 0 ? (
              <Button onClick={() => setMovement('dispatch')}>
                <Truck className="size-4" /> Dispatch
              </Button>
            ) : null}
            {can('packing.record') || (canWarehouse && received && onHand > 0) || (can('qc.release') && released) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {can('packing.record') ? (
                    <DropdownMenuItem onSelect={() => setEditing(true)}>
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                  ) : null}
                  {canWarehouse && received && onHand > 0 ? (
                    <>
                      <DropdownMenuItem onSelect={() => setMovement('relocate')}>
                        <ArrowRightLeft className="size-4" /> Move location
                      </DropdownMenuItem>
                      {b.stock.available > 0 ? (
                        <>
                          <DropdownMenuItem onSelect={() => setMovement('damage')}>
                            <PackageCheck className="size-4" /> Record damaged
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setMovement('spoil')}>
                            <PackageCheck className="size-4" /> Record spoiled
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {can('qc.release') && released && b.stock.dispatched === 0 ? (
                    <DropdownMenuItem onSelect={() => setConfirm('withdraw')}>
                      <Undo2 className="size-4" /> Withdraw export release
                    </DropdownMenuItem>
                  ) : null}
                  {can('packing.record') && !locked ? (
                    <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm('delete')}>
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Net weight" value={`${fmtNumber(b.net_weight)} kg`} hint={`${fmtNumber(perPackage)} kg per package`} />
        <KpiCard label="Gross weight" value={`${fmtNumber(b.gross_weight)} kg`} hint={`${fmtNumber(b.tare_weight_per_package)} kg packaging each`} />
        <KpiCard
          label="In stock"
          value={received ? `${onHand} pkgs` : 'Not received'}
          hint={received ? `${fmtNumber(onHand * perPackage)} kg at ${b.location?.name ?? '—'}` : 'Waiting to be booked into the warehouse'}
        />
        <KpiCard
          label="Export release"
          value={released ? 'Released' : b.qc_status === 'approved' ? 'Ready to release' : 'Not released'}
          hint={released ? `${fmtDateTime(b.released_at)}${b.released_by_user ? ` by ${b.released_by_user.full_name}` : ''}` : 'Needs QC approval first'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Packing details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Detail
                label="Source harvest"
                value={
                  b.harvest ? (
                    can('harvest.view') ? (
                      <Link href={`/harvest/batches/${b.harvest.id}`} className="font-mono text-xs text-brand-700 hover:underline">
                        {b.harvest.batch_no}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{b.harvest.batch_no}</span>
                    )
                  ) : null
                }
              />
              <Detail label="Block" value={b.harvest?.block ? `${b.harvest.block.code} · ${b.harvest.block.name}` : null} />
              <Detail label="Crop / grade" value={`${b.crop?.name ?? ''} · ${b.grade?.name ?? ''}`} />
              <Detail label="Packaging" value={b.packaging?.name} />
              <Detail label="Packed by" value={b.packed_by_user?.full_name} />
              <Detail label="Received" value={received ? fmtDate(b.received_date) : 'Not yet'} />
              <Detail
                label="Grade packed"
                value={
                  b.source.packedKg == null
                    ? fmtQty(b.source.graded, b.source.unit)
                    : `${fmtNumber(b.source.packedKg)} of ${fmtNumber(b.source.graded * factor)} kg graded`
                }
              />
              <Detail label="Recorded" value={fmtDateTime(b.created_at)} />
            </dl>
            {b.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{b.notes}</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Warehouse stock</CardTitle>
          </CardHeader>
          <CardContent>
            {received ? (
              <StockBreakdown stock={b.stock} total={b.package_count} kgPerPackage={perPackage} />
            ) : (
              <div className="py-6 text-center">
                <p className="font-medium">Not received into the warehouse yet</p>
                <p className="text-sm text-muted-foreground">Receive the batch at a cold room or store to start tracking its stock.</p>
                {canWarehouse ? (
                  <Button className="mt-4" onClick={() => setMovement('receive')}>
                    <Warehouse className="size-4" /> Receive into warehouse
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Quality inspections</CardTitle>
          {can('qc.inspect') && !released && !openInspection ? (
            <Button variant="ghost" size="sm" onClick={() => setInspecting(true)}>
              <ClipboardCheck className="size-4" /> Inspect
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">
          <InspectionTable inspections={b.inspections} emptyTitle="Not inspected yet. QC approval is needed before export release." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock movements</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <MovementTable movements={b.movements} />
        </CardContent>
      </Card>

      <PhotoGallery entityType="packing_batch" entityId={b.id} canEdit={can('packing.record')} />

      {can('packing.record') ? <PackingBatchSheet open={editing} onOpenChange={setEditing} batch={b} /> : null}
      {can('qc.inspect') ? (
        <QcInspectionSheet
          open={inspecting}
          onOpenChange={setInspecting}
          defaults={{ subject_type: 'packing_batch', packing_batch_id: b.id }}
          onSaved={(i) => router.push(`/quality/inspections/${i.id}`)}
        />
      ) : null}
      {canWarehouse && movement ? (
        <StockMovementSheet open={Boolean(movement)} onOpenChange={(o) => !o && setMovement(null)} batch={b} kind={movement} />
      ) : null}
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${b.packing_no}?`}
        description="Use this only for packing entered by mistake. The produce becomes available to pack again."
        confirmLabel="Delete batch"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
      <ConfirmDialog
        open={confirm === 'release'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Release ${b.packing_no} for export?`}
        description="The batch has passed QC. Once released it can be dispatched from the warehouse and no further inspections can be recorded."
        confirmLabel="Release for export"
        pending={release.isPending}
        onConfirm={() => release.mutate(true)}
      />
      <ConfirmDialog
        open={confirm === 'withdraw'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Withdraw the export release?"
        description="The batch goes back to QC approved and cannot be dispatched until it is released again."
        confirmLabel="Withdraw release"
        destructive
        pending={release.isPending}
        onConfirm={() => release.mutate(false)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission={['packing.view', 'warehouse.view', 'qc.view']}>
      <PackingBatchPage />
    </RequirePermission>
  );
}
