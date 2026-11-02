'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BlockCycleFields } from '@/components/farm/BlockCycleFields';
import { FormSheet } from '@/components/farm/FormSheet';
import {
  CheckboxListField,
  DateTimeField,
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from '@/components/farm/fields';
import { farmKeys, useActivityTypes, useFarmUsers, useWorkers } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { isoToLocal, localToIso } from '@/lib/farm/format';
import { TASK_STATUSES, optionLabel, taskSchema, type TaskInput } from '@/lib/farm/schemas';
import type { TaskRow } from '@/lib/farm/types';

function nowLocal(): string {
  return isoToLocal(new Date().toISOString())!;
}

function toValues(task?: TaskRow | null): TaskInput {
  if (!task) {
    return {
      worker_ids: [],
      activity_type_id: '',
      block_id: null,
      planting_cycle_id: null,
      supervisor_id: null,
      start_at: nowLocal(),
      due_at: null,
      status: 'assigned',
      completed_at: null,
      target_quantity: null,
      achieved_quantity: null,
      quantity_unit: '',
      hours_spent: null,
      notes: '',
    };
  }
  return {
    worker_ids: [task.worker_id],
    activity_type_id: task.activity_type_id,
    block_id: task.block_id,
    planting_cycle_id: task.planting_cycle_id,
    supervisor_id: task.supervisor_id,
    start_at: isoToLocal(task.start_at)!,
    due_at: isoToLocal(task.due_at),
    status: task.status,
    completed_at: isoToLocal(task.completed_at),
    target_quantity: task.target_quantity == null ? null : Number(task.target_quantity),
    achieved_quantity: task.achieved_quantity == null ? null : Number(task.achieved_quantity),
    quantity_unit: task.quantity_unit ?? '',
    hours_spent: task.hours_spent == null ? null : Number(task.hours_spent),
    notes: task.notes ?? '',
  };
}

type Props = { open: boolean; onOpenChange: (v: boolean) => void; task?: TaskRow | null };

export function TaskSheet({ open, onOpenChange, task }: Props) {
  const users = useFarmUsers();
  const workers = useWorkers();
  const types = useActivityTypes();
  const form = useForm<TaskInput>({ resolver: zodResolver(taskSchema), defaultValues: toValues(task) });
  const status = useWatch({ control: form.control, name: 'status' });

  useEffect(() => {
    if (open) form.reset(toValues(task));
  }, [open, task, form]);

  const save = useFormMutation(
    form,
    (v) => {
      const body = {
        ...v,
        start_at: localToIso(v.start_at),
        due_at: localToIso(v.due_at),
        completed_at: v.status === 'completed' ? localToIso(v.completed_at) : null,
      };
      return task
        ? farmFetch(`/api/farm/tasks/${task.id}`, { method: 'PATCH', body })
        : farmFetch<{ created: number }>('/api/farm/tasks', { method: 'POST', body });
    },
    {
      success: task ? 'Task updated' : 'Task assigned',
      invalidate: [farmKeys.tasks, farmKeys.workers],
      onDone: () => onOpenChange(false),
    }
  );

  const activeWorkers = (workers.data ?? []).filter((w) => w.status === 'active' || w.id === task?.worker_id);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={task ? `Task for ${task.worker?.full_name ?? 'worker'}` : 'Assign task'}
      description={
        task
          ? 'Update progress, or reassign the task to another worker.'
          : 'One task is created for each selected worker so progress and productivity are tracked per person.'
      }
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={task ? 'Save changes' : 'Assign task'}
    >
      {task ? (
        <SelectField<TaskInput>
          name="worker_ids.0"
          label="Worker"
          required
          options={activeWorkers.map((w) => ({ value: w.id, label: `${w.full_name} (${w.worker_code})` }))}
        />
      ) : (
        <CheckboxListField<TaskInput>
          name="worker_ids"
          label="Workers"
          required
          emptyText="No active workers. Add workers first."
          options={activeWorkers.map((w) => ({ value: w.id, label: w.full_name, hint: w.worker_code }))}
        />
      )}
      <SelectField<TaskInput>
        name="activity_type_id"
        label="Activity"
        required
        options={(types.data ?? [])
          .filter((t) => t.status === 'active' || t.id === task?.activity_type_id)
          .map((t) => ({ value: t.id, label: t.name }))}
      />
      <BlockCycleFields<TaskInput>
        blockRequired={false}
        currentCycle={
          task?.planting_cycle_id && task.block_id
            ? { id: task.planting_cycle_id, blockId: task.block_id, label: `${task.crop?.name ?? 'Crop'} planting` }
            : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimeField<TaskInput> name="start_at" label="Start" required />
        <DateTimeField<TaskInput> name="due_at" label="Due" />
        <SelectField<TaskInput>
          name="supervisor_id"
          label="Supervisor"
          emptyLabel="Not assigned"
          options={(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
        />
        <SelectField<TaskInput>
          name="status"
          label="Status"
          required
          options={TASK_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
          onValueChange={(v) => {
            if (v === 'completed' && !form.getValues('completed_at')) form.setValue('completed_at', nowLocal());
          }}
        />
        {status === 'completed' ? (
          <DateTimeField<TaskInput> name="completed_at" label="Completed at" required />
        ) : null}
      </div>

      <div className="space-y-4 rounded-lg border p-3">
        <p className="text-sm font-semibold">Productivity</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField<TaskInput> name="target_quantity" label="Target" />
          <NumberField<TaskInput> name="achieved_quantity" label="Achieved" />
          <TextField<TaskInput> name="quantity_unit" label="Unit" placeholder="plants, rows, kg" />
        </div>
        <NumberField<TaskInput> name="hours_spent" label="Hours spent" suffix="h" />
      </div>
      <TextareaField<TaskInput> name="notes" label="Instructions / notes" />
    </FormSheet>
  );
}
