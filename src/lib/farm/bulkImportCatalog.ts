import type { Permission } from '@/lib/farm/permissions';

export type BulkImportKind =
  | 'workers'
  | 'blocks'
  | 'crops'
  | 'varieties'
  | 'buyers'
  | 'input-products'
  | 'input-lots'
  | 'incidents'
  | 'contracts'
  | 'shipments'
  | 'attendance';

export type BulkImportSpec = {
  kind: BulkImportKind;
  title: string;
  description: string;
  required: string[];
  optional: string[];
  sample: (string | number | null)[];
  permission: Permission;
  endpoint: string;
  /** Query keys to refresh after a successful import. */
  invalidate?: string[][];
};

export const COLUMN_HELP: Record<string, string> = {
  worker_code: 'Worker ID',
  full_name: 'Full name',
  category: 'permanent or casual',
  pay_basis: 'daily or monthly',
  phone: 'Phone',
  national_id: 'National ID',
  job_role: 'Job',
  status: 'Status',
  start_date: 'Start date',
  daily_rate: 'Pay per day',
  monthly_salary: 'Monthly pay',
  overtime_rate: 'Overtime pay per hour',
  notes: 'Notes',
  code: 'Code',
  name: 'Name',
  size_value: 'Size number',
  size_unit: 'acres or hectares',
  soil_type: 'Soil type',
  irrigation_type: 'Watering method',
  production_cycle: 'seasonal / annual / perennial / continuous',
  default_unit: 'Usual unit (kg, etc.)',
  scientific_name: 'Scientific name',
  maturity_days: 'Days to harvest',
  description: 'Description',
  crop_code: 'Crop code',
  contact_name: 'Contact person',
  email: 'Email',
  country: 'Country',
  destination: 'Destination',
  address: 'Address',
  payment_terms: 'Payment terms',
  sku: 'Product code',
  unit: 'Unit',
  active_ingredient: 'Main chemical',
  registration_no: 'Registration number',
  manufacturer: 'Manufacturer',
  default_supplier: 'Usual supplier',
  reorder_level: 'Reorder level',
  product_sku: 'Product code (SKU)',
  lot_no: 'Lot / batch number',
  supplier: 'Supplier',
  received_date: 'Date received',
  expiry_date: 'Expiry date',
  quantity_received: 'Qty received',
  quantity_remaining: 'Qty remaining',
  unit_cost: 'Cost each',
  location: 'Store location',
  block_code: 'Block ID',
  incident_type: 'pest / disease / other',
  date_identified: 'Date found',
  severity: 'low / medium / high / critical',
  area_affected_ha: 'Area affected (ha)',
  action_taken: 'Action taken',
  treatment: 'Treatment',
  follow_up_date: 'Follow-up date',
  buyer_code: 'Buyer code',
  contract_no: 'Contract number',
  title: 'Title',
  start_date_contract: 'Start date',
  end_date: 'End date',
  agreed_quantity: 'Agreed quantity',
  quantity_unit: 'Unit',
  unit_price: 'Price per unit',
  currency: 'Currency (UGX)',
  specifications: 'Quality requirements',
  shipment_no: 'Shipment number',
  carrier: 'Transport company',
  booking_ref: 'Booking number',
  awb_bl_number: 'Waybill number',
  etd: 'Leave date',
  eta: 'Arrive date',
  invoice_no: 'Invoice number',
  invoice_amount: 'Invoice amount',
  invoice_currency: 'Invoice currency',
  payment_status: 'unpaid / partial / paid / overdue',
  attendance_date: 'Date',
  hours_worked: 'Hours worked',
  overtime_hours: 'Overtime hours',
};

export function friendlyColumns(cols: string[]) {
  return cols.map((c) => (COLUMN_HELP[c] ? `${COLUMN_HELP[c]} (${c})` : c)).join(', ');
}

