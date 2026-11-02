'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useCurrency, useFarmUsers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import {
  PAY_BASES,
  WORKER_CATEGORIES,
  WORKER_STATUSES,
  optionLabel,
  workerSchema,
  type WorkerInput,
} from '@/lib/farm/schemas';
import type { WorkerRow } from '@/lib/farm/types';

const EMPTY: WorkerInput = {
  worker_code: '',
  full_name: '',
  phone: '',
  national_id: '',
  category: 'casual',
  job_role: '',
  supervisor_id: null,
  status: 'active',
  start_date: null,
  end_date: null,
  pay_basis: 'daily',
  daily_rate: null,
  monthly_salary: null,
  overtime_rate: 0,
  notes: '',
};

function toValues(worker?: WorkerRow | null): WorkerInput {
  if (!worker) return EMPTY;
  return {
    worker_code: worker.worker_code,
    full_name: worker.full_name,
    phone: worker.phone ?? '',
    national_id: worker.national_id ?? '',
    category: worker.category,
    job_role: worker.job_role ?? '',
    supervisor_id: worker.supervisor_id,
    status: worker.status,
    start_date: worker.start_date,
    end_date: worker.end_date,
    pay_basis: worker.pay_basis,
    daily_rate: worker.daily_rate == null ? null : Number(worker.daily_rate),
    monthly_salary: worker.monthly_salary == null ? null : Number(worker.monthly_salary),
    overtime_rate: Number(worker.overtime_rate),
    notes: worker.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  worker?: WorkerRow | null;
  onSaved?: (worker: WorkerRow) => void;
};

export function WorkerFormSheet({ open, onOpenChange, worker, onSaved }: Props) {
  const users = useFarmUsers();
  const currency = useCurrency();
  const form = useForm<WorkerInput>({ resolver: zodResolver(workerSchema), defaultValues: toValues(worker) });
  const payBasis = useWatch({ control: form.control, name: 'pay_basis' });

  useEffect(() => {
    if (open) form.reset(toValues(worker));
  }, [open, worker, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ worker: WorkerRow }>(worker ? `/api/farm/workers/${worker.id}` : '/api/farm/workers', {
        method: worker ? 'PATCH' : 'POST',
        body: {
          ...values,
          daily_rate: values.pay_basis === 'daily' ? values.daily_rate : null,
          monthly_salary: values.pay_basis === 'monthly' ? values.monthly_salary : null,
        },
      }),
    {
      success: worker ? 'Worker updated' : 'Worker added',
      invalidate: [farmKeys.workers, farmKeys.attendance],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.worker);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={worker ? `Edit ${worker.full_name}` : 'New worker'}
      description="Permanent staff and casual labourers. Pay rates are used to cost labour on activities and harvests."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={worker ? 'Save changes' : 'Add worker'}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField<WorkerInput> name="worker_code" label="Worker ID" required uppercase placeholder="W-001" />
        <TextField<WorkerInput> name="full_name" label="Full name" required className="sm:col-span-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<WorkerInput> name="phone" label="Phone" placeholder="+256…" />
        <TextField<WorkerInput> name="national_id" label="National ID" />
        <SelectField<WorkerInput>
          name="category"
          label="Category"
          required
          options={WORKER_CATEGORIES.map((c) => ({ value: c, label: optionLabel(c) }))}
        />
        <TextField<WorkerInput> name="job_role" label="Job role" placeholder="Picker, sprayer…" />
        <SelectField<WorkerInput>
          name="supervisor_id"
          label="Supervisor"
          emptyLabel="Not assigned"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
        <SelectField<WorkerInput>
          name="status"
          label="Status"
          required
          options={WORKER_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
        />
        <DateField<WorkerInput> name="start_date" label="Start date" />
        <DateField<WorkerInput> name="end_date" label="End date" />
      </div>

      <div className="space-y-4 rounded-lg border p-3">
        <p className="text-sm font-semibold">Pay</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField<WorkerInput>
            name="pay_basis"
            label="Paid"
            required
            options={PAY_BASES.map((p) => ({ value: p, label: p === 'daily' ? 'Per day worked' : 'Monthly salary' }))}
          />
          {payBasis === 'daily' ? (
            <NumberField<WorkerInput> name="daily_rate" label="Daily rate" required suffix={currency} />
          ) : (
            <NumberField<WorkerInput> name="monthly_salary" label="Monthly salary" required suffix={currency} />
          )}
          <NumberField<WorkerInput>
            name="overtime_rate"
            label="Overtime rate per hour"
            required
            suffix={currency}
            description="Use 0 if overtime is not paid."
          />
        </div>
      </div>
      <TextareaField<WorkerInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
