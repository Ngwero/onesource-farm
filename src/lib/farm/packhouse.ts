import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBatches } from './operations';
import { HARVEST_SELECT, MOVEMENT_SELECT, PACKING_SELECT, QC_SELECT, single } from './queries';
import type { Permission } from './permissions';
import type { QcInspectionInput } from './schemas';
import type {
  PackingBatchDetail,
  PackingBatchRow,
  PackingSource,
  QcInspectionRow,
  StockBalance,
  StockMovementRow,
  TraceResult,
} from './types';

const EMPTY_STOCK: StockBalance = { available: 0, reserved: 0, dispatched: 0, damaged: 0, spoiled: 0 };

/** kg per harvest unit, or null when the harvest is not weighed (crates, bunches…). */
export function kgFactor(unit: string): number | null {
  if (unit === 'kg') return 1;
  if (unit === 'tonne') return 1000;
  return null;
}

type RawPacking = Omit<PackingBatchRow, 'stock'>;

/** Attach ledger-derived package balances to packed batches. */
export async function withStock(supabase: SupabaseClient, farmId: string, rows: RawPacking[]): Promise<PackingBatchRow[]> {
  if (!rows.length) return [];
  let query = supabase
    .from('packing_batch_stock')
    .select('packing_batch_id, available, reserved, dispatched, damaged, spoiled');
  query = rows.length <= 150 ? query.in('packing_batch_id', rows.map((r) => r.id)) : query.eq('farm_id', farmId);
  const { data, error } = await query;
  if (error) throw error;
  const balances = new Map((data ?? []).map((s) => [s.packing_batch_id as string, s]));
  return rows.map((r) => {
    const s = balances.get(r.id);
    return {
      ...r,
      stock: s
        ? {
            available: Number(s.available),
            reserved: Number(s.reserved),
            dispatched: Number(s.dispatched),
            damaged: Number(s.damaged),
            spoiled: Number(s.spoiled),
          }
        : EMPTY_STOCK,
    };
  });
}

export function qcRpcArgs(id: string | null, farmId: string, userId: string, input: QcInspectionInput) {
  const { checks, ...data } = input;
  return { p_id: id, p_farm: farmId, p_user: userId, p_data: data, p_checks: checks };
}

