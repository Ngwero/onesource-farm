-- Farm Export Management System — Phase 1 foundation
-- Farm, blocks, planting cycles, crops, master data, permission-based access, attachments.
-- OneSource tables are untouched: users.role_id keeps driving OneSource routing; farm access uses app roles.
-- Safe to re-run: objects use IF NOT EXISTS and seeds use ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION farm_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ——— Permission-based access ———

CREATE TABLE IF NOT EXISTS app_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z]+\.[a-z]+$'),
  module TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS user_app_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_app_roles_role ON user_app_roles(role_id);

-- ——— Farm ———
-- V1 runs one farm, but every operational table carries farm_id so multi-farm stays possible.

CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  legal_name TEXT,
  location TEXT,
  district TEXT,
  country TEXT NOT NULL DEFAULT 'Uganda',
  total_area_ha NUMERIC(12, 2) CHECK (total_area_ha IS NULL OR total_area_ha > 0),
  timezone TEXT NOT NULL DEFAULT 'Africa/Kampala',
  default_currency TEXT NOT NULL DEFAULT 'USD' CHECK (default_currency ~ '^[A-Z]{3}$'),
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ——— Crops (configurable — not hardcoded to chilli) ———

CREATE TABLE IF NOT EXISTS crops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{2,12}$'),
  name TEXT NOT NULL UNIQUE,
  scientific_name TEXT,
  production_cycle TEXT NOT NULL DEFAULT 'seasonal'
    CHECK (production_cycle IN ('seasonal', 'annual', 'perennial', 'continuous')),
  default_unit TEXT NOT NULL DEFAULT 'kg'
    CHECK (default_unit IN ('kg', 'tonne', 'crate', 'bunch', 'piece')),
  maturity_days INT CHECK (maturity_days IS NULL OR maturity_days > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crop_varieties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z0-9-]{1,16}$'),
  name TEXT NOT NULL,
  maturity_days INT CHECK (maturity_days IS NULL OR maturity_days > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_id, code),
  UNIQUE (crop_id, name),
  UNIQUE (id, crop_id)
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]{1,16}$'),
  name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('export', 'local_market', 'processing', 'waste')),
  is_reject BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grading configuration: which grades apply to which crop.
CREATE TABLE IF NOT EXISTS crop_grades (
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
  PRIMARY KEY (crop_id, grade_id)
);

-- Crop-specific QC checks (used by QC inspections in Phase 3).
CREATE TABLE IF NOT EXISTS crop_quality_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  criterion_type TEXT NOT NULL DEFAULT 'pass_fail'
    CHECK (criterion_type IN ('pass_fail', 'numeric', 'scale', 'text')),
  unit TEXT,
  min_value NUMERIC(14, 4),
  max_value NUMERIC(14, 4),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  guidance TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_id, name),
  CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

-- ——— Blocks / plots ———

CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z0-9-]{1,16}$'),
  name TEXT NOT NULL,
  size_value NUMERIC(12, 3) NOT NULL CHECK (size_value > 0),
  size_unit TEXT NOT NULL DEFAULT 'acres' CHECK (size_unit IN ('acres', 'hectares')),
  area_ha NUMERIC(12, 4) GENERATED ALWAYS AS (
    CASE WHEN size_unit = 'hectares' THEN size_value ELSE ROUND(size_value * 0.404686, 4) END
  ) STORED,
  soil_type TEXT,
  irrigation_type TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'preparation', 'fallow', 'inactive')),
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, code),
  UNIQUE (id, farm_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_farm ON blocks(farm_id);

-- ——— Planting cycles: what is planted in a block, when, and the expected yield ———

CREATE TABLE IF NOT EXISTS planting_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  block_id UUID NOT NULL,
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  variety_id UUID,
  season_label TEXT,
  planting_date DATE NOT NULL,
  expected_harvest_date DATE,
  planted_area_ha NUMERIC(12, 4) CHECK (planted_area_ha IS NULL OR planted_area_ha > 0),
  expected_yield NUMERIC(14, 3) CHECK (expected_yield IS NULL OR expected_yield >= 0),
  yield_unit TEXT NOT NULL DEFAULT 'kg',
  actual_yield NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (actual_yield >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned', 'active', 'harvesting', 'completed', 'abandoned')),
  closed_at DATE,
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (block_id, farm_id) REFERENCES blocks(id, farm_id) ON DELETE RESTRICT,
  -- Variety must belong to the cycle's crop.
  FOREIGN KEY (variety_id, crop_id) REFERENCES crop_varieties(id, crop_id) ON DELETE RESTRICT,
  CHECK (expected_harvest_date IS NULL OR expected_harvest_date >= planting_date),
  CHECK (closed_at IS NULL OR closed_at >= planting_date)
);

-- A block can only have one crop in the ground at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_planting_cycles_open_per_block
  ON planting_cycles(block_id) WHERE status IN ('active', 'harvesting');
CREATE INDEX IF NOT EXISTS idx_planting_cycles_block ON planting_cycles(block_id);
CREATE INDEX IF NOT EXISTS idx_planting_cycles_crop ON planting_cycles(crop_id);

-- ——— Master data ———

CREATE TABLE IF NOT EXISTS packaging_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{1,16}$'),
  name TEXT NOT NULL UNIQUE,
  standard_capacity NUMERIC(12, 3) NOT NULL CHECK (standard_capacity > 0),
  capacity_unit TEXT NOT NULL DEFAULT 'kg' CHECK (capacity_unit IN ('kg', 'g', 'piece', 'bunch')),
  tare_weight_kg NUMERIC(10, 3) CHECK (tare_weight_kg IS NULL OR tare_weight_kg >= 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]{1,24}$'),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'export'
    CHECK (category IN ('export', 'procurement', 'buyer', 'supplier', 'qc', 'claim', 'general')),
  is_mandatory_for_export BOOLEAN NOT NULL DEFAULT FALSE,
  has_expiry BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]+(\.[a-z_]+)*$'),
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ——— Document numbering (harvest batches, packed batches, POs, shipments…) ———

CREATE TABLE IF NOT EXISTS farm_sequences (
  scope TEXT NOT NULL,
  period TEXT NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, period)
);

CREATE OR REPLACE FUNCTION farm_next_sequence(p_scope TEXT, p_period TEXT) RETURNS INT AS $$
DECLARE
  v INT;
BEGIN
  INSERT INTO farm_sequences (scope, period, last_value)
  VALUES (p_scope, p_period, 1)
  ON CONFLICT (scope, period) DO UPDATE SET last_value = farm_sequences.last_value + 1
  RETURNING last_value INTO v;
  RETURN v;
END;
$$ LANGUAGE plpgsql;

-- ——— Attachments: every file is linked to a record (no orphan files) ———

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'farm', 'block', 'planting_cycle', 'crop', 'farm_activity', 'pest_disease_incident',
    'worker', 'harvest_batch', 'qc_inspection', 'packing_batch', 'buyer', 'buyer_contract',
    'shipment', 'shipment_document', 'supplier', 'purchase_request', 'supplier_quotation',
    'purchase_order', 'goods_received_note', 'supplier_invoice', 'buyer_invoice', 'payment',
    'shipment_cost', 'claim', 'equipment'
  )),
  entity_id UUID NOT NULL,
  category TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  caption TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

-- ——— updated_at triggers ———

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_roles', 'farms', 'crops', 'crop_varieties', 'grades', 'crop_quality_criteria',
    'blocks', 'planting_cycles', 'packaging_types', 'document_types', 'system_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION farm_set_updated_at()',
      t
    );
  END LOOP;
END;
$$;

-- ——— RLS: all access goes through server routes using the service role ———

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_quality_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE planting_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- ——— Seed: roles ———

INSERT INTO app_roles (slug, name, description) VALUES
  ('system_admin', 'System Administrator', 'Full access, users, roles and configuration'),
  ('farm_manager', 'Farm Manager', 'Runs farm operations, blocks, crops, labour and harvest'),
  ('field_supervisor', 'Field Supervisor', 'Records farm activities, attendance and pest observations'),
  ('harvest_supervisor', 'Harvest Supervisor', 'Records harvests and grading'),
  ('packhouse_officer', 'Packhouse Officer', 'Records packing and packed batches'),
  ('warehouse_officer', 'Warehouse Officer', 'Manages warehouse stock and movements'),
  ('qc_officer', 'Quality Control Officer', 'Performs QC inspections'),
  ('procurement_officer', 'Procurement Officer', 'Runs purchase requests through to supplier invoices'),
  ('logistics_officer', 'Export / Logistics Officer', 'Manages air shipments, AWBs and export documents'),
  ('sales_officer', 'Sales / Contracts Officer', 'Manages buyers, contracts and stock reservations'),
  ('finance_officer', 'Finance Officer', 'Records invoices, payments and costs'),
  ('auditor', 'Auditor / Viewer', 'Read-only access across the system'),
  ('management', 'Management / CEO', 'Dashboard and reporting visibility across the operation'),
  ('ememo_approver', 'OneSource Approver', 'Approves farm requests routed through the OneSource module')
