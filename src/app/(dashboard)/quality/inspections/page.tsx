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
import { QcStatusChip, StatusChip } from '@/components/farm/StatusChip';
import { QcInspectionSheet } from '@/components/farm/forms/QcInspectionSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate } from '@/lib/farm/format';
import type { QcInspectionRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 7;

const REVIEW_FILTERS = [
  { value: 'awaiting_review', label: 'Awaiting review' },
  { value: 'rework', label: 'Rework required' },
  { value: 'reinspection', label: 'Reinspection required' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function InspectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState('');
  const [review, setReview] = useState(searchParams.get('review_status') ?? ALL);
  const [subject, setSubject] = useState(ALL);

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (review !== ALL) params.set('review_status', review);
  if (subject !== ALL) params.set('subject_type', subject);
  const qs = params.toString();

  const inspections = useQuery({
    queryKey: [...farmKeys.qc, qs],
    queryFn: () => farmFetch<{ inspections: QcInspectionRow[] }>(`/api/farm/qc?${qs}`).then((r) => r.inspections),
  });
  const list = useMemo(() => inspections.data ?? [], [inspections.data]);
  const summary = useMemo(() => {
    const passed = list.filter((i) => i.result !== 'fail').length;
    return {
      awaiting: list.filter((i) => i.review_status === 'awaiting_review').length,
      rework: list.filter((i) => i.review_status === 'rework' && !i.rework_completed_at).length,
      passRate: list.length ? Math.round((passed / list.length) * 100) : null,
      failed: list.length - passed,
    };
  }, [list]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="QC Inspections"
        subtitle="Inspect harvest and packed batches against each crop's quality criteria. A supervisor approves, sends back for rework, or asks for reinspection."
        actions={
          can('qc.inspect') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New inspection
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Awaiting review" value={summary.awaiting} hint="Needs a supervisor decision" />
        <KpiCard label="Rework open" value={summary.rework} hint="Sent back, not yet reworked" />
        <KpiCard label="Pass rate" value={summary.passRate == null ? '—' : `${summary.passRate}%`} hint="Pass or conditional pass" />
        <KpiCard label="Failed" value={summary.failed} hint={`${list.length} inspections in view`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input type="date" className="w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
        <Select value={review} onValueChange={setReview}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All review statuses</SelectItem>
            {REVIEW_FILTERS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Harvest and packed</SelectItem>
            <SelectItem value="harvest_batch">Harvest batches</SelectItem>
            <SelectItem value="packing_batch">Packed batches</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {inspections.error ? (
        <ErrorState message={errorMessage(inspections.error)} onRetry={() => inspections.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inspection</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Checks</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Batch QC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : list.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title="No inspections match these filters"
                  description="Record an inspection against a graded harvest or a packed batch."
                  action={
                    can('qc.inspect') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New inspection
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                list.map((i) => {
                  const failed = i.checks.filter((c) => c.passed === false).length;
                  const batchStatus = i.packing?.qc_status ?? i.harvest?.qc_status;
                  return (
                    <TableRow key={i.id} className="cursor-pointer" onClick={() => router.push(`/quality/inspections/${i.id}`)}>
                      <TableCell>
                        <Link
                          href={`/quality/inspections/${i.id}`}
                          className="font-mono text-sm font-semibold text-brand-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {i.inspection_no}
                        </Link>
                        <p className="text-xs text-muted-foreground">{i.inspector?.full_name ?? '—'}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(i.inspection_date)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{i.packing?.packing_no ?? i.harvest?.batch_no}</span>
                        <p className="text-xs text-muted-foreground">
                          {i.crop?.name} · {i.subject_type === 'packing_batch' ? 'Packed' : 'Harvest'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={i.result} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {i.checks.length - failed}/{i.checks.length} passed
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          status={i.review_status}
                          label={i.review_status === 'rework' && i.rework_completed_at ? 'Rework done' : undefined}
                        />
                      </TableCell>
                      <TableCell>{batchStatus ? <QcStatusChip status={batchStatus} /> : '—'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <QcInspectionSheet open={creating} onOpenChange={setCreating} onSaved={(i) => router.push(`/quality/inspections/${i.id}`)} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="qc.view">
      <Suspense>
        <InspectionsPage />
      </Suspense>
    </RequirePermission>
  );
}
