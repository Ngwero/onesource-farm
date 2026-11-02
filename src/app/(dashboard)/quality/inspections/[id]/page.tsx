'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gavel, GitBranch, Hammer, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { ErrorState } from '@/components/farm/DataStates';
import { Detail } from '@/components/farm/Detail';
import { ChecksTable } from '@/components/farm/Packhouse';
import { PhotoGallery } from '@/components/farm/PhotoGallery';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { QcStatusChip, StatusChip } from '@/components/farm/StatusChip';
import { QcInspectionSheet } from '@/components/farm/forms/QcInspectionSheet';
import { QcReviewSheet, QcReworkSheet } from '@/components/farm/forms/QcReviewSheet';
import { farmKeys, PACKHOUSE_KEYS } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtDateTime, fmtNumber } from '@/lib/farm/format';
import type { QcInspectionRow } from '@/lib/farm/types';

const DECISION_TEXT: Record<string, string> = {
  approved: 'Approved',
  rework: 'Sent back for rework',
  reinspection: 'Reinspection requested',
  rejected: 'Rejected',
};

function InspectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reworking, setReworking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inspection = useQuery({
    queryKey: farmKeys.inspection(id),
    queryFn: () => farmFetch<{ inspection: QcInspectionRow }>(`/api/farm/qc/${id}`).then((r) => r.inspection),
  });

  const remove = useActionMutation(() => farmFetch(`/api/farm/qc/${id}`, { method: 'DELETE' }), {
    success: 'Inspection deleted',
    invalidate: [...PACKHOUSE_KEYS, farmKeys.qcSubjects],
    onDone: () => router.push('/quality/inspections'),
  });

  if (inspection.error) return <ErrorState message={errorMessage(inspection.error)} onRetry={() => inspection.refetch()} />;
  const i = inspection.data;
  if (!i) return <div className="dashboard-loading">Loading inspection…</div>;

  const open = i.review_status === 'awaiting_review';
  const failed = i.checks.filter((c) => c.passed === false).length;
  const batchNo = i.packing?.packing_no ?? i.harvest?.batch_no;
  const batchHref = i.packing ? `/packhouse/packing/${i.packing.id}` : i.harvest ? `/harvest/batches/${i.harvest.id}` : null;
  const batchStatus = i.packing?.qc_status ?? i.harvest?.qc_status;
  const reworkPending = i.review_status === 'rework' && !i.rework_completed_at && batchStatus === 'rework';
  const canOpenBatch = i.packing ? can('packing.view') : can('harvest.view');
  const traceHref = i.packing
    ? `/trace?packing_batch_id=${i.packing.id}`
    : i.harvest
      ? `/trace?harvest_batch_id=${i.harvest.id}`
      : null;

  return (
    <div className="space-y-6">
      <Link href="/quality/inspections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> QC Inspections
      </Link>

      <PageHeader
        title={i.inspection_no}
        titleMono
        meta={
          <>
            <StatusChip status={i.result} />
            <StatusChip status={i.review_status} label={i.review_status === 'rework' && i.rework_completed_at ? 'Rework done' : undefined} />
          </>
        }
        subtitle={`${i.crop?.name ?? ''} ${i.subject_type === 'packing_batch' ? 'packed batch' : 'harvest batch'} ${batchNo ?? ''}, inspected ${fmtDate(i.inspection_date)}${i.inspector ? ` by ${i.inspector.full_name}` : ''}`}
        actions={
          <>
            {traceHref && can('traceability.view') ? (
              <Button variant="outline" asChild>
                <Link href={traceHref}>
                  <GitBranch className="size-4" /> Trace
                </Link>
              </Button>
            ) : null}
            {open && can('qc.inspect') ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button variant="outline" onClick={() => setDeleting(true)}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </>
            ) : null}
            {open && can('qc.approve') ? (
              <Button onClick={() => setReviewing(true)}>
                <Gavel className="size-4" /> Review
              </Button>
            ) : null}
            {reworkPending && can('qc.inspect') ? (
              <Button onClick={() => setReworking(true)}>
                <Hammer className="size-4" /> Record rework
              </Button>
            ) : null}
          </>
        }
      />

      {reworkPending ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The supervisor sent this batch back for rework. Re-sort or repack it, record what was done, and then inspect it again.
        </div>
      ) : null}
      {batchStatus === 'reinspection' && !reworkPending ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          This batch needs a fresh inspection before it can be approved.{' '}
          {batchHref && canOpenBatch ? (
            <Link href={batchHref} className="font-medium underline">
              Open {batchNo}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspection</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Detail
                label="Batch"
                value={
                  batchHref && canOpenBatch ? (
                    <Link href={batchHref} className="font-mono text-xs text-brand-700 hover:underline">
                      {batchNo}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{batchNo}</span>
                  )
                }
              />
              <Detail label="Batch QC status" value={batchStatus ? <QcStatusChip status={batchStatus} /> : null} />
              <Detail label="Crop" value={i.crop?.name} />
              <Detail label="Inspector" value={i.inspector?.full_name} />
              <Detail label="Sample" value={i.sample_size != null ? `${fmtNumber(i.sample_size)} ${i.sample_unit ?? ''}` : null} />
              <Detail label="Checks" value={`${i.checks.length - failed} of ${i.checks.length} passed`} />
              <Detail label="Rejected" value={i.rejected_quantity ? `${fmtNumber(i.rejected_quantity)} ${i.sample_unit ?? ''}` : 'None'} />
              <Detail label="Reason" value={i.rejection_reason?.name} />
            </dl>
            {i.buyer_specification ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Buyer specification</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{i.buyer_specification}</p>
              </div>
            ) : null}
            {i.corrective_action ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Corrective action</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{i.corrective_action}</p>
              </div>
            ) : null}
            {i.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{i.notes}</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Quality checks</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ChecksTable checks={i.checks} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supervisor review</CardTitle>
        </CardHeader>
        <CardContent>
          {open ? (
            <p className="text-sm text-muted-foreground">
              Awaiting review.{' '}
              {can('qc.approve') ? 'Approve it, send it back for rework, or ask for reinspection.' : 'A QC supervisor will review it.'}
            </p>
          ) : (
            <ol className="space-y-4">
              <li>
                <p className="text-sm font-medium">
                  {DECISION_TEXT[i.review_status] ?? i.review_status}
                  {i.reviewer ? ` by ${i.reviewer.full_name}` : ''}
                  <span className="font-normal text-muted-foreground"> · {fmtDateTime(i.reviewed_at)}</span>
                </p>
                {i.review_notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{i.review_notes}</p> : null}
              </li>
              {i.rework_completed_at ? (
                <li>
                  <p className="text-sm font-medium">
                    Rework completed{i.rework_user ? ` by ${i.rework_user.full_name}` : ''}
                    <span className="font-normal text-muted-foreground"> · {fmtDateTime(i.rework_completed_at)}</span>
                  </p>
                  {i.rework_notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{i.rework_notes}</p> : null}
                </li>
              ) : null}
            </ol>
          )}
        </CardContent>
      </Card>

      <PhotoGallery entityType="qc_inspection" entityId={i.id} canEdit={can('qc.inspect')} />

      {can('qc.inspect') && open ? <QcInspectionSheet open={editing} onOpenChange={setEditing} inspection={i} /> : null}
      {can('qc.approve') && open ? <QcReviewSheet open={reviewing} onOpenChange={setReviewing} inspection={i} /> : null}
      {can('qc.inspect') && reworkPending ? <QcReworkSheet open={reworking} onOpenChange={setReworking} inspection={i} /> : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${i.inspection_no}?`}
        description="The batch's QC status goes back to what the previous inspection decided. Photos on this inspection are deleted too."
        confirmLabel="Delete inspection"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="qc.view">
      <InspectionPage />
    </RequirePermission>
  );
}