export const BULK_IMPORT_SPECS: Record<BulkImportKind, BulkImportSpec> = {
  workers: {
    kind: 'workers',
    title: 'Workers',
    description: 'Add many workers at once. For daily pay fill daily_rate. For monthly pay fill monthly_salary.',
    required: ['worker_code', 'full_name', 'category', 'pay_basis'],
    optional: [
      'phone',
      'national_id',
      'job_role',
      'status',
      'start_date',
      'daily_rate',
      'monthly_salary',
      'overtime_rate',
      'notes',
    ],
    sample: ['W-001', 'Jane Okello', 'casual', 'daily', '0700000000', '', 'Picker', 'active', '2026-01-15', 25000, '', 0, ''],
    permission: 'workforce.manage',
    endpoint: '/api/farm/import/workers',
    invalidate: [['farm', 'workers']],
  },
  blocks: {
    kind: 'blocks',
    title: 'Blocks',
    description: 'Add many farm plots at once. size_unit must be acres or hectares.',
    required: ['code', 'name', 'size_value', 'size_unit', 'status'],
    optional: ['soil_type', 'irrigation_type', 'notes'],
    sample: ['B01', 'North Block', 2.5, 'acres', 'active', 'loam', 'drip', ''],
    permission: 'farm.manage',
    endpoint: '/api/farm/import/blocks',
    invalidate: [['farm', 'blocks'], ['farm', 'overview']],
  },
  crops: {
    kind: 'crops',
    title: 'Crops',
    description: 'Add many crops at once. production_cycle: seasonal, annual, perennial, or continuous.',
    required: ['code', 'name', 'production_cycle', 'default_unit', 'status'],
    optional: ['scientific_name', 'maturity_days', 'description'],
    sample: ['CHILLI', 'Chilies', 'seasonal', 'kg', 'active', 'Capsicum annuum', 90, 'Hot pepper'],
    permission: 'crops.manage',
    endpoint: '/api/farm/import/crops',
    invalidate: [['farm', 'crops']],
  },
  varieties: {
    kind: 'varieties',
    title: 'Crop varieties',
    description: 'Add varieties for existing crops. Use the crop short code (crop_code).',
    required: ['crop_code', 'code', 'name', 'status'],
    optional: ['maturity_days', 'description'],
    sample: ['CHILLI', 'CAYENNE', 'Cayenne', 'active', 90, 'Hot variety'],
    permission: 'crops.manage',
    endpoint: '/api/farm/import/varieties',
    invalidate: [['farm', 'crops']],
  },
  buyers: {
    kind: 'buyers',
    title: 'Buyers',
    description: 'Add many buyers (customers) at once.',
    required: ['code', 'name', 'status'],
    optional: ['contact_name', 'email', 'phone', 'country', 'destination', 'address', 'payment_terms', 'notes'],
    sample: ['EU-01', 'Nordic Fresh BV', 'active', 'Anna de Vries', 'orders@buyer.com', '+31…', 'Netherlands', 'Rotterdam', '', 'Pay in 30 days', ''],
    permission: 'buyers.manage',
    endpoint: '/api/farm/import/buyers',
    invalidate: [['farm', 'buyers']],
  },
  'input-products': {
    kind: 'input-products',
    title: 'Input products',
    description: 'Add store products. category: seed, fertilizer, crop_protection, fuel, packaging, or other.',
    required: ['sku', 'name', 'category', 'unit', 'status'],
    optional: ['active_ingredient', 'registration_no', 'manufacturer', 'default_supplier', 'reorder_level', 'notes'],
    sample: ['FERT-NPK', 'NPK Fertilizer', 'fertilizer', 'kg', 'active', '', '', 'Yara', 'Local supplier', 50, ''],
    permission: 'procurement.manage',
    endpoint: '/api/farm/import/input-products',
    invalidate: [['farm', 'inputs', 'products']],
  },
  'input-lots': {
    kind: 'input-lots',
    title: 'Input lots',
    description: 'Add stock batches. product_sku must match an existing product.',
    required: ['product_sku', 'lot_no', 'received_date', 'quantity_received', 'quantity_remaining'],
    optional: ['supplier', 'expiry_date', 'unit_cost', 'location', 'notes'],
    sample: ['FERT-NPK', 'LOT-2026-01', '2026-01-10', 200, 200, 'Agro Supply', '2027-01-10', 4500, 'Main store', ''],
    permission: 'procurement.manage',
    endpoint: '/api/farm/import/input-lots',
    invalidate: [['farm', 'inputs', 'lots']],
  },
  incidents: {
    kind: 'incidents',
    title: 'Pest & disease',
    description: 'Add many pest/disease records. block_code must match an existing block.',
    required: ['block_code', 'incident_type', 'name', 'date_identified', 'severity', 'status'],
    optional: ['description', 'area_affected_ha', 'action_taken', 'treatment', 'follow_up_date'],
    sample: ['B01', 'pest', 'Aphids', '2026-03-01', 'medium', 'open', 'Found on leaves', 0.5, 'Scouted field', '', '2026-03-05'],
    permission: 'pest.record',
    endpoint: '/api/farm/import/incidents',
    invalidate: [['farm', 'incidents']],
  },
  contracts: {
    kind: 'contracts',
    title: 'Contracts',
    description: 'Add buyer contracts. buyer_code required. crop_code optional.',
    required: ['buyer_code', 'contract_no', 'title', 'start_date', 'agreed_quantity', 'quantity_unit', 'unit_price', 'currency', 'status'],
    optional: ['crop_code', 'end_date', 'specifications', 'notes'],
    sample: ['EU-01', 'CTR-2026-01', 'Chilli export Q1', '2026-01-01', 5000, 'kg', 12000, 'UGX', 'active', 'CHILLI', '2026-03-31', 'Export grade', ''],
    permission: 'contracts.manage',
    endpoint: '/api/farm/import/contracts',
    invalidate: [['farm', 'contracts']],
  },
  shipments: {
    kind: 'shipments',
    title: 'Shipments',
    description: 'Add planned shipments. buyer_code must match an existing buyer.',
    required: ['shipment_no', 'buyer_code', 'status', 'payment_status'],
    optional: [
      'destination',
      'carrier',
      'booking_ref',
      'awb_bl_number',
      'etd',
      'eta',
      'invoice_no',
      'invoice_amount',
      'invoice_currency',
      'notes',
    ],
    sample: [
      'SHP-2026-001',
      'EU-01',
      'planned',
      'unpaid',
      'Amsterdam',
      'KLM Cargo',
      '',
      '',
      '2026-04-01',
      '2026-04-02',
      'INV-001',
      5000000,
      'UGX',
      '',
    ],
    permission: 'shipments.manage',
    endpoint: '/api/farm/import/shipments',
    invalidate: [['farm', 'shipments']],
  },
  attendance: {
    kind: 'attendance',
    title: 'Attendance',
    description: 'Mark many workers for a day. status: present, absent, leave, or off.',
    required: ['attendance_date', 'worker_code', 'status'],
    optional: ['hours_worked', 'overtime_hours', 'notes'],
    sample: ['2026-03-01', 'W-001', 'present', 8, 0, ''],
    permission: 'attendance.record',
    endpoint: '/api/farm/import/attendance',
    invalidate: [['farm', 'attendance']],
  },
};

