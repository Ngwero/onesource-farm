'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useFarmUsers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { farmSchema, type FarmInput } from '@/lib/farm/schemas';
import type { FarmRow } from '@/lib/farm/types';

function toValues(farm: FarmRow): FarmInput {
  return {
    name: farm.name,
    legal_name: farm.legal_name ?? '',
    location: farm.location ?? '',
    district: farm.district ?? '',
    country: farm.country,
    total_area_ha: farm.total_area_ha ?? null,
    timezone: farm.timezone,
    default_currency: farm.default_currency,
    manager_id: farm.manager_id,
    notes: farm.notes ?? '',
  };
}

export function FarmProfileSheet({ open, onOpenChange, farm }: { open: boolean; onOpenChange: (v: boolean) => void; farm: FarmRow }) {
  const users = useFarmUsers();
  const form = useForm<FarmInput>({ resolver: zodResolver(farmSchema), defaultValues: toValues(farm) });

  useEffect(() => {
    if (open) form.reset(toValues(farm));
  }, [open, farm, form]);

  const save = useFormMutation(form, (values) => farmFetch('/api/farm/profile', { method: 'PATCH', body: values }), {
    success: 'Farm details saved',
    invalidate: [farmKeys.overview, farmKeys.profile],
    onDone: () => onOpenChange(false),
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit farm details"
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
    >
      <TextField<FarmInput> name="name" label="Farm name" required />
      <TextField<FarmInput> name="legal_name" label="Legal / registered name" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<FarmInput> name="location" label="Location" placeholder="Village, sub-county" />
        <TextField<FarmInput> name="district" label="District" />
        <TextField<FarmInput> name="country" label="Country" required />
        <NumberField<FarmInput> name="total_area_ha" label="Total farm area" suffix="ha" />
        <TextField<FarmInput> name="default_currency" label="Default currency" required uppercase />
        <TextField<FarmInput> name="timezone" label="Timezone" required />
      </div>
      <SelectField<FarmInput>
        name="manager_id"
        label="Farm manager"
        emptyLabel="Not assigned"
        options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
      />
      <TextareaField<FarmInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
