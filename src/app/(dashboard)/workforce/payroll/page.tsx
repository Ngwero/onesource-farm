'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { FormSheet } from '@/components/farm/FormSheet';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { DateField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useFormMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney } from '@/lib/farm/format';
import { payrollPeriodSchema, type PayrollPeriodInput } from '@/lib/farm/schemas';
import type { PayrollPeriodRow } from '@/lib/farm/types';

const COLUMNS = 6;

function defaultPeriod(latest?: PayrollPeriodRow): PayrollPeriodInput {
  // Suggest the month after the latest period, or last month if there is none.
  const base = latest ? new Date(`${latest.period_end}T00:00:00`) : subMonths(new Date(), 1);
  const month = latest ? startOfMonth(new Date(base.getFullYear(), base.getMonth() + 1, 1)) : startOfMonth(base);
  return {
    name: format(month, 'MMMM yyyy'),
    period_start: format(month, 'yyyy-MM-dd'),
    period_end: format(endOfMonth(month), 'yyyy-MM-dd'),
    notes: '',
  };
}

function NewPeriodSheet({
  open,
  onOpenChange,
  latest,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  latest?: PayrollPeriodRow;
}) {
  const router = useRouter();
  const form = useForm<PayrollPeriodInput>({ resolver: zodResolver(payrollPeriodSchema), defaultValues: defaultPeriod(latest) });

  useEffect(() => {
    if (open) form.reset(defaultPeriod(latest));
  }, [open, latest, form]);

  const save = useFormMutation(form, (v) => farmFetch<{ id: string }>('/api/farm/payroll', { method: 'POST', body: v }), {
    success: 'Payroll period created',
    invalidate: [farmKeys.payroll],
    onDone: (r) => {
      onOpenChange(false);
      router.push(`/workforce/payroll/${r.id}`);
    },
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New payroll period"
      description="Pay is calculated from attendance: daily workers by days present, salaried staff pro rata, plus overtime."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel="Create and calculate"
    >
      <TextField<PayrollPeriodInput> name="name" label="Name" required placeholder="October 2026" />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField<PayrollPeriodInput> name="period_start" label="From" required />
        <DateField<PayrollPeriodInput> name="period_end" label="To" required />
      </div>
      <TextareaField<PayrollPeriodInput> name="notes" label="Notes" />
    </FormSheet>
  );
}

function PayrollPage() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const [creating, setCreating] = useState(false);

  const periods = useQuery({
    queryKey: farmKeys.payroll,
    queryFn: () => farmFetch<{ periods: PayrollPeriodRow[] }>('/api/farm/payroll').then((r) => r.periods),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll Costing"
        subtitle="Labour cost per pay period, what each worker is owed, and where the labour was spent."
        actions={
          can('payroll.manage') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New period
            </Button>
          ) : null
        }
      />

      {periods.error ? (
        <ErrorState message={errorMessage(periods.error)} onRetry={() => periods.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Workers</TableHead>
                <TableHead className="text-right">Total payable</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : !periods.data?.length ? (
                <EmptyRow
                  columns={COLUMNS}
                  title="No payroll periods yet"
                  description="Create a period once attendance has been recorded for it."
                  action={
                    can('payroll.manage') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New period
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                periods.data.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/workforce/payroll/${p.id}`)}>
                    <TableCell>
                      <Link
                        href={`/workforce/payroll/${p.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
                    </TableCell>
                    <TableCell className="text-right">{p.line_count}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtMoney(p.total_payable, currency)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtMoney(p.total_paid, currency)}</TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <NewPeriodSheet open={creating} onOpenChange={setCreating} latest={periods.data?.[0]} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="payroll.view">
      <PayrollPage />
    </RequirePermission>
  );
}
