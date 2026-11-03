import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteFile } from '@/lib/storage';
import { HttpError } from './http';
import { HARVEST_SELECT, single } from './queries';
import type { GradeRef, GradingRow, HarvestBatchDetail, HarvestBatchRow, LabourAllocation, WorkerRow } from './types';
import type { Permission } from './permissions';
import type { ActivityInput, HarvestBatchInput, TaskInput } from './schemas';

export type LabourSettings = { dayHours: number; monthDays: number };

export async function getLabourSettings(supabase: SupabaseClient): Promise<LabourSettings> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['workforce.standard_day_hours', 'workforce.working_days_per_month']);
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key as string, Number(r.value)]));
  return {
    dayHours: map.get('workforce.standard_day_hours') || 8,
    monthDays: map.get('workforce.working_days_per_month') || 26,
  };
}

/** Mirrors farm_worker_hourly_rate() in the database. */
export function hourlyRate(
  worker: Pick<WorkerRow, 'pay_basis' | 'daily_rate' | 'monthly_salary'>,
  s: LabourSettings
): number {
  const rate =
    worker.pay_basis === 'daily'
      ? Number(worker.daily_rate ?? 0) / s.dayHours
      : Number(worker.monthly_salary ?? 0) / s.monthDays / s.dayHours;
  return Math.round(rate * 10000) / 10000;
}

export async function withHourlyRates<T extends Pick<WorkerRow, 'pay_basis' | 'daily_rate' | 'monthly_salary'>>(
  supabase: SupabaseClient,
  workers: T[]
): Promise<(T & { hourly_rate: number })[]> {
  const settings = await getLabourSettings(supabase);
  return workers.map((w) => ({ ...w, hourly_rate: hourlyRate(w, settings) }));
}

