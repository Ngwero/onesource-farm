-- Phase 4: buyers / contracts / shipments, farm-input store, spray compliance,
-- executive budget settings, and public batch-trace tokens.

-- ——— Buyers ———

CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,16}$'),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  destination TEXT,
  address TEXT,
  payment_terms TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, code),
  UNIQUE (farm_id, name)
);

CREATE INDEX IF NOT EXISTS idx_buyers_farm ON buyers(farm_id, status);

-- ——— Supply contracts ———

CREATE TABLE IF NOT EXISTS buyer_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE RESTRICT,
  contract_no TEXT NOT NULL,
  crop_id UUID REFERENCES crops(id) ON DELETE RESTRICT,
  grade_id UUID REFERENCES grades(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  agreed_quantity NUMERIC(14, 3) NOT NULL CHECK (agreed_quantity > 0),
  quantity_unit TEXT NOT NULL DEFAULT 'kg',
  unit_price NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  specifications TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, contract_no),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_buyer_contracts_farm ON buyer_contracts(farm_id, status);
CREATE INDEX IF NOT EXISTS idx_buyer_contracts_buyer ON buyer_contracts(buyer_id);

-- ——— Export shipments ———

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  shipment_no TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES buyer_contracts(id) ON DELETE SET NULL,
  destination TEXT,
  carrier TEXT,
  booking_ref TEXT,
  awb_bl_number TEXT,
  etd DATE,
  eta DATE,
  dispatched_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'loading', 'dispatched', 'in_transit', 'delivered', 'cancelled')),
  invoice_no TEXT,
  invoice_amount NUMERIC(14, 2) CHECK (invoice_amount IS NULL OR invoice_amount >= 0),
  invoice_currency TEXT CHECK (invoice_currency IS NULL OR invoice_currency ~ '^[A-Z]{3}$'),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, shipment_no)
);

CREATE INDEX IF NOT EXISTS idx_shipments_farm ON shipments(farm_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_buyer ON shipments(buyer_id);

CREATE TABLE IF NOT EXISTS shipment_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  packing_batch_id UUID NOT NULL REFERENCES packing_batches(id) ON DELETE RESTRICT,
  package_count INT NOT NULL CHECK (package_count > 0),
  net_weight NUMERIC(14, 3) NOT NULL CHECK (net_weight > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipment_id, packing_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_shipment_lines_batch ON shipment_lines(packing_batch_id);

CREATE TABLE IF NOT EXISTS shipment_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  document_type_id UUID REFERENCES document_types(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  reference_no TEXT,
  issued_on DATE,
  expires_on DATE,
  file_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ——— Farm input inventory (seed, fertilizer, chemicals, fuel, packaging) ———

CREATE TABLE IF NOT EXISTS input_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('seed', 'fertilizer', 'crop_protection', 'fuel', 'packaging', 'other')),
  unit TEXT NOT NULL,
  active_ingredient TEXT,
  registration_no TEXT,
  manufacturer TEXT,
  default_supplier TEXT,
  reorder_level NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_input_products_farm ON input_products(farm_id, category, status);

CREATE TABLE IF NOT EXISTS input_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES input_products(id) ON DELETE RESTRICT,
  lot_no TEXT NOT NULL,
  supplier TEXT,
  received_date DATE NOT NULL,
  expiry_date DATE,
  quantity_received NUMERIC(14, 3) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining NUMERIC(14, 3) NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost NUMERIC(14, 4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, product_id, lot_no),
  CHECK (quantity_remaining <= quantity_received),
  CHECK (expiry_date IS NULL OR expiry_date >= received_date)
);

CREATE INDEX IF NOT EXISTS idx_input_lots_product ON input_lots(product_id, expiry_date);

CREATE TABLE IF NOT EXISTS input_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES input_products(id) ON DELETE RESTRICT,
  lot_id UUID REFERENCES input_lots(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('receipt', 'issue', 'adjustment', 'return', 'waste')),
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14, 4),
  activity_id UUID REFERENCES farm_activities(id) ON DELETE SET NULL,
  reference TEXT,
  notes TEXT,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_input_movements_product ON input_movements(product_id, moved_at DESC);

-- ——— Spray / chemical compliance on activities ———

ALTER TABLE farm_activities
  ADD COLUMN IF NOT EXISTS application_rate_per_ha NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS treated_area_ha NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS active_ingredient TEXT,
  ADD COLUMN IF NOT EXISTS product_registration TEXT,
  ADD COLUMN IF NOT EXISTS pre_harvest_interval_days INT CHECK (pre_harvest_interval_days IS NULL OR pre_harvest_interval_days >= 0),
  ADD COLUMN IF NOT EXISTS re_entry_interval_hours INT CHECK (re_entry_interval_hours IS NULL OR re_entry_interval_hours >= 0),
  ADD COLUMN IF NOT EXISTS applicator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_equipment TEXT,
  ADD COLUMN IF NOT EXISTS spray_window_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS harvest_compliant BOOLEAN;

ALTER TABLE farm_activity_inputs
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES input_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES input_lots(id) ON DELETE SET NULL;

-- ——— Public / QR batch trace tokens ———

CREATE TABLE IF NOT EXISTS batch_trace_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('harvest_batch', 'packing_batch')),
  harvest_batch_id UUID REFERENCES harvest_batches(id) ON DELETE CASCADE,
  packing_batch_id UUID REFERENCES packing_batches(id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (subject_type = 'harvest_batch' AND harvest_batch_id IS NOT NULL AND packing_batch_id IS NULL)
    OR (subject_type = 'packing_batch' AND packing_batch_id IS NOT NULL AND harvest_batch_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_batch_trace_tokens_subject ON batch_trace_tokens(harvest_batch_id, packing_batch_id);

-- ——— Executive budget setting ———

INSERT INTO system_settings (key, value, description) VALUES
  ('finance.monthly_payroll_budget', '0', 'Monthly payroll budget used on the executive dashboard'),
  ('finance.monthly_input_budget', '0', 'Monthly farm-input budget used on the executive dashboard')
ON CONFLICT (key) DO NOTHING;

-- ——— Touch updated_at helpers ———

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['buyers', 'buyer_contracts', 'shipments', 'input_products', 'input_lots']
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION touch_%s_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $f$
       BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $f$',
      t
    );
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION touch_%s_updated_at()',
      t, t, t
    );
  END LOOP;
END $$;
