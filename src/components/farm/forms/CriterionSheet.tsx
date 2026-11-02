'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { NumberField, SelectField, SwitchField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { CRITERION_TYPES, optionLabel, qualityCriterionSchema, type QualityCriterionInput } from '@/lib/farm/schemas';
import type { QualityCriterionRow } from '@/lib/farm/types';

function toValues(c?: QualityCriterionRow | null, nextOrder = 0): QualityCriterionInput {
  return {
    name: c?.name ?? '',
    criterion_type: (c?.criterion_type as QualityCriterionInput['criterion_type']) ?? 'pass_fail',
    unit: c?.unit ?? '',
    min_value: c?.min_value != null ? Number(c.min_value) : null,
    max_value: c?.max_value != null ? Number(c.max_value) : null,
    is_mandatory: c?.is_mandatory ?? true,
    sort_order: c?.sort_order ?? nextOrder,
    guidance: c?.guidance ?? '',
    status: c?.status ?? 'active',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cropId: string;
  criterion?: QualityCriterionRow | null;
  nextOrder?: number;
};

export function CriterionSheet({ open, onOpenChange, cropId, criterion, nextOrder = 0 }: Props) {
  const form = useForm<QualityCriterionInput>({
    resolver: zodResolver(qualityCriterionSchema),
    defaultValues: toValues(criterion, nextOrder),
  });

  useEffect(() => {
    if (open) form.reset(toValues(criterion, nextOrder));
  }, [open, criterion, nextOrder, form]);

  const type = useWatch({ control: form.control, name: 'criterion_type' });
  const measured = type === 'numeric' || type === 'scale';

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch(criterion ? `/api/farm/criteria/${criterion.id}` : `/api/farm/crops/${cropId}/criteria`, {
        method: criterion ? 'PATCH' : 'POST',
        body: measured ? values : { ...values, unit: null, min_value: null, max_value: null },
      }),
    {
      success: criterion ? 'QC check updated' : 'QC check added',
      invalidate: [farmKeys.crop(cropId)],
      onDone: () => onOpenChange(false),
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={criterion ? `Edit ${criterion.name}` : 'New QC check'}
      description="Inspectors complete these checks for this crop during QC inspections."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={criterion ? 'Save changes' : 'Add check'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<QualityCriterionInput> name="name" label="Check" required placeholder="Colour" />
        <SelectField<QualityCriterionInput>
          name="criterion_type"
          label="Result type"
          required
          options={CRITERION_TYPES.map((t) => ({ value: t, label: optionLabel(t) }))}
        />
        {measured ? (
          <>
            <NumberField<QualityCriterionInput> name="min_value" label="Minimum acceptable" />
            <NumberField<QualityCriterionInput> name="max_value" label="Maximum acceptable" />
            <TextField<QualityCriterionInput> name="unit" label="Unit" placeholder="mm, %, g" />
          </>
        ) : null}
        <NumberField<QualityCriterionInput> name="sort_order" label="Display order" step="1" />
        <SelectField<QualityCriterionInput>
          name="status"
          label="Status"
          required
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>
      <SwitchField<QualityCriterionInput>
        name="is_mandatory"
        label="Mandatory"
        description="A failed mandatory check fails the inspection."
      />
      <TextareaField<QualityCriterionInput> name="guidance" label="Guidance for inspectors" />
    </FormSheet>
  );
}
