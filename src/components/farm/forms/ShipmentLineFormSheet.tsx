'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { FormSheet } from '@/components/farm/FormSheet';
import { NumberField, SelectField, TextareaField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { shipmentLineSchema, type ShipmentLineInput } from '@/lib/farm/schemas';
import type { PackingBatchRow, ShipmentRow } from '@/lib/farm/types';

const EMPTY: ShipmentLineInput = {
  packing_batch_id: '',
  package_count: null as unknown as number,
  net_weight: null as unknown as number,
  notes: '',
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shipment: ShipmentRow;
  onSaved?: (shipment: ShipmentRow) => void;
};

export function ShipmentLineFormSheet({ open, onOpenChange, shipment, onSaved }: Props) {
  const form = useForm<ShipmentLineInput>({ resolver: zodResolver(shipmentLineSchema), defaultValues: EMPTY });
  const packingBatchId = useWatch({ control: form.control, name: 'packing_batch_id' });
  const packageCount = useWatch({ control: form.control, name: 'package_count' });

  const stock = useQuery({
    queryKey: farmKeys.stock,
    queryFn: () => farmFetch<{ batches: PackingBatchRow[] }>('/api/farm/warehouse/stock').then((r) => r.batches),
    enabled: open,
  });

  const options = useMemo(() => {
    const used = new Set((shipment.lines ?? []).map((l) => l.packing_batch_id));
    return (stock.data ?? []).filter((b) => b.stock.available > 0 && !used.has(b.id));
  }, [stock.data, shipment.lines]);

  const selected = options.find((b) => b.id === packingBatchId) ?? null;

  useEffect(() => {
    if (open) form.reset(EMPTY);
  }, [open, form]);

  useEffect(() => {
    if (!selected || !packageCount) return;
    form.setValue('net_weight', Number((Number(selected.net_weight_per_package) * packageCount).toFixed(3)), {
      shouldValidate: true,
    });
  }, [selected, packageCount, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ shipment: ShipmentRow }>(`/api/farm/shipments/${shipment.id}/lines`, {
        method: 'POST',
        body: values,
      }),
    {
      success: 'Packing batch allocated',
      invalidate: [farmKeys.shipments, farmKeys.shipment(shipment.id), farmKeys.stock],
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
      title={`Allocate to ${shipment.shipment_no}`}
      description="Link warehouse packing batches to this shipment. Available packages only."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel="Allocate batch"
    >
      <SelectField<ShipmentLineInput>
        name="packing_batch_id"
        label="Packing batch"
        required
        options={options.map((b) => ({
          value: b.id,
          label: `${b.packing_no} · ${b.crop?.name ?? '—'} ${b.grade?.name ?? ''} (${b.stock.available} avail.)`,
        }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField<ShipmentLineInput>
          name="package_count"
          label="Packages"
          required
          description={selected ? `${selected.stock.available} available` : undefined}
        />
        <NumberField<ShipmentLineInput> name="net_weight" label="Net weight (kg)" required />
      </div>
      <TextareaField<ShipmentLineInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
