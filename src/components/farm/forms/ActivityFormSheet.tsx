'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockCycleFields } from '@/components/farm/BlockCycleFields';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useActivityTypes, useCurrency, useFarmUsers, useWorkers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, todayIso } from '@/lib/farm/format';
import { activitySchema, type ActivityInput } from '@/lib/farm/schemas';
import type { ActivityRow } from '@/lib/farm/types';

function toValues(activity?: ActivityRow | null, defaults?: Partial<ActivityInput>): ActivityInput {
  if (!activity) {
    return {
      block_id: '',
      planting_cycle_id: null,
      activity_type_id: '',
      activity_date: todayIso(),
      supervisor_id: null,
      casual_labour_days: 0,
      other_labour_cost: 0,
      other_cost: 0,
      weather: '',
      notes: '',
      workers: [],
      inputs: [],
      ...defaults,
    };
  }
  return {
    block_id: activity.block_id,
    planting_cycle_id: activity.planting_cycle_id,
    activity_type_id: activity.activity_type_id,
    activity_date: activity.activity_date,
    supervisor_id: activity.supervisor_id,
    casual_labour_days: Number(activity.casual_labour_days),
    other_labour_cost: Number(activity.other_labour_cost),
    other_cost: Number(activity.other_cost),
    weather: activity.weather ?? '',
    notes: activity.notes ?? '',
    workers: activity.workers.map((w) => ({ worker_id: w.worker_id, hours_worked: Number(w.hours_worked) })),
    inputs: [...activity.inputs]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        input_name: i.input_name,
        quantity: Number(i.quantity),
        unit: i.unit,
        unit_cost: i.unit_cost == null ? null : Number(i.unit_cost),
      })),
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activity?: ActivityRow | null;
  defaults?: Partial<ActivityInput>;
  onSaved?: (id: string) => void;
};

