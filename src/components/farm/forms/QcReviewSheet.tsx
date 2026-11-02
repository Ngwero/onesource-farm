'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { SelectField, TextareaField } from '@/components/farm/fields';
import { farmKeys, PACKHOUSE_KEYS } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { optionLabel, qcReviewSchema, qcReworkSchema, type QcReviewInput, type QcReworkInput } from '@/lib/farm/schemas';
import type { QcInspectionRow } from '@/lib/farm/types';

const DECISION_HELP: Record<QcReviewInput['decision'], string> = {
  approved: 'The batch becomes QC approved. Packed batches can then be released for export.',
  rework: 'The batch must be re-sorted or reworked, then inspected again.',
  reinspection: 'The batch must be inspected again before a decision.',
  rejected: 'The batch fails QC. Failed harvest batches cannot be packed.',
};

type Props = { open: boolean; onOpenChange: (v: boolean) => void; inspection: QcInspectionRow };

export function QcReviewSheet({ open, onOpenChange, inspection }: Props) {
  const form = useForm<QcReviewInput>({
    resolver: zodResolver(qcReviewSchema),
    defaultValues: { decision: null as unknown as QcReviewInput['decision'], notes: '' },
  });
  useEffect(() => {
    if (open) form.reset({ decision: null as unknown as QcReviewInput['decision'], notes: '' });
  }, [open, form]);
  const decision = useWatch({ control: form.control, name: 'decision' });
  const notesRequired = Boolean(decision) && (decision !== 'approved' || inspection.result === 'conditional_pass');

  const save = useFormMutation(
    form,
    (v) => farmFetch(`/api/farm/qc/${inspection.id}/review`, { method: 'POST', body: v }),
    {
      success: 'Review saved',
      invalidate: [...PACKHOUSE_KEYS, farmKeys.inspection(inspection.id)],
      onDone: () => onOpenChange(false),
    }
  );

  function onSubmit(v: QcReviewInput) {
    if (notesRequired && !v.notes?.trim()) {
      form.setError('notes', { type: 'client', message: 'Explain the decision' });
      return;
    }
    save.mutate(v);
  }

  const options = (['approved', 'rework', 'reinspection', 'rejected'] as const)
    .filter((d) => d !== 'approved' || inspection.result !== 'fail')
    .map((d) => ({ value: d, label: d === 'approved' ? 'Approve' : d === 'rejected' ? 'Reject' : optionLabel(d) }));

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Review ${inspection.inspection_no}`}
      description={`Inspector result: ${optionLabel(inspection.result)}. Decide what happens to ${inspection.packing?.packing_no ?? inspection.harvest?.batch_no ?? 'the batch'}.`}
      form={form}
      onSubmit={onSubmit}
      pending={save.isPending}
      submitLabel="Save decision"
    >
      <SelectField<QcReviewInput>
        name="decision"
        label="Decision"
        required
        options={options}
        description={decision ? DECISION_HELP[decision] : inspection.result === 'fail' ? 'A failed inspection cannot be approved.' : undefined}
      />
      <TextareaField<QcReviewInput>
        name="notes"
        label="Review notes"
        required={notesRequired}
        rows={4}
        placeholder={decision === 'rework' ? 'What must be re-sorted or reworked' : undefined}
      />
    </FormSheet>
  );
}

export function QcReworkSheet({ open, onOpenChange, inspection }: Props) {
  const form = useForm<QcReworkInput>({ resolver: zodResolver(qcReworkSchema), defaultValues: { notes: '' } });
  useEffect(() => {
    if (open) form.reset({ notes: '' });
  }, [open, form]);

  const save = useFormMutation(
    form,
    (v) => farmFetch(`/api/farm/qc/${inspection.id}/rework`, { method: 'POST', body: v }),
    {
      success: 'Rework recorded — the batch now needs reinspection',
      invalidate: [...PACKHOUSE_KEYS, farmKeys.inspection(inspection.id)],
      onDone: () => onOpenChange(false),
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Record rework done"
      description={inspection.review_notes ? `Requested: ${inspection.review_notes}` : 'Describe the rework or re-sorting carried out.'}
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel="Save rework"
    >
      <TextareaField<QcReworkInput>
        name="notes"
        label="Rework carried out"
        required
        rows={5}
        placeholder="e.g. Re-sorted 3 cartons, removed off-colour pods, repacked"
      />
    </FormSheet>
  );
}
