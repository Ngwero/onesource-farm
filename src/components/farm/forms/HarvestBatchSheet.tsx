'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField } from '@/components/farm/fields';
import { farmKeys, useCurrency, useFarmUsers, useOpenCycles, useWorkers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtNumber, fmtQty, todayIso } from '@/lib/farm/format';
import { harvestBatchSchema, type HarvestBatchInput } from '@/lib/farm/schemas';
import type { HarvestBatchRow } from '@/lib/farm/types';

function toValues(batch?: HarvestBatchRow | null, defaults?: Partial<HarvestBatchInput>): HarvestBatchInput {
  if (!batch) {
    return {
      planting_cycle_id: '',
      harvest_date: todayIso(),
      supervisor_id: null,
      quantity: null as unknown as number,
      casual_labour_days: 0,
      other_labour_cost: 0,
      notes: '',
      workers: [],
      ...defaults,
    };
  }
  return {
    planting_cycle_id: batch.planting_cycle_id,
    harvest_date: batch.harvest_date,
    supervisor_id: batch.supervisor_id,
    quantity: Number(batch.quantity),
    casual_labour_days: Number(batch.casual_labour_days),
    other_labour_cost: Number(batch.other_labour_cost),
    notes: batch.notes ?? '',
    workers: batch.workers.map((w) => ({
      worker_id: w.worker_id,
      hours_worked: Number(w.hours_worked),
      quantity_picked: w.quantity_picked == null ? null : Number(w.quantity_picked),
    })),
  };
}

