export type Ref = { id: string; full_name: string } | null;
export type CodeRef = { id: string; code: string; name: string } | null;

export type FarmRow = {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  location: string | null;
  district: string | null;
  country: string;
  total_area_ha: number | null;
  timezone: string;
  default_currency: string;
  manager_id: string | null;
  manager?: Ref;
  is_active: boolean;
  notes: string | null;
};

export type PlantingCycleRow = {
  id: string;
  block_id: string;
  crop_id: string;
  variety_id: string | null;
  season_label: string | null;
  planting_date: string;
  expected_harvest_date: string | null;
  planted_area_ha: number | null;
  expected_yield: number | null;
  yield_unit: string;
  actual_yield: number;
  status: 'planned' | 'active' | 'harvesting' | 'completed' | 'abandoned';
  closed_at: string | null;
  supervisor_id: string | null;
  notes: string | null;
  crop: CodeRef;
  variety: CodeRef;
  supervisor: Ref;
};

export type BlockRow = {
  id: string;
  farm_id: string;
  code: string;
  name: string;
  size_value: number;
  size_unit: 'acres' | 'hectares';
  area_ha: number;
  soil_type: string | null;
  irrigation_type: string | null;
  status: 'active' | 'preparation' | 'fallow' | 'inactive';
  supervisor_id: string | null;
  notes: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  boundary_geojson: { type: 'Polygon'; coordinates: [number, number][][] } | null;
  map_zoom: number | null;
  supervisor: Ref;
  planting_cycles: PlantingCycleRow[];
  current_cycle: PlantingCycleRow | null;
};

export type CropRow = {
  id: string;
  code: string;
  name: string;
  scientific_name: string | null;
  production_cycle: string;
  default_unit: string;
  maturity_days: number | null;
  description: string | null;
  status: 'active' | 'inactive';
};

export type VarietyRow = {
  id: string;
  crop_id: string;
  code: string;
  name: string;
  maturity_days: number | null;
  description: string | null;
  status: 'active' | 'inactive';
};

export type GradeRow = {
  id: string;
  code: string;
  name: string;
  purpose: string;
  is_reject: boolean;
  sort_order: number;
  description: string | null;
  status: 'active' | 'inactive';
};

export type QualityCriterionRow = {
  id: string;
  crop_id: string;
  name: string;
  criterion_type: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  is_mandatory: boolean;
  sort_order: number;
  guidance: string | null;
  status: 'active' | 'inactive';
};

export type CropDetail = CropRow & {
  varieties: VarietyRow[];
  grade_ids: string[];
  criteria: QualityCriterionRow[];
  open_cycles: number;
};

// ——— Phase 2: workforce, activities, harvest ———

export type WorkerRef = { id: string; worker_code: string; full_name: string } | null;
export type BlockRef = { id: string; code: string; name: string } | null;

export type ActivityTypeRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  uses_inputs: boolean;
  sort_order: number;
  status: 'active' | 'inactive';
};

export type WorkerRow = {
  id: string;
  worker_code: string;
  full_name: string;
  phone: string | null;
  national_id: string | null;
  category: 'permanent' | 'casual';
  job_role: string | null;
  supervisor_id: string | null;
  supervisor: Ref;
  status: 'active' | 'inactive' | 'terminated';
  start_date: string | null;
  end_date: string | null;
  pay_basis: 'daily' | 'monthly';
  daily_rate: number | null;
  monthly_salary: number | null;
  overtime_rate: number;
  notes: string | null;
  hourly_rate: number;
};

export type LabourLine = {
  worker_id: string;
  hours_worked: number;
  hourly_rate: number;
  cost: number;
  worker: WorkerRef;
};

export type CycleRef = {
  id: string;
  season_label: string | null;
  planting_date: string;
} | null;

