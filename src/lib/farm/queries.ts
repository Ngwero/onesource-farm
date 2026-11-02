import type { BlockRow, PlantingCycleRow } from './types';

export const CYCLE_SELECT = `
  id, block_id, crop_id, variety_id, season_label, planting_date, expected_harvest_date,
  planted_area_ha, expected_yield, yield_unit, actual_yield, status, closed_at, supervisor_id, notes,
  created_at, updated_at,
  crop:crops!planting_cycles_crop_id_fkey(id, code, name),
  variety:crop_varieties!planting_cycles_variety_id_crop_id_fkey(id, code, name),
  supervisor:users!planting_cycles_supervisor_id_fkey(id, full_name)
`;

export const BLOCK_SELECT = `
  id, farm_id, code, name, size_value, size_unit, area_ha, soil_type, irrigation_type, status,
  supervisor_id, notes, created_at, updated_at,
  supervisor:users!blocks_supervisor_id_fkey(id, full_name),
  planting_cycles:planting_cycles!planting_cycles_block_id_farm_id_fkey(${CYCLE_SELECT})
`;

const LABOUR_LINE = 'worker_id, hours_worked, hourly_rate, cost, worker:workers(id, worker_code, full_name)';

export const ACTIVITY_SELECT = `
  *,
  block:blocks!farm_activities_block_id_farm_id_fkey(id, code, name),
  crop:crops!farm_activities_crop_id_fkey(id, code, name),
  cycle:planting_cycles!farm_activities_planting_cycle_id_block_id_crop_id_fkey(id, season_label, planting_date),
  activity_type:activity_types!farm_activities_activity_type_id_fkey(id, code, name, category, uses_inputs),
  supervisor:users!farm_activities_supervisor_id_fkey(id, full_name),
  created_by_user:users!farm_activities_created_by_fkey(id, full_name),
  workers:farm_activity_workers(${LABOUR_LINE}),
  inputs:farm_activity_inputs(id, input_name, quantity, unit, unit_cost, cost, sort_order)
`;

export const INCIDENT_SELECT = `
  *,
  block:blocks!pest_disease_incidents_block_id_farm_id_fkey(id, code, name),
  crop:crops!pest_disease_incidents_crop_id_fkey(id, code, name),
  supervisor:users!pest_disease_incidents_supervisor_id_fkey(id, full_name),
  reported_by_user:users!pest_disease_incidents_reported_by_fkey(id, full_name)
`;

export const GRADING_SELECT = `
  id, graded_date, inspector_id, total_quantity, notes, created_at,
  inspector:users!harvest_gradings_inspector_id_fkey(id, full_name),
  lines:harvest_grading_lines(grade_id, quantity),
  rejections:harvest_grading_rejections(reason_id, quantity, reason:rejection_reasons(id, code, name))
`;

export const HARVEST_SELECT = `
  *,
  block:blocks!harvest_batches_block_id_farm_id_fkey(id, code, name),
  crop:crops!harvest_batches_crop_id_fkey(id, code, name),
  variety:crop_varieties!harvest_batches_variety_id_crop_id_fkey(id, code, name),
  supervisor:users!harvest_batches_supervisor_id_fkey(id, full_name),
  cycle:planting_cycles!harvest_batches_planting_cycle_id_block_id_crop_id_fkey(
    id, season_label, planting_date, expected_yield, actual_yield, yield_unit, status
  ),
  workers:harvest_batch_workers(quantity_picked, ${LABOUR_LINE}),
  grading:harvest_gradings!harvest_gradings_batch_id_crop_id_fkey(${GRADING_SELECT})
`;

export const TASK_SELECT = `
  *,
  worker:workers!worker_tasks_worker_id_farm_id_fkey(id, worker_code, full_name),
  activity_type:activity_types!worker_tasks_activity_type_id_fkey(id, code, name),
  block:blocks!worker_tasks_block_id_farm_id_fkey(id, code, name),
  crop:crops!worker_tasks_crop_id_fkey(id, code, name),
  supervisor:users!worker_tasks_supervisor_id_fkey(id, full_name)
`;

export const PACKING_SELECT = `
  *,
  harvest:harvest_batches!packing_batches_harvest_batch_id_crop_id_fkey(
    id, batch_no, harvest_date, unit, block:blocks!harvest_batches_block_id_farm_id_fkey(id, code, name)
  ),
  crop:crops!packing_batches_crop_id_fkey(id, code, name),
  grade:grades!packing_batches_grade_id_fkey(id, code, name, purpose),
  packaging:packaging_types!packing_batches_packaging_type_id_fkey(id, code, name),
  location:warehouse_locations!packing_batches_location_id_fkey(id, code, name),
  packed_by_user:users!packing_batches_packed_by_fkey(id, full_name),
  released_by_user:users!packing_batches_released_by_fkey(id, full_name)
`;

export const QC_SELECT = `
  *,
  crop:crops!qc_inspections_crop_id_fkey(id, code, name),
  inspector:users!qc_inspections_inspector_id_fkey(id, full_name),
  reviewer:users!qc_inspections_reviewed_by_fkey(id, full_name),
  rework_user:users!qc_inspections_rework_by_fkey(id, full_name),
  rejection_reason:rejection_reasons!qc_inspections_rejection_reason_id_fkey(id, code, name),
  harvest:harvest_batches!qc_inspections_harvest_batch_id_fkey(id, batch_no, unit, qc_status),
  packing:packing_batches!qc_inspections_packing_batch_id_fkey(id, packing_no, qc_status, net_weight),
  checks:qc_inspection_checks(*)
`;

export const MOVEMENT_SELECT = `
  *,
  from_location:warehouse_locations!stock_movements_from_location_id_fkey(id, code, name),
  to_location:warehouse_locations!stock_movements_to_location_id_fkey(id, code, name),
  created_by_user:users!stock_movements_created_by_fkey(id, full_name),
  batch:packing_batches!stock_movements_packing_batch_id_fkey(
    id, packing_no, net_weight_per_package,
    crop:crops!packing_batches_crop_id_fkey(id, code, name),
    grade:grades!packing_batches_grade_id_fkey(id, code, name)
  )
`;

export const WORKER_SELECT = '*, supervisor:users!workers_supervisor_id_fkey(id, full_name)';

/** PostgREST returns a one-to-one embed as an object or a one-element array depending on the FK shape. */
export function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const OPEN_STATUSES = new Set(['active', 'harvesting']);

/** The crop currently in the ground, or else the next planned cycle. */
export function pickCurrentCycle(cycles: PlantingCycleRow[]): PlantingCycleRow | null {
  const open = cycles.find((c) => OPEN_STATUSES.has(c.status));
  if (open) return open;
  const planned = cycles
    .filter((c) => c.status === 'planned')
    .sort((a, b) => a.planting_date.localeCompare(b.planting_date));
  return planned[0] ?? null;
}

export function withCurrentCycle(block: Omit<BlockRow, 'current_cycle'>): BlockRow {
  const cycles = [...(block.planting_cycles ?? [])].sort((a, b) =>
    b.planting_date.localeCompare(a.planting_date)
  );
  return { ...block, planting_cycles: cycles, current_cycle: pickCurrentCycle(cycles) };
}
