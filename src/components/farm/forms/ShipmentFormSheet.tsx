'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import {
  PAYMENT_STATUSES,
  SHIPMENT_STATUSES,
  optionLabel,
  shipmentSchema,
  type ShipmentInput,
} from '@/lib/farm/schemas';
import type { BuyerRow, ContractRow, ShipmentRow } from '@/lib/farm/types';

function toValues(shipment?: ShipmentRow | null, defaults?: Partial<ShipmentInput>): ShipmentInput {
  if (!shipment) {
    return {
      shipment_no: '',
      buyer_id: '',
      contract_id: null,
      destination: '',
      carrier: '',
      booking_ref: '',
      awb_bl_number: '',
      etd: null,
      eta: null,
      dispatched_at: null,
      status: 'planned',
      invoice_no: '',
      invoice_amount: null,
      invoice_currency: '',
      payment_status: 'unpaid',
      notes: '',
      ...defaults,
    };
  }
  return {
    shipment_no: shipment.shipment_no,
    buyer_id: shipment.buyer_id,
    contract_id: shipment.contract_id,
    destination: shipment.destination ?? '',
    carrier: shipment.carrier ?? '',
    booking_ref: shipment.booking_ref ?? '',
    awb_bl_number: shipment.awb_bl_number ?? '',
    etd: shipment.etd,
    eta: shipment.eta,
    dispatched_at: shipment.dispatched_at,
    status: shipment.status,
    invoice_no: shipment.invoice_no ?? '',
    invoice_amount: shipment.invoice_amount == null ? null : Number(shipment.invoice_amount),
    invoice_currency: shipment.invoice_currency ?? '',
    payment_status: shipment.payment_status,
    notes: shipment.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shipment?: ShipmentRow | null;
  buyers: BuyerRow[];
  contracts: ContractRow[];
  defaults?: Partial<ShipmentInput>;
  onSaved?: (shipment: ShipmentRow) => void;
};

export function ShipmentFormSheet({
  open,
  onOpenChange,
  shipment,
  buyers,
  contracts,
  defaults,
  onSaved,
}: Props) {
  const form = useForm<ShipmentInput>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: toValues(shipment, defaults),
  });
  const buyerId = useWatch({ control: form.control, name: 'buyer_id' });

  useEffect(() => {
    if (open) form.reset(toValues(shipment, defaults));
  }, [open, shipment, defaults, form]);

  const buyerContracts = useMemo(
    () => contracts.filter((c) => !buyerId || c.buyer_id === buyerId),
    [contracts, buyerId]
  );

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ shipment: ShipmentRow }>(
        shipment ? `/api/farm/shipments/${shipment.id}` : '/api/farm/shipments',
        { method: shipment ? 'PATCH' : 'POST', body: values }
      ),
    {
      success: shipment ? 'Shipment updated' : 'Shipment created',
      invalidate: [farmKeys.shipments, ...(shipment ? [farmKeys.shipment(shipment.id)] : [])],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.shipment);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={shipment ? `Edit ${shipment.shipment_no}` : 'New shipment'}
      description="Plan an export shipment, then allocate packing batches as lines."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={shipment ? 'Save changes' : 'Create shipment'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<ShipmentInput> name="shipment_no" label="Shipment number" required placeholder="SHP-2026-001" />
        <SelectField<ShipmentInput>
          name="status"
          label="Status"
          required
          options={SHIPMENT_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
        />
        <SelectField<ShipmentInput>
          name="buyer_id"
          label="Buyer"
          required
          options={buyers.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
        />
        <SelectField<ShipmentInput>
          name="contract_id"
          label="Contract"
          emptyLabel="No contract"
          options={buyerContracts.map((c) => ({ value: c.id, label: `${c.contract_no} · ${c.title}` }))}
        />
        <TextField<ShipmentInput> name="destination" label="Destination" />
        <TextField<ShipmentInput> name="carrier" label="Carrier" />
        <TextField<ShipmentInput> name="booking_ref" label="Booking reference" />
        <TextField<ShipmentInput> name="awb_bl_number" label="AWB / BL number" />
        <DateField<ShipmentInput> name="etd" label="ETD" />
        <DateField<ShipmentInput> name="eta" label="ETA" />
        <TextField<ShipmentInput> name="invoice_no" label="Invoice number" />
        <NumberField<ShipmentInput> name="invoice_amount" label="Invoice amount" />
        <TextField<ShipmentInput> name="invoice_currency" label="Invoice currency" uppercase placeholder="USD" />
        <SelectField<ShipmentInput>
          name="payment_status"
          label="Payment status"
          required
          options={PAYMENT_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
        />
      </div>
      <TextareaField<ShipmentInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