export type ActivityRow = {
  id: string;
  block_id: string;
  planting_cycle_id: string | null;
  crop_id: string | null;
  activity_type_id: string;
  activity_date: string;
  supervisor_id: string | null;
  casual_labour_days: number;
  other_labour_cost: number;
  worker_labour_cost: number;
  input_cost: number;
  other_cost: number;
  total_cost: number;
  weather: string | null;
  weather_temp_c: number | null;
  weather_wind_kmh: number | null;
  weather_precip_mm: number | null;
  weather_humidity_pct: number | null;
  weather_code: number | null;
  weather_source: string | null;
  spray_window_score: number | null;
  spray_window_label: string | null;
  notes: string | null;
  application_rate_per_ha: number | null;
  treated_area_ha: number | null;
  active_ingredient: string | null;
  product_registration: string | null;
  pre_harvest_interval_days: number | null;
  re_entry_interval_hours: number | null;
  applicator_id: string | null;
  safety_equipment: string | null;
  spray_window_ok: boolean | null;
  harvest_compliant: boolean | null;
  created_at: string;
  block: BlockRef;
  crop: CodeRef;
  cycle: CycleRef;
  activity_type: Pick<ActivityTypeRow, 'id' | 'code' | 'name' | 'category' | 'uses_inputs'> | null;
  supervisor: Ref;
  applicator: Ref;
  created_by_user: Ref;
  workers: LabourLine[];
  inputs: {
    id: string;
    input_name: string;
    quantity: number;
    unit: string;
    unit_cost: number | null;
    cost: number;
    sort_order: number;
    product_id: string | null;
    lot_id: string | null;
  }[];
};

export type InputProductRow = {
  id: string;
  farm_id: string;
  sku: string;
  name: string;
  category: 'seed' | 'fertilizer' | 'crop_protection' | 'fuel' | 'packaging' | 'other';
  unit: string;
  active_ingredient: string | null;
  registration_no: string | null;
  manufacturer: string | null;
  default_supplier: string | null;
  reorder_level: number;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InputLotRow = {
  id: string;
  farm_id: string;
  product_id: string;
  lot_no: string;
  supplier: string | null;
  received_date: string;
  expiry_date: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: Pick<InputProductRow, 'id' | 'sku' | 'name' | 'unit' | 'category' | 'status'> | null;
};

export type InputMovementRow = {
  id: string;
  farm_id: string;
  product_id: string;
  lot_id: string | null;
  movement_type: 'receipt' | 'issue' | 'adjustment' | 'return' | 'waste';
  quantity: number;
  unit_cost: number | null;
  activity_id: string | null;
  reference: string | null;
  notes: string | null;
  moved_at: string;
  created_at: string;
  product?: Pick<InputProductRow, 'id' | 'sku' | 'name' | 'unit'> | null;
  lot?: Pick<InputLotRow, 'id' | 'lot_no'> | null;
};

export type IncidentRow = {
  id: string;
  block_id: string;
  planting_cycle_id: string | null;
  crop_id: string | null;
  incident_type: 'pest' | 'disease' | 'other';
  name: string;
  date_identified: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string | null;
  area_affected_ha: number | null;
  action_taken: string | null;
  treatment: string | null;
  follow_up_date: string | null;
  status: 'open' | 'treating' | 'monitoring' | 'resolved';
  resolved_date: string | null;
  supervisor_id: string | null;
  created_at: string;
  block: BlockRef;
  crop: CodeRef;
  supervisor: Ref;
  reported_by_user: Ref;
};

export type GradeRef = Pick<GradeRow, 'id' | 'code' | 'name' | 'purpose' | 'is_reject' | 'sort_order'>;

export type GradingRow = {
  id: string;
  graded_date: string;
  inspector_id: string | null;
  total_quantity: number;
  notes: string | null;
  created_at: string;
  inspector: Ref;
  lines: { grade_id: string; quantity: number; grade: GradeRef | null }[];
  rejections: { reason_id: string; quantity: number | null; reason: { id: string; code: string; name: string } | null }[];
};

export type HarvestBatchRow = {
  id: string;
  batch_no: string;
  planting_cycle_id: string;
  block_id: string;
  crop_id: string;
  variety_id: string | null;
  harvest_date: string;
  supervisor_id: string | null;
  quantity: number;
  unit: string;
  casual_labour_days: number;
  other_labour_cost: number;
  worker_labour_cost: number;
  status: 'pending_grading' | 'graded';
  qc_status: QcStatus;
  notes: string | null;
  created_at: string;
  block: BlockRef;
  crop: CodeRef;
  variety: CodeRef;
  supervisor: Ref;
  cycle: {
    id: string;
    season_label: string | null;
    planting_date: string;
    expected_yield: number | null;
    actual_yield: number;
    yield_unit: string;
    status: string;
  } | null;
  workers: (LabourLine & { quantity_picked: number | null })[];
  grading: GradingRow | null;
};

export type HarvestBatchDetail = HarvestBatchRow & { crop_grades: GradeRef[] };

export type TaskRow = {
  id: string;
  worker_id: string;
  activity_type_id: string;
  block_id: string | null;
  planting_cycle_id: string | null;
  crop_id: string | null;
  supervisor_id: string | null;
  start_at: string;
  due_at: string | null;
  completed_at: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  target_quantity: number | null;
  achieved_quantity: number | null;
  quantity_unit: string | null;
  hours_spent: number | null;
  notes: string | null;
  worker: WorkerRef;
  activity_type: Pick<ActivityTypeRow, 'id' | 'code' | 'name'> | null;
  block: BlockRef;
  crop: CodeRef;
  supervisor: Ref;
};

export type AttendanceEntry = {
  worker_id: string;
  status: 'present' | 'absent' | 'leave' | 'off';
  hours_worked: number | null;
  overtime_hours: number;
  notes: string | null;
};

export type PayrollPeriodRow = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'finalized' | 'paid';
  notes: string | null;
  finalized_at: string | null;
  created_at: string;
  line_count: number;
  total_payable: number;
  total_paid: number;
};