ON CONFLICT (slug) DO NOTHING;

-- ——— Seed: permissions (catalogue for all phases) ———

INSERT INTO permissions (key, module, description, sort_order) VALUES
  ('dashboard.view', 'Dashboard', 'View the executive dashboard', 10),
  ('farm.view', 'Farm', 'View farm, blocks and planting cycles', 20),
  ('farm.manage', 'Farm', 'Create and edit farm, blocks and planting cycles', 21),
  ('crops.view', 'Crops', 'View crops, varieties and grading setup', 30),
  ('crops.manage', 'Crops', 'Create and edit crops, varieties, grading and QC criteria', 31),
  ('activities.view', 'Farm activities', 'View farm activities', 40),
  ('activities.record', 'Farm activities', 'Record farm activities and inputs used', 41),
  ('activities.manage', 'Farm activities', 'Edit or delete any farm activity', 42),
  ('pest.view', 'Pest & disease', 'View pest and disease incidents', 50),
  ('pest.record', 'Pest & disease', 'Record and update pest and disease incidents', 51),
  ('workforce.view', 'Workforce', 'View workers and tasks', 60),
  ('workforce.manage', 'Workforce', 'Create and edit workers and tasks', 61),
  ('attendance.record', 'Workforce', 'Record attendance', 62),
  ('payroll.view', 'Workforce', 'View payroll costing', 63),
  ('payroll.manage', 'Workforce', 'Edit rates, advances, deductions and payment status', 64),
  ('harvest.view', 'Harvest', 'View harvest batches and grading', 70),
  ('harvest.record', 'Harvest', 'Record harvest batches', 71),
  ('grading.record', 'Harvest', 'Record harvest grading', 72),
  ('qc.view', 'Quality control', 'View QC inspections', 80),
  ('qc.inspect', 'Quality control', 'Perform QC inspections and rework', 81),
  ('qc.approve', 'Quality control', 'Supervisor review and QC approval', 82),
  ('qc.release', 'Quality control', 'Final export release', 83),
  ('packing.view', 'Packhouse', 'View packing records', 90),
  ('packing.record', 'Packhouse', 'Record packing and packed batches', 91),
  ('warehouse.view', 'Warehouse', 'View inventory and stock movements', 100),
  ('warehouse.manage', 'Warehouse', 'Receive, move, damage and dispatch stock', 101),
  ('buyers.view', 'Sales', 'View buyers', 110),
  ('buyers.manage', 'Sales', 'Create and edit buyers', 111),
  ('contracts.view', 'Sales', 'View buyer contracts', 112),
  ('contracts.manage', 'Sales', 'Create and edit buyer contracts', 113),
  ('reservations.manage', 'Sales', 'Reserve and release stock against contracts', 114),
  ('shipments.view', 'Exports', 'View shipments and AWBs', 120),
  ('shipments.manage', 'Exports', 'Create and update shipments, airport dispatch and AWBs', 121),
  ('documents.view', 'Exports', 'View export documents', 122),
  ('documents.manage', 'Exports', 'Upload and manage export documents', 123),
  ('procurement.view', 'Procurement', 'View procurement records', 130),
  ('procurement.request', 'Procurement', 'Raise purchase requests', 131),
  ('procurement.manage', 'Procurement', 'Quotations, supplier selection, POs, GRNs and supplier invoices', 132),
  ('suppliers.manage', 'Procurement', 'Create and edit suppliers', 133),
  ('finance.view', 'Finance', 'View invoices, payments and receivables', 140),
  ('invoices.manage', 'Finance', 'Create and edit buyer invoices', 141),
  ('payments.record', 'Finance', 'Record buyer and supplier payments', 142),
  ('costs.manage', 'Finance', 'Record shipment and operating costs', 143),
  ('profitability.view', 'Finance', 'View profitability analysis', 144),
  ('claims.view', 'Claims', 'View buyer claims', 150),
  ('claims.manage', 'Claims', 'Create and progress buyer claims', 151),
  ('equipment.view', 'Equipment', 'View the equipment register', 160),
  ('equipment.manage', 'Equipment', 'Create and edit equipment', 161),
  ('traceability.view', 'Traceability', 'Trace shipments back to the farm and harvests forward', 170),
  ('reports.view', 'Reports', 'View reports', 180),
  ('reports.export', 'Reports', 'Export reports to PDF, Excel and CSV', 181),
  ('alerts.view', 'Alerts', 'View alerts', 190),
  ('alerts.manage', 'Alerts', 'Acknowledge, assign and resolve alerts', 191),
  ('admin.users', 'Administration', 'Assign users to roles', 200),
  ('admin.roles', 'Administration', 'Edit role permissions', 201),
  ('admin.settings', 'Administration', 'Manage grades, packaging, document types and system settings', 202)