/** Validate a planting belongs to the block and return its crop, or null when no planting is given. */
export async function cropForCycle(
  supabase: SupabaseClient,
  farmId: string,
  blockId: string,
  cycleId: string | null | undefined
): Promise<string | null> {
  if (!cycleId) return null;
  const { data, error } = await supabase
    .from('planting_cycles')
    .select('crop_id, block_id')
    .eq('id', cycleId)
    .eq('farm_id', farmId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError('The selected planting does not exist.', 400, { planting_cycle_id: 'Not found' });
  if (data.block_id !== blockId) {
    throw new HttpError('The selected planting is in a different block.', 400, {
      planting_cycle_id: 'Choose a planting in this block',
    });
  }
  return data.crop_id as string;
}

export function activityRpcArgs(id: string | null, farmId: string, userId: string, input: ActivityInput) {
  const { workers, inputs, ...data } = input;
  return { p_id: id, p_farm: farmId, p_user: userId, p_data: data, p_workers: workers, p_inputs: inputs };
}

/** Persist structured weather / spray-window columns (migration 027+) after the RPC save. */
export async function patchActivityWeather(
  supabase: SupabaseClient,
  activityId: string,
  farmId: string,
  input: ActivityInput
) {
  const { error } = await supabase
    .from('farm_activities')
    .update({
      weather: input.weather ?? null,
      weather_temp_c: input.weather_temp_c ?? null,
      weather_wind_kmh: input.weather_wind_kmh ?? null,
      weather_precip_mm: input.weather_precip_mm ?? null,
      weather_humidity_pct: input.weather_humidity_pct ?? null,
      weather_code: input.weather_code ?? null,
      weather_source: input.weather_source ?? null,
      spray_window_score: input.spray_window_score ?? null,
      spray_window_label: input.spray_window_label ?? null,
      spray_window_ok:
        input.spray_window_ok ??
        (input.spray_window_score != null ? input.spray_window_score >= 55 : null),
    })
    .eq('id', activityId)
    .eq('farm_id', farmId);
  if (error) throw error;
}

export function harvestRpcArgs(id: string | null, farmId: string, userId: string, input: HarvestBatchInput) {
  const { workers, ...data } = input;
  return { p_id: id, p_farm: farmId, p_user: userId, p_data: data, p_workers: workers };
}

export function taskRow(input: TaskInput, cropId: string | null) {
  return {
    activity_type_id: input.activity_type_id,
    block_id: input.block_id ?? null,
    planting_cycle_id: input.planting_cycle_id ?? null,
    crop_id: cropId,
    supervisor_id: input.supervisor_id ?? null,
    start_at: input.start_at,
    due_at: input.due_at ?? null,
    status: input.status,
    completed_at: input.status === 'completed' ? input.completed_at : null,
    target_quantity: input.target_quantity ?? null,
    achieved_quantity: input.achieved_quantity ?? null,
    quantity_unit: input.quantity_unit ?? null,
    hours_spent: input.hours_spent ?? null,
    notes: input.notes ?? null,
  };
}

type Named = { code?: string; name?: string } | null;

/**
 * Labour cost in a date range, allocated to block → crop → activity (or harvest).
 * Every figure comes from a worker line or labour cost on a specific activity or harvest batch.
 */
export async function labourAllocation(
  supabase: SupabaseClient,
  farmId: string,
  from: string,
  to: string
): Promise<LabourAllocation[]> {
  const [actRes, harvestRes] = await Promise.all([
    supabase
      .from('farm_activities')
      .select(
        'other_labour_cost, block:blocks!farm_activities_block_id_farm_id_fkey(code), crop:crops!farm_activities_crop_id_fkey(name), activity_type:activity_types!farm_activities_activity_type_id_fkey(name), workers:farm_activity_workers(hours_worked, cost)'
      )
      .eq('farm_id', farmId)
      .gte('activity_date', from)
      .lte('activity_date', to),
    supabase
      .from('harvest_batches')
      .select(
        'other_labour_cost, block:blocks!harvest_batches_block_id_farm_id_fkey(code), crop:crops!harvest_batches_crop_id_fkey(name), workers:harvest_batch_workers(hours_worked, cost)'
      )
      .eq('farm_id', farmId)
      .gte('harvest_date', from)
      .lte('harvest_date', to),
  ]);
  if (actRes.error) throw actRes.error;
  if (harvestRes.error) throw harvestRes.error;

  const groups = new Map<string, LabourAllocation>();
  const add = (source: 'activity' | 'harvest', block: Named, crop: Named, activity: string, hours: number, cost: number) => {
    const key = [source, block?.code, crop?.name, activity].join('|');
    const g = groups.get(key) ?? { source, block: block?.code ?? '—', crop: crop?.name ?? null, activity, hours: 0, cost: 0 };
    g.hours += hours;
    g.cost += cost;
    groups.set(key, g);
  };
  type Row = { other_labour_cost: number; block: Named; crop: Named; activity_type?: Named; workers: { hours_worked: number; cost: number }[] };
  for (const a of (actRes.data ?? []) as unknown as Row[]) {
    const hours = a.workers.reduce((s, w) => s + Number(w.hours_worked), 0);
    const cost = a.workers.reduce((s, w) => s + Number(w.cost), 0) + Number(a.other_labour_cost);
    add('activity', a.block, a.crop, a.activity_type?.name ?? 'Activity', hours, cost);
  }
  for (const h of (harvestRes.data ?? []) as unknown as Row[]) {
    const hours = h.workers.reduce((s, w) => s + Number(w.hours_worked), 0);
    const cost = h.workers.reduce((s, w) => s + Number(w.cost), 0) + Number(h.other_labour_cost);
    add('harvest', h.block, h.crop, 'Harvesting', hours, cost);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, cost: Math.round(g.cost * 100) / 100 }))
    .sort((a, b) => a.block.localeCompare(b.block) || b.cost - a.cost);
}

async function gradeMap(supabase: SupabaseClient): Promise<Map<string, GradeRef>> {
  const { data, error } = await supabase.from('grades').select('id, code, name, purpose, is_reject, sort_order');
  if (error) throw error;
  return new Map((data ?? []).map((g) => [g.id as string, g as GradeRef]));
}

