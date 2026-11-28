'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { CROP_UNITS, PRODUCTION_CYCLES, cropSchema, optionLabel, type CropInput } from '@/lib/farm/schemas';
import type { CropRow } from '@/lib/farm/types';

const EMPTY: CropInput = {
  code: '',
  name: '',
  scientific_name: '',
  production_cycle: 'seasonal',
  default_unit: 'kg',
  maturity_days: null,
  description: '',
  status: 'active',
};

function toValues(crop?: CropRow | null): CropInput {
  if (!crop) return EMPTY;
  return {
    code: crop.code,
    name: crop.name,
    scientific_name: crop.scientific_name ?? '',
    production_cycle: crop.production_cycle as CropInput['production_cycle'],
    default_unit: crop.default_unit as CropInput['default_unit'],
    maturity_days: crop.maturity_days,
    description: crop.description ?? '',
    status: crop.status,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  crop?: CropRow | null;
  onSaved?: (crop: CropRow) => void;
};

export function CropFormSheet({ open, onOpenChange, crop, onSaved }: Props) {
  const form = useForm<CropInput>({ resolver: zodResolver(cropSchema), defaultValues: toValues(crop) });

  useEffect(() => {
    if (open) form.reset(toValues(crop));
  }, [open, crop, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ crop: CropRow }>(crop ? `/api/farm/crops/${crop.id}` : '/api/farm/crops', {
        method: crop ? 'PATCH' : 'POST',
        body: values,
      }),
    {
      success: crop ? 'Crop updated' : 'Crop created',
      invalidate: [farmKeys.crops, ...(crop ? [farmKeys.crop(crop.id)] : [])],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.crop);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={crop ? `Edit ${crop.name}` : 'New crop'}
      description={crop ? undefined : 'Add a crop grown on the farm. You can add varieties after saving.'}
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={crop ? 'Save changes' : 'Create crop'}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField<CropInput>
          name="code"
          label="Short code"
          required
          uppercase
          placeholder="e.g. CHILLI"
          description="Used in harvest batch numbers"
        />
        <TextField<CropInput> name="name" label="Crop name" required placeholder="e.g. Chilies" className="sm:col-span-2" />
      </div>
      <TextField<CropInput> name="scientific_name" label="Scientific name" placeholder="Optional, e.g. Capsicum annuum" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<CropInput>
          name="production_cycle"
          label="How often is it grown?"
          required
          placeholder="Choose one"
          options={PRODUCTION_CYCLES.map((c) => ({ value: c, label: optionLabel(c) }))}
        />
        <SelectField<CropInput>
          name="default_unit"
          label="Usual unit"
          required
          placeholder="e.g. kg"
          options={CROP_UNITS.map((u) => ({ value: u, label: u }))}
        />
        <NumberField<CropInput> name="maturity_days" label="Days to harvest" step="1" suffix="days" placeholder="e.g. 90" />
        <SelectField<CropInput>
          name="status"
          label="Status"
          required
          placeholder="Active or inactive?"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>
      <TextareaField<CropInput> name="description" label="Description" placeholder="Optional notes about this crop" />
    </FormSheet>
  );
}
