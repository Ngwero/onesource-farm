'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Banknote, Calculator, Loader2, Lock, Pencil, Trash2, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, ErrorState } from '@/components/farm/DataStates';
import { FormSheet } from '@/components/farm/FormSheet';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { NumberField, TextareaField } from '@/components/farm/fields';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation, useFormMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtNumber, todayIso } from '@/lib/farm/format';
import { optionLabel, payrollLineSchema, type PayrollLineInput } from '@/lib/farm/schemas';
import type { LabourAllocation, PayrollLineRow, PayrollPeriodRow } from '@/lib/farm/types';

type PeriodDetail = {
  period: Omit<PayrollPeriodRow, 'line_count' | 'total_payable' | 'total_paid'>;
  lines: PayrollLineRow[];
  allocation: LabourAllocation[];
};

const sum = <T,>(rows: T[], pick: (r: T) => number | string | null) => rows.reduce((s, r) => s + Number(pick(r) ?? 0), 0);

function LineSheet({
  line,
  periodId,
  onOpenChange,
}: {
  line: PayrollLineRow | null;
  periodId: string;
  onOpenChange: (v: boolean) => void;
}) {
  const currency = useCurrency();
  const form = useForm<PayrollLineInput>({
    resolver: zodResolver(payrollLineSchema),
    defaultValues: { advances: 0, deductions: 0, notes: '' },
  });

  useEffect(() => {
    if (line) form.reset({ advances: Number(line.advances), deductions: Number(line.deductions), notes: line.notes ?? '' });
  }, [line, form]);

  const save = useFormMutation(
    form,
    (v) => farmFetch(`/api/farm/payroll/lines/${line!.id}`, { method: 'PATCH', body: v }),
    { success: 'Payroll line updated', invalidate: [farmKeys.payrollPeriod(periodId), farmKeys.payroll], onDone: () => onOpenChange(false) }
  );

  return (
    <FormSheet
      open={Boolean(line)}
      onOpenChange={onOpenChange}
      title={line ? `Adjust ${line.worker?.full_name}` : 'Adjust line'}
      description={
        line
          ? `Gross pay ${fmtMoney(Number(line.base_pay) + Number(line.overtime_pay), currency)}. Advances already paid and other deductions reduce the amount payable.`
          : undefined
      }
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel="Save"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField<PayrollLineInput> name="advances" label="Advances" required suffix={currency} />
        <NumberField<PayrollLineInput> name="deductions" label="Other deductions" required suffix={currency} />
      </div>
      <TextareaField<PayrollLineInput> name="notes" label="Notes" placeholder="Reason for deductions" />
    </FormSheet>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  count,
  total,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  total: string;
  pending: boolean;
  onConfirm: (paidAt: string, reference: string) => void;
}) {
  const [paidAt, setPaidAt] = useState(todayIso());
  const [reference, setReference] = useState('');
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Mark {count} worker{count === 1 ? '' : 's'} as paid ({total}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paid-at">Payment date</Label>
            <Input id="paid-at" type="date" value={paidAt} max={todayIso()} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-ref">Reference</Label>
            <Input
              id="pay-ref"
              placeholder="Mobile money batch, cheque or voucher no."
              maxLength={80}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(paidAt, reference.trim())} disabled={pending || !paidAt}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Mark paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayrollPeriodPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const canManage = can('payroll.manage');
  const [editingLine, setEditingLine] = useState<PayrollLineRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState<'finalize' | 'reopen' | 'delete' | null>(null);

  const detail = useQuery({
    queryKey: farmKeys.payrollPeriod(id),
    queryFn: () => farmFetch<PeriodDetail>(`/api/farm/payroll/${id}`),
  });
  const invalidate = [farmKeys.payrollPeriod(id), farmKeys.payroll];

  const action = useActionMutation(
    (a: 'recalculate' | 'finalize' | 'reopen') => farmFetch(`/api/farm/payroll/${id}`, { method: 'PATCH', body: { action: a } }),
    {
      success: 'Payroll updated',
      invalidate,
      onDone: () => setConfirm(null),
    }
  );
  const remove = useActionMutation(() => farmFetch(`/api/farm/payroll/${id}`, { method: 'DELETE' }), {
    success: 'Payroll period deleted',
    invalidate: [farmKeys.payroll],
    onDone: () => router.push('/workforce/payroll'),
  });
  const pay = useActionMutation(
    (body: { line_ids: string[]; paid: boolean; paid_at?: string; payment_reference?: string }) =>
      farmFetch(`/api/farm/payroll/${id}/payments`, { method: 'PUT', body }),
    {
      success: 'Payments updated',
      invalidate,
      onDone: () => {
        setPaying(false);
        setSelected(new Set());
      },
    }
  );

  const lines = useMemo(() => detail.data?.lines ?? [], [detail.data]);
  const allocation = detail.data?.allocation ?? [];
  const totals = useMemo(
    () => ({
      base: sum(lines, (l) => l.base_pay),
      overtime: sum(lines, (l) => l.overtime_pay),
      advances: sum(lines, (l) => l.advances),
      deductions: sum(lines, (l) => l.deductions),
      payable: sum(lines, (l) => l.amount_payable),
      paid: sum(lines.filter((l) => l.payment_status === 'paid'), (l) => l.amount_payable),
      days: sum(lines, (l) => l.days_present),
    }),
    [lines]
  );

  if (detail.error) return <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />;
  if (!detail.data) return <div className="dashboard-loading">Loading payroll…</div>;
  const { period } = detail.data;
  const isDraft = period.status === 'draft';
  const selectable = canManage && !isDraft;
  const selectedLines = lines.filter((l) => selected.has(l.id));
  const selectedUnpaid = selectedLines.filter((l) => l.payment_status === 'unpaid');
  const selectedPaid = selectedLines.filter((l) => l.payment_status === 'paid');
  const allSelected = lines.length > 0 && selected.size === lines.length;
  const allocationTotal = sum(allocation, (a) => a.cost);

  function toggle(lineId: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(lineId);
      else next.delete(lineId);
      return next;
    });
  }

  const columns = 10 + (selectable ? 1 : 0) + (canManage && isDraft ? 1 : 0);

  return (
    <div className="space-y-6">
      <Link href="/workforce/payroll" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Payroll Costing
      </Link>

      <PageHeader
        title={period.name}
        meta={<StatusChip status={period.status} />}
        subtitle={`${fmtDate(period.period_start)} – ${fmtDate(period.period_end)}`}
        actions={
          canManage ? (
            isDraft ? (
              <>
                <Button variant="outline" onClick={() => setConfirm('delete')}>
                  <Trash2 className="size-4" /> Delete
                </Button>
                <Button variant="outline" onClick={() => action.mutate('recalculate')} disabled={action.isPending}>
                  {action.isPending && action.variables === 'recalculate' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Calculator className="size-4" />
                  )}
                  Recalculate
                </Button>
                <Button onClick={() => setConfirm('finalize')} disabled={!lines.length}>
                  <Lock className="size-4" /> Finalize
                </Button>
              </>
            ) : period.status === 'finalized' ? (
              <Button variant="outline" onClick={() => setConfirm('reopen')}>
                <Undo2 className="size-4" /> Reopen
              </Button>
            ) : null
          ) : null
        }
      />

      {isDraft ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Draft: recalculate after correcting attendance or pay rates; advances and deductions are kept. Finalize to lock
          the amounts and start recording payments.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Gross pay" value={fmtMoney(totals.base + totals.overtime, currency)} hint={`Includes ${fmtMoney(totals.overtime, currency)} overtime`} />
        <KpiCard label="Advances & deductions" value={fmtMoney(totals.advances + totals.deductions, currency)} />
        <KpiCard label="Net payable" value={fmtMoney(totals.payable, currency)} hint={`${lines.length} workers · ${fmtNumber(totals.days)} days worked`} />
        <KpiCard label="Paid" value={fmtMoney(totals.paid, currency)} hint={`Outstanding ${fmtMoney(totals.payable - totals.paid, currency)}`} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Worker pay</CardTitle>
          {selectable && selected.size ? (
            <div className="flex gap-2">
              {selectedPaid.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pay.mutate({ line_ids: selectedPaid.map((l) => l.id), paid: false })}
                  disabled={pay.isPending}
                >
                  Mark {selectedPaid.length} unpaid
                </Button>
              ) : null}
              {selectedUnpaid.length ? (
                <Button size="sm" onClick={() => setPaying(true)} disabled={pay.isPending}>
                  <Banknote className="size-4" /> Record payment ({selectedUnpaid.length})
                </Button>
              ) : null}
            </div>
          ) : selectable ? (
            <p className="text-xs text-muted-foreground">Select workers to record payment.</p>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable ? (
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(lines.map((l) => l.id)) : new Set())}
                      aria-label="Select all"
                    />
                  </TableHead>
                ) : null}
                <TableHead className={selectable ? undefined : 'pl-6'}>Worker</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Base pay</TableHead>
                <TableHead className="text-right">Overtime</TableHead>
                <TableHead className="text-right">Advances</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Notes</TableHead>
                {canManage && isDraft ? <TableHead className="pr-6 text-right">Adjust</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <EmptyRow
                  columns={columns}
                  title="No workers in this period"
                  description="Lines are created for active workers with attendance or a monthly salary. Record attendance, then recalculate."
                />
              ) : (
                lines.map((l) => (
                  <TableRow key={l.id}>
                    {selectable ? (
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selected.has(l.id)}
                          onCheckedChange={(v) => toggle(l.id, v === true)}
                          aria-label={`Select ${l.worker?.full_name}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className={selectable ? undefined : 'pl-6'}>
                      <Link href={`/workforce/workers/${l.worker_id}`} className="font-medium text-brand-700 hover:underline">
                        {l.worker?.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {l.worker?.worker_code} · {optionLabel(l.worker?.category ?? '')}
                      </p>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {fmtMoney(l.rate, currency)}
                      <p className="text-xs text-muted-foreground">{l.pay_basis === 'daily' ? 'per day' : 'per month'}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtNumber(l.days_present)}
                      {Number(l.leave_days) ? <p className="text-xs text-muted-foreground">{fmtNumber(l.leave_days)} leave</p> : null}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtMoney(l.base_pay, currency)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {Number(l.overtime_pay) ? fmtMoney(l.overtime_pay, currency) : '—'}
                      {Number(l.overtime_hours) ? (
                        <p className="text-xs text-muted-foreground">
                          {fmtNumber(l.overtime_hours)} h × {fmtNumber(l.overtime_rate)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{Number(l.advances) ? fmtMoney(l.advances, currency) : '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{Number(l.deductions) ? fmtMoney(l.deductions, currency) : '—'}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{fmtMoney(l.amount_payable, currency)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusChip status={l.payment_status} />
                      {l.paid_at ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {fmtDate(l.paid_at)}
                          {l.payment_reference ? ` · ${l.payment_reference}` : ''}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-48 text-xs text-muted-foreground">{l.notes || '—'}</TableCell>
                    {canManage && isDraft ? (
                      <TableCell className="pr-6 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditingLine(l)} aria-label="Adjust line">
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
            {lines.length ? (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={selectable ? 3 : 2} className="pl-6 font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right">{fmtNumber(totals.days)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(totals.base, currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(totals.overtime, currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(totals.advances, currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(totals.deductions, currency)}</TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">{fmtMoney(totals.payable, currency)}</TableCell>
                  <TableCell colSpan={canManage && isDraft ? 3 : 2} />
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Labour cost by block, crop and activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Labour recorded on activities and harvests dated in this period, at each worker&apos;s hourly cost plus casual and
            other labour entered on the record. Labour not logged against a record does not appear here, so this can be lower
            than gross pay.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Block</TableHead>
                <TableHead>Crop</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead className="text-right">Worker hours</TableHead>
                <TableHead className="pr-6 text-right">Labour cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocation.length === 0 ? (
                <EmptyRow columns={5} title="No labour costed to activities or harvests in this period" />
              ) : (
                allocation.map((a) => (
                  <TableRow key={`${a.source}-${a.block}-${a.crop}-${a.activity}`}>
                    <TableCell className="pl-6 font-medium">{a.block}</TableCell>
                    <TableCell>{a.crop ?? '—'}</TableCell>
                    <TableCell>{a.activity}</TableCell>
                    <TableCell className="text-right">{fmtNumber(a.hours)}</TableCell>
                    <TableCell className="pr-6 text-right whitespace-nowrap">{fmtMoney(a.cost, currency)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {allocation.length ? (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="pl-6 font-semibold">
                    Total costed labour
                  </TableCell>
                  <TableCell className="text-right">{fmtNumber(sum(allocation, (a) => a.hours))}</TableCell>
                  <TableCell className="pr-6 text-right font-semibold whitespace-nowrap">{fmtMoney(allocationTotal, currency)}</TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </CardContent>
      </Card>

      <LineSheet line={editingLine} periodId={id} onOpenChange={(open) => !open && setEditingLine(null)} />
      <PaymentDialog
        key={paying ? 'open' : 'closed'}
        open={paying}
        onOpenChange={setPaying}
        count={selectedUnpaid.length}
        total={fmtMoney(sum(selectedUnpaid, (l) => l.amount_payable), currency)}
        pending={pay.isPending}
        onConfirm={(paidAt, reference) =>
          pay.mutate({ line_ids: selectedUnpaid.map((l) => l.id), paid: true, paid_at: paidAt, payment_reference: reference || undefined })
        }
      />
      <ConfirmDialog
        open={confirm === 'finalize'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Finalize ${period.name}?`}
        description="Amounts are locked and payments can be recorded. You can reopen it later if no one has been paid yet."
        confirmLabel="Finalize"
        pending={action.isPending}
        onConfirm={() => action.mutate('finalize')}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Reopen ${period.name}?`}
        description="The period goes back to draft so amounts can be recalculated or adjusted."
        confirmLabel="Reopen"
        pending={action.isPending}
        onConfirm={() => action.mutate('reopen')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${period.name}?`}
        description="The period and its calculated lines are removed. Attendance records are not affected."
        confirmLabel="Delete period"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="payroll.view">
      <PayrollPeriodPage />
    </RequirePermission>
  );
}
