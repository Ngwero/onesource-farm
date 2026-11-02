'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { varietySchema, type VarietyInput } from '@/lib/farm/schemas';
import type { VarietyRow } from '@/lib/farm/types';

function toValues(variety?: VarietyRow | null): VarietyInput {
  return {
    code: variety?.code ?? '',
    name: variety?.name ?? '',
    maturity_days: variety?.maturity_days ?? null,
    description: variety?.description ?? '',
    status: variety?.status ?? 'active',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cropId: string;
  variety?: VarietyRow | null;
};

export function VarietySheet({ open, onOpenChange, cropId, variety }: Props) {
  const form = useForm<VarietyInput>({ resolver: zodResolver(varietySchema), defaultValues: toValues(variety) });

  useEffect(() => {
    if (open) form.reset(toValues(variety));
  }, [open, variety, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch(variety ? `/api/farm/varieties/${variety.id}` : `/api/farm/crops/${cropId}/varieties`, {
        method: variety ? 'PATCH' : 'POST',
        body: values,
      }),
    {
      success: variety ? 'Variety updated' : 'Variety added',
      invalidate: [farmKeys.crop(cropId), farmKeys.crops],
      onDone: () => onOpenChange(false),
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={variety ? `Edit ${variety.name}` : 'New variety'}
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={variety ? 'Save changes' : 'Add variety'}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField<VarietyInput> name="code" label="Code" required uppercase />
        <TextField<VarietyInput> name="name" label="Variety name" required className="sm:col-span-2" />
        <NumberField<VarietyInput>
          name="maturity_days"
          label="Maturity"
          step="1"
          suffix="days"
          className="sm:col-span-2"
          description="Leave blank to use the crop's maturity period"
        />
        <SelectField<VarietyInput>
          name="status"
          label="Status"
          required
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>
      <TextareaField<VarietyInput> name="description" label="Description" />
    </FormSheet>
  );
}
