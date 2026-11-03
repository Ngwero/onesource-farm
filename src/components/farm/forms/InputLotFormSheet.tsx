'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useCurrency, useInputProducts } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { todayIso } from '@/lib/farm/format';
import { inputLotSchema, type InputLotInput } from '@/lib/farm/schemas';
import type { InputLotRow } from '@/lib/farm/types';

const EMPTY: InputLotInput = {
  product_id: '',
  lot_no: '',
  supplier: '',
  received_date: todayIso(),
  expiry_date: null,
  quantity_received: null as unknown as number,
  quantity_remaining: null as unknown as number,
  unit_cost: null,
  location: '',
  notes: '',
};

function toValues(lot?: InputLotRow | null, defaultProductId?: string | null): InputLotInput {
  if (!lot) {
    return { ...EMPTY, product_id: defaultProductId ?? '', received_date: todayIso() };
  }
  return {
    product_id: lot.product_id,
    lot_no: lot.lot_no,
    supplier: lot.supplier ?? '',
    received_date: lot.received_date,
    expiry_date: lot.expiry_date,
    quantity_received: Number(lot.quantity_received),
    quantity_remaining: Number(lot.quantity_remaining),
    unit_cost: lot.unit_cost == null ? null : Number(lot.unit_cost),
    location: lot.location ?? '',
    notes: lot.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lot?: InputLotRow | null;
  defaultProductId?: string | null;
  onSaved?: (lot: InputLotRow) => void;
};

export function InputLotFormSheet({ open, onOpenChange, lot, defaultProductId, onSaved }: Props) {
  const products = useInputProducts();
  const currency = useCurrency();
  const form = useForm<InputLotInput>({
    resolver: zodResolver(inputLotSchema),
    defaultValues: toValues(lot, defaultProductId),
  });
  const received = useWatch({ control: form.control, name: 'quantity_received' });

  useEffect(() => {
    if (open) form.reset(toValues(lot, defaultProductId));
  }, [open, lot, defaultProductId, form]);

  // New lots: keep remaining in sync with received until the user edits remaining.
  useEffect(() => {
    if (!lot && open && received != null && !Number.isNaN(Number(received))) {
      const current = form.getValues('quantity_remaining');
      if (current == null || Number.isNaN(Number(current)) || Number(current) === 0 || Number(current) > Number(received)) {
        form.setValue('quantity_remaining', Number(received));
      }
    }
  }, [received, lot, open, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ lot: InputLotRow }>(lot ? `/api/farm/inputs/lots/${lot.id}` : '/api/farm/inputs/lots', {
        method: lot ? 'PATCH' : 'POST',
        body: values,
      }),
    {
      success: lot ? 'Lot updated' : 'Lot received',
      invalidate: [farmKeys.inputLots, farmKeys.inputProducts, farmKeys.inputMovements],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.lot);
      },
    }
  );

  const activeProducts = (products.data ?? []).filter((p) => p.status === 'active' || p.id === lot?.product_id);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={lot ? `Edit lot ${lot.lot_no}` : 'Receive a lot'}
      description="Record a delivery into stock. Remaining quantity is reduced when activities issue from this lot."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={lot ? 'Save changes' : 'Receive lot'}
    >
      <SelectField<InputLotInput>
        name="product_id"
        label="Product"
        required
        options={activeProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<InputLotInput> name="lot_no" label="Lot / batch no." required />
        <TextField<InputLotInput> name="supplier" label="Supplier" />
        <DateField<InputLotInput> name="received_date" label="Received" required />
        <DateField<InputLotInput> name="expiry_date" label="Expiry" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField<InputLotInput> name="quantity_received" label="Qty received" required />
        <NumberField<InputLotInput> name="quantity_remaining" label="Qty remaining" required />
        <NumberField<InputLotInput> name="unit_cost" label="Unit cost" suffix={currency || undefined} />
      </div>
      <TextField<InputLotInput> name="location" label="Store location" placeholder="Chemical shed A" />
      <TextareaField<InputLotInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
