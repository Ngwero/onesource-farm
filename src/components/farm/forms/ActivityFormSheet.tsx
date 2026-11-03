'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CloudSun, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockCycleFields } from '@/components/farm/BlockCycleFields';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useActivityTypes, useCurrency, useFarmUsers, useInputLots, useInputProducts, useWorkers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, todayIso } from '@/lib/farm/format';
import { activitySchema, type ActivityInput } from '@/lib/farm/schemas';
import type { ActivityRow } from '@/lib/farm/types';

const SPRAY_TYPE = /pesticide|herbicide|fungicide|spray|chemical/i;

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
      weather_temp_c: null,
      weather_wind_kmh: null,
      weather_precip_mm: null,
      weather_humidity_pct: null,
      weather_code: null,
      weather_source: '',
      spray_window_score: null,
      spray_window_label: '',
      notes: '',
      application_rate_per_ha: null,
      treated_area_ha: null,
      active_ingredient: '',
      product_registration: '',
      pre_harvest_interval_days: null,
      re_entry_interval_hours: null,
      applicator_id: null,
      safety_equipment: '',
      spray_window_ok: null,
      harvest_compliant: null,
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
    weather_temp_c: activity.weather_temp_c == null ? null : Number(activity.weather_temp_c),
    weather_wind_kmh: activity.weather_wind_kmh == null ? null : Number(activity.weather_wind_kmh),
    weather_precip_mm: activity.weather_precip_mm == null ? null : Number(activity.weather_precip_mm),
    weather_humidity_pct: activity.weather_humidity_pct == null ? null : Number(activity.weather_humidity_pct),
    weather_code: activity.weather_code ?? null,
    weather_source: activity.weather_source ?? '',
    spray_window_score: activity.spray_window_score == null ? null : Number(activity.spray_window_score),
    spray_window_label: activity.spray_window_label ?? '',
    notes: activity.notes ?? '',
    application_rate_per_ha: activity.application_rate_per_ha == null ? null : Number(activity.application_rate_per_ha),
    treated_area_ha: activity.treated_area_ha == null ? null : Number(activity.treated_area_ha),
    active_ingredient: activity.active_ingredient ?? '',
    product_registration: activity.product_registration ?? '',
    pre_harvest_interval_days: activity.pre_harvest_interval_days,
    re_entry_interval_hours: activity.re_entry_interval_hours,
    applicator_id: activity.applicator_id,
    safety_equipment: activity.safety_equipment ?? '',
    spray_window_ok: activity.spray_window_ok,
    harvest_compliant: activity.harvest_compliant,
    workers: activity.workers.map((w) => ({ worker_id: w.worker_id, hours_worked: Number(w.hours_worked) })),
    inputs: [...activity.inputs]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        input_name: i.input_name,
        quantity: Number(i.quantity),
        unit: i.unit,
        unit_cost: i.unit_cost == null ? null : Number(i.unit_cost),
        product_id: i.product_id,
        lot_id: i.lot_id,
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
  const products = useInputProducts();
  const lots = useInputLots();
  const currency = useCurrency();
  const [weatherLoading, setWeatherLoading] = useState(false);
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
  const showSpray = Boolean(type?.name && SPRAY_TYPE.test(type.name));

  useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if ((name === 'block_id' || name === 'activity_date') && form.getValues('weather_source') === 'open-meteo') {
        form.setValue('weather', '', { shouldDirty: true });
        for (const field of ['weather_temp_c', 'weather_wind_kmh', 'weather_precip_mm', 'weather_humidity_pct', 'weather_code', 'spray_window_score', 'spray_window_ok'] as const) {
          form.setValue(field, null, { shouldDirty: true });
        }
        form.setValue('weather_source', '', { shouldDirty: true });
        form.setValue('spray_window_label', '', { shouldDirty: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

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

  const activeProducts = (products.data ?? []).filter((p) => p.status === 'active');

  const save = useFormMutation(
    form,
    (v) =>
      farmFetch<{ id: string; queued?: boolean }>(
        activity ? `/api/farm/activities/${activity.id}` : '/api/farm/activities',
        {
          method: activity ? 'PATCH' : 'POST',
          body: v,
        }
      ),
    {
      success: activity ? 'Activity updated' : 'Activity recorded',
      invalidate: [farmKeys.activities, farmKeys.workers, farmKeys.payroll, farmKeys.inputLots, farmKeys.inputMovements],
      onDone: (r) => {
        if (r.queued) toast.message('Queued offline — will sync when you reconnect');
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
              onClick={() =>
                inputRows.append({
                  input_name: '',
                  quantity: null as unknown as number,
                  unit: 'kg',
                  unit_cost: null,
                  product_id: null,
                  lot_id: null,
                })
              }
            >
              <Plus className="size-4" /> Add input
            </Button>
          </div>
          {inputRows.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add fertilizer, chemicals or seed used.</p>
          ) : (
            inputRows.fields.map((f, i) => {
              const productId = watchedInputs?.[i]?.product_id;
              const productLots = (lots.data ?? []).filter(
                (l) => l.product_id === productId && (Number(l.quantity_remaining) > 0 || l.id === watchedInputs?.[i]?.lot_id)
              );
              return (
                <div key={f.id} className="space-y-2 rounded-md border border-dashed p-2">
                  <div className="grid grid-cols-12 items-start gap-2">
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
                  {activeProducts.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <SelectField<ActivityInput>
                        name={`inputs.${i}.product_id`}
                        label="Store product"
                        emptyLabel="Not linked"
                        options={activeProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                        description="Link to issue stock from a lot."
                        onValueChange={(id) => {
                          form.setValue(`inputs.${i}.lot_id`, null);
                          const p = activeProducts.find((x) => x.id === id);
                          if (p) {
                            form.setValue(`inputs.${i}.input_name`, p.name);
                            form.setValue(`inputs.${i}.unit`, p.unit);
                            if (p.active_ingredient && showSpray) {
                              form.setValue('active_ingredient', p.active_ingredient);
                            }
                            if (p.registration_no && showSpray) {
                              form.setValue('product_registration', p.registration_no);
                            }
                          }
                        }}
                      />
                      <SelectField<ActivityInput>
                        name={`inputs.${i}.lot_id`}
                        label="Lot"
                        emptyLabel="No lot"
                        options={productLots.map((l) => ({
                          value: l.id,
                          label: `${l.lot_no} · ${Number(l.quantity_remaining)} left`,
                        }))}
                        onValueChange={(id) => {
                          const lot = productLots.find((l) => l.id === id);
                          if (lot?.unit_cost != null) {
                            form.setValue(`inputs.${i}.unit_cost`, Number(lot.unit_cost));
                          }
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </section>
      ) : null}

      {showSpray ? (
        <section className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-semibold">Chemical / spray</p>
          <p className="text-xs text-muted-foreground">Rate, treated area and intervals for spray compliance.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField<ActivityInput> name="application_rate_per_ha" label="Application rate" suffix="/ha" />
            <NumberField<ActivityInput> name="treated_area_ha" label="Treated area" suffix="ha" />
            <TextField<ActivityInput> name="active_ingredient" label="Active ingredient" />
            <TextField<ActivityInput> name="product_registration" label="Product registration" />
            <NumberField<ActivityInput> name="pre_harvest_interval_days" label="Pre-harvest interval" suffix="days" step="1" />
            <NumberField<ActivityInput> name="re_entry_interval_hours" label="Re-entry interval" suffix="hours" step="1" />
            <SelectField<ActivityInput>
              name="applicator_id"
              label="Applicator"
              emptyLabel="Not recorded"
              options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
            />
            <TextField<ActivityInput> name="safety_equipment" label="Safety equipment" placeholder="PPE, respirator…" />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField<ActivityInput> name="other_cost" label="Other costs" suffix={currency} description="Fuel, transport, hire." />
        <div className="space-y-2">
          <TextField<ActivityInput> name="weather" label="Weather" placeholder="Sunny, light wind" />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={weatherLoading}
              onClick={async () => {
                const blockId = form.getValues('block_id');
                const date = form.getValues('activity_date');
                if (!blockId) {
                  toast.error('Select a block first so we can use its GPS location');
                  return;
                }
                setWeatherLoading(true);
                try {
                  const res = await farmFetch<{
                    weather: {
                      summary: string;
                      tempC: number | null;
                      windKmh: number | null;
                      precipMm: number | null;
                      humidityPct: number | null;
                      weatherCode: number | null;
                      source: string;
                      sprayScore: number;
                      sprayLabel: string;
                      sprayReasons: string[];
                    };
                  }>(`/api/farm/weather?block_id=${blockId}${date ? `&date=${date}` : ''}`);
                  if (form.getValues('block_id') !== blockId || form.getValues('activity_date') !== date) return;
                  const w = res.weather;
                  form.setValue('weather', w.summary, { shouldDirty: true });
                  form.setValue('weather_temp_c', w.tempC, { shouldDirty: true });
                  form.setValue('weather_wind_kmh', w.windKmh, { shouldDirty: true });
                  form.setValue('weather_precip_mm', w.precipMm, { shouldDirty: true });
                  form.setValue('weather_humidity_pct', w.humidityPct, { shouldDirty: true });
                  form.setValue('weather_code', w.weatherCode, { shouldDirty: true });
                  form.setValue('weather_source', w.source, { shouldDirty: true });
                  form.setValue('spray_window_score', w.sprayScore, { shouldDirty: true });
                  form.setValue('spray_window_label', w.sprayLabel, { shouldDirty: true });
                  form.setValue('spray_window_ok', w.sprayScore >= 55, { shouldDirty: true });
                  if (w.sprayLabel === 'No forecast') {
                    toast.message('No complete forecast is available for this date');
                    return;
                  }
                  toast.success(`${w.sprayLabel} — ${w.sprayReasons.join('; ') || w.summary}`);
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setWeatherLoading(false);
                }
              }}
            >
              <CloudSun className="size-4" />
              {weatherLoading ? 'Fetching…' : 'Fill from forecast'}
            </Button>
            {form.watch('spray_window_label') ? (
              <span className="text-xs text-muted-foreground">{form.watch('spray_window_label')}</span>
            ) : null}
          </div>
        </div>
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
