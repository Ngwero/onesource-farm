'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { buyerSchema, optionLabel, type BuyerInput } from '@/lib/farm/schemas';
import type { BuyerRow } from '@/lib/farm/types';

const EMPTY: BuyerInput = {
  code: '',
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  country: '',
  destination: '',
  address: '',
  payment_terms: '',
  status: 'active',
  notes: '',
};

function toValues(buyer?: BuyerRow | null): BuyerInput {
  if (!buyer) return EMPTY;
  return {
    code: buyer.code,
    name: buyer.name,
    contact_name: buyer.contact_name ?? '',
    email: buyer.email ?? '',
    phone: buyer.phone ?? '',
    country: buyer.country ?? '',
    destination: buyer.destination ?? '',
    address: buyer.address ?? '',
    payment_terms: buyer.payment_terms ?? '',
    status: buyer.status,
    notes: buyer.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  buyer?: BuyerRow | null;
  onSaved?: (buyer: BuyerRow) => void;
};

export function BuyerFormSheet({ open, onOpenChange, buyer, onSaved }: Props) {
  const form = useForm<BuyerInput>({ resolver: zodResolver(buyerSchema), defaultValues: toValues(buyer) });

  useEffect(() => {
    if (open) form.reset(toValues(buyer));
  }, [open, buyer, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ buyer: BuyerRow }>(buyer ? `/api/farm/buyers/${buyer.id}` : '/api/farm/buyers', {
        method: buyer ? 'PATCH' : 'POST',
        body: values,
      }),
    {
      success: buyer ? 'Buyer updated' : 'Buyer created',
      invalidate: [farmKeys.buyers, ...(buyer ? [farmKeys.buyer(buyer.id)] : [])],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.buyer);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={buyer ? `Edit ${buyer.name}` : 'New buyer'}
      description="Export customers and destinations used on contracts and shipments."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={buyer ? 'Save changes' : 'Create buyer'}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField<BuyerInput> name="code" label="Buyer code" required uppercase placeholder="EU-01" />
        <TextField<BuyerInput> name="name" label="Buyer name" required className="sm:col-span-2" placeholder="Nordic Fresh BV" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<BuyerInput> name="contact_name" label="Contact name" />
        <TextField<BuyerInput> name="email" label="Email" placeholder="orders@buyer.com" />
        <TextField<BuyerInput> name="phone" label="Phone" />
        <TextField<BuyerInput> name="country" label="Country" />
        <TextField<BuyerInput> name="destination" label="Default destination" placeholder="Rotterdam" />
        <SelectField<BuyerInput>
          name="status"
          label="Status"
          required
          options={(['active', 'inactive'] as const).map((s) => ({ value: s, label: optionLabel(s) }))}
        />
      </div>
      <TextField<BuyerInput> name="payment_terms" label="Payment terms" placeholder="Net 30" />
      <TextareaField<BuyerInput> name="address" label="Address" />
      <TextareaField<BuyerInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