ON CONFLICT (key) DO NOTHING;

-- ——— Seed: default role permissions ('*' matches any run of characters) ———

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM (VALUES
  ('system_admin', ARRAY['*']),
  ('farm_manager', ARRAY[
    'dashboard.view', 'farm.*', 'crops.*', 'activities.*', 'pest.*', 'workforce.*', 'attendance.*',
    'payroll.view', 'harvest.*', 'grading.*', 'qc.*', 'packing.view', 'warehouse.view',
    'procurement.view', 'procurement.request', 'equipment.*', 'traceability.view', 'reports.*', 'alerts.*'
  ]),
  ('field_supervisor', ARRAY[
    'farm.view', 'crops.view', 'activities.view', 'activities.record', 'pest.*', 'workforce.view',
    'attendance.record', 'harvest.view', 'equipment.view', 'alerts.view', 'procurement.request'
  ]),
  ('harvest_supervisor', ARRAY[
    'farm.view', 'crops.view', 'harvest.*', 'grading.record', 'workforce.view', 'attendance.record',
    'qc.view', 'traceability.view', 'alerts.view'
  ]),
  ('packhouse_officer', ARRAY[
    'crops.view', 'harvest.view', 'grading.record', 'packing.*', 'qc.view', 'warehouse.view',
    'traceability.view', 'alerts.view'
  ]),
  ('warehouse_officer', ARRAY[
    'crops.view', 'packing.view', 'warehouse.*', 'reservations.manage', 'contracts.view',
    'shipments.view', 'traceability.view', 'alerts.view'
  ]),
  ('qc_officer', ARRAY[
    'crops.view', 'harvest.view', 'qc.view', 'qc.inspect', 'packing.view', 'warehouse.view',
    'documents.view', 'traceability.view', 'alerts.view'
  ]),
  ('procurement_officer', ARRAY[
    'dashboard.view', 'procurement.*', 'suppliers.*', 'documents.view', 'reports.view', 'alerts.view'
  ]),
  ('logistics_officer', ARRAY[
    'dashboard.view', 'shipments.*', 'documents.*', 'warehouse.view', 'buyers.view', 'contracts.view',
    'costs.manage', 'traceability.view', 'reports.view', 'alerts.view'
  ]),
  ('sales_officer', ARRAY[
    'dashboard.view', 'buyers.*', 'contracts.*', 'reservations.manage', 'warehouse.view',
    'shipments.view', 'documents.view', 'finance.view', 'claims.*', 'traceability.view',
    'reports.view', 'alerts.view'
  ]),
  ('finance_officer', ARRAY[
    'dashboard.view', 'finance.*', 'invoices.*', 'payments.*', 'costs.*', 'profitability.*',
    'payroll.*', 'procurement.view', 'buyers.view', 'contracts.view', 'shipments.view',
    'claims.view', 'traceability.view', 'reports.*', 'alerts.view'
  ]),
  ('auditor', ARRAY['*.view', 'reports.export']),
  ('management', ARRAY['*.view', 'reports.*', 'alerts.*']),
  ('ememo_approver', ARRAY['alerts.view'])
) AS m(slug, patterns)
JOIN app_roles r ON r.slug = m.slug
JOIN permissions p
  ON EXISTS (SELECT 1 FROM unnest(m.patterns) AS pat WHERE p.key LIKE replace(pat, '*', '%'))
ON CONFLICT DO NOTHING;

-- Existing OneSource administrators become system administrators.
INSERT INTO user_app_roles (user_id, role_id)
SELECT u.id, ar.id
FROM users u
JOIN roles r ON r.id = u.role_id AND r.slug = 'admin'
JOIN app_roles ar ON ar.slug = 'system_admin'
ON CONFLICT DO NOTHING;

