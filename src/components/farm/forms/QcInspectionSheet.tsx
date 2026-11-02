'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { QC_STATUS_LABEL } from '@/components/farm/StatusChip';
import { farmKeys, PACKHOUSE_KEYS, useFarmUsers, useMasterList } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtNumber, fmtQty, todayIso } from '@/lib/farm/format';
import { qcInspectionSchema, type QcInspectionInput } from '@/lib/farm/schemas';
import type { QcInspectionRow, QcStatus, QualityCriterionRow } from '@/lib/farm/types';
import { cn } from '@/lib/utils';

type Named = { id: string; code: string; name: string } | null;
type Subjects = {
  harvests: { id: string; batch_no: string; harvest_date: string; quantity: number; unit: string; qc_status: QcStatus; crop_id: string; crop: Named; block: Named; awaiting_review: boolean }[];
  packing: { id: string; packing_no: string; packing_date: string; package_count: number; net_weight: number; qc_status: QcStatus; crop_id: string; crop: Named; grade: Named; awaiting_review: boolean }[];
  criteria: QualityCriterionRow[];
};
type Reason = { id: string; name: string; status: string };
type CheckMeta = Pick<QualityCriterionRow, 'name' | 'criterion_type' | 'unit' | 'min_value' | 'max_value' | 'is_mandatory'> & { guidance?: string | null };
type Check = QcInspectionInput['checks'][number];

export type QcDefaults = Partial<Pick<QcInspectionInput, 'subject_type' | 'harvest_batch_id' | 'packing_batch_id'>>;

function blankChecks(criteria: QualityCriterionRow[]): Check[] {
  return criteria.map((c) => ({ criterion_id: c.id, passed: null, value_numeric: null, value_text: null, notes: null }));
}

function toValues(inspection?: QcInspectionRow | null, defaults?: QcDefaults): QcInspectionInput {
  if (!inspection) {
    return {
      subject_type: 'packing_batch',
      harvest_batch_id: null,
      packing_batch_id: null,
      inspection_date: todayIso(),
      inspector_id: null,
      sample_size: null,
      sample_unit: 'kg',
      buyer_specification: '',
      result: null as unknown as QcInspectionInput['result'],
      rejected_quantity: null,
      rejection_reason_id: null,
      corrective_action: '',
      notes: '',
      checks: [],
      ...defaults,
    };
  }
  return {
    subject_type: inspection.subject_type,
    harvest_batch_id: inspection.harvest_batch_id,
    packing_batch_id: inspection.packing_batch_id,
    inspection_date: inspection.inspection_date,
    inspector_id: inspection.inspector_id,
    sample_size: inspection.sample_size == null ? null : Number(inspection.sample_size),
    sample_unit: inspection.sample_unit ?? '',
    buyer_specification: inspection.buyer_specification ?? '',
    result: inspection.result,
    rejected_quantity: inspection.rejected_quantity == null ? null : Number(inspection.rejected_quantity),
    rejection_reason_id: inspection.rejection_reason_id,
    corrective_action: inspection.corrective_action ?? '',
    notes: inspection.notes ?? '',
    checks: inspection.checks
      .filter((c) => c.criterion_id)
      .map((c) => ({
        criterion_id: c.criterion_id!,
        passed: c.passed,
        value_numeric: c.value_numeric == null ? null : Number(c.value_numeric),
        value_text: c.value_text,
        notes: c.notes,
      })),
  };
}

/** Numeric and scale checks with limits pass or fail by range; others are marked by the inspector. */
function autoResult(meta: CheckMeta, value: number | null | undefined): boolean | null {
  if (meta.criterion_type !== 'numeric' && meta.criterion_type !== 'scale') return null;
  if (meta.min_value == null && meta.max_value == null) return null;
  if (value == null || Number.isNaN(value)) return null;
  return (meta.min_value == null || value >= Number(meta.min_value)) && (meta.max_value == null || value <= Number(meta.max_value));
}

function rangeText(meta: CheckMeta): string | null {
  const unit = meta.unit ? ` ${meta.unit}` : '';
  if (meta.min_value != null && meta.max_value != null) return `${fmtNumber(meta.min_value)}–${fmtNumber(meta.max_value)}${unit}`;
  if (meta.min_value != null) return `at least ${fmtNumber(meta.min_value)}${unit}`;
  if (meta.max_value != null) return `at most ${fmtNumber(meta.max_value)}${unit}`;
  return null;
}