export function ActivityFormSheet({ open, onOpenChange, activity, defaults, onSaved }: Props) {
  const users = useFarmUsers();
  const workers = useWorkers();
  const types = useActivityTypes();
  const currency = useCurrency();
  const form = useForm<ActivityInput>({ resolver: zodResolver(activitySchema), defaultValues: toValues(activity, defaults) });
  const workerRows = useFieldArray({ control: form.control, name: 'workers' });
  const inputRows = useFieldArray({ control: form.control, name: 'inputs' });

  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);
  useEffect(() => {
    if (open) form.reset(toValues(activity, defaultsRef.current));
  }, [open, activity, form]);

  const [typeId, watchedWorkers, watchedInputs, otherLabour, otherCost] = useWatch({
    control: form.control,
    name: ['activity_type_id', 'workers', 'inputs', 'other_labour_cost', 'other_cost'],
  });
  const type = types.data?.find((t) => t.id === typeId);
  const showInputs = Boolean(type?.uses_inputs) || inputRows.fields.length > 0;

  const rates = useMemo(() => {
    const map = new Map((workers.data ?? []).map((w) => [w.id, Number(w.hourly_rate)]));
    for (const w of activity?.workers ?? []) map.set(w.worker_id, Number(w.hourly_rate));
    return map;
  }, [workers.data, activity]);
  const estimate = useMemo(() => {
    const labour = (watchedWorkers ?? []).reduce((s, w) => s + (rates.get(w.worker_id) ?? 0) * Number(w.hours_worked || 0), 0);
    const inputs = (watchedInputs ?? []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0);
    return { labour, inputs, total: labour + inputs + Number(otherLabour || 0) + Number(otherCost || 0) };
  }, [watchedWorkers, watchedInputs, otherLabour, otherCost, rates]);

  const chosen = new Set((watchedWorkers ?? []).map((w) => w.worker_id));
  const available = (workers.data ?? []).filter((w) => w.status === 'active' && !chosen.has(w.id));
  const workerName = (id: string) => {
    const w = workers.data?.find((x) => x.id === id);
    return w ? `${w.full_name} (${w.worker_code})` : 'Worker';
  };

  const save = useFormMutation(
    form,
    (v) =>
      farmFetch<{ id: string }>(activity ? `/api/farm/activities/${activity.id}` : '/api/farm/activities', {
        method: activity ? 'PATCH' : 'POST',
        body: v,
      }),
    {
      success: activity ? 'Activity updated' : 'Activity recorded',
      invalidate: [farmKeys.activities, farmKeys.workers, farmKeys.payroll],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.id);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={activity ? 'Edit activity' : 'Record activity'}
      description="Field work on a block: who did it, inputs applied and what it cost. Labour is costed at each worker's hourly rate."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={activity ? 'Save changes' : 'Record activity'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<ActivityInput>
          name="activity_type_id"
          label="Activity"
          required
          options={(types.data ?? [])
            .filter((t) => t.status === 'active' || t.id === activity?.activity_type_id)
            .map((t) => ({ value: t.id, label: t.name }))}
        />
        <DateField<ActivityInput> name="activity_date" label="Date" required />
      </div>
      <BlockCycleFields<ActivityInput>
        currentCycle={
          activity?.planting_cycle_id
            ? {
                id: activity.planting_cycle_id,
                blockId: activity.block_id,
                label: `${activity.crop?.name ?? 'Crop'}, planted ${fmtDate(activity.cycle?.planting_date)}`,
              }
            : null
        }
      />
      <SelectField<ActivityInput>
        name="supervisor_id"
        label="Supervisor"
        emptyLabel="Not recorded"
        options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
      />

      <section className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Workers</p>
          <Select value="" onValueChange={(id) => workerRows.append({ worker_id: id, hours_worked: 8 })}>
            <SelectTrigger className="h-8 w-48" disabled={!available.length}>
              <SelectValue placeholder={available.length ? 'Add worker…' : 'No more workers'} />
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
        {workerRows.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No registered workers added.</p>
        ) : (
          <ul className="space-y-2">
            {workerRows.fields.map((f, i) => (
              <li key={f.id} className="flex items-start gap-2">
                <span className="flex-1 pt-2 text-sm">{workerName(f.worker_id)}</span>
                <FormField
                  control={form.control}
                  name={`workers.${i}.hours_worked`}
                  render={({ field }) => (
                    <FormItem className="w-28">
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min={0}
                            max={24}
                            aria-label="Hours"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)}
                            className="pr-7"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">h</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => workerRows.remove(i)} aria-label="Remove worker">
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField<ActivityInput>
            name="casual_labour_days"
            label="Unregistered casual labour"
            suffix="days"
            description="Person-days of casuals not on the worker list."
          />
          <NumberField<ActivityInput>
            name="other_labour_cost"
            label="Their labour cost"
            suffix={currency}
            description="What was paid for that casual labour."
          />
        </div>
      </section>

      {showInputs ? (
        <section className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Inputs applied</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRows.append({ input_name: '', quantity: null as unknown as number, unit: 'kg', unit_cost: null })}
            >
              <Plus className="size-4" /> Add input
            </Button>
          </div>
          {inputRows.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add fertilizer, chemicals or seed used.</p>
          ) : (
            inputRows.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-12 items-start gap-2">
                <TextField<ActivityInput> name={`inputs.${i}.input_name`} label="Product" required className="col-span-12 sm:col-span-4" />
                <NumberField<ActivityInput> name={`inputs.${i}.quantity`} label="Qty" required className="col-span-4 sm:col-span-2" />
                <TextField<ActivityInput> name={`inputs.${i}.unit`} label="Unit" required className="col-span-4 sm:col-span-2" />
                <NumberField<ActivityInput> name={`inputs.${i}.unit_cost`} label="Unit cost" className="col-span-4 sm:col-span-3" />
                <div className="col-span-12 flex justify-end sm:col-span-1 sm:pt-6">
                  <Button type="button" variant="ghost" size="icon" onClick={() => inputRows.remove(i)} aria-label="Remove input">
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField<ActivityInput> name="other_cost" label="Other costs" suffix={currency} description="Fuel, transport, hire." />
        <TextField<ActivityInput> name="weather" label="Weather" placeholder="Sunny, light wind" />
      </div>
      <TextareaField<ActivityInput> name="notes" label="Notes" />

      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Registered worker labour</span>
          <span>{fmtMoney(estimate.labour, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Inputs</span>
          <span>{fmtMoney(estimate.inputs, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
          <span>Estimated total cost</span>
          <span>{fmtMoney(estimate.total, currency)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Each worker&apos;s rate is fixed when they are first added to the activity, so later pay changes do not alter its cost.
        </p>
      </div>
    </FormSheet>
  );
}