export function normalizeInspection(row: QcInspectionRow): QcInspectionRow {
  return {
    ...row,
    harvest: single(row.harvest),
    packing: single(row.packing),
    checks: [...(row.checks ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function loadInspections(
  supabase: SupabaseClient,
  farmId: string,
  by: { column: 'id' | 'harvest_batch_id' | 'packing_batch_id'; ids: string[] }
): Promise<QcInspectionRow[]> {
  if (!by.ids.length) return [];
  const { data, error } = await supabase
    .from('qc_inspections')
    .select(QC_SELECT)
    .eq('farm_id', farmId)
    .in(by.column, by.ids)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as QcInspectionRow[]).map(normalizeInspection);
}

export async function loadInspection(supabase: SupabaseClient, farmId: string, id: string): Promise<QcInspectionRow> {
  const { data, error } = await supabase.from('qc_inspections').select(QC_SELECT).eq('id', id).eq('farm_id', farmId).single();
  if (error) throw error;
  return normalizeInspection(data as unknown as QcInspectionRow);
}

export async function loadMovements(supabase: SupabaseClient, farmId: string, batchIds: string[]): Promise<StockMovementRow[]> {
  if (!batchIds.length) return [];
  const { data, error } = await supabase
    .from('stock_movements')
    .select(MOVEMENT_SELECT)
    .eq('farm_id', farmId)
    .in('packing_batch_id', batchIds)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as StockMovementRow[];
}

function normalizePacking(row: RawPacking): RawPacking {
  return { ...row, harvest: single(row.harvest) };
}

export type PackingFilter = {
  harvestId?: string;
  from?: string;
  to?: string;
  qcStatus?: string;
  locationId?: string;
  received?: boolean;
};

export async function loadPackingBatches(
  supabase: SupabaseClient,
  farmId: string,
  filter: PackingFilter = {}
): Promise<PackingBatchRow[]> {
  let query = supabase.from('packing_batches').select(PACKING_SELECT).eq('farm_id', farmId);
  if (filter.harvestId) query = query.eq('harvest_batch_id', filter.harvestId);
  if (filter.from) query = query.gte('packing_date', filter.from);
  if (filter.to) query = query.lte('packing_date', filter.to);
  if (filter.qcStatus) query = query.eq('qc_status', filter.qcStatus);
  if (filter.locationId) query = query.eq('location_id', filter.locationId);
  if (filter.received === true) query = query.not('received_date', 'is', null);
  if (filter.received === false) query = query.is('received_date', null);
  const { data, error } = await query
    .order('packing_date', { ascending: false })
    .order('packing_no', { ascending: false })
    .limit(500);
  if (error) throw error;
  return withStock(supabase, farmId, ((data ?? []) as unknown as RawPacking[]).map(normalizePacking));
}

export async function loadPackingBatch(supabase: SupabaseClient, farmId: string, id: string): Promise<PackingBatchDetail> {
  const { data, error } = await supabase.from('packing_batches').select(PACKING_SELECT).eq('id', id).eq('farm_id', farmId).single();
  if (error) throw error;
  const [batch] = await withStock(supabase, farmId, [normalizePacking(data as unknown as RawPacking)]);

  const [movements, inspections, grading, packed] = await Promise.all([
    loadMovements(supabase, farmId, [batch.id]),
    loadInspections(supabase, farmId, { column: 'packing_batch_id', ids: [batch.id] }),
    supabase
      .from('harvest_gradings')
      .select('lines:harvest_grading_lines(grade_id, quantity)')
      .eq('batch_id', batch.harvest_batch_id)
      .maybeSingle(),
    supabase
      .from('packing_batches')
      .select('net_weight')
      .eq('harvest_batch_id', batch.harvest_batch_id)
      .eq('grade_id', batch.grade_id),
  ]);
  if (grading.error) throw grading.error;
  if (packed.error) throw packed.error;
  const lines = (grading.data?.lines ?? []) as { grade_id: string; quantity: number }[];
  const unit = batch.harvest?.unit ?? 'kg';
  return {
    ...batch,
    movements,
    inspections,
    source: {
      graded: Number(lines.find((l) => l.grade_id === batch.grade_id)?.quantity ?? 0),
      unit,
      packedKg: kgFactor(unit) == null ? null : (packed.data ?? []).reduce((s, p) => s + Number(p.net_weight), 0),
    },
  };
}

/** Graded, non-failed harvest batches with produce left to pack, newest first. */
export async function loadPackingSources(supabase: SupabaseClient, farmId: string): Promise<PackingSource[]> {
  const { data, error } = await supabase
    .from('harvest_batches')
    .select(
      `id, batch_no, harvest_date, unit, qc_status,
       crop:crops!harvest_batches_crop_id_fkey(id, code, name),
       block:blocks!harvest_batches_block_id_farm_id_fkey(id, code, name),
       grading:harvest_gradings!harvest_gradings_batch_id_crop_id_fkey(lines:harvest_grading_lines(grade_id, quantity))`
    )
    .eq('farm_id', farmId)
    .eq('status', 'graded')
    .neq('qc_status', 'failed')
    .order('harvest_date', { ascending: false })
    .limit(200);
  if (error) throw error;
  type Raw = Omit<PackingSource, 'grades'> & { grading: { lines: { grade_id: string; quantity: number }[] } | { lines: { grade_id: string; quantity: number }[] }[] | null };
  const rows = (data ?? []) as unknown as Raw[];
  if (!rows.length) return [];

  const oldest = rows[rows.length - 1].harvest_date;
  const [gradesRes, packedRes] = await Promise.all([
    supabase.from('grades').select('id, code, name, purpose, is_reject, sort_order'),
    supabase.from('packing_batches').select('harvest_batch_id, grade_id, net_weight').eq('farm_id', farmId).gte('packing_date', oldest),
  ]);
  if (gradesRes.error) throw gradesRes.error;
  if (packedRes.error) throw packedRes.error;
  const grades = new Map((gradesRes.data ?? []).map((g) => [g.id as string, g]));
  const packed = new Map<string, number>();
  for (const p of packedRes.data ?? []) {
    const key = `${p.harvest_batch_id}|${p.grade_id}`;
    packed.set(key, (packed.get(key) ?? 0) + Number(p.net_weight));
  }

  const sources: PackingSource[] = [];
  for (const r of rows) {
    const factor = kgFactor(r.unit);
    const lines = single(r.grading)?.lines ?? [];
    const options = lines
      .map((l) => ({ line: l, grade: grades.get(l.grade_id) }))
      .filter(({ line, grade }) => grade && !grade.is_reject && Number(line.quantity) > 0)
      .sort((a, b) => Number(a.grade!.sort_order) - Number(b.grade!.sort_order))
      .map(({ line, grade }) => {
        const packedKg = packed.get(`${r.id}|${line.grade_id}`) ?? 0;
        const graded = Number(line.quantity);
        return {
          grade_id: line.grade_id,
          code: grade!.code as string,
          name: grade!.name as string,
          purpose: grade!.purpose as string,
          graded,
          packedKg,
          remainingKg: factor == null ? null : Math.max(0, Math.round((graded * factor - packedKg) * 1000) / 1000),
        };
      })
      .filter((g) => g.remainingKg == null || g.remainingKg > 0);
    if (!options.length) continue;
    sources.push({
      id: r.id,
      batch_no: r.batch_no,
      harvest_date: r.harvest_date,
      unit: r.unit,
      qc_status: r.qc_status,
      crop: single(r.crop),
      block: single(r.block),
      grades: options,
    });
  }
  return sources;
}

// ——— Traceability ———

export type TraceMatch = { type: 'harvest_batch' | 'packing_batch'; id: string; code: string; date: string; crop: string | null };

/** Resolve a harvest or packing number; exact match first, otherwise suggestions. */
export async function findTraceTarget(
  supabase: SupabaseClient,
  farmId: string,
  q: string
): Promise<{ exact: TraceMatch | null; matches: TraceMatch[] }> {
  const term = q.trim().toUpperCase();
  const pattern = `%${term.replace(/[%_,()]/g, '')}%`;
  const [packing, harvest] = await Promise.all([
    supabase
      .from('packing_batches')
      .select('id, packing_no, packing_date, harvest_batch_id, crop:crops!packing_batches_crop_id_fkey(name)')
      .eq('farm_id', farmId)
      .ilike('packing_no', pattern)
      .order('packing_date', { ascending: false })
      .limit(10),
    supabase
      .from('harvest_batches')
      .select('id, batch_no, harvest_date, crop:crops!harvest_batches_crop_id_fkey(name)')
      .eq('farm_id', farmId)
      .ilike('batch_no', pattern)
      .order('harvest_date', { ascending: false })
      .limit(10),
  ]);
  if (packing.error) throw packing.error;
  if (harvest.error) throw harvest.error;
  type Named = { name: string } | { name: string }[] | null;
  const matches: TraceMatch[] = [
    ...(packing.data ?? []).map((p) => ({
      type: 'packing_batch' as const,
      id: p.id as string,
      code: p.packing_no as string,
      date: p.packing_date as string,
      crop: single(p.crop as Named)?.name ?? null,
    })),
    ...(harvest.data ?? []).map((h) => ({
      type: 'harvest_batch' as const,
      id: h.id as string,
      code: h.batch_no as string,
      date: h.harvest_date as string,
      crop: single(h.crop as Named)?.name ?? null,
    })),
  ];
  return { exact: matches.find((m) => m.code === term) ?? null, matches };
}

export async function harvestIdForPacking(supabase: SupabaseClient, farmId: string, packingId: string): Promise<string> {
  const { data, error } = await supabase
    .from('packing_batches')
    .select('harvest_batch_id')
    .eq('id', packingId)
    .eq('farm_id', farmId)
    .single();
  if (error) throw error;
  return data.harvest_batch_id as string;
}

/** Everything linked to a harvest batch: where it came from and where its produce went. */
export async function loadTrace(
  supabase: SupabaseClient,
  farmId: string,
  harvestId: string,
  focus: TraceResult['focus'],
  can: (p: Permission) => boolean
): Promise<TraceResult> {
  const { data, error } = await supabase.from('harvest_batches').select(HARVEST_SELECT).eq('id', harvestId).eq('farm_id', farmId).single();
  if (error) throw error;
  const [harvest] = await normalizeBatches(supabase, [data as never]);

  const cycleRes = await supabase
    .from('planting_cycles')
    .select(
      'id, season_label, planting_date, expected_harvest_date, status, planted_area_ha, variety:crop_varieties!planting_cycles_variety_id_crop_id_fkey(id, code, name)'
    )
    .eq('id', harvest.planting_cycle_id)
    .maybeSingle();
  if (cycleRes.error) throw cycleRes.error;
  const cycle = cycleRes.data ? { ...cycleRes.data, variety: single(cycleRes.data.variety) } : null;
  const since = cycle?.planting_date ?? harvest.harvest_date;
  // Records on this planting, or on the block with no planting set, up to the harvest date.
  const linked = `planting_cycle_id.eq.${harvest.planting_cycle_id},and(planting_cycle_id.is.null,block_id.eq.${harvest.block_id})`;
  const costs = can('activities.view');

  const [activitiesRes, incidentsRes, inspections, packingRows] = await Promise.all([
    can('activities.view')
      ? supabase
          .from('farm_activities')
          .select(
            'id, activity_date, worker_labour_cost, other_labour_cost, input_cost, activity_type:activity_types!farm_activities_activity_type_id_fkey(name), workers:farm_activity_workers(hours_worked), inputs:farm_activity_inputs(input_name, sort_order)'
          )
          .eq('farm_id', farmId)
          .or(linked)
          .gte('activity_date', since)
          .lte('activity_date', harvest.harvest_date)
          .order('activity_date', { ascending: false })
      : null,
    can('pest.view')
      ? supabase
          .from('pest_disease_incidents')
          .select('id, name, incident_type, severity, status, date_identified')
          .eq('farm_id', farmId)
          .or(linked)
          .gte('date_identified', since)
          .lte('date_identified', harvest.harvest_date)
          .order('date_identified', { ascending: false })
      : null,
    loadInspections(supabase, farmId, { column: 'harvest_batch_id', ids: [harvest.id] }),
    loadPackingBatches(supabase, farmId, { harvestId: harvest.id }),
  ]);
  if (activitiesRes?.error) throw activitiesRes.error;
  if (incidentsRes?.error) throw incidentsRes.error;

  const packingIds = packingRows.map((p) => p.id);
  const [movements, packingInspections] = await Promise.all([
    loadMovements(supabase, farmId, packingIds),
    loadInspections(supabase, farmId, { column: 'packing_batch_id', ids: packingIds }),
  ]);

  type RawActivity = {
    id: string;
    activity_date: string;
    worker_labour_cost: number;
    other_labour_cost: number;
    input_cost: number;
    activity_type: { name: string } | null;
    workers: { hours_worked: number }[];
    inputs: { input_name: string; sort_order: number }[];
  };

  return {
    harvest,
    cycle,
    activities: activitiesRes
      ? ((activitiesRes.data ?? []) as unknown as RawActivity[]).map((a) => ({
          id: a.id,
          activity_date: a.activity_date,
          type: single(a.activity_type)?.name ?? 'Activity',
          workers: a.workers.length,
          hours: a.workers.reduce((s, w) => s + Number(w.hours_worked), 0),
          labourCost: costs ? Number(a.worker_labour_cost) + Number(a.other_labour_cost) : null,
          inputCost: costs ? Number(a.input_cost) : null,
          inputs: [...a.inputs].sort((x, y) => x.sort_order - y.sort_order).map((i) => i.input_name),
        }))
      : null,
    incidents: incidentsRes ? (incidentsRes.data ?? []) : null,
    inspections,
    packing: packingRows.map((p) => ({
      ...p,
      movements: movements.filter((m) => m.packing_batch_id === p.id),
      inspections: packingInspections.filter((i) => i.packing_batch_id === p.id),
    })),
    focus,
    costs,
  };
}