function PassFail({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={cn('flex items-center gap-1 px-2.5 py-1.5', value === true ? 'bg-emerald-600 text-white' : 'hover:bg-muted')}
      >
        <Check className="size-3.5" /> Pass
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={cn('flex items-center gap-1 border-l px-2.5 py-1.5', value === false ? 'bg-red-600 text-white' : 'hover:bg-muted')}
      >
        <X className="size-3.5" /> Fail
      </button>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inspection?: QcInspectionRow | null;
  defaults?: QcDefaults;
  onSaved?: (inspection: QcInspectionRow) => void;
};

export function QcInspectionSheet({ open, onOpenChange, inspection, defaults, onSaved }: Props) {
  const editing = Boolean(inspection);
  const users = useFarmUsers();
  const reasons = useMasterList<Reason>('rejection-reasons');
  const subjects = useQuery({
    queryKey: farmKeys.qcSubjects,
    queryFn: () => farmFetch<Subjects>('/api/farm/qc/subjects'),
    enabled: open && !editing,
  });
  const form = useForm<QcInspectionInput>({ resolver: zodResolver(qcInspectionSchema), defaultValues: toValues(inspection, defaults) });

  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);
  useEffect(() => {
    if (open) form.reset(toValues(inspection, defaultsRef.current));
  }, [open, inspection, form]);

  const [subjectType, harvestId, packingId, checks, result, rejectedQty] = useWatch({
    control: form.control,
    name: ['subject_type', 'harvest_batch_id', 'packing_batch_id', 'checks', 'result', 'rejected_quantity'],
  });

  const harvests = useMemo(() => subjects.data?.harvests ?? [], [subjects.data]);
  const packing = useMemo(() => subjects.data?.packing ?? [], [subjects.data]);
  const criteria = useMemo(() => subjects.data?.criteria ?? [], [subjects.data]);

  function cropOf(type: string | undefined, id: string | null | undefined): string | null {
    if (!id) return null;
    return type === 'harvest_batch' ? (harvests.find((h) => h.id === id)?.crop_id ?? null) : (packing.find((p) => p.id === id)?.crop_id ?? null);
  }

  function loadChecks(type: string | undefined, id: string | null | undefined) {
    const crop = cropOf(type, id);
    form.setValue('checks', crop ? blankChecks(criteria.filter((c) => c.crop_id === crop)) : []);
  }

  // A batch passed in from another page needs its checklist once the subjects have loaded.
  const seeded = useRef(false);
  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (editing || seeded.current || !subjects.data) return;
    seeded.current = true;
    const values = form.getValues();
    if (values.checks.length) return;
    const { harvests: hs, packing: ps, criteria: cs } = subjects.data;
    const crop =
      values.subject_type === 'harvest_batch'
        ? hs.find((h) => h.id === values.harvest_batch_id)?.crop_id
        : ps.find((p) => p.id === values.packing_batch_id)?.crop_id;
    if (crop) form.setValue('checks', blankChecks(cs.filter((c) => c.crop_id === crop)));
  }, [open, editing, subjects.data, form]);

  const meta = useMemo(() => {
    const map = new Map<string, CheckMeta>();
    if (inspection) for (const c of inspection.checks) if (c.criterion_id) map.set(c.criterion_id, c);
    for (const c of criteria) map.set(c.id, c);
    return map;
  }, [inspection, criteria]);

  const rows = (checks ?? []).map((c, i) => {
    const m = meta.get(c.criterion_id);
    const auto = m ? autoResult(m, c.value_numeric) : null;
    return { check: c, index: i, meta: m, passed: auto ?? c.passed ?? null, auto: auto != null };
  });
  const failedMandatory = rows.filter((r) => r.meta?.is_mandatory && r.passed === false).map((r) => r.meta!.name);
  const unmarked = rows.filter((r) => r.meta?.is_mandatory && r.passed == null && r.meta.criterion_type === 'pass_fail').length;

  const subjectUnit = editing
    ? inspection!.harvest?.unit ?? 'kg'
    : subjectType === 'harvest_batch'
      ? (harvests.find((h) => h.id === harvestId)?.unit ?? 'kg')
      : 'kg';

  function setCheck(index: number, patch: Partial<Check>) {
    form.setValue(`checks.${index}`, { ...form.getValues(`checks.${index}`), ...patch }, { shouldDirty: true });
  }

  const save = useFormMutation(
    form,
    (v) => {
      const body = {
        ...v,
        checks: v.checks.map((c) => {
          const m = meta.get(c.criterion_id);
          const auto = m ? autoResult(m, c.value_numeric) : null;
          return { ...c, passed: auto ?? c.passed ?? null };
        }),
      };
      return editing
        ? farmFetch<{ inspection: QcInspectionRow }>(`/api/farm/qc/${inspection!.id}`, { method: 'PATCH', body })
        : farmFetch<{ inspection: QcInspectionRow }>('/api/farm/qc', { method: 'POST', body });
    },
    {
      success: editing ? 'Inspection updated' : 'Inspection recorded',
      invalidate: [...PACKHOUSE_KEYS, farmKeys.qcSubjects, ...(inspection ? [farmKeys.inspection(inspection.id)] : [])],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.inspection);
      },
    }
  );

  function onSubmit(v: QcInspectionInput) {
    if (!v.checks.length) {
      form.setError('root', { type: 'client', message: 'Choose a batch whose crop has quality criteria set up.' });
      return;
    }
    if (v.result === 'pass' && failedMandatory.length) {
      form.setError('result', { type: 'client', message: `Failed: ${failedMandatory.join(', ')}. Use Conditional pass or Fail.` });
      return;
    }
    save.mutate(v);
  }

  const harvestOptions = harvests
    .filter((h) => !h.awaiting_review || h.id === harvestId)
    .map((h) => ({
      value: h.id,
      label: `${h.batch_no} · ${h.crop?.name ?? ''} · ${fmtQty(h.quantity, h.unit)} · ${QC_STATUS_LABEL[h.qc_status]}`,
    }));
  const packingOptions = packing
    .filter((p) => !p.awaiting_review || p.id === packingId)
    .map((p) => ({
      value: p.id,
      label: `${p.packing_no} · ${fmtNumber(p.net_weight)} kg · ${QC_STATUS_LABEL[p.qc_status]}`,
    }));

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${inspection!.inspection_no}` : 'Record QC inspection'}
      description="Check a sample against the crop's quality criteria. A supervisor then reviews the inspection before the batch can be approved or released."
      form={form}
      onSubmit={onSubmit}
      pending={save.isPending}
      submitLabel={editing ? 'Save changes' : 'Record inspection'}
    >
      {editing ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{inspection!.harvest?.batch_no ?? inspection!.packing?.packing_no}</p>
          <p className="text-muted-foreground">{inspection!.crop?.name}. The inspected batch cannot change.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <SelectField<QcInspectionInput>
            name="subject_type"
            label="Inspecting"
            options={[
              { value: 'packing_batch', label: 'Packed batch' },
              { value: 'harvest_batch', label: 'Harvest batch' },
            ]}
            onValueChange={(v) => {
              form.setValue('harvest_batch_id', null);
              form.setValue('packing_batch_id', null);
              form.setValue('checks', []);
              if (v === 'harvest_batch') form.setValue('sample_unit', 'kg');
            }}
          />
          {subjectType === 'harvest_batch' ? (
            <SelectField<QcInspectionInput>
              key="harvest"
              name="harvest_batch_id"
              label="Harvest batch"
              required
              placeholder={subjects.isLoading ? 'Loading…' : 'Select a batch'}
              options={harvestOptions}
              onValueChange={(id) => loadChecks('harvest_batch', id)}
              description="Harvests from the last 90 days. Batches with an inspection awaiting review are not listed."
            />
          ) : (
            <SelectField<QcInspectionInput>
              key="packing"
              name="packing_batch_id"
              label="Packed batch"
              required
              placeholder={subjects.isLoading ? 'Loading…' : 'Select a batch'}
              options={packingOptions}
              onValueChange={(id) => loadChecks('packing_batch', id)}
              description="Batches not yet released. Those with an inspection awaiting review are not listed."
            />
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField<QcInspectionInput> name="inspection_date" label="Inspection date" required />
        <SelectField<QcInspectionInput>
          name="inspector_id"
          label="Inspector"
          emptyLabel="Not recorded"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
        <NumberField<QcInspectionInput> name="sample_size" label="Sample size" />
        <TextField<QcInspectionInput> name="sample_unit" label="Sample unit" placeholder="kg, pieces, cartons" />
      </div>
      <TextareaField<QcInspectionInput>
        name="buyer_specification"
        label="Buyer specification"
        rows={2}
        placeholder="Buyer-specific requirements checked, if any"
      />

      <section className="space-y-2 rounded-lg border p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Quality checks</p>
          {rows.length ? (
            <p className="text-xs text-muted-foreground">
              {rows.filter((r) => r.passed === true).length} passed · {rows.filter((r) => r.passed === false).length} failed
            </p>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {editing || harvestId || packingId
              ? 'This crop has no active quality criteria. Add them on the crop’s QC criteria tab.'
              : 'Choose a batch to load its crop’s checklist.'}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map(({ check, index, meta: m, passed, auto }) => {
              if (!m) return null;
              const range = rangeText(m);
              return (
                <li key={check.criterion_id} className="space-y-2 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {m.name}
                        {m.is_mandatory ? <span className="text-destructive">*</span> : null}
                      </p>
                      {range || m.guidance ? (
                        <p className="text-xs text-muted-foreground">{[range ? `Spec ${range}` : null, m.guidance].filter(Boolean).join(' · ')}</p>
                      ) : null}
                    </div>
                    {auto ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        )}
                      >
                        {passed ? 'Within spec' : 'Out of spec'}
                      </span>
                    ) : (
                      <PassFail value={check.passed} onChange={(v) => setCheck(index, { passed: v })} />
                    )}
                  </div>
                  {m.criterion_type === 'numeric' || m.criterion_type === 'scale' ? (
                    <div className="relative w-40">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        aria-label={`${m.name} measured value`}
                        placeholder="Measured value"
                        value={check.value_numeric ?? ''}
                        onChange={(e) => setCheck(index, { value_numeric: e.target.value === '' ? null : e.target.valueAsNumber })}
                        className={m.unit ? 'pr-12' : undefined}
                      />
                      {m.unit ? (
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{m.unit}</span>
                      ) : null}
                    </div>
                  ) : m.criterion_type === 'text' ? (
                    <Input
                      aria-label={`${m.name} observation`}
                      placeholder="Observation"
                      value={check.value_text ?? ''}
                      onChange={(e) => setCheck(index, { value_text: e.target.value })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {unmarked ? <p className="text-xs text-muted-foreground">{unmarked} mandatory checks still to mark.</p> : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<QcInspectionInput>
          name="result"
          label="Result"
          required
          options={[
            { value: 'pass', label: 'Pass' },
            { value: 'conditional_pass', label: 'Conditional pass' },
            { value: 'fail', label: 'Fail' },
          ]}
        />
        <NumberField<QcInspectionInput> name="rejected_quantity" label="Rejected quantity" suffix={subjectUnit} />
      </div>
      {failedMandatory.length && result === 'pass' ? (
        <p className="flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="size-4" /> Failed mandatory checks: {failedMandatory.join(', ')}.
        </p>
      ) : null}
      {Number(rejectedQty) > 0 ? (
        <SelectField<QcInspectionInput>
          name="rejection_reason_id"
          label="Rejection reason"
          required
          options={(reasons.data ?? []).filter((r) => r.status === 'active').map((r) => ({ value: r.id, label: r.name }))}
        />
      ) : null}
      <TextareaField<QcInspectionInput>
        name="corrective_action"
        label="Corrective action / rework needed"
        rows={2}
        placeholder="Re-sorting, re-packing or other action recommended"
      />
      <TextareaField<QcInspectionInput> name="notes" label="Inspector notes" />
      {!editing && subjectType === 'harvest_batch' && harvestId ? (
        <p className="text-xs text-muted-foreground">
          Harvested {fmtDate(harvests.find((h) => h.id === harvestId)?.harvest_date)} from block {harvests.find((h) => h.id === harvestId)?.block?.code}.
        </p>
      ) : null}
    </FormSheet>
  );
}