function NumberCell({ name, label, suffix }: { name: `workers.${number}.hours_worked` | `workers.${number}.quantity_picked`; label: string; suffix: string }) {
  return (
    <FormField<HarvestBatchInput>
      name={name}
      render={({ field }) => (
        <FormItem className="w-28">
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                aria-label={label}
                value={(field.value as number | null) ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)}
                className="pr-9"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">{suffix}</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch?: HarvestBatchRow | null;
  defaults?: Partial<HarvestBatchInput>;
  onSaved?: (batch: HarvestBatchRow) => void;
};

export function HarvestBatchSheet({ open, onOpenChange, batch, defaults, onSaved }: Props) {
  const users = useFarmUsers();
  const workers = useWorkers();
  const cycles = useOpenCycles();
  const currency = useCurrency();
  const form = useForm<HarvestBatchInput>({ resolver: zodResolver(harvestBatchSchema), defaultValues: toValues(batch, defaults) });
  const pickers = useFieldArray({ control: form.control, name: 'workers' });
  const graded = batch?.status === 'graded';

  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);
  useEffect(() => {
    if (open) form.reset(toValues(batch, defaultsRef.current));
  }, [open, batch, form]);

  const [cycleId, watchedPickers, otherLabour] = useWatch({
    control: form.control,
    name: ['planting_cycle_id', 'workers', 'other_labour_cost'],
  });

  const cycleOptions = (cycles.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.block?.code ?? ''} · ${c.crop?.name ?? ''}${c.variety ? ` (${c.variety.name})` : ''}, planted ${fmtDate(c.planting_date)}`,
  }));
  if (batch && !cycleOptions.some((o) => o.value === batch.planting_cycle_id)) {
    cycleOptions.unshift({
      value: batch.planting_cycle_id,
      label: `${batch.block?.code ?? ''} · ${batch.crop?.name ?? ''}, planted ${fmtDate(batch.cycle?.planting_date)}`,
    });
  }
  const cycle = cycles.data?.find((c) => c.id === cycleId);
  const unit = cycle?.yield_unit ?? batch?.unit ?? 'kg';

  const rates = useMemo(() => {
    const map = new Map((workers.data ?? []).map((w) => [w.id, Number(w.hourly_rate)]));
    for (const w of batch?.workers ?? []) map.set(w.worker_id, Number(w.hourly_rate));
    return map;
  }, [workers.data, batch]);
  const labour = (watchedPickers ?? []).reduce((s, w) => s + (rates.get(w.worker_id) ?? 0) * Number(w.hours_worked || 0), 0);
  const picked = (watchedPickers ?? []).reduce((s, w) => s + Number(w.quantity_picked || 0), 0);

  const chosen = new Set((watchedPickers ?? []).map((w) => w.worker_id));
  const available = (workers.data ?? []).filter((w) => w.status === 'active' && !chosen.has(w.id));
  const workerName = (id: string) => {
    const w = workers.data?.find((x) => x.id === id);
    return w ? `${w.full_name} (${w.worker_code})` : 'Worker';
  };

  const save = useFormMutation(
    form,
    (v) =>
      farmFetch<{ batch: HarvestBatchRow }>(batch ? `/api/farm/harvests/${batch.id}` : '/api/farm/harvests', {
        method: batch ? 'PATCH' : 'POST',
        body: v,
      }),
    {
      success: batch ? 'Harvest batch updated' : 'Harvest batch recorded',
      invalidate: [farmKeys.harvests, farmKeys.cycles, farmKeys.blocks, farmKeys.overview, farmKeys.workers, farmKeys.payroll],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.batch);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={batch ? `Edit ${batch.batch_no}` : 'Record harvest'}
      description={
        batch
          ? 'The batch number stays the same.'
          : 'A batch number is generated from crop, block and date, e.g. CHILLI-BLK-A-20261002-001. The batch then waits for grading.'
      }
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={batch ? 'Save changes' : 'Record harvest'}
    >
      {graded ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This batch has been graded, so the planting and quantity are locked. Delete the grading to change them.
        </p>
      ) : null}
      <SelectField<HarvestBatchInput>
        name="planting_cycle_id"
        label="Planting harvested"
        required
        disabled={graded}
        options={cycleOptions}
        description={!cycles.isLoading && !cycleOptions.length ? 'No active plantings. Record a planting on a block first.' : undefined}
      />
      {cycle ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          Harvested so far {fmtQty(cycle.actual_yield, cycle.yield_unit)}
          {cycle.expected_yield ? ` of ${fmtQty(cycle.expected_yield, cycle.yield_unit)} expected` : ''}.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField<HarvestBatchInput> name="harvest_date" label="Harvest date" required />
        <NumberField<HarvestBatchInput> name="quantity" label="Quantity harvested" required suffix={unit} disabled={graded} />
        <SelectField<HarvestBatchInput>
          name="supervisor_id"
          label="Supervisor"
          emptyLabel="Not recorded"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
      </div>

      <section className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Pickers</p>
          <Select value="" onValueChange={(id) => pickers.append({ worker_id: id, hours_worked: 8, quantity_picked: null })}>
            <SelectTrigger className="h-8 w-48" disabled={!available.length}>
              <SelectValue placeholder={available.length ? 'Add picker…' : 'No more workers'} />
            </SelectTrigger>
            <SelectContent>
              {available.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.full_name} ({w.worker_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {pickers.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add registered workers who picked, with hours and optionally how much each picked.</p>
        ) : (
          <ul className="space-y-2">
            {pickers.fields.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-start gap-2">
                <span className="min-w-40 flex-1 pt-2 text-sm">{workerName(f.worker_id)}</span>
                <NumberCell name={`workers.${i}.hours_worked`} label="Hours" suffix="h" />
                <NumberCell name={`workers.${i}.quantity_picked`} label="Picked" suffix={unit} />
                <Button type="button" variant="ghost" size="icon" onClick={() => pickers.remove(i)} aria-label="Remove picker">
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {picked > 0 ? (
          <p className="text-xs text-muted-foreground">
            Picked by registered workers: {fmtQty(picked, unit)}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField<HarvestBatchInput>
            name="casual_labour_days"
            label="Unregistered casual labour"
            suffix="days"
          />
          <NumberField<HarvestBatchInput> name="other_labour_cost" label="Their labour cost" suffix={currency} />
        </div>
        <p className="text-xs text-muted-foreground">
          Estimated labour cost {fmtMoney(labour + Number(otherLabour || 0), currency)}
          {pickers.fields.length ? ` (${fmtNumber((watchedPickers ?? []).reduce((s, w) => s + Number(w.hours_worked || 0), 0))} worker hours)` : ''}.
        </p>
      </section>
      <TextareaField<HarvestBatchInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
