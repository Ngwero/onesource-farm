'use client';

import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FormSheet } from '@/components/farm/FormSheet';
import { GradeDistribution } from '@/components/farm/GradeDistribution';
import { DateField, NumberField, SelectField, TextareaField } from '@/components/farm/fields';
import { farmKeys, useFarmUsers, useMasterList } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { fmtNumber, fmtPct, fmtQty, todayIso } from '@/lib/farm/format';
import { gradingStats } from '@/lib/farm/grading';
import { gradingSchema, optionLabel, type GradingInput } from '@/lib/farm/schemas';
import type { HarvestBatchDetail } from '@/lib/farm/types';

type Reason = { id: string; code: string; name: string; status: 'active' | 'inactive'; sort_order: number };

function toValues(batch: HarvestBatchDetail): GradingInput {
  const existing = new Map(batch.grading?.lines.map((l) => [l.grade_id, Number(l.quantity)]) ?? []);
  return {
    graded_date: batch.grading?.graded_date ?? todayIso(),
    inspector_id: batch.grading?.inspector_id ?? null,
    notes: batch.grading?.notes ?? '',
    lines: batch.crop_grades.map((g) => ({ grade_id: g.id, quantity: existing.get(g.id) ?? 0 })),
    rejections:
      batch.grading?.rejections.map((r) => ({ reason_id: r.reason_id, quantity: r.quantity == null ? null : Number(r.quantity) })) ?? [],
  };
}

type Props = { open: boolean; onOpenChange: (v: boolean) => void; batch: HarvestBatchDetail };

export function GradingSheet({ open, onOpenChange, batch }: Props) {
  const users = useFarmUsers();
  const reasons = useMasterList<Reason>('rejection-reasons');
  const form = useForm<GradingInput>({ resolver: zodResolver(gradingSchema), defaultValues: toValues(batch) });
  const lineFields = useFieldArray({ control: form.control, name: 'lines' });
  const rejectionFields = useFieldArray({ control: form.control, name: 'rejections' });

  useEffect(() => {
    if (open) form.reset(toValues(batch));
  }, [open, batch, form]);

  const [lines, rejections] = useWatch({ control: form.control, name: ['lines', 'rejections'] });
  const gradesById = useMemo(() => new Map(batch.crop_grades.map((g) => [g.id, g])), [batch.crop_grades]);
  const harvested = Number(batch.quantity);
  const stats = gradingStats(
    (lines ?? []).map((l) => ({ quantity: Number(l.quantity) || 0, grade: gradesById.get(l.grade_id) ?? null })),
    harvested
  );
  const difference = Math.round((harvested - stats.graded) * 1000) / 1000;
  const balanced = difference === 0;
  const selectedReasons = new Set((rejections ?? []).map((r) => r.reason_id));
  const reasonOptions = (reasons.data ?? []).filter((r) => r.status === 'active' || selectedReasons.has(r.id));

  function toggleReason(id: string, on: boolean) {
    if (on) rejectionFields.append({ reason_id: id, quantity: null });
    else {
      const index = (rejections ?? []).findIndex((r) => r.reason_id === id);
      if (index >= 0) rejectionFields.remove(index);
    }
  }

  const save = useFormMutation(
    form,
    (v) =>
      farmFetch(`/api/farm/harvests/${batch.id}/grading`, {
        method: 'PUT',
        body: { ...v, lines: v.lines.filter((l) => l.quantity > 0) },
      }),
    {
      success: batch.grading ? 'Grading updated' : 'Batch graded',
      invalidate: [farmKeys.harvests],
      onDone: () => onOpenChange(false),
    }
  );

  function onSubmit(v: GradingInput) {
    if (!balanced) {
      form.setError('root', {
        type: 'client',
        message: `Grades must add up to the harvested ${fmtQty(harvested, batch.unit)}; ${difference > 0 ? `${fmtNumber(difference, 3)} ${batch.unit} still to grade` : `${fmtNumber(-difference, 3)} ${batch.unit} too much`}.`,
      });
      return;
    }
    if (stats.rejected > 0 && !(v.rejections ?? []).length) {
      form.setError('root', { type: 'client', message: 'Select at least one rejection reason for the rejected quantity.' });
      return;
    }
    save.mutate(v);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Grade ${batch.batch_no}`}
      description={`Split the harvested ${fmtQty(harvested, batch.unit)} of ${batch.crop?.name ?? 'produce'} into grades. The grades must add up exactly to the harvested quantity.`}
      form={form}
      onSubmit={onSubmit}
      pending={save.isPending}
      submitLabel="Save grading"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField<GradingInput> name="graded_date" label="Graded on" required />
        <SelectField<GradingInput>
          name="inspector_id"
          label="Inspector"
          emptyLabel="Not recorded"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
      </div>

      <section className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-semibold">Grades</p>
        {lineFields.fields.length === 0 ? (
          <p className="text-sm text-destructive">
            No grades are enabled for {batch.crop?.name ?? 'this crop'}. Enable grades on the crop&apos;s Grading tab first.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lineFields.fields.map((f, i) => {
              const g = gradesById.get(f.grade_id);
              return (
                <NumberField<GradingInput>
                  key={f.id}
                  name={`lines.${i}.quantity`}
                  label={`${g?.name ?? 'Grade'}${g ? ` · ${optionLabel(g.purpose)}` : ''}`}
                  suffix={batch.unit}
                />
              );
            })}
          </div>
        )}
        <div
          className={
            balanced
              ? 'flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
              : 'flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800'
          }
        >
          {balanced ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          <span>
            Graded {fmtQty(stats.graded, batch.unit)} of {fmtQty(harvested, batch.unit)}
            {balanced
              ? ': balanced.'
              : difference > 0
                ? `, ${fmtNumber(difference, 3)} ${batch.unit} still to grade.`
                : `, ${fmtNumber(-difference, 3)} ${batch.unit} over.`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Exportable</p>
            <p className="font-semibold">
              {fmtPct(stats.exportablePct)} <span className="font-normal text-muted-foreground">· {fmtQty(stats.exportable, batch.unit)}</span>
            </p>
          </div>
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="font-semibold">
              {fmtPct(stats.rejectionPct)} <span className="font-normal text-muted-foreground">· {fmtQty(stats.rejected, batch.unit)}</span>
            </p>
          </div>
        </div>
        <GradeDistribution stats={stats} unit={batch.unit} />
      </section>

      <section className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-semibold">Rejection reasons</p>
          <p className="text-xs text-muted-foreground">
            {stats.rejected > 0 ? 'Required when any quantity is rejected.' : 'Select why produce was rejected, if any.'} Quantities per reason
            are optional.
          </p>
        </div>
        <ul className="divide-y rounded-md border">
          {reasonOptions.map((r) => {
            const index = (rejections ?? []).findIndex((x) => x.reason_id === r.id);
            const on = index >= 0;
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Checkbox checked={on} onCheckedChange={(v) => toggleReason(r.id, v === true)} id={`reason-${r.id}`} />
                <label htmlFor={`reason-${r.id}`} className="flex-1 cursor-pointer">
                  {r.name}
                </label>
                {on ? (
                  <div className="relative w-28">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      aria-label={`Quantity rejected for ${r.name}`}
                      value={rejections?.[index]?.quantity ?? ''}
                      onChange={(e) =>
                        form.setValue(`rejections.${index}.quantity`, e.target.value === '' ? null : e.target.valueAsNumber)
                      }
                      className="pr-9"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                      {batch.unit}
                    </span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <TextareaField<GradingInput> name="notes" label="Inspector notes" />
    </FormSheet>
  );
}
