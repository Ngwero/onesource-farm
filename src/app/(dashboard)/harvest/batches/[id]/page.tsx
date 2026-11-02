'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, GitBranch, Package, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, ErrorState } from '@/components/farm/DataStates';
import { Detail } from '@/components/farm/Detail';
import { GradeDistribution } from '@/components/farm/GradeDistribution';
import { KpiCard } from '@/components/farm/KpiCard';
import { PhotoGallery } from '@/components/farm/PhotoGallery';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { InspectionTable } from '@/components/farm/Packhouse';
import { QcStatusChip, StatusChip } from '@/components/farm/StatusChip';
import { GradingSheet } from '@/components/farm/forms/GradingSheet';
import { HarvestBatchSheet } from '@/components/farm/forms/HarvestBatchSheet';
import { PackingBatchSheet } from '@/components/farm/forms/PackingBatchSheet';
import { QcInspectionSheet } from '@/components/farm/forms/QcInspectionSheet';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtPct, fmtQty } from '@/lib/farm/format';
import { gradingStats } from '@/lib/farm/grading';
import type { HarvestBatchDetail, PackingBatchRow, QcInspectionRow } from '@/lib/farm/types';

function HarvestBatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const canRecord = can('harvest.record');
  const canGrade = can('grading.record');
  const [editing, setEditing] = useState(false);
  const [grading, setGrading] = useState(false);
  const [confirm, setConfirm] = useState<'batch' | 'grading' | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [packingOpen, setPackingOpen] = useState(false);

  const batch = useQuery({
    queryKey: farmKeys.harvest(id),
    queryFn: () => farmFetch<{ batch: HarvestBatchDetail }>(`/api/farm/harvests/${id}`).then((r) => r.batch),
  });

  const graded = batch.data?.status === 'graded';
  const packing = useQuery({
    queryKey: [...farmKeys.packing, 'harvest', id],
    queryFn: () => farmFetch<{ batches: PackingBatchRow[] }>(`/api/farm/packing?harvest_batch_id=${id}`).then((r) => r.batches),
    enabled: graded && can('packing.view'),
  });
  const inspections = useQuery({
    queryKey: [...farmKeys.qc, 'harvest', id],
    queryFn: () => farmFetch<{ inspections: QcInspectionRow[] }>(`/api/farm/qc?harvest_batch_id=${id}`).then((r) => r.inspections),
    enabled: graded && can('qc.view'),
  });

  const removeBatch = useActionMutation(() => farmFetch(`/api/farm/harvests/${id}`, { method: 'DELETE' }), {
    success: 'Harvest batch deleted',
    invalidate: [farmKeys.harvests, farmKeys.cycles, farmKeys.blocks, farmKeys.overview, farmKeys.payroll],
    onDone: () => router.push('/harvest/batches'),
  });
  const removeGrading = useActionMutation(() => farmFetch(`/api/farm/harvests/${id}/grading`, { method: 'DELETE' }), {
    success: 'Grading deleted',
    invalidate: [farmKeys.harvests],
    onDone: () => setConfirm(null),
  });

  if (batch.error) return <ErrorState message={errorMessage(batch.error)} onRetry={() => batch.refetch()} />;
  const b = batch.data;
  if (!b) return <div className="dashboard-loading">Loading batch…</div>;
  const g = b.grading;
  const stats = g ? gradingStats(g.lines, Number(b.quantity)) : null;
  const labourCost = Number(b.worker_labour_cost) + Number(b.other_labour_cost);
  const hours = b.workers.reduce((s, w) => s + Number(w.hours_worked), 0);
  const packed = (packing.data ?? []).length > 0;
  const gradingEditable = canGrade && !packed;
  const openInspection = (inspections.data ?? []).some((i) => i.review_status === 'awaiting_review') || b.qc_status === 'released';

  return (
    <div className="space-y-6">
      <Link href="/harvest/batches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Harvest Batches
      </Link>

      <PageHeader
        title={b.batch_no}
        titleMono
        meta={
          <>
            <StatusChip status={b.status} />
            {g ? <QcStatusChip status={b.qc_status} /> : null}
          </>
        }
        subtitle={`${fmtQty(b.quantity, b.unit)} of ${b.crop?.name ?? ''}${b.variety ? ` (${b.variety.name})` : ''} from block ${b.block?.code ?? ''}, harvested ${fmtDate(b.harvest_date)}`}
        actions={
          <>
            {can('traceability.view') ? (
              <Button variant="outline" asChild>
                <Link href={`/trace?harvest_batch_id=${b.id}`}>
                  <GitBranch className="size-4" /> Trace
                </Link>
              </Button>
            ) : null}
            {canRecord ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button variant="outline" onClick={() => setConfirm('batch')} disabled={Boolean(g)} title={g ? 'Delete the grading first' : undefined}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </>
            ) : null}
            {gradingEditable ? (
              <Button onClick={() => setGrading(true)}>
                <ClipboardCheck className="size-4" /> {g ? 'Edit grading' : 'Grade batch'}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Harvested" value={fmtQty(b.quantity, b.unit)} />
        <KpiCard
          label="Exportable"
          value={stats ? fmtPct(stats.exportablePct) : 'Not graded'}
          hint={stats ? fmtQty(stats.exportable, b.unit) : undefined}
        />
        <KpiCard label="Rejected" value={stats ? fmtPct(stats.rejectionPct) : '—'} hint={stats ? fmtQty(stats.rejected, b.unit) : undefined} />
        <KpiCard
          label="Labour cost"
          value={fmtMoney(labourCost, currency)}
          hint={Number(b.quantity) > 0 ? `${fmtMoney(labourCost / Number(b.quantity), currency)} per ${b.unit}` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Detail
                label="Block"
                value={
                  b.block ? (
                    <Link href={`/farm/blocks/${b.block.id}`} className="text-brand-700 hover:underline">
                      {b.block.code} · {b.block.name}
                    </Link>
                  ) : null
                }
              />
              <Detail label="Crop" value={`${b.crop?.name ?? ''}${b.variety ? ` · ${b.variety.name}` : ''}`} />
              <Detail label="Planted" value={fmtDate(b.cycle?.planting_date)} />
              <Detail label="Season" value={b.cycle?.season_label} />
              <Detail
                label="Planting harvested"
                value={
                  b.cycle
                    ? `${fmtQty(b.cycle.actual_yield, b.cycle.yield_unit)}${b.cycle.expected_yield ? ` of ${fmtQty(b.cycle.expected_yield, b.cycle.yield_unit)}` : ''}`
                    : null
                }
              />
              <Detail label="Supervisor" value={b.supervisor?.full_name} />
              <Detail label="Recorded" value={fmtDateTime(b.created_at)} />
            </dl>
            {b.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{b.notes}</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Grading</CardTitle>
            {packed ? (
              <span className="text-xs text-muted-foreground">Locked: produce has been packed</span>
            ) : g && canGrade ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirm('grading')}>
                <Trash2 className="size-4" /> Delete grading
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {g && stats ? (
              <div className="space-y-5">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Detail label="Graded on" value={fmtDate(g.graded_date)} />
                  <Detail label="Inspector" value={g.inspector?.full_name} />
                  <Detail label="Graded quantity" value={fmtQty(g.total_quantity, b.unit)} />
                </dl>
                <GradeDistribution stats={stats} unit={b.unit} />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade</TableHead>
                      <TableHead>Use</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.lines.map((l) => (
                      <TableRow key={l.grade_id}>
                        <TableCell className="font-medium">{l.grade?.name}</TableCell>
                        <TableCell>{l.grade ? <StatusChip status={l.grade.purpose} /> : null}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtQty(l.quantity, b.unit)}</TableCell>
                        <TableCell className="text-right">
                          {fmtPct(Number(b.quantity) > 0 ? (Number(l.quantity) / Number(b.quantity)) * 100 : null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {g.rejections.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rejection reasons</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {g.rejections.map((r) => (
                        <li key={r.reason_id} className="rounded-full border bg-red-50 px-2.5 py-0.5 text-xs text-red-700">
                          {r.reason?.name}
                          {r.quantity != null ? ` · ${fmtQty(r.quantity, b.unit)}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {g.notes ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{g.notes}</p> : null}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="font-medium">Not graded yet</p>
                <p className="text-sm text-muted-foreground">
                  Split the batch into {b.crop_grades.map((x) => x.name).join(', ') || 'grades'} to see exportable and rejected
                  quantities.
                </p>
                {canGrade ? (
                  <Button className="mt-4" onClick={() => setGrading(true)}>
                    <ClipboardCheck className="size-4" /> Grade batch
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pickers</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Worker</TableHead>
                <TableHead className="text-right">Picked</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate / h</TableHead>
                <TableHead className="pr-6 text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.workers.length === 0 ? (
                <EmptyRow columns={5} title="No registered pickers recorded" />
              ) : (
                b.workers.map((w) => (
                  <TableRow key={w.worker_id}>
                    <TableCell className="pl-6">
                      <Link href={`/workforce/workers/${w.worker_id}`} className="font-medium text-brand-700 hover:underline">
                        {w.worker?.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{w.worker?.worker_code}</p>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{w.quantity_picked == null ? '—' : fmtQty(w.quantity_picked, b.unit)}</TableCell>
                    <TableCell className="text-right">{fmtNumber(w.hours_worked)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtMoney(w.hourly_rate, currency)}</TableCell>
                    <TableCell className="pr-6 text-right whitespace-nowrap">{fmtMoney(w.cost, currency)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="px-6 pt-3 text-xs text-muted-foreground">
            {fmtNumber(hours)} registered worker hours ({fmtMoney(b.worker_labour_cost, currency)})
            {Number(b.casual_labour_days) || Number(b.other_labour_cost)
              ? `, plus ${fmtNumber(b.casual_labour_days)} casual labour days (${fmtMoney(b.other_labour_cost, currency)})`
              : ''}
            .
          </p>
        </CardContent>
      </Card>

      {g && (can('qc.view') || can('packing.view')) ? (
        <div className="space-y-6">
          {can('qc.view') ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Quality inspections</CardTitle>
                {can('qc.inspect') && !openInspection ? (
                  <Button variant="ghost" size="sm" onClick={() => setInspecting(true)}>
                    <ClipboardCheck className="size-4" /> Inspect
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="px-0">
                {inspections.error ? (
                  <ErrorState message={errorMessage(inspections.error)} onRetry={() => inspections.refetch()} />
                ) : (
                  <InspectionTable inspections={inspections.data ?? []} emptyTitle="The harvest has not been inspected" />
                )}
              </CardContent>
            </Card>
          ) : null}
          {can('packing.view') ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Packed from this harvest</CardTitle>
                {can('packing.record') && b.qc_status !== 'failed' ? (
                  <Button variant="ghost" size="sm" onClick={() => setPackingOpen(true)}>
                    <Package className="size-4" /> Record packing
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="px-0">
                {packing.error ? (
                  <ErrorState message={errorMessage(packing.error)} onRetry={() => packing.refetch()} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Packed batch</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="pr-6">QC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(packing.data ?? []).length === 0 ? (
                        <EmptyRow columns={4} title="Nothing packed yet" />
                      ) : (
                        (packing.data ?? []).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="pl-6">
                              <Link href={`/packhouse/packing/${p.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                                {p.packing_no}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {p.package_count} × {p.packaging?.name}
                              </p>
                            </TableCell>
                            <TableCell>{p.grade?.name}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{fmtNumber(p.net_weight)} kg</TableCell>
                            <TableCell className="pr-6">
                              <QcStatusChip status={p.qc_status} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <PhotoGallery entityType="harvest_batch" entityId={b.id} canEdit={canRecord} />
      {can('qc.inspect') && g ? (
        <QcInspectionSheet
          open={inspecting}
          onOpenChange={setInspecting}
          defaults={{ subject_type: 'harvest_batch', harvest_batch_id: b.id }}
          onSaved={(i) => router.push(`/quality/inspections/${i.id}`)}
        />
      ) : null}
      {can('packing.record') && g ? (
        <PackingBatchSheet
          open={packingOpen}
          onOpenChange={setPackingOpen}
          defaults={{ harvest_batch_id: b.id }}
          onSaved={(p) => router.push(`/packhouse/packing/${p.id}`)}
        />
      ) : null}

      <HarvestBatchSheet open={editing} onOpenChange={setEditing} batch={b} />
      {canGrade ? <GradingSheet open={grading} onOpenChange={setGrading} batch={b} /> : null}
      <ConfirmDialog
        open={confirm === 'batch'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${b.batch_no}?`}
        description="Use this only for harvests entered by mistake. The planting's harvested total is reduced and photos are deleted."
        confirmLabel="Delete batch"
        destructive
        pending={removeBatch.isPending}
        onConfirm={() => removeBatch.mutate(undefined)}
      />
      <ConfirmDialog
        open={confirm === 'grading'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this grading?"
        description="The batch goes back to pending grading. Use this to correct the harvested quantity or regrade from scratch."
        confirmLabel="Delete grading"
        destructive
        pending={removeGrading.isPending}
        onConfirm={() => removeGrading.mutate(undefined)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="harvest.view">
      <HarvestBatchPage />
    </RequirePermission>
  );
}