export type PayrollLineRow = {
  id: string;
  worker_id: string;
  pay_basis: 'daily' | 'monthly';
  rate: number;
  days_present: number;
  leave_days: number;
  base_pay: number;
  overtime_hours: number;
  overtime_rate: number;
  overtime_pay: number;
  advances: number;
  deductions: number;
  amount_payable: number;
  payment_status: 'unpaid' | 'paid';
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  worker: (WorkerRef & { category: string }) | null;
};

export type LabourAllocation = {
  source: 'activity' | 'harvest';
  block: string;
  crop: string | null;
  activity: string;
  hours: number;
  cost: number;
};

export type AttachmentRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  created_at: string;
  uploaded_by_user: Ref;
  captured_lat?: number | null;
  captured_lng?: number | null;
  captured_at?: string | null;
  meta?: Record<string, unknown> | null;
};

export type OpenCycleOption = {
  id: string;
  block_id: string;
  crop_id: string;
  variety_id: string | null;
  season_label: string | null;
  planting_date: string;
  expected_yield: number | null;
  actual_yield: number;
  yield_unit: string;
  status: string;
  block: BlockRef;
  crop: CodeRef;
  variety: CodeRef;
};

export type UserOption = { id: string; full_name: string; email: string; title: string | null };

// ——— Phase 3: quality control, packing, warehouse, traceability ———

export type QcStatus = 'pending' | 'failed' | 'rework' | 'reinspection' | 'approved' | 'released';
export type ReviewStatus = 'awaiting_review' | 'approved' | 'rework' | 'reinspection' | 'rejected';

export type WarehouseLocationRow = {
  id: string;
  code: string;
  name: string;
  location_type: string;
  sort_order: number;
  description: string | null;
  status: 'active' | 'inactive';
};

export type PackagingTypeRow = {
  id: string;
  code: string;
  name: string;
  standard_capacity: number;
  capacity_unit: string;
  tare_weight_kg: number | null;
  status: 'active' | 'inactive';
};

export type StockBalance = { available: number; reserved: number; dispatched: number; damaged: number; spoiled: number };

export type PackingBatchRow = {
  id: string;
  packing_no: string;
  harvest_batch_id: string;
  crop_id: string;
  grade_id: string;
  packaging_type_id: string;
  packing_date: string;
  package_count: number;
  net_weight_per_package: number;
  tare_weight_per_package: number;
  net_weight: number;
  gross_weight: number;
  packed_by: string | null;
  location_id: string | null;
  received_date: string | null;
  qc_status: QcStatus;
  released_at: string | null;
  notes: string | null;
  created_at: string;
  harvest: { id: string; batch_no: string; harvest_date: string; unit: string; block: BlockRef } | null;
  crop: CodeRef;
  grade: Pick<GradeRow, 'id' | 'code' | 'name' | 'purpose'> | null;
  packaging: Pick<PackagingTypeRow, 'id' | 'code' | 'name'> | null;
  location: CodeRef;
  packed_by_user: Ref;
  released_by_user: Ref;
  stock: StockBalance;
};

