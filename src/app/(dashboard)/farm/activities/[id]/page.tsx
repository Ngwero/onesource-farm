'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, ErrorState } from '@/components/farm/DataStates';
import { Detail } from '@/components/farm/Detail';
import { PhotoGallery } from '@/components/farm/PhotoGallery';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { ActivityFormSheet } from '@/components/farm/forms/ActivityFormSheet';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtQty } from '@/lib/farm/format';
import { optionLabel } from '@/lib/farm/schemas';
import type { ActivityRow } from '@/lib/farm/types';

function CostLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between border-t pt-2 font-semibold' : 'flex justify-between text-sm'}>
      <span className={strong ? undefined : 'text-muted-foreground'}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activity = useQuery({
    queryKey: farmKeys.activity(id),
    queryFn: () => farmFetch<{ activity: ActivityRow }>(`/api/farm/activities/${id}`).then((r) => r.activity),
  });

  const remove = useActionMutation(() => farmFetch(`/api/farm/activities/${id}`, { method: 'DELETE' }), {
    success: 'Activity deleted',
    invalidate: [farmKeys.activities, farmKeys.payroll],
    onDone: () => router.push('/farm/activities'),
  });

  if (activity.error) return <ErrorState message={errorMessage(activity.error)} onRetry={() => activity.refetch()} />;
  const a = activity.data;
  if (!a) return <div className="dashboard-loading">Loading activity…</div>;
  const hours = a.workers.reduce((s, w) => s + Number(w.hours_worked), 0);

  return (
    <div className="space-y-6">
      <Link href="/farm/activities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Activities
      </Link>

      <PageHeader
        title={a.activity_type?.name ?? 'Activity'}
        subtitle={`${fmtDate(a.activity_date)} · Block ${a.block?.code ?? ''}${a.crop ? ` · ${a.crop.name}` : ''}`}
        actions={
          <>
            {can('activities.record') ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
            ) : null}
            {can('activities.manage') ? (
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Detail
                label="Block"
                value={
                  a.block ? (
                    <Link href={`/farm/blocks/${a.block.id}`} className="text-brand-700 hover:underline">
                      {a.block.code} · {a.block.name}
                    </Link>
                  ) : null
                }
              />
              <Detail
                label="Planting"
                value={a.crop ? `${a.crop.name}, planted ${fmtDate(a.cycle?.planting_date)}` : 'Not linked'}
              />
              <Detail label="Category" value={a.activity_type ? optionLabel(a.activity_type.category) : null} />
              <Detail label="Supervisor" value={a.supervisor?.full_name} />
              <Detail label="Weather" value={a.weather} />
              <Detail label="Recorded" value={`${a.created_by_user?.full_name ?? '—'}, ${fmtDateTime(a.created_at)}`} />
            </dl>
            {a.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{a.notes}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CostLine label={`Registered workers (${fmtNumber(hours)} h)`} value={fmtMoney(a.worker_labour_cost, currency)} />
            <CostLine
              label={`Casual labour${Number(a.casual_labour_days) ? ` (${fmtNumber(a.casual_labour_days)} days)` : ''}`}
              value={fmtMoney(a.other_labour_cost, currency)}
            />
            <CostLine label="Inputs" value={fmtMoney(a.input_cost, currency)} />
            <CostLine label="Other" value={fmtMoney(a.other_cost, currency)} />
            <CostLine label="Total" value={fmtMoney(a.total_cost, currency)} strong />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workers</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Worker</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate / h</TableHead>
                  <TableHead className="pr-6 text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.workers.length === 0 ? (
                  <EmptyRow columns={4} title="No registered workers" />
                ) : (
                  a.workers.map((w) => (
                    <TableRow key={w.worker_id}>
                      <TableCell className="pl-6">
                        <Link href={`/workforce/workers/${w.worker_id}`} className="font-medium text-brand-700 hover:underline">
                          {w.worker?.full_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{w.worker?.worker_code}</p>
                      </TableCell>
                      <TableCell className="text-right">{fmtNumber(w.hours_worked)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(w.hourly_rate, currency)}</TableCell>
                      <TableCell className="pr-6 text-right whitespace-nowrap">{fmtMoney(w.cost, currency)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inputs applied</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="pr-6 text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.inputs.length === 0 ? (
                  <EmptyRow columns={4} title="No inputs recorded" />
                ) : (
                  [...a.inputs]
                    .sort((x, y) => x.sort_order - y.sort_order)
                    .map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="pl-6 font-medium">{i.input_name}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtQty(i.quantity, i.unit)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{i.unit_cost == null ? '—' : fmtMoney(i.unit_cost, currency)}</TableCell>
                        <TableCell className="pr-6 text-right whitespace-nowrap">{fmtMoney(i.cost, currency)}</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <PhotoGallery entityType="farm_activity" entityId={a.id} canEdit={can('activities.record')} />

      <ActivityFormSheet open={editing} onOpenChange={setEditing} activity={a} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this activity?"
        description="Its labour and input costs are removed from block and payroll costing, and its photos are deleted."
        confirmLabel="Delete activity"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="activities.view">
      <ActivityDetailPage />
    </RequirePermission>
  );
}
