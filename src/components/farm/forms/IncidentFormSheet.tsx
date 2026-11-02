'use client';

import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BlockCycleFields } from '@/components/farm/BlockCycleFields';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useFarmUsers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { todayIso } from '@/lib/farm/format';
import {
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  SEVERITIES,
  incidentSchema,
  optionLabel,
  type IncidentInput,
} from '@/lib/farm/schemas';
import type { IncidentRow } from '@/lib/farm/types';

function toValues(incident?: IncidentRow | null, defaults?: Partial<IncidentInput>): IncidentInput {
  if (!incident) {
    return {
      block_id: '',
      planting_cycle_id: null,
      incident_type: 'pest',
      name: '',
      date_identified: todayIso(),
      severity: 'medium',
      description: '',
      area_affected_ha: null,
      action_taken: '',
      treatment: '',
      follow_up_date: null,
      status: 'open',
      resolved_date: null,
      supervisor_id: null,
      ...defaults,
    };
  }
  return {
    block_id: incident.block_id,
    planting_cycle_id: incident.planting_cycle_id,
    incident_type: incident.incident_type,
    name: incident.name,
    date_identified: incident.date_identified,
    severity: incident.severity,
    description: incident.description ?? '',
    area_affected_ha: incident.area_affected_ha == null ? null : Number(incident.area_affected_ha),
    action_taken: incident.action_taken ?? '',
    treatment: incident.treatment ?? '',
    follow_up_date: incident.follow_up_date,
    status: incident.status,
    resolved_date: incident.resolved_date,
    supervisor_id: incident.supervisor_id,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incident?: IncidentRow | null;
  defaults?: Partial<IncidentInput>;
  onSaved?: (incident: IncidentRow) => void;
};

export function IncidentFormSheet({ open, onOpenChange, incident, defaults, onSaved }: Props) {
  const users = useFarmUsers();
  const form = useForm<IncidentInput>({ resolver: zodResolver(incidentSchema), defaultValues: toValues(incident, defaults) });
  const status = useWatch({ control: form.control, name: 'status' });

  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);
  useEffect(() => {
    if (open) form.reset(toValues(incident, defaultsRef.current));
  }, [open, incident, form]);

  const save = useFormMutation(
    form,
    (v) =>
      farmFetch<{ incident: IncidentRow }>(incident ? `/api/farm/incidents/${incident.id}` : '/api/farm/incidents', {
        method: incident ? 'PATCH' : 'POST',
        body: { ...v, resolved_date: v.status === 'resolved' ? v.resolved_date : null },
      }),
    {
      success: incident ? 'Incident updated' : 'Incident reported',
      invalidate: [farmKeys.incidents],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.incident);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={incident ? `Edit ${incident.name}` : 'Report pest or disease'}
      description="Record what was found, how severe it is and the action taken, then follow it up until resolved."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={incident ? 'Save changes' : 'Report incident'}
    >
      <BlockCycleFields<IncidentInput>
        currentCycle={
          incident?.planting_cycle_id
            ? { id: incident.planting_cycle_id, blockId: incident.block_id, label: `${incident.crop?.name ?? 'Crop'} planting` }
            : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField<IncidentInput>
          name="incident_type"
          label="Type"
          required
          options={INCIDENT_TYPES.map((t) => ({ value: t, label: optionLabel(t) }))}
        />
        <TextField<IncidentInput> name="name" label="Pest / disease" required placeholder="Aphids" className="sm:col-span-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <DateField<IncidentInput> name="date_identified" label="Identified on" required />
        <SelectField<IncidentInput>
          name="severity"
          label="Severity"
          required
          options={SEVERITIES.map((s) => ({ value: s, label: optionLabel(s) }))}
        />
        <NumberField<IncidentInput> name="area_affected_ha" label="Area affected" suffix="ha" />
      </div>
      <TextareaField<IncidentInput> name="description" label="What was observed" />
      <TextareaField<IncidentInput> name="action_taken" label="Action taken" />
      <TextareaField<IncidentInput> name="treatment" label="Treatment applied" placeholder="Product, rate and date" rows={2} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<IncidentInput>
          name="supervisor_id"
          label="Responsible"
          emptyLabel="Not assigned"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
        <DateField<IncidentInput> name="follow_up_date" label="Follow up on" />
        <SelectField<IncidentInput>
          name="status"
          label="Status"
          required
          options={INCIDENT_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
          onValueChange={(v) => {
            if (v === 'resolved' && !form.getValues('resolved_date')) form.setValue('resolved_date', todayIso());
          }}
        />
        {status === 'resolved' ? <DateField<IncidentInput> name="resolved_date" label="Resolved on" required /> : null}
      </div>
    </FormSheet>
  );
}