export type StockMovementRow = {
  id: string;
  packing_batch_id: string;
  movement_type: 'receive' | 'relocate' | 'reserve' | 'unreserve' | 'dispatch' | 'damage' | 'spoil';
  from_bucket: string | null;
  to_bucket: string | null;
  packages: number;
  movement_date: string;
  reference: string | null;
  reason: string | null;
  created_at: string;
  from_location: CodeRef;
  to_location: CodeRef;
  created_by_user: Ref;
  batch: {
    id: string;
    packing_no: string;
    net_weight_per_package: number;
    crop: CodeRef;
    grade: CodeRef;
  } | null;
};

export type QcCheckRow = {
  id: string;
  criterion_id: string | null;
  name: string;
  criterion_type: 'pass_fail' | 'numeric' | 'scale' | 'text';
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  is_mandatory: boolean;
  value_numeric: number | null;
  value_text: string | null;
  passed: boolean | null;
  notes: string | null;
  sort_order: number;
};

export type QcInspectionRow = {
  id: string;
  inspection_no: string;
  subject_type: 'harvest_batch' | 'packing_batch';
  harvest_batch_id: string | null;
  packing_batch_id: string | null;
  crop_id: string;
  inspection_date: string;
  inspector_id: string | null;
  sample_size: number | null;
  sample_unit: string | null;
  buyer_specification: string | null;
  result: 'pass' | 'conditional_pass' | 'fail';
  rejected_quantity: number | null;
  rejection_reason_id: string | null;
  corrective_action: string | null;
  notes: string | null;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  review_notes: string | null;
  rework_notes: string | null;
  rework_completed_at: string | null;
  created_at: string;
  crop: CodeRef;
  inspector: Ref;
  reviewer: Ref;
  rework_user: Ref;
  rejection_reason: CodeRef;
  harvest: { id: string; batch_no: string; unit: string; qc_status: QcStatus } | null;
  packing: { id: string; packing_no: string; qc_status: QcStatus; net_weight: number } | null;
  checks: QcCheckRow[];
};

export type PackingBatchDetail = PackingBatchRow & {
  movements: StockMovementRow[];
  inspections: QcInspectionRow[];
  /** Graded quantity of this grade in the source harvest, and how much of it is packed (kg harvests only). */
  source: { graded: number; unit: string; packedKg: number | null };
};

/** A graded harvest batch that still has produce to pack, with what is left per grade. */
export type PackingSource = {
  id: string;
  batch_no: string;
  harvest_date: string;
  unit: string;
  qc_status: QcStatus;
  crop: CodeRef;
  block: BlockRef;
  grades: { grade_id: string; code: string; name: string; purpose: string; graded: number; packedKg: number; remainingKg: number | null }[];
};

export type TraceResult = {
  harvest: HarvestBatchRow;
  cycle: {
    id: string;
    season_label: string | null;
    planting_date: string;
    expected_harvest_date: string | null;
    status: string;
    planted_area_ha: number | null;
    variety: CodeRef;
  } | null;
  activities: {
    id: string;
    activity_date: string;
    type: string;
    workers: number;
    hours: number;
    labourCost: number | null;
    inputCost: number | null;
    inputs: string[];
  }[] | null;
  incidents: { id: string; name: string; incident_type: string; severity: string; status: string; date_identified: string }[] | null;
  inspections: QcInspectionRow[];
  packing: (PackingBatchRow & { movements: StockMovementRow[]; inspections: QcInspectionRow[] })[];
  focus: { type: 'harvest_batch' | 'packing_batch'; id: string };
  costs: boolean;
};

export type FarmOverview = {
  farm: FarmRow;
  totals: {
    blocks: number;
    blocksByStatus: Record<string, number>;
    totalAreaHa: number;
    plantedAreaHa: number;
    openCycles: number;
    activeCrops: number;
    expectedYieldOpen: number;
    actualYieldOpen: number;
    harvestDueNext30Days: number;
  };
  cropBreakdown: { crop: string; blocks: number; areaHa: number; expectedYield: number; unit: string }[];
  upcomingHarvests: {
    cycleId: string;
    blockId: string;
    block: string;
    crop: string;
    variety: string | null;
    expectedHarvestDate: string;
    expectedYield: number | null;
    unit: string;
  }[];
  blockMap: {
    id: string;
    code: string;
    name: string;
    status: string;
    areaHa: number;
    crop: string | null;
    variety: string | null;
    cycleStatus: string | null;
    expectedYield: number | null;
    actualYield: number;
    unit: string | null;
    expectedHarvestDate: string | null;
  }[];
  operations: FarmOperations;
};

