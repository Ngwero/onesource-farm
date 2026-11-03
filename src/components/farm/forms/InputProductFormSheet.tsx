'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import {
  INPUT_PRODUCT_CATEGORIES,
  inputProductSchema,
  optionLabel,
  type InputProductInput,
} from '@/lib/farm/schemas';
import type { InputProductRow } from '@/lib/farm/types';

const EMPTY: InputProductInput = {
  sku: '',
  name: '',
  category: 'crop_protection',
  unit: 'L',
  active_ingredient: '',
  registration_no: '',
  manufacturer: '',
  default_supplier: '',
  reorder_level: 0,
  status: 'active',
  notes: '',
};

function toValues(product?: InputProductRow | null): InputProductInput {
  if (!product) return EMPTY;
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    unit: product.unit,
    active_ingredient: product.active_ingredient ?? '',
    registration_no: product.registration_no ?? '',
    manufacturer: product.manufacturer ?? '',
    default_supplier: product.default_supplier ?? '',
    reorder_level: Number(product.reorder_level),
    status: product.status,
    notes: product.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product?: InputProductRow | null;
  onSaved?: (product: InputProductRow) => void;
};

export function InputProductFormSheet({ open, onOpenChange, product, onSaved }: Props) {
  const form = useForm<InputProductInput>({ resolver: zodResolver(inputProductSchema), defaultValues: toValues(product) });

  useEffect(() => {
    if (open) form.reset(toValues(product));
  }, [open, product, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ product: InputProductRow }>(
        product ? `/api/farm/inputs/products/${product.id}` : '/api/farm/inputs/products',
        { method: product ? 'PATCH' : 'POST', body: values }
      ),
    {
      success: product ? 'Product updated' : 'Product added',
      invalidate: [farmKeys.inputProducts, farmKeys.inputLots],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.product);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={product ? `Edit ${product.name}` : 'New input product'}
      description="Seed, fertilizer, crop protection, fuel and packaging held in the farm store."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={product ? 'Save changes' : 'Add product'}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField<InputProductInput> name="sku" label="SKU" required uppercase placeholder="CP-GLY-01" />
        <TextField<InputProductInput> name="name" label="Name" required className="sm:col-span-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField<InputProductInput>
          name="category"
          label="Category"
          required
          options={INPUT_PRODUCT_CATEGORIES.map((c) => ({ value: c, label: optionLabel(c) }))}
        />
        <TextField<InputProductInput> name="unit" label="Unit" required placeholder="kg, L, bag" />
        <SelectField<InputProductInput>
          name="status"
          label="Status"
          required
          options={(['active', 'inactive'] as const).map((s) => ({ value: s, label: optionLabel(s) }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<InputProductInput> name="active_ingredient" label="Active ingredient" />
        <TextField<InputProductInput> name="registration_no" label="Registration no." />
        <TextField<InputProductInput> name="manufacturer" label="Manufacturer" />
        <TextField<InputProductInput> name="default_supplier" label="Default supplier" />
      </div>
      <NumberField<InputProductInput> name="reorder_level" label="Reorder level" description="Alert when stock falls to this quantity." />
      <TextareaField<InputProductInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
