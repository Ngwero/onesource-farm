import { z } from 'zod';

const requiredText = (max = 120) => z.string().trim().min(1, 'Required').max(max);
const optionalText = (max = 1000) => z.string().trim().max(max).nullable().optional();
const optionalId = z.uuid().nullable().optional();
const isoDate = z.iso.date('Use a valid date');
const optionalDate = isoDate.nullable().optional();
const positive = z.number('Enter a number').positive('Must be greater than 0');
const nonNegative = z.number('Enter a number').min(0, 'Cannot be negative');
const code = (max: number, pattern: RegExp, hint: string) =>
  z.string().trim().toUpperCase().min(1, 'Required').max(max).regex(pattern, hint);

export const activeStatus = z.enum(['active', 'inactive']);

// ——— Option lists (shared by forms, filters and badges) ———

export const BLOCK_STATUSES = ['active', 'preparation', 'fallow', 'inactive'] as const;
export const SIZE_UNITS = ['acres', 'hectares'] as const;
export const CYCLE_STATUSES = ['planned', 'active', 'harvesting', 'completed', 'abandoned'] as const;
export const PRODUCTION_CYCLES = ['seasonal', 'annual', 'perennial', 'continuous'] as const;
export const CROP_UNITS = ['kg', 'tonne', 'crate', 'bunch', 'piece'] as const;
export const CRITERION_TYPES = ['pass_fail', 'numeric', 'scale', 'text'] as const;
export const GRADE_PURPOSES = ['export', 'local_market', 'processing', 'waste'] as const;
export const CAPACITY_UNITS = ['kg', 'g', 'piece', 'bunch'] as const;
export const DOCUMENT_CATEGORIES = [
  'export',
  'procurement',
  'buyer',
  'supplier',
  'qc',
  'claim',
  'general',
] as const;

export function optionLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ——— Farm ———

export const farmSchema = z.object({
  name: requiredText(),
  legal_name: optionalText(200),
  location: optionalText(200),
  district: optionalText(100),
  country: requiredText(80),
  total_area_ha: positive.nullable().optional(),
  timezone: requiredText(60),
  default_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter code, e.g. USD'),
  manager_id: optionalId,
  notes: optionalText(),
});
export type FarmInput = z.infer<typeof farmSchema>;

export const blockSchema = z.object({
  code: code(16, /^[A-Z0-9-]+$/, 'Letters, numbers and dashes only'),
  name: requiredText(),
  size_value: positive,
  size_unit: z.enum(SIZE_UNITS),
  soil_type: optionalText(80),
  irrigation_type: optionalText(80),
  status: z.enum(BLOCK_STATUSES),
  supervisor_id: optionalId,
  notes: optionalText(),
});
export type BlockInput = z.infer<typeof blockSchema>;

const plantingCycleFields = z.object({
  block_id: z.uuid('Select a block'),
  crop_id: z.uuid('Select a crop'),
  variety_id: optionalId,
  season_label: optionalText(60),
  planting_date: isoDate,
  expected_harvest_date: optionalDate,
  planted_area_ha: positive.nullable().optional(),
  expected_yield: nonNegative.nullable().optional(),
  yield_unit: z.enum(CROP_UNITS),
  status: z.enum(CYCLE_STATUSES),
  closed_at: optionalDate,
  supervisor_id: optionalId,
  notes: optionalText(),
});

export const plantingCycleSchema = plantingCycleFields
  .refine((v) => !v.expected_harvest_date || v.expected_harvest_date >= v.planting_date, {
    path: ['expected_harvest_date'],
    message: 'Must be on or after the planting date',
  })
  .refine((v) => !v.closed_at || v.closed_at >= v.planting_date, {
    path: ['closed_at'],
    message: 'Must be on or after the planting date',
  });
export type PlantingCycleInput = z.infer<typeof plantingCycleSchema>;

// ——— Crops ———

export const cropSchema = z.object({
  code: code(12, /^[A-Z0-9]{2,12}$/, '2–12 letters or numbers, e.g. CHILLI'),
  name: requiredText(),
  scientific_name: optionalText(120),
  production_cycle: z.enum(PRODUCTION_CYCLES),
  default_unit: z.enum(CROP_UNITS),
  maturity_days: z.number().int('Whole days only').positive('Must be greater than 0').nullable().optional(),
  description: optionalText(),
  status: activeStatus,
});
export type CropInput = z.infer<typeof cropSchema>;