type RawBatch = Omit<HarvestBatchRow, 'grading'> & { grading: GradingRow | GradingRow[] | null };

export async function normalizeBatches(supabase: SupabaseClient, rows: RawBatch[]): Promise<HarvestBatchRow[]> {
  const grades = rows.some((r) => single(r.grading)) ? await gradeMap(supabase) : new Map<string, GradeRef>();
  return rows.map((r) => {
    const grading = single(r.grading);
    return {
      ...r,
      grading: grading
        ? {
            ...grading,
            lines: grading.lines
              .map((l) => ({ ...l, grade: grades.get(l.grade_id) ?? null }))
              .sort((a, b) => (a.grade?.sort_order ?? 0) - (b.grade?.sort_order ?? 0)),
          }
        : null,
    };
  });
}

/** One batch plus the grades enabled for its crop (active ones, and any already used in its grading). */
export async function loadHarvestBatch(supabase: SupabaseClient, farmId: string, id: string): Promise<HarvestBatchDetail> {
  const { data, error } = await supabase
    .from('harvest_batches')
    .select(HARVEST_SELECT)
    .eq('id', id)
    .eq('farm_id', farmId)
    .single();
  if (error) throw error;
  const [batch] = await normalizeBatches(supabase, [data as unknown as RawBatch]);

  const { data: cropGrades, error: gradesError } = await supabase
    .from('crop_grades')
    .select('grade:grades(id, code, name, purpose, is_reject, sort_order, status)')
    .eq('crop_id', batch.crop_id);
  if (gradesError) throw gradesError;
  const used = new Set(batch.grading?.lines.map((l) => l.grade_id) ?? []);
  const crop_grades = (cropGrades ?? [])
    .map((r) => single(r.grade as unknown as (GradeRef & { status: string }) | null))
    .filter((g): g is GradeRef & { status: string } => Boolean(g) && (g!.status === 'active' || used.has(g!.id)))
    .map((g) => ({ id: g.id, code: g.code, name: g.name, purpose: g.purpose, is_reject: g.is_reject, sort_order: g.sort_order }))
    .sort((a, b) => a.sort_order - b.sort_order);
  return { ...batch, crop_grades };
}

// ——— Attachments ———

export const ATTACHMENT_ENTITIES = {
  farm_activity: { table: 'farm_activities', view: 'activities.view', edit: 'activities.record' },
  pest_disease_incident: { table: 'pest_disease_incidents', view: 'pest.view', edit: 'pest.record' },
  harvest_batch: { table: 'harvest_batches', view: 'harvest.view', edit: 'harvest.record' },
  worker: { table: 'workers', view: 'workforce.view', edit: 'workforce.manage' },
  qc_inspection: { table: 'qc_inspections', view: 'qc.view', edit: 'qc.inspect' },
  packing_batch: { table: 'packing_batches', view: 'packing.view', edit: 'packing.record' },
  block: { table: 'blocks', view: 'farm.view', edit: 'farm.manage' },
} satisfies Record<string, { table: string; view: Permission; edit: Permission }>;

export type AttachmentEntity = keyof typeof ATTACHMENT_ENTITIES;

/** Remove a record's files from storage; call after the record itself is deleted. */
export async function deleteAttachmentsFor(supabase: SupabaseClient, entityType: AttachmentEntity, entityId: string) {
  const { data, error } = await supabase
    .from('attachments')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .select('file_path');
  if (error) throw error;
  await Promise.all((data ?? []).map((a) => deleteFile(a.file_path as string)));
}

export function attachmentEntity(type: string | null): (typeof ATTACHMENT_ENTITIES)[AttachmentEntity] {
  if (!type || !(type in ATTACHMENT_ENTITIES)) throw new HttpError('Unsupported attachment type', 400);
  return ATTACHMENT_ENTITIES[type as AttachmentEntity];
}
