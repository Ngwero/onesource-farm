'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BlockMapEditor } from '@/components/farm/BlockMapEditor';
import { FormSheet } from '@/components/farm/FormSheet';
import { NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useFarmUsers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { BLOCK_STATUSES, SIZE_UNITS, blockSchema, optionLabel, type BlockInput } from '@/lib/farm/schemas';
import type { BlockRow } from '@/lib/farm/types';

const EMPTY: BlockInput = {
  code: '',
  name: '',
  size_value: null as unknown as number,
  size_unit: 'acres',
  soil_type: '',
  irrigation_type: '',
  status: 'active',
  supervisor_id: null,
  notes: '',
  centroid_lat: null,
  centroid_lng: null,
  boundary_geojson: null,
};

function toValues(block?: BlockRow | null): BlockInput {
  if (!block) return EMPTY;
  return {
    code: block.code,
    name: block.name,
    size_value: Number(block.size_value),
    size_unit: block.size_unit,
    soil_type: block.soil_type ?? '',
    irrigation_type: block.irrigation_type ?? '',
    status: block.status,
    supervisor_id: block.supervisor_id,
    notes: block.notes ?? '',
    centroid_lat: block.centroid_lat == null ? null : Number(block.centroid_lat),
    centroid_lng: block.centroid_lng == null ? null : Number(block.centroid_lng),
    boundary_geojson: block.boundary_geojson,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  block?: BlockRow | null;
  onSaved?: (block: BlockRow) => void;
};

export function BlockFormSheet({ open, onOpenChange, block, onSaved }: Props) {
  const users = useFarmUsers();
  const form = useForm<BlockInput>({ resolver: zodResolver(blockSchema), defaultValues: toValues(block) });
  const geo = useWatch({
    control: form.control,
    name: ['centroid_lat', 'centroid_lng', 'boundary_geojson'],
  });

  useEffect(() => {
    if (open) form.reset(toValues(block));
  }, [open, block, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ block: BlockRow }>(block ? `/api/farm/blocks/${block.id}` : '/api/farm/blocks', {
        method: block ? 'PATCH' : 'POST',
        body: values,
      }),
    {
      success: block ? 'Block updated' : 'Block created',
      invalidate: [farmKeys.blocks, farmKeys.overview],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.block);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={block ? `Edit block ${block.code}` : 'New block'}
      description="A block or plot is a fixed area of the farm. Record what is planted in it as a planting."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={block ? 'Save changes' : 'Create block'}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField<BlockInput> name="code" label="Block ID" required uppercase placeholder="A" />
        <TextField<BlockInput> name="name" label="Block name" required placeholder="Block A — North" className="sm:col-span-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField<BlockInput> name="size_value" label="Size" required />
        <SelectField<BlockInput>
          name="size_unit"
          label="Unit"
          required
          options={SIZE_UNITS.map((u) => ({ value: u, label: optionLabel(u) }))}
        />
        <TextField<BlockInput> name="soil_type" label="Soil type" placeholder="Loam" />
        <TextField<BlockInput> name="irrigation_type" label="Irrigation" placeholder="Drip" />
        <SelectField<BlockInput>
          name="status"
          label="Status"
          required
          options={BLOCK_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
        />
        <SelectField<BlockInput>
          name="supervisor_id"
          label="Supervisor"
          emptyLabel="Not assigned"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
      </div>
      <BlockMapEditor
        value={{
          centroid_lat: (geo?.[0] as number | null) ?? null,
          centroid_lng: (geo?.[1] as number | null) ?? null,
          boundary_geojson: (geo?.[2] as BlockInput['boundary_geojson']) ?? null,
        }}
        onChange={(next) => {
          form.setValue('centroid_lat', next.centroid_lat, { shouldDirty: true });
          form.setValue('centroid_lng', next.centroid_lng, { shouldDirty: true });
          form.setValue('boundary_geojson', next.boundary_geojson, { shouldDirty: true });
        }}
      />
      <TextareaField<BlockInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