export type BuyerRow = {
  id: string;
  farm_id: string;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  destination: string | null;
  address: string | null;
  payment_terms: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractRow = {
  id: string;
  farm_id: string;
  buyer_id: string;
  contract_no: string;
  crop_id: string | null;
  grade_id: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  agreed_quantity: number;
  quantity_unit: string;
  unit_price: number;
  currency: string;
  specifications: string | null;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  buyer: Pick<BuyerRow, 'id' | 'code' | 'name' | 'status'> | null;
  crop: CodeRef;
  grade: CodeRef;
};

export type ShipmentLineRow = {
  id: string;
  shipment_id: string;
  packing_batch_id: string;
  package_count: number;
  net_weight: number;
  notes: string | null;
  created_at: string;
  packing_batch: {
    id: string;
    packing_no: string;
    package_count: number;
    net_weight: number;
    net_weight_per_package: number;
    qc_status: QcStatus;
    crop: CodeRef;
    grade: CodeRef;
  } | null;
};

export type ShipmentRow = {
  id: string;
  farm_id: string;
  shipment_no: string;
  buyer_id: string;
  contract_id: string | null;
  destination: string | null;
  carrier: string | null;
  booking_ref: string | null;
  awb_bl_number: string | null;
  etd: string | null;
  eta: string | null;
  dispatched_at: string | null;
  status: 'planned' | 'loading' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled';
  invoice_no: string | null;
  invoice_amount: number | null;
  invoice_currency: string | null;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  notes: string | null;
  created_at: string;
  updated_at: string;
  buyer: Pick<BuyerRow, 'id' | 'code' | 'name' | 'status'> | null;
  contract: Pick<ContractRow, 'id' | 'contract_no' | 'title' | 'status'> | null;
  lines: ShipmentLineRow[];
};

/** Management KPIs spanning field cost, quality, payroll, stock age and commercial revenue. */
export type ExecutiveOverview = {
  since: string;
  yieldPerHa: number | null;
  costPerKg: number | null;
  exportablePct: number | null;
  rejectionPct: number | null;
  costsByCrop: {
    crop: string;
    labourCost: number;
    inputCost: number;
    totalCost: number;
    harvestedKg: number;
    costPerKg: number | null;
  }[];
  costsByBlock: {
    block: string;
    labourCost: number;
    inputCost: number;
    totalCost: number;
    harvestedKg: number;
    costPerKg: number | null;
  }[];
  payroll: { actual: number; budget: number | null; variance: number | null };
  stockAgeing: { bucket: string; batches: number; kg: number }[];
  upcomingHarvests: {
    block: string;
    crop: string;
    expectedHarvestDate: string;
    expectedYield: number | null;
    unit: string | null;
  }[];
  commercial: {
    revenueByCrop: { crop: string; amount: number }[];
    revenueByBuyer: { buyer: string; amount: number }[];
    revenueByShipment: {
      shipment: string;
      buyer: string;
      amount: number;
      currency: string;
      paymentStatus: string;
    }[];
    profitByBlock: {
      block: string;
      shippedKg: number;
      estimatedCost: number;
      estimatedProfit: number | null;
    }[];
  };
};

/** Last-30-day operations; a section is absent when the user cannot view those records. */
export type FarmOperations = {
  since: string;
  harvest?: {
    unit: string;
    total: number;
    otherUnits: { unit: string; quantity: number }[];
    batches: number;
    pendingGrading: number;
    exportablePct: number | null;
    rejectionPct: number | null;
    series: { date: string; quantity: number }[];
    labourCost: number;
  };
  activities?: { count: number; totalCost: number; labourCost: number; inputCost: number };
  incidents?: { unresolved: number; severe: number; followUpDue: number };
  workforce?: { activeWorkers: number; markedToday: number; presentToday: number };
  tasks?: { open: number; overdue: number };
  packhouse?: { awaitingReview: number | null; awaitingRelease: number | null; awaitingReceipt: number | null };
  recent: {
    kind: 'harvest' | 'activity' | 'incident';
    id: string;
    title: string;
    detail: string;
    date: string;
    at: string;
    href: string;
  }[];
};
