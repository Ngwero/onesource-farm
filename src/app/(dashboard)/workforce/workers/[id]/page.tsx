'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, ErrorState } from '@/components/farm/DataStates';
import { Detail } from '@/components/farm/Detail';
import { KpiCard } from '@/components/farm/KpiCard';
import { PhotoGallery } from '@/components/farm/PhotoGallery';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { WorkerFormSheet } from '@/components/farm/forms/WorkerFormSheet';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtQty } from '@/lib/farm/format';
import { optionLabel } from '@/lib/farm/schemas';
import type { TaskRow, WorkerRow } from '@/lib/farm/types';

type WorkerDetail = {
  worker: WorkerRow;
  attendance: { attendance_date: string; status: string; hours_worked: number | null; overtime_hours: number; notes: string | null }[];
  tasks: TaskRow[];
  activityLabour: {
    hours_worked: number;
    cost: number;
    activity: { id: string; activity_date: string; block: { code: string } | null; activity_type: { name: string } | null } | null;
  }[];
  harvestLabour: {
    hours_worked: number;
    cost: number;
    quantity_picked: number | null;
    batch: { id: string; batch_no: string; harvest_date: string; unit: string } | null;
  }[];
};

function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const canManage = can('workforce.manage');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const detail = useQuery({
    queryKey: farmKeys.worker(id),
    queryFn: () => farmFetch<WorkerDetail>(`/api/farm/workers/${id}`),
  });

  const remove = useActionMutation(() => farmFetch(`/api/farm/workers/${id}`, { method: 'DELETE' }), {
    success: 'Worker deleted',
    invalidate: [farmKeys.workers],
    onDone: () => router.push('/workforce/workers'),
  });

  const summary = useMemo(() => {
    const att = detail.data?.attendance ?? [];
    return {
      present: att.filter((a) => a.status === 'present').length,
      absent: att.filter((a) => a.status === 'absent').length,
      overtime: att.reduce((s, a) => s + Number(a.overtime_hours ?? 0), 0),
      labourCost:
        (detail.data?.activityLabour ?? []).reduce((s, l) => s + Number(l.cost), 0) +
        (detail.data?.harvestLabour ?? []).reduce((s, l) => s + Number(l.cost), 0),
    };
  }, [detail.data]);

  const labour = useMemo(() => {
    const rows = [
      ...(detail.data?.activityLabour ?? []).map((l) => ({
        key: `a-${l.activity?.id}`,
        date: l.activity?.activity_date ?? '',
        what: l.activity?.activity_type?.name ?? 'Activity',
        where: l.activity?.block?.code ?? '—',
        href: l.activity ? `/farm/activities/${l.activity.id}` : null,
        picked: null as string | null,
        hours: Number(l.hours_worked),
        cost: Number(l.cost),
      })),
      ...(detail.data?.harvestLabour ?? []).map((l) => ({
        key: `h-${l.batch?.id}`,
        date: l.batch?.harvest_date ?? '',
        what: 'Harvest',
        where: l.batch?.batch_no ?? '—',
        href: l.batch ? `/harvest/batches/${l.batch.id}` : null,
        picked: l.quantity_picked == null ? null : fmtQty(l.quantity_picked, l.batch?.unit),
        hours: Number(l.hours_worked),
        cost: Number(l.cost),
      })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [detail.data]);

  if (detail.error) return <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />;
  if (!detail.data) return <div className="dashboard-loading">Loading worker…</div>;
  const { worker: w, attendance, tasks } = detail.data;

  return (
    <div className="space-y-6">
      <Link href="/workforce/workers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Workers
      </Link>

      <PageHeader
        title={w.full_name}
        meta={<StatusChip status={w.status} />}
        subtitle={`${w.worker_code} · ${optionLabel(w.category)}${w.job_role ? ` · ${w.job_role}` : ''}`}
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Days present" value={summary.present} hint="Last 90 days" />
        <KpiCard label="Days absent" value={summary.absent} hint="Last 90 days" />
        <KpiCard label="Overtime" value={`${fmtNumber(summary.overtime)} h`} hint="Last 90 days" />
        <KpiCard label="Labour costed" value={fmtMoney(summary.labourCost, currency)} hint="Activities and harvests, 90 days" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Phone" value={w.phone} />
              <Detail label="National ID" value={w.national_id} />
              <Detail label="Supervisor" value={w.supervisor?.full_name} />
              <Detail label="Started" value={fmtDate(w.start_date)} />
              <Detail label="Ended" value={w.end_date ? fmtDate(w.end_date) : null} />
              <Detail
                label="Pay"
                value={
                  w.pay_basis === 'daily'
                    ? `${fmtMoney(w.daily_rate, currency)} / day`
                    : `${fmtMoney(w.monthly_salary, currency)} / month`
                }
              />
              <Detail label="Overtime rate" value={`${fmtMoney(w.overtime_rate, currency)} / h`} />
              <Detail label="Cost per hour" value={fmtMoney(w.hourly_rate, currency)} />
            </dl>
            {w.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{w.notes}</p> : null}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="labour">
            <TabsList>
              <TabsTrigger value="labour">Labour costed</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>
            <TabsContent value="labour">
              <div className="data-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Work</TableHead>
                      <TableHead>Block / batch</TableHead>
                      <TableHead className="text-right">Picked</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labour.length === 0 ? (
                      <EmptyRow columns={6} title="No labour recorded in the last 90 days" />
                    ) : (
                      labour.map((l) => (
                        <TableRow key={l.key}>
                          <TableCell className="whitespace-nowrap">{fmtDate(l.date)}</TableCell>
                          <TableCell>
                            {l.href ? (
                              <Link href={l.href} className="font-medium text-brand-700 hover:underline">
                                {l.what}
                              </Link>
                            ) : (
                              l.what
                            )}
                          </TableCell>
                          <TableCell>{l.where}</TableCell>
                          <TableCell className="text-right">{l.picked ?? '—'}</TableCell>
                          <TableCell className="text-right">{fmtNumber(l.hours)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{fmtMoney(l.cost, currency)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="attendance">
              <div className="data-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Overtime</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <EmptyRow columns={5} title="No attendance in the last 90 days" />
                    ) : (
                      attendance.map((a) => (
                        <TableRow key={a.attendance_date}>
                          <TableCell className="whitespace-nowrap">{fmtDate(a.attendance_date)}</TableCell>
                          <TableCell>
                            <StatusChip status={a.status} />
                          </TableCell>
                          <TableCell className="text-right">{fmtNumber(a.hours_worked)}</TableCell>
                          <TableCell className="text-right">{Number(a.overtime_hours) ? fmtNumber(a.overtime_hours) : '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{a.notes || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="tasks">
              <div className="data-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Block</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead className="text-right">Achieved / target</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.length === 0 ? (
                      <EmptyRow columns={5} title="No tasks assigned" />
                    ) : (
                      tasks.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.activity_type?.name}</TableCell>
                          <TableCell>{t.block?.code ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDateTime(t.start_at)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {t.target_quantity != null
                              ? `${fmtNumber(t.achieved_quantity ?? 0)} / ${fmtQty(t.target_quantity, t.quantity_unit)}`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusChip status={t.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PhotoGallery entityType="worker" entityId={w.id} canEdit={canManage} title="Documents & photos" />

      <WorkerFormSheet open={editing} onOpenChange={setEditing} worker={w} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${w.full_name}?`}
        description="Workers with attendance, tasks or costed labour cannot be deleted — mark them inactive or terminated instead."
        confirmLabel="Delete worker"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="workforce.view">
      <WorkerDetailPage />
    </RequirePermission>
  );
}
