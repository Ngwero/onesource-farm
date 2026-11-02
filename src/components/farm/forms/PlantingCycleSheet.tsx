'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, formatISO, parseISO } from 'date-fns';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useCrops, useFarmUsers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import {
  CROP_UNITS,
  CYCLE_STATUSES,
  optionLabel,
  plantingCycleSchema,
  type PlantingCycleInput,
} from '@/lib/farm/schemas';
import type { BlockRow, PlantingCycleRow } from '@/lib/farm/types';

function toValues(block: BlockRow, cycle?: PlantingCycleRow | null): PlantingCycleInput {
  if (!cycle) {
    return {
      block_id: block.id,
      crop_id: '',
      variety_id: null,
      season_label: '',
      planting_date: formatISO(new Date(), { representation: 'date' }),
      expected_harvest_date: null,
      planted_area_ha: Number(block.area_ha),
      expected_yield: null,
      yield_unit: 'kg',
      status: 'active',
      closed_at: null,
      supervisor_id: block.supervisor_id,
      notes: '',
    };
  }
  return {
    block_id: block.id,
    crop_id: cycle.crop_id,
    variety_id: cycle.variety_id,
    season_label: cycle.season_label ?? '',
    planting_date: cycle.planting_date,
    expected_harvest_date: cycle.expected_harvest_date,
    planted_area_ha: cycle.planted_area_ha != null ? Number(cycle.planted_area_ha) : null,
    expected_yield: cycle.expected_yield != null ? Number(cycle.expected_yield) : null,
    yield_unit: cycle.yield_unit as PlantingCycleInput['yield_unit'],
    status: cycle.status,
    closed_at: cycle.closed_at,
    supervisor_id: cycle.supervisor_id,
    notes: cycle.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  block: BlockRow;
  cycle?: PlantingCycleRow | null;
};

export function PlantingCycleSheet({ open, onOpenChange, block, cycle }: Props) {
  const crops = useCrops();
  const users = useFarmUsers();
  const form = useForm<PlantingCycleInput>({
    resolver: zodResolver(plantingCycleSchema),
    defaultValues: toValues(block, cycle),
  });

  useEffect(() => {
    if (open) form.reset(toValues(block, cycle));
  }, [open, block, cycle, form]);

  const [cropId, plantingDate, status] = useWatch({
    control: form.control,
    name: ['crop_id', 'planting_date', 'status'],
  });
  const selectedCrop = crops.data?.find((c) => c.id === cropId);

  const cropOptions = useMemo(
    () =>
      (crops.data ?? [])
        .filter((c) => c.status === 'active' || c.id === cycle?.crop_id)
        .map((c) => ({ value: c.id, label: c.name })),
    [crops.data, cycle?.crop_id]
  );
  const varietyOptions = (selectedCrop?.crop_varieties ?? [])
    .filter((v) => v.status === 'active' || v.id === cycle?.variety_id)
    .map((v) => ({ value: v.id, label: v.name }));

  // Changing crop clears a variety from another crop and adopts the crop's unit.
  useEffect(() => {
    if (!selectedCrop) return;
    const variety = form.getValues('variety_id');
    if (variety && !selectedCrop.crop_varieties.some((v) => v.id === variety)) form.setValue('variety_id', null);
    if (!cycle) form.setValue('yield_unit', selectedCrop.default_unit as PlantingCycleInput['yield_unit']);
  }, [selectedCrop, cycle, form]);

  // Suggest the expected harvest date from the crop's maturity period.
  useEffect(() => {
    if (!selectedCrop?.maturity_days || !plantingDate || form.getFieldState('expected_harvest_date').isDirty) return;
    if (cycle && form.getValues('expected_harvest_date')) return;
    try {
      const suggested = formatISO(addDays(parseISO(plantingDate), selectedCrop.maturity_days), { representation: 'date' });
      form.setValue('expected_harvest_date', suggested);
    } catch {
      // invalid date while typing
    }
  }, [selectedCrop, plantingDate, cycle, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch(cycle ? `/api/farm/planting-cycles/${cycle.id}` : '/api/farm/planting-cycles', {
        method: cycle ? 'PATCH' : 'POST',
        body: values,
      }),
    {
      success: cycle ? 'Planting updated' : 'Planting recorded',
      invalidate: [farmKeys.blocks, farmKeys.overview, farmKeys.crops, farmKeys.cycles],
      onDone: () => onOpenChange(false),
    }
  );

  const closing = status === 'completed' || status === 'abandoned';

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={cycle ? 'Edit planting' : `New planting in ${block.code}`}
      description="What is planted in this block, when, and the yield you expect."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={cycle ? 'Save changes' : 'Record planting'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<PlantingCycleInput> name="crop_id" label="Crop" required options={cropOptions} />
        <SelectField<PlantingCycleInput>
          name="variety_id"
          label="Variety"
          emptyLabel={varietyOptions.length ? 'Not specified' : 'No varieties set up'}
          options={varietyOptions}
          disabled={!selectedCrop}
        />
        <DateField<PlantingCycleInput> name="planting_date" label="Planting date" required />
        <DateField<PlantingCycleInput>
          name="expected_harvest_date"
          label="Expected harvest date"
          description={selectedCrop?.maturity_days ? `Suggested from ${selectedCrop.maturity_days}-day maturity` : undefined}
        />
        <NumberField<PlantingCycleInput> name="planted_area_ha" label="Planted area" suffix="ha" />
        <TextField<PlantingCycleInput> name="season_label" label="Season" placeholder="2026 Season A" />
        <NumberField<PlantingCycleInput> name="expected_yield" label="Expected yield" />
        <SelectField<PlantingCycleInput>
          name="yield_unit"
          label="Yield unit"
          required
          options={CROP_UNITS.map((u) => ({ value: u, label: u }))}
        />
        <SelectField<PlantingCycleInput>
          name="status"
          label="Status"
          required
          options={CYCLE_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
        />
        {closing ? <DateField<PlantingCycleInput> name="closed_at" label="Closed on" description="Defaults to today" /> : null}
        <SelectField<PlantingCycleInput>
          name="supervisor_id"
          label="Supervisor"
          emptyLabel="Not assigned"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
      </div>
      <TextareaField<PlantingCycleInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