export function columnsFor(spec: BulkImportSpec) {
  return [...spec.required, ...spec.optional];
}

/** Convert spreadsheet string rows into typed payloads expected by each import API. */
export function buildImportPayload(kind: BulkImportKind, rows: Record<string, string>[]) {
  const num = (v: string) => (v === '' ? null : Number(v));
  const str = (v: string) => (v === '' ? null : v);

  switch (kind) {
    case 'workers':
      return rows.map((r) => {
        const pay_basis = r.pay_basis as 'daily' | 'monthly';
        return {
          worker_code: r.worker_code,
          full_name: r.full_name,
          phone: str(r.phone),
          national_id: str(r.national_id),
          category: r.category,
          job_role: str(r.job_role),
          status: r.status || 'active',
          start_date: str(r.start_date),
          pay_basis,
          daily_rate: pay_basis === 'daily' ? num(r.daily_rate) : null,
          monthly_salary: pay_basis === 'monthly' ? num(r.monthly_salary) : null,
          overtime_rate: num(r.overtime_rate) ?? 0,
          notes: str(r.notes),
        };
      });
    case 'blocks':
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        size_value: Number(r.size_value),
        size_unit: r.size_unit,
        status: r.status,
        soil_type: str(r.soil_type),
        irrigation_type: str(r.irrigation_type),
        notes: str(r.notes),
      }));
    case 'crops':
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        scientific_name: str(r.scientific_name),
        production_cycle: r.production_cycle,
        default_unit: r.default_unit,
        maturity_days: num(r.maturity_days),
        description: str(r.description),
        status: r.status || 'active',
      }));
    case 'varieties':
      return rows.map((r) => ({
        crop_code: r.crop_code,
        code: r.code,
        name: r.name,
        maturity_days: num(r.maturity_days),
        description: str(r.description),
        status: r.status || 'active',
      }));
    case 'buyers':
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        contact_name: str(r.contact_name),
        email: str(r.email),
        phone: str(r.phone),
        country: str(r.country),
        destination: str(r.destination),
        address: str(r.address),
        payment_terms: str(r.payment_terms),
        status: r.status || 'active',
        notes: str(r.notes),
      }));
    case 'input-products':
      return rows.map((r) => ({
        sku: r.sku,
        name: r.name,
        category: r.category,
        unit: r.unit,
        active_ingredient: str(r.active_ingredient),
        registration_no: str(r.registration_no),
        manufacturer: str(r.manufacturer),
        default_supplier: str(r.default_supplier),
        reorder_level: num(r.reorder_level) ?? 0,
        status: r.status || 'active',
        notes: str(r.notes),
      }));
    case 'input-lots':
      return rows.map((r) => ({
        product_sku: r.product_sku,
        lot_no: r.lot_no,
        supplier: str(r.supplier),
        received_date: r.received_date,
        expiry_date: str(r.expiry_date),
        quantity_received: Number(r.quantity_received),
        quantity_remaining: Number(r.quantity_remaining),
        unit_cost: num(r.unit_cost),
        location: str(r.location),
        notes: str(r.notes),
      }));
    case 'incidents':
      return rows.map((r) => ({
        block_code: r.block_code,
        incident_type: r.incident_type,
        name: r.name,
        date_identified: r.date_identified,
        severity: r.severity,
        status: r.status || 'open',
        description: str(r.description),
        area_affected_ha: num(r.area_affected_ha),
        action_taken: str(r.action_taken),
        treatment: str(r.treatment),
        follow_up_date: str(r.follow_up_date),
      }));
    case 'contracts':
      return rows.map((r) => ({
        buyer_code: r.buyer_code,
        contract_no: r.contract_no,
        title: r.title,
        start_date: r.start_date,
        end_date: str(r.end_date),
        agreed_quantity: Number(r.agreed_quantity),
        quantity_unit: r.quantity_unit,
        unit_price: Number(r.unit_price),
        currency: (r.currency || 'UGX').toUpperCase(),
        status: r.status || 'active',
        crop_code: str(r.crop_code),
        specifications: str(r.specifications),
        notes: str(r.notes),
      }));
    case 'shipments':
      return rows.map((r) => ({
        shipment_no: r.shipment_no,
        buyer_code: r.buyer_code,
        status: r.status || 'planned',
        payment_status: r.payment_status || 'unpaid',
        destination: str(r.destination),
        carrier: str(r.carrier),
        booking_ref: str(r.booking_ref),
        awb_bl_number: str(r.awb_bl_number),
        etd: str(r.etd),
        eta: str(r.eta),
        invoice_no: str(r.invoice_no),
        invoice_amount: num(r.invoice_amount),
        invoice_currency: (r.invoice_currency || 'UGX').toUpperCase(),
        notes: str(r.notes),
      }));
    case 'attendance':
      return rows.map((r) => ({
        attendance_date: r.attendance_date,
        worker_code: r.worker_code,
        status: r.status,
        hours_worked: num(r.hours_worked),
        overtime_hours: num(r.overtime_hours) ?? 0,
        notes: str(r.notes),
      }));
    default:
      return rows;
  }
}