-- ——— Seed: farm and master data ———

INSERT INTO farms (code, name, country)
VALUES ('OSF', 'OneSource Farm', 'Uganda')
ON CONFLICT (code) DO NOTHING;

INSERT INTO grades (code, name, purpose, is_reject, sort_order, description) VALUES
  ('A', 'Grade A', 'export', FALSE, 1, 'Export quality'),
  ('B', 'Grade B', 'local_market', FALSE, 2, 'Local market'),
  ('C', 'Grade C', 'processing', FALSE, 3, 'Processing'),
  ('REJECTED', 'Rejected', 'waste', TRUE, 4, 'Waste / rejected')
ON CONFLICT (code) DO NOTHING;

INSERT INTO crops (code, name, scientific_name, production_cycle, default_unit, maturity_days, description)
VALUES ('CHILLI', 'Chilli', 'Capsicum spp.', 'seasonal', 'kg', 90, 'Fresh chilli for export')
ON CONFLICT (code) DO NOTHING;

INSERT INTO crop_grades (crop_id, grade_id)
SELECT c.id, g.id FROM crops c CROSS JOIN grades g WHERE c.code = 'CHILLI'
ON CONFLICT DO NOTHING;

INSERT INTO crop_quality_criteria (crop_id, name, criterion_type, is_mandatory, sort_order)
SELECT c.id, v.name, 'pass_fail', TRUE, v.sort_order
FROM crops c
CROSS JOIN (VALUES
  ('Size', 1), ('Colour', 2), ('Weight', 3), ('Damage', 4), ('Defects', 5), ('Maturity', 6),
  ('Ripeness', 7), ('Pest signs', 8), ('Disease signs', 9), ('Moisture / condition', 10),
  ('Appearance', 11)
) AS v(name, sort_order)
WHERE c.code = 'CHILLI'
ON CONFLICT (crop_id, name) DO NOTHING;

INSERT INTO packaging_types (code, name, standard_capacity, capacity_unit) VALUES
  ('CARTON', 'Carton', 5, 'kg'),
  ('CRATE', 'Crate', 10, 'kg'),
  ('SACK', 'Sack', 25, 'kg'),
  ('BOX', 'Box', 4, 'kg')
ON CONFLICT (code) DO NOTHING;

INSERT INTO document_types (code, name, category, is_mandatory_for_export, has_expiry, sort_order) VALUES
  ('COMMERCIAL_INVOICE', 'Commercial Invoice', 'export', TRUE, FALSE, 1),
  ('PACKING_LIST', 'Packing List', 'export', TRUE, FALSE, 2),
  ('AIR_WAYBILL', 'Air Waybill', 'export', TRUE, FALSE, 3),
  ('PHYTOSANITARY', 'Phytosanitary Certificate', 'export', TRUE, TRUE, 4),
  ('CERT_OF_ORIGIN', 'Certificate of Origin', 'export', FALSE, FALSE, 5),
  ('EXPORT_PERMIT', 'Export Permit', 'export', TRUE, TRUE, 6),
  ('CUSTOMS_DECLARATION', 'Customs Declaration', 'export', TRUE, FALSE, 7),
  ('URA_EXPORT', 'URA Export Documentation', 'export', FALSE, FALSE, 8),
  ('INSPECTION_CERT', 'Inspection Certificate', 'export', FALSE, TRUE, 9),
  ('INSURANCE', 'Insurance Certificate', 'export', FALSE, TRUE, 10),
  ('OTHER_EXPORT', 'Other Supporting Document', 'export', FALSE, FALSE, 99)
ON CONFLICT (code) DO NOTHING;

INSERT INTO system_settings (key, value, description) VALUES
  ('general.default_currency', '"USD"', 'Currency used for contracts and reporting'),
  ('general.weight_unit', '"kg"', 'Base unit for harvest, stock and export weights'),
  ('general.fiscal_year_start_month', '1', 'Month (1–12) the financial year starts'),
  ('ememo.purchase_order_threshold', '1000', 'Purchase orders at or above this amount need approval'),
  ('ememo.supplier_payment_threshold', '1000', 'Supplier payments at or above this amount need approval'),
  ('alerts.upcoming_harvest_days', '7', 'Days before expected harvest to raise an alert'),
  ('alerts.document_expiry_days', '14', 'Days before a document expires to raise an alert')
ON CONFLICT (key) DO NOTHING;
