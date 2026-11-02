'use client';

import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, PACKHOUSE_KEYS, useWarehouseLocations } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { fmtNumber, todayIso } from '@/lib/farm/format';
import { stockMovementSchema, type StockMovementInput } from '@/lib/farm/schemas';
import type { PackingBatchRow } from '@/lib/farm/types';

export type MovementKind = StockMovementInput['movement_type'];

const COPY: Record<MovementKind, { title: string; description: string; submit: string; success: string }> = {
  receive: {
    title: 'Receive into warehouse',
    description: 'Book the packed batch into stock at a warehouse location. All packages become available.',
    submit: 'Receive stock',
    success: 'Stock received',
  },
  relocate: {
    title: 'Move to another location',
    description: 'Move the whole batch to a different cold room, store or bay.',
    submit: 'Move stock',
    success: 'Stock moved',
  },
  damage: {
    title: 'Record damaged stock',
    description: 'Write off packages that were damaged in storage or handling.',
    submit: 'Record damage',
    success: 'Damaged stock recorded',
  },
  spoil: {
    title: 'Record spoiled stock',
    description: 'Write off packages that spoiled before dispatch.',
    submit: 'Record spoilage',
    success: 'Spoiled stock recorded',
  },
  dispatch: {
    title: 'Dispatch stock',
    description: 'Send export-released packages out of the warehouse.',
    submit: 'Dispatch',
    success: 'Stock dispatched',
  },
};

type Props = { open: boolean; onOpenChange: (v: boolean) => void; batch: PackingBatchRow; kind: MovementKind };

function initialValues(kind: MovementKind, available: number): StockMovementInput {
  return {
    movement_type: kind,
    movement_date: todayIso(),
    packages: kind === 'dispatch' ? available : null,
    to_location_id: null,
    reference: '',
    reason: '',
  };
}

export function StockMovementSheet({ open, onOpenChange, batch, kind }: Props) {
  const locations = useWarehouseLocations();
  const form = useForm<StockMovementInput>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: initialValues(kind, batch.stock.available),
  });
  const availableRef = useRef(batch.stock.available);
  useEffect(() => {
    availableRef.current = batch.stock.available;
  }, [batch.stock.available]);
  useEffect(() => {
    if (open) form.reset(initialValues(kind, availableRef.current));
  }, [open, kind, form]);

  const packages = useWatch({ control: form.control, name: 'packages' });
  const perPackage = Number(batch.net_weight_per_package);
  const copy = COPY[kind];

  const save = useFormMutation(
    form,
    (v) => farmFetch(`/api/farm/packing/${batch.id}/movements`, { method: 'POST', body: v }),
    {
      success: copy.success,
      invalidate: [...PACKHOUSE_KEYS, farmKeys.packingBatch(batch.id)],
      onDone: () => onOpenChange(false),
    }
  );

  function onSubmit(v: StockMovementInput) {
    if (v.packages && v.packages > batch.stock.available && kind !== 'receive' && kind !== 'relocate') {
      form.setError('packages', { type: 'client', message: `Only ${batch.stock.available} packages are available` });
      return;
    }
    save.mutate(v);
  }

  const locationOptions = (locations.data ?? [])
    .filter((l) => l.status === 'active' && l.id !== batch.location_id)
    .map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }));

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${copy.title}: ${batch.packing_no}`}
      description={copy.description}
      form={form}
      onSubmit={onSubmit}
      pending={save.isPending}
      submitLabel={copy.submit}
    >
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        {kind === 'receive' ? (
          <p>
            {batch.package_count} × {batch.packaging?.name ?? 'package'} · {fmtNumber(batch.net_weight)} kg net
          </p>
        ) : (
          <p>
            {batch.stock.available} available
            {batch.stock.reserved ? `, ${batch.stock.reserved} reserved` : ''} at {batch.location?.name ?? '—'} ·{' '}
            {fmtNumber(batch.stock.available * perPackage)} kg net available
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField<StockMovementInput> name="movement_date" label="Date" required />
        {kind === 'receive' || kind === 'relocate' ? (
          <SelectField<StockMovementInput>
            name="to_location_id"
            label={kind === 'receive' ? 'Location' : 'Move to'}
            required
            options={locationOptions}
            description={locationOptions.length ? undefined : 'Add warehouse locations under Administration first.'}
          />
        ) : (
          <NumberField<StockMovementInput>
            name="packages"
            label="Packages"
            required
            step="1"
            description={packages ? `${fmtNumber((Number(packages) || 0) * perPackage)} kg net` : undefined}
          />
        )}
      </div>
      {kind === 'dispatch' ? (
        <TextField<StockMovementInput>
          name="reference"
          label="Dispatch reference"
          required
          placeholder="Delivery note or air waybill number"
        />
      ) : (
        <TextField<StockMovementInput> name="reference" label="Reference" placeholder="Optional document or note number" />
      )}
      <TextareaField<StockMovementInput>
        name="reason"
        label={kind === 'damage' || kind === 'spoil' ? 'Reason' : 'Notes'}
        required={kind === 'damage' || kind === 'spoil'}
      />
    </FormSheet>
  );
}