export const varietySchema = z.object({
  code: code(16, /^[A-Z0-9-]+$/, 'Letters, numbers and dashes only'),
  name: requiredText(),
  maturity_days: z.number().int('Whole days only').positive('Must be greater than 0').nullable().optional(),
  description: optionalText(),
  status: activeStatus,
});
export type VarietyInput = z.infer<typeof varietySchema>;

export const qualityCriterionSchema = z
  .object({
    name: requiredText(),
    criterion_type: z.enum(CRITERION_TYPES),
    unit: optionalText(20),
    min_value: z.number().nullable().optional(),
    max_value: z.number().nullable().optional(),
    is_mandatory: z.boolean(),
    sort_order: z.number().int(),
    guidance: optionalText(500),
    status: activeStatus,
  })
  .refine((v) => v.min_value == null || v.max_value == null || v.min_value <= v.max_value, {
    path: ['max_value'],
    message: 'Must be greater than or equal to the minimum',
  });
export type QualityCriterionInput = z.infer<typeof qualityCriterionSchema>;

export const cropGradesSchema = z.object({
  grade_ids: z.array(z.uuid()).min(1, 'Select at least one grade'),
});

// ——— Master data ———

export const gradeSchema = z.object({
  code: code(16, /^[A-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  name: requiredText(),
  purpose: z.enum(GRADE_PURPOSES),
  is_reject: z.boolean(),
  sort_order: z.number().int(),
  description: optionalText(),
  status: activeStatus,
});

export const packagingTypeSchema = z.object({
  code: code(16, /^[A-Z0-9_-]+$/, 'Letters, numbers, dashes and underscores only'),
  name: requiredText(),
  standard_capacity: positive,
  capacity_unit: z.enum(CAPACITY_UNITS),
  tare_weight_kg: nonNegative.nullable().optional(),
  description: optionalText(),
  status: activeStatus,
});

export const documentTypeSchema = z.object({
  code: code(24, /^[A-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  name: requiredText(),
  category: z.enum(DOCUMENT_CATEGORIES),
  is_mandatory_for_export: z.boolean(),
  has_expiry: z.boolean(),
  requires_approval: z.boolean(),
  sort_order: z.number().int(),
  description: optionalText(),
  status: activeStatus,
});

export const activityTypeSchema = z.object({
  code: code(24, /^[A-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  name: requiredText(),
  category: z.enum(['planting', 'nutrition', 'crop_protection', 'irrigation', 'maintenance', 'inspection', 'harvest', 'other']),
  uses_inputs: z.boolean(),
  sort_order: z.number().int(),
  description: optionalText(),
  status: activeStatus,
});

export const rejectionReasonSchema = z.object({
  code: code(24, /^[A-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  name: requiredText(),
  sort_order: z.number().int(),
  description: optionalText(),
  status: activeStatus,
});

// ——— Workforce ———

export const ACTIVITY_CATEGORIES = [
  'planting',
  'nutrition',
  'crop_protection',
  'irrigation',
  'maintenance',
  'inspection',
  'harvest',
  'other',
] as const;
export const WORKER_CATEGORIES = ['permanent', 'casual'] as const;
export const WORKER_STATUSES = ['active', 'inactive', 'terminated'] as const;
export const PAY_BASES = ['daily', 'monthly'] as const;
export const ATTENDANCE_STATUSES = ['present', 'absent', 'leave', 'off'] as const;
export const TASK_STATUSES = ['assigned', 'in_progress', 'completed', 'cancelled'] as const;
export const PAYROLL_STATUSES = ['draft', 'finalized', 'paid'] as const;

export const workerSchema = z
  .object({
    worker_code: code(20, /^[A-Z0-9-]+$/, 'Letters, numbers and dashes only'),
    full_name: requiredText(),
    phone: optionalText(30),
    national_id: optionalText(40),
    category: z.enum(WORKER_CATEGORIES),
    job_role: optionalText(80),
    supervisor_id: optionalId,
    status: z.enum(WORKER_STATUSES),
    start_date: optionalDate,
    end_date: optionalDate,
    pay_basis: z.enum(PAY_BASES),
    daily_rate: nonNegative.nullable().optional(),
    monthly_salary: nonNegative.nullable().optional(),
    overtime_rate: nonNegative,
    notes: optionalText(),
  })
  .refine((v) => v.pay_basis !== 'daily' || v.daily_rate != null, { path: ['daily_rate'], message: 'Enter the daily rate' })
  .refine((v) => v.pay_basis !== 'monthly' || v.monthly_salary != null, {
    path: ['monthly_salary'],
    message: 'Enter the monthly salary',
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'Must be on or after the start date',
  });
export type WorkerInput = z.infer<typeof workerSchema>;

const hours = z.number('Enter hours').min(0, 'Cannot be negative').max(24, 'At most 24 hours');

export const attendanceSaveSchema = z.object({
  attendance_date: isoDate,
  entries: z
    .array(
      z
        .object({
          worker_id: z.uuid(),
          status: z.enum(ATTENDANCE_STATUSES),
          hours_worked: hours.nullable().optional(),
          overtime_hours: hours,
          notes: optionalText(300),
        })
        .refine((e) => e.status === 'present' || (!e.hours_worked && !e.overtime_hours), {
          path: ['hours_worked'],
          message: 'Only workers marked present can have hours',
        })
    )
    .min(1, 'Mark at least one worker'),
});
export type AttendanceSaveInput = z.infer<typeof attendanceSaveSchema>;

export const taskSchema = z
  .object({
    worker_ids: z.array(z.uuid()).min(1, 'Select at least one worker'),
    activity_type_id: z.uuid('Select an activity'),
    block_id: optionalId,
    planting_cycle_id: optionalId,
    supervisor_id: optionalId,
    start_at: z.string().min(1, 'Required'),
    due_at: z.string().nullable().optional(),
    status: z.enum(TASK_STATUSES),
    completed_at: z.string().nullable().optional(),
    target_quantity: positive.nullable().optional(),
    achieved_quantity: nonNegative.nullable().optional(),
    quantity_unit: optionalText(20),
    hours_spent: nonNegative.nullable().optional(),
    notes: optionalText(),
  })
  .refine((v) => !v.due_at || v.due_at >= v.start_at, { path: ['due_at'], message: 'Must be after the start' })
  .refine((v) => v.status !== 'completed' || Boolean(v.completed_at), {
    path: ['completed_at'],
    message: 'Enter when the task was completed',
  });
export type TaskInput = z.infer<typeof taskSchema>;

export const payrollPeriodSchema = z
  .object({
    name: requiredText(60),
    period_start: isoDate,
    period_end: isoDate,
    notes: optionalText(),
  })
  .refine((v) => v.period_end >= v.period_start, { path: ['period_end'], message: 'Must be on or after the start date' });
export type PayrollPeriodInput = z.infer<typeof payrollPeriodSchema>;

export const payrollLineSchema = z.object({
  advances: nonNegative,
  deductions: nonNegative,
  notes: optionalText(300),
});
export type PayrollLineInput = z.infer<typeof payrollLineSchema>;

export const payrollPaymentSchema = z.object({
  line_ids: z.array(z.uuid()).min(1),
  paid: z.boolean(),
  paid_at: optionalDate,
  payment_reference: optionalText(80),
});

// ——— Farm activities & incidents ———

const workerHours = z.object({ worker_id: z.uuid(), hours_worked: z.number().positive('Enter hours').max(24) });

export const activitySchema = z.object({
  block_id: z.uuid('Select a block'),
  planting_cycle_id: optionalId,
  activity_type_id: z.uuid('Select an activity type'),
  activity_date: isoDate,
  supervisor_id: optionalId,
  casual_labour_days: nonNegative,
  other_labour_cost: nonNegative,
  other_cost: nonNegative,
  weather: optionalText(200),
  notes: optionalText(),
  workers: z.array(workerHours),
  inputs: z.array(
    z.object({
      input_name: requiredText(120),
      quantity: positive,
      unit: requiredText(20),
      unit_cost: nonNegative.nullable().optional(),
    })
  ),
});
export type ActivityInput = z.infer<typeof activitySchema>;

export const INCIDENT_TYPES = ['pest', 'disease', 'other'] as const;
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const INCIDENT_STATUSES = ['open', 'treating', 'monitoring', 'resolved'] as const;

export const incidentSchema = z
  .object({
    block_id: z.uuid('Select a block'),
    planting_cycle_id: optionalId,
    incident_type: z.enum(INCIDENT_TYPES),
    name: requiredText(),
    date_identified: isoDate,
    severity: z.enum(SEVERITIES),
    description: optionalText(),
    area_affected_ha: positive.nullable().optional(),
    action_taken: optionalText(),
    treatment: optionalText(),
    follow_up_date: optionalDate,
    status: z.enum(INCIDENT_STATUSES),
    resolved_date: optionalDate,
    supervisor_id: optionalId,
  })
  .refine((v) => !v.follow_up_date || v.follow_up_date >= v.date_identified, {
    path: ['follow_up_date'],
    message: 'Must be on or after the date identified',
  })
  .refine((v) => v.status !== 'resolved' || Boolean(v.resolved_date), {
    path: ['resolved_date'],
    message: 'Enter the date it was resolved',
  })
  .refine((v) => !v.resolved_date || v.resolved_date >= v.date_identified, {
    path: ['resolved_date'],
    message: 'Must be on or after the date identified',
  });
export type IncidentInput = z.infer<typeof incidentSchema>;

// ——— Harvest & grading ———

export const harvestBatchSchema = z.object({
  planting_cycle_id: z.uuid('Select the planting being harvested'),
  harvest_date: isoDate,
  supervisor_id: optionalId,
  quantity: positive,
  casual_labour_days: nonNegative,
  other_labour_cost: nonNegative,
  notes: optionalText(),
  workers: z.array(workerHours.extend({ quantity_picked: nonNegative.nullable().optional() })),
});
export type HarvestBatchInput = z.infer<typeof harvestBatchSchema>;

export const gradingSchema = z.object({
  graded_date: isoDate,
  inspector_id: optionalId,
  notes: optionalText(),
  lines: z.array(z.object({ grade_id: z.uuid(), quantity: nonNegative })).min(1),
  rejections: z.array(z.object({ reason_id: z.uuid(), quantity: nonNegative.nullable().optional() })),
});
export type GradingInput = z.infer<typeof gradingSchema>;

// ——— Quality control, packing and warehouse ———

export const QC_STATUSES = ['pending', 'failed', 'rework', 'reinspection', 'approved', 'released'] as const;
export const QC_RESULTS = ['pass', 'conditional_pass', 'fail'] as const;
export const QC_DECISIONS = ['approved', 'rework', 'reinspection', 'rejected'] as const;
export const REVIEW_STATUSES = ['awaiting_review', ...QC_DECISIONS] as const;
export const QC_SUBJECTS = ['harvest_batch', 'packing_batch'] as const;
export const LOCATION_TYPES = ['cold_room', 'dry_store', 'packhouse', 'dispatch', 'other'] as const;
export const MOVEMENT_TYPES = ['receive', 'relocate', 'damage', 'spoil', 'dispatch'] as const;

export const warehouseLocationSchema = z.object({
  code: code(16, /^[A-Z0-9_-]+$/, 'Letters, numbers, dashes and underscores only'),
  name: requiredText(),
  location_type: z.enum(LOCATION_TYPES),
  sort_order: z.number().int(),
  description: optionalText(),
  status: activeStatus,
});

export const packingBatchSchema = z.object({
  harvest_batch_id: z.uuid('Select the harvest batch'),
  grade_id: z.uuid('Select the grade'),
  packaging_type_id: z.uuid('Select the packaging'),
  packing_date: isoDate,
  package_count: z.number('Enter a number').int('Whole packages only').positive('Must be greater than 0'),
  net_weight_per_package: positive,
  tare_weight_per_package: nonNegative,
  packed_by: optionalId,
  notes: optionalText(),
});
export type PackingBatchInput = z.infer<typeof packingBatchSchema>;

export const qcCheckSchema = z.object({
  criterion_id: z.uuid(),
  passed: z.boolean().nullable().optional(),
  value_numeric: z.number().nullable().optional(),
  value_text: optionalText(500),
  notes: optionalText(500),
});

export const qcInspectionSchema = z
  .object({
    subject_type: z.enum(QC_SUBJECTS),
    harvest_batch_id: optionalId,
    packing_batch_id: optionalId,
    inspection_date: isoDate,
    inspector_id: optionalId,
    sample_size: positive.nullable().optional(),
    sample_unit: optionalText(20),
    buyer_specification: optionalText(500),
    result: z.enum(QC_RESULTS, 'Choose the result'),
    rejected_quantity: nonNegative.nullable().optional(),
    rejection_reason_id: optionalId,
    corrective_action: optionalText(),
    notes: optionalText(),
    checks: z.array(qcCheckSchema),
  })
  .refine((v) => v.subject_type !== 'harvest_batch' || Boolean(v.harvest_batch_id), {
    path: ['harvest_batch_id'],
    message: 'Select the harvest batch',
  })
  .refine((v) => v.subject_type !== 'packing_batch' || Boolean(v.packing_batch_id), {
    path: ['packing_batch_id'],
    message: 'Select the packed batch',
  })
  .refine((v) => !v.rejected_quantity || Boolean(v.rejection_reason_id), {
    path: ['rejection_reason_id'],
    message: 'Select why produce was rejected',
  });
export type QcInspectionInput = z.infer<typeof qcInspectionSchema>;

export const qcReviewSchema = z.object({
  decision: z.enum(QC_DECISIONS, 'Choose a decision'),
  notes: optionalText(),
});
export type QcReviewInput = z.infer<typeof qcReviewSchema>;

export const qcReworkSchema = z.object({ notes: requiredText(1000) });
export type QcReworkInput = z.infer<typeof qcReworkSchema>;

export const exportReleaseSchema = z.object({ release: z.boolean() });

export const stockMovementSchema = z
  .object({
    movement_type: z.enum(MOVEMENT_TYPES),
    movement_date: isoDate,
    packages: z.number('Enter a number').int('Whole packages only').positive('Must be greater than 0').nullable().optional(),
    to_location_id: optionalId,
    reference: optionalText(120),
    reason: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if ((v.movement_type === 'receive' || v.movement_type === 'relocate') && !v.to_location_id) {
      ctx.addIssue({ code: 'custom', path: ['to_location_id'], message: 'Choose a location' });
    }
    if (['damage', 'spoil', 'dispatch'].includes(v.movement_type) && !v.packages) {
      ctx.addIssue({ code: 'custom', path: ['packages'], message: 'Enter the number of packages' });
    }
    if (v.movement_type === 'dispatch' && !v.reference?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['reference'], message: 'Enter the delivery note or air waybill number' });
    }
    if ((v.movement_type === 'damage' || v.movement_type === 'spoil') && !v.reason?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Give a reason' });
    }
  });
export type StockMovementInput = z.infer<typeof stockMovementSchema>;

// ——— Access ———

export const rolePermissionsSchema = z.object({
  permission_keys: z.array(z.string()),
});

export const userRolesSchema = z.object({
  role_ids: z.array(z.uuid()),
});

// ——— System settings ———

export const SYSTEM_SETTINGS = {
  'general.default_currency': {
    label: 'Default currency',
    schema: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter code'),
    kind: 'text',
  },
  'general.weight_unit': { label: 'Base weight unit', schema: z.enum(['kg', 'tonne']), kind: 'text' },
  'general.fiscal_year_start_month': {
    label: 'Financial year starts in month (1–12)',
    schema: z.number().int().min(1).max(12),
    kind: 'number',
  },
  'ememo.purchase_order_threshold': {
    label: 'Purchase orders needing eMemo approval (amount at or above)',
    schema: z.number().min(0),
    kind: 'number',
  },
  'ememo.supplier_payment_threshold': {
    label: 'Supplier payments needing eMemo approval (amount at or above)',
    schema: z.number().min(0),
    kind: 'number',
  },
  'alerts.upcoming_harvest_days': {
    label: 'Alert this many days before an expected harvest',
    schema: z.number().int().min(0).max(90),
    kind: 'number',
  },
  'alerts.document_expiry_days': {
    label: 'Alert this many days before a document expires',
    schema: z.number().int().min(0).max(180),
    kind: 'number',
  },
  'workforce.standard_day_hours': {
    label: 'Hours in a standard working day',
    schema: z.number().positive().max(24),
    kind: 'number',
  },
  'workforce.working_days_per_month': {
    label: 'Working days per month (for costing salaried staff)',
    schema: z.number().positive().max(31),
    kind: 'number',
  },
} as const;

export type SystemSettingKey = keyof typeof SYSTEM_SETTINGS;
