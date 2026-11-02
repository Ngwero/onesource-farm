'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Lock } from 'lucide-react';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField } from '@/components/farm/fields';
import { QC_STATUS_LABEL } from '@/components/farm/StatusChip';
import { farmKeys, PACKHOUSE_KEYS, useFarmUsers, usePackagingTypes } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtNumber, fmtQty, todayIso } from '@/lib/farm/format';
import { packingBatchSchema, type PackingBatchInput } from '@/lib/farm/schemas';
import type { PackingBatchDetail, PackingBatchRow, PackingSource } from '@/lib/farm/types';

function toValues(batch?: PackingBatchDetail | null, defaults?: Partial<PackingBatchInput>): PackingBatchInput {
  if (!batch) {
    return {
      harvest_batch_id: '',
      grade_id: '',
      packaging_type_id: '',
      packing_date: todayIso(),
      package_count: null as unknown as number,
      net_weight_per_package: null as unknown as number,
      tare_weight_per_package: 0,
      packed_by: null,
      notes: '',
      ...defaults,
    };
  }
  return {
    harvest_batch_id: batch.harvest_batch_id,
    grade_id: batch.grade_id,
    packaging_type_id: batch.packaging_type_id,
    packing_date: batch.packing_date,
    package_count: Number(batch.package_count),
    net_weight_per_package: Number(batch.net_weight_per_package),
    tare_weight_per_package: Number(batch.tare_weight_per_package),
    packed_by: batch.packed_by,
    notes: batch.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch?: PackingBatchDetail | null;
  defaults?: Partial<PackingBatchInput>;
  onSaved?: (batch: PackingBatchRow) => void;
};

export function PackingBatchSheet({ open, onOpenChange, batch, defaults, onSaved }: Props) {
  const editing = Boolean(batch);
  const users = useFarmUsers();
  const packaging = usePackagingTypes();
  const sources = useQuery({
    queryKey: farmKeys.packingSources,
    queryFn: () => farmFetch<{ sources: PackingSource[] }>('/api/farm/packing/sources').then((r) => r.sources),
    enabled: open && !editing,
  });
  const form = useForm<PackingBatchInput>({ resolver: zodResolver(packingBatchSchema), defaultValues: toValues(batch, defaults) });

  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);
  useEffect(() => {
    if (open) form.reset(toValues(batch, defaultsRef.current));
  }, [open, batch, form]);

  const [harvestId, gradeId, count, net, tare] = useWatch({
    control: form.control,
    name: ['harvest_batch_id', 'grade_id', 'package_count', 'net_weight_per_package', 'tare_weight_per_package'],
  });

  const sourceList = useMemo(() => sources.data ?? [], [sources.data]);
  const source = sourceList.find((s) => s.id === harvestId) ?? null;
  const gradeOption = source?.grades.find((g) => g.grade_id === gradeId) ?? null;
  const locked = Boolean(batch && (batch.received_date || batch.inspections.length));

  // Kilograms still free to pack for this grade, counting this batch's own weight when editing.
  const remainingKg = editing
    ? batch!.source.packedKg == null
      ? null
      : Number(batch!.source.graded) * (batch!.source.unit === 'tonne' ? 1000 : 1) - batch!.source.packedKg + Number(batch!.net_weight)
    : (gradeOption?.remainingKg ?? null);
  const netTotal = (Number(count) || 0) * (Number(net) || 0);
  const grossTotal = (Number(count) || 0) * ((Number(net) || 0) + (Number(tare) || 0));
  const over = remainingKg != null && netTotal > remainingKg + 1e-9;

  const activePackaging = (packaging.data ?? []).filter((p) => p.status === 'active' || p.id === batch?.packaging_type_id);

  function pickHarvest(id: string | null) {
    const s = sourceList.find((x) => x.id === id);
    form.setValue('grade_id', s && s.grades.length === 1 ? s.grades[0].grade_id : '', { shouldValidate: false });
  }

  function pickPackaging(id: string | null) {
    const p = (packaging.data ?? []).find((x) => x.id === id);
    if (!p) return;
    if (p.capacity_unit === 'kg') form.setValue('net_weight_per_package', Number(p.standard_capacity), { shouldValidate: true });
    else if (p.capacity_unit === 'g') form.setValue('net_weight_per_package', Number(p.standard_capacity) / 1000, { shouldValidate: true });
    form.setValue('tare_weight_per_package', Number(p.tare_weight_kg ?? 0), { shouldValidate: true });
  }

  const save = useFormMutation(
    form,
    (v) =>
      editing
        ? farmFetch<{ batch: PackingBatchDetail }>(`/api/farm/packing/${batch!.id}`, { method: 'PATCH', body: v })
        : farmFetch<{ batch: PackingBatchDetail }>('/api/farm/packing', { method: 'POST', body: v }),
    {
      success: editing ? 'Packed batch updated' : 'Packed batch recorded',
      invalidate: [...PACKHOUSE_KEYS, farmKeys.packingSources, ...(batch ? [farmKeys.packingBatch(batch.id)] : [])],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.batch);
      },
    }
  );

  function onSubmit(v: PackingBatchInput) {
    if (over) {
      form.setError('package_count', {
        type: 'client',
        message: `Only ${fmtNumber(remainingKg!, 3)} kg of this grade is left to pack.`,
      });
      return;
    }
    save.mutate(v);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${batch!.packing_no}` : 'Record packed batch'}
      description="Pack graded produce from a harvest batch. Each packed batch gets its own number that follows it through QC, the warehouse and shipment."
      form={form}
      onSubmit={onSubmit}
      pending={save.isPending}
      submitLabel={editing ? 'Save changes' : 'Record packing'}
    >
      {editing ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">
            {batch!.harvest?.batch_no} · {batch!.grade?.name}
          </p>
          <p className="text-muted-foreground">
            {batch!.crop?.name}, packed {fmtDate(batch!.packing_date)}. The source batch, grade and date cannot change.
          </p>
        </div>
      ) : (
        <>
          <SelectField<PackingBatchInput>
            name="harvest_batch_id"
            label="Harvest batch"
            required
            placeholder={sources.isLoading ? 'Loading…' : 'Select a graded batch'}
            options={sourceList.map((s) => ({
              value: s.id,
              label: `${s.batch_no} · ${s.crop?.name ?? ''} · ${fmtDate(s.harvest_date)}${s.qc_status !== 'pending' ? ` · ${QC_STATUS_LABEL[s.qc_status]}` : ''}`,
            }))}
            onValueChange={pickHarvest}
            description={
              !sources.isLoading && sourceList.length === 0
                ? 'No graded harvests have produce left to pack. Grade a harvest batch first.'
                : 'Only graded batches with produce left to pack are listed.'
            }
          />
          <SelectField<PackingBatchInput>
            name="grade_id"
            label="Grade"
            required
            disabled={!source}
            placeholder={source ? 'Select a grade' : 'Choose a harvest batch first'}
            options={(source?.grades ?? []).map((g) => ({
              value: g.grade_id,
              label: `${g.name} · ${g.remainingKg == null ? fmtQty(g.graded, source!.unit) : `${fmtNumber(g.remainingKg, 3)} kg left`}`,
            }))}
          />
        </>
      )}

      {locked ? (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Lock className="mt-0.5 size-4 shrink-0" />
          This batch has been received into the warehouse or inspected, so packaging, packages and weights are locked.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<PackingBatchInput>
          name="packaging_type_id"
          label="Packaging"
          required
          disabled={locked}
          options={activePackaging.map((p) => ({ value: p.id, label: `${p.name} (${fmtNumber(p.standard_capacity)} ${p.capacity_unit})` }))}
          onValueChange={pickPackaging}
        />
        <DateField<PackingBatchInput> name="packing_date" label="Packing date" required disabled={editing} />
        <NumberField<PackingBatchInput> name="package_count" label="Number of packages" required step="1" disabled={locked} />
        <NumberField<PackingBatchInput> name="net_weight_per_package" label="Net weight per package" required suffix="kg" disabled={locked} />
        <NumberField<PackingBatchInput>
          name="tare_weight_per_package"
          label="Packaging weight per package"
          suffix="kg"
          disabled={locked}
          description="Empty packaging weight, used for gross weight"
        />
        <SelectField<PackingBatchInput>
          name="packed_by"
          label="Packed by"
          emptyLabel="Not recorded"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Net weight</p>
          <p className="font-semibold">{fmtNumber(netTotal, 3)} kg</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Gross weight</p>
          <p className="font-semibold">{fmtNumber(grossTotal, 3)} kg</p>
        </div>
        <div className={over ? 'rounded-md border border-amber-300 bg-amber-50 px-3 py-2' : 'rounded-md border px-3 py-2'}>
          <p className="text-xs text-muted-foreground">Left to pack</p>
          <p className="font-semibold">{remainingKg == null ? '—' : `${fmtNumber(Math.max(remainingKg - netTotal, 0), 3)} kg`}</p>
        </div>
      </div>
      {over ? (
        <p className="flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="size-4" /> More than the {fmtNumber(remainingKg!, 3)} kg graded and not yet packed.
        </p>
      ) : null}

      <TextareaField<PackingBatchInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
