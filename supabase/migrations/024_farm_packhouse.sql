-- Phase 3: quality control, packing, warehouse stock and traceability.
-- Stock is an append-only movement ledger; balances are always derived from it.
-- Business-rule violations are raised with SQLSTATE P0001 and a user-readable message.

-- ——— Warehouse locations ———

CREATE TABLE IF NOT EXISTS warehouse_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{1,16}$'),
  name TEXT NOT NULL UNIQUE,
  location_type TEXT NOT NULL DEFAULT 'cold_room'
    CHECK (location_type IN ('cold_room', 'dry_store', 'packhouse', 'dispatch', 'other')),
  sort_order INT NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO warehouse_locations (code, name, location_type, sort_order) VALUES
  ('COLD-1', 'Cold room 1', 'cold_room', 10),
  ('DISPATCH', 'Dispatch bay', 'dispatch', 20)
ON CONFLICT (code) DO NOTHING;

-- ——— QC status on harvest batches ———
-- pending → (failed | rework → reinspection | approved) → released (packed batches only)

ALTER TABLE harvest_batches
  ADD COLUMN IF NOT EXISTS qc_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (qc_status IN ('pending', 'failed', 'rework', 'reinspection', 'approved', 'released'));

-- ——— Packed batches ———

CREATE TABLE IF NOT EXISTS packing_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  packing_no TEXT NOT NULL UNIQUE,
  harvest_batch_id UUID NOT NULL,
  crop_id UUID NOT NULL,
  grade_id UUID NOT NULL,
  packaging_type_id UUID NOT NULL REFERENCES packaging_types(id) ON DELETE RESTRICT,
  packing_date DATE NOT NULL,
  package_count INT NOT NULL CHECK (package_count > 0),
  net_weight_per_package NUMERIC(12, 3) NOT NULL CHECK (net_weight_per_package > 0),
  tare_weight_per_package NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (tare_weight_per_package >= 0),
  net_weight NUMERIC(14, 3) GENERATED ALWAYS AS (package_count * net_weight_per_package) STORED,
  gross_weight NUMERIC(14, 3) GENERATED ALWAYS AS (package_count * (net_weight_per_package + tare_weight_per_package)) STORED,
  packed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
  received_date DATE,
  qc_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (qc_status IN ('pending', 'failed', 'rework', 'reinspection', 'approved', 'released')),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (harvest_batch_id, crop_id) REFERENCES harvest_batches(id, crop_id) ON DELETE RESTRICT,
  -- Only grades configured for the crop can be packed.
  FOREIGN KEY (crop_id, grade_id) REFERENCES crop_grades(crop_id, grade_id) ON DELETE RESTRICT,
  CHECK (received_date IS NULL OR received_date >= packing_date),
  CHECK ((received_date IS NULL) = (location_id IS NULL)),
  CHECK (qc_status <> 'released' OR released_at IS NOT NULL)
);

-- Direct keys so the API can embed the crop and grade.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'packing_batches_crop_id_fkey') THEN
    ALTER TABLE packing_batches ADD CONSTRAINT packing_batches_crop_id_fkey
      FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'packing_batches_grade_id_fkey') THEN
    ALTER TABLE packing_batches ADD CONSTRAINT packing_batches_grade_id_fkey
      FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_packing_batches_farm_date ON packing_batches(farm_id, packing_date DESC);
CREATE INDEX IF NOT EXISTS idx_packing_batches_harvest ON packing_batches(harvest_batch_id);

-- ——— QC inspections ———

CREATE TABLE IF NOT EXISTS qc_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  inspection_no TEXT NOT NULL UNIQUE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('harvest_batch', 'packing_batch')),
  harvest_batch_id UUID REFERENCES harvest_batches(id) ON DELETE RESTRICT,
  packing_batch_id UUID REFERENCES packing_batches(id) ON DELETE RESTRICT,
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  inspection_date DATE NOT NULL,
  inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sample_size NUMERIC(12, 3) CHECK (sample_size IS NULL OR sample_size > 0),
  sample_unit TEXT,
  buyer_specification TEXT,
  result TEXT NOT NULL CHECK (result IN ('pass', 'conditional_pass', 'fail')),
  rejected_quantity NUMERIC(14, 3) CHECK (rejected_quantity IS NULL OR rejected_quantity >= 0),
  rejection_reason_id UUID REFERENCES rejection_reasons(id) ON DELETE RESTRICT,
  corrective_action TEXT,
  notes TEXT,
  review_status TEXT NOT NULL DEFAULT 'awaiting_review'
    CHECK (review_status IN ('awaiting_review', 'approved', 'rework', 'reinspection', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rework_notes TEXT,
  rework_completed_at TIMESTAMPTZ,
  rework_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((subject_type = 'harvest_batch') = (harvest_batch_id IS NOT NULL)),
  CHECK ((subject_type = 'packing_batch') = (packing_batch_id IS NOT NULL)),
  CHECK (review_status = 'awaiting_review' OR reviewed_at IS NOT NULL),
  CHECK (COALESCE(rejected_quantity, 0) = 0 OR rejection_reason_id IS NOT NULL),
  CHECK (rework_completed_at IS NULL OR review_status = 'rework')
);

CREATE INDEX IF NOT EXISTS idx_qc_inspections_farm_date ON qc_inspections(farm_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_harvest ON qc_inspections(harvest_batch_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_packing ON qc_inspections(packing_batch_id);
-- One open inspection per batch at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_awaiting_harvest
  ON qc_inspections(harvest_batch_id) WHERE review_status = 'awaiting_review' AND harvest_batch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_awaiting_packing
  ON qc_inspections(packing_batch_id) WHERE review_status = 'awaiting_review' AND packing_batch_id IS NOT NULL;

-- Each check snapshots the crop criterion so later criteria changes do not rewrite history.
CREATE TABLE IF NOT EXISTS qc_inspection_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
  criterion_id UUID REFERENCES crop_quality_criteria(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  criterion_type TEXT NOT NULL CHECK (criterion_type IN ('pass_fail', 'numeric', 'scale', 'text')),
  unit TEXT,
  min_value NUMERIC(14, 4),
  max_value NUMERIC(14, 4),
  is_mandatory BOOLEAN NOT NULL,
  value_numeric NUMERIC(14, 4),
  value_text TEXT,
  passed BOOLEAN,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (inspection_id, name)
);

-- ——— Stock movement ledger ———

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  packing_batch_id UUID NOT NULL REFERENCES packing_batches(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('receive', 'relocate', 'reserve', 'unreserve', 'dispatch', 'damage', 'spoil')),
  from_bucket TEXT CHECK (from_bucket IN ('available', 'reserved', 'dispatched', 'damaged', 'spoiled')),
  to_bucket TEXT CHECK (to_bucket IN ('available', 'reserved', 'dispatched', 'damaged', 'spoiled')),
  packages INT NOT NULL CHECK (packages > 0),
  from_location_id UUID REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
  to_location_id UUID REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
  movement_date DATE NOT NULL,
  reference TEXT,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_bucket IS DISTINCT FROM to_bucket OR movement_type = 'relocate')
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_farm_date ON stock_movements(farm_id, movement_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(packing_batch_id);

CREATE OR REPLACE FUNCTION farm_guard_stock_movement() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Stock movements are permanent. Record a correcting movement instead.';
END $$;

DROP TRIGGER IF EXISTS trg_stock_movements_append_only ON stock_movements;
CREATE TRIGGER trg_stock_movements_append_only
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION farm_guard_stock_movement();

-- Package balances per packed batch, derived from the ledger.
CREATE OR REPLACE VIEW packing_batch_stock WITH (security_invoker = true) AS
SELECT
  pb.id AS packing_batch_id,
  pb.farm_id,
  (COALESCE(SUM(m.packages) FILTER (WHERE m.to_bucket = 'available'), 0)
    - COALESCE(SUM(m.packages) FILTER (WHERE m.from_bucket = 'available'), 0))::INT AS available,
  (COALESCE(SUM(m.packages) FILTER (WHERE m.to_bucket = 'reserved'), 0)
    - COALESCE(SUM(m.packages) FILTER (WHERE m.from_bucket = 'reserved'), 0))::INT AS reserved,
  (COALESCE(SUM(m.packages) FILTER (WHERE m.to_bucket = 'dispatched'), 0)
    - COALESCE(SUM(m.packages) FILTER (WHERE m.from_bucket = 'dispatched'), 0))::INT AS dispatched,
  (COALESCE(SUM(m.packages) FILTER (WHERE m.to_bucket = 'damaged'), 0)
    - COALESCE(SUM(m.packages) FILTER (WHERE m.from_bucket = 'damaged'), 0))::INT AS damaged,
  (COALESCE(SUM(m.packages) FILTER (WHERE m.to_bucket = 'spoiled'), 0)
    - COALESCE(SUM(m.packages) FILTER (WHERE m.from_bucket = 'spoiled'), 0))::INT AS spoiled
FROM packing_batches pb
LEFT JOIN stock_movements m ON m.packing_batch_id = pb.id
GROUP BY pb.id, pb.farm_id;

-- ——— Guards ———

-- Once received into the warehouse or inspected, what was packed cannot change.
CREATE OR REPLACE FUNCTION farm_guard_packing_batch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  v_locked := OLD.received_date IS NOT NULL
    OR EXISTS (SELECT 1 FROM qc_inspections WHERE packing_batch_id = OLD.id);
  IF TG_OP = 'DELETE' THEN
    IF v_locked THEN
      RAISE EXCEPTION 'Packed batch % has been received or inspected and cannot be deleted.', OLD.packing_no;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.harvest_batch_id IS DISTINCT FROM OLD.harvest_batch_id OR NEW.grade_id IS DISTINCT FROM OLD.grade_id THEN
    RAISE EXCEPTION 'The source harvest and grade of a packed batch cannot change. Delete it and pack again.';
  END IF;
  IF v_locked AND (NEW.package_count, NEW.net_weight_per_package, NEW.tare_weight_per_package, NEW.packaging_type_id)
      IS DISTINCT FROM (OLD.package_count, OLD.net_weight_per_package, OLD.tare_weight_per_package, OLD.packaging_type_id) THEN
    RAISE EXCEPTION 'Packed batch % has been received or inspected, so its packages and weights are locked.', OLD.packing_no;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_packing_batches_guard ON packing_batches;
CREATE TRIGGER trg_packing_batches_guard
  BEFORE UPDATE OR DELETE ON packing_batches
  FOR EACH ROW EXECUTE FUNCTION farm_guard_packing_batch();

-- Packed quantities were taken from the grading, so it cannot change underneath them.
CREATE OR REPLACE FUNCTION farm_guard_packed_grading() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_batch UUID;
BEGIN
  IF TG_TABLE_NAME = 'harvest_gradings' THEN
    v_batch := OLD.batch_id;
  ELSE
    SELECT batch_id INTO v_batch FROM harvest_gradings WHERE id = OLD.grading_id;
  END IF;
  IF v_batch IS NOT NULL AND EXISTS (SELECT 1 FROM packing_batches WHERE harvest_batch_id = v_batch) THEN
    RAISE EXCEPTION 'This harvest has been packed, so its grading is locked.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_harvest_gradings_packed ON harvest_gradings;
CREATE TRIGGER trg_harvest_gradings_packed
  BEFORE DELETE ON harvest_gradings
  FOR EACH ROW EXECUTE FUNCTION farm_guard_packed_grading();

DROP TRIGGER IF EXISTS trg_grading_lines_packed ON harvest_grading_lines;
CREATE TRIGGER trg_grading_lines_packed
  BEFORE UPDATE OR DELETE ON harvest_grading_lines
  FOR EACH ROW EXECUTE FUNCTION farm_guard_packed_grading();

-- ——— Packing ———

CREATE OR REPLACE FUNCTION farm_save_packing_batch(
  p_id UUID, p_farm UUID, p_user UUID, p_data JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := p_id;
  v_existing packing_batches%ROWTYPE;
  v_harvest UUID := NULLIF(p_data->>'harvest_batch_id', '')::UUID;
  v_grade UUID := NULLIF(p_data->>'grade_id', '')::UUID;
  v_date DATE := (p_data->>'packing_date')::DATE;
  v_count INT := (p_data->>'package_count')::INT;
  v_net NUMERIC := (p_data->>'net_weight_per_package')::NUMERIC;
  h RECORD;
  g RECORD;
  v_factor NUMERIC;
  v_packed NUMERIC;
  v_seq INT;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM packing_batches WHERE id = v_id AND farm_id = p_farm FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Packed batch not found' USING ERRCODE = 'P0002';
    END IF;
    v_harvest := v_existing.harvest_batch_id;
    v_grade := v_existing.grade_id;
    v_date := v_existing.packing_date;
  END IF;

  SELECT hb.id, hb.batch_no, hb.crop_id, hb.unit, hb.status, hb.qc_status, hb.harvest_date, cr.code AS crop_code
  INTO h
  FROM harvest_batches hb
  JOIN crops cr ON cr.id = hb.crop_id
  WHERE hb.id = v_harvest AND hb.farm_id = p_farm
  FOR UPDATE OF hb;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected harvest batch does not exist on this farm.';
  END IF;
  IF h.status <> 'graded' THEN
    RAISE EXCEPTION 'Grade harvest batch % before packing it.', h.batch_no;
  END IF;
  IF h.qc_status = 'failed' THEN
    RAISE EXCEPTION 'Harvest batch % failed QC and cannot be packed.', h.batch_no;
  END IF;
  IF v_date < h.harvest_date THEN
    RAISE EXCEPTION 'The packing date cannot be before the harvest date (%).', to_char(h.harvest_date, 'DD Mon YYYY');
  END IF;

  SELECT gr.code, gr.name, gr.is_reject, l.quantity
  INTO g
  FROM harvest_gradings hg
  JOIN harvest_grading_lines l ON l.grading_id = hg.id
  JOIN grades gr ON gr.id = l.grade_id
  WHERE hg.batch_id = h.id AND l.grade_id = v_grade;
  IF NOT FOUND OR g.quantity = 0 THEN
    RAISE EXCEPTION 'Batch % has no produce graded in the selected grade.', h.batch_no;
  END IF;
  IF g.is_reject THEN
    RAISE EXCEPTION 'Rejected produce cannot be packed.';
  END IF;

  -- Weight-based harvests: packed net weight cannot exceed what was graded.
  v_factor := CASE h.unit WHEN 'kg' THEN 1 WHEN 'tonne' THEN 1000 ELSE NULL END;
  IF v_factor IS NOT NULL THEN
    SELECT COALESCE(SUM(net_weight), 0) INTO v_packed
    FROM packing_batches
    WHERE harvest_batch_id = h.id AND grade_id = v_grade AND id IS DISTINCT FROM v_id;
    IF v_packed + v_count * v_net > g.quantity * v_factor THEN
      RAISE EXCEPTION 'Only % kg of % is left to pack from % (% kg graded, % kg already packed).',
        trim_scale(GREATEST(g.quantity * v_factor - v_packed, 0)), g.name, h.batch_no,
        trim_scale(g.quantity * v_factor), trim_scale(v_packed);
    END IF;
  END IF;

  IF v_id IS NULL THEN
    v_seq := farm_next_sequence('packing:' || h.crop_code || ':' || g.code, to_char(v_date, 'YYYYMMDD'));
    INSERT INTO packing_batches (
      farm_id, packing_no, harvest_batch_id, crop_id, grade_id, packaging_type_id, packing_date,
      package_count, net_weight_per_package, tare_weight_per_package, packed_by, notes, created_by
    ) VALUES (
      p_farm,
      'PK-' || h.crop_code || '-' || g.code || '-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 3, '0'),
      h.id, h.crop_id, v_grade, (p_data->>'packaging_type_id')::UUID, v_date,
      v_count, v_net, COALESCE((p_data->>'tare_weight_per_package')::NUMERIC, 0),
      NULLIF(p_data->>'packed_by', '')::UUID, p_data->>'notes', p_user
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE packing_batches SET
      packaging_type_id = (p_data->>'packaging_type_id')::UUID,
      package_count = v_count,
      net_weight_per_package = v_net,
      tare_weight_per_package = COALESCE((p_data->>'tare_weight_per_package')::NUMERIC, 0),
      packed_by = NULLIF(p_data->>'packed_by', '')::UUID,
      notes = p_data->>'notes'
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END $$;

-- ——— QC ———

-- A batch's QC status follows its latest inspection; release is set separately.
CREATE OR REPLACE FUNCTION farm_sync_qc_status(p_harvest UUID, p_packing UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v TEXT;
BEGIN
  SELECT CASE
      WHEN review_status = 'approved' THEN 'approved'
      WHEN review_status = 'rework' AND rework_completed_at IS NULL THEN 'rework'
      WHEN review_status IN ('rework', 'reinspection') THEN 'reinspection'
      WHEN review_status = 'rejected' THEN 'failed'
      ELSE 'pending'
    END
  INTO v
  FROM qc_inspections
  WHERE (p_harvest IS NOT NULL AND harvest_batch_id = p_harvest)
     OR (p_packing IS NOT NULL AND packing_batch_id = p_packing)
  ORDER BY created_at DESC
  LIMIT 1;
  v := COALESCE(v, 'pending');
  IF p_harvest IS NOT NULL THEN
    UPDATE harvest_batches SET qc_status = v WHERE id = p_harvest AND qc_status IS DISTINCT FROM v;
  END IF;
  IF p_packing IS NOT NULL THEN
    UPDATE packing_batches SET qc_status = v
    WHERE id = p_packing AND qc_status <> 'released' AND qc_status IS DISTINCT FROM v;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION farm_save_qc_inspection(
  p_id UUID, p_farm UUID, p_user UUID, p_data JSONB, p_checks JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := p_id;
  v_existing qc_inspections%ROWTYPE;
  v_type TEXT := p_data->>'subject_type';
  v_harvest UUID;
  v_packing UUID;
  v_crop UUID;
  v_qc TEXT;
  v_date DATE := (p_data->>'inspection_date')::DATE;
  v_result TEXT := p_data->>'result';
  v_inserted INT;
  v_missing TEXT;
  v_failed TEXT;
  v_seq INT;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM qc_inspections WHERE id = v_id AND farm_id = p_farm FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inspection not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.review_status <> 'awaiting_review' THEN
      RAISE EXCEPTION 'This inspection has been reviewed and can no longer be changed. Record a new inspection instead.';
    END IF;
    v_type := v_existing.subject_type;
    v_harvest := v_existing.harvest_batch_id;
    v_packing := v_existing.packing_batch_id;
    v_crop := v_existing.crop_id;
  ELSIF v_type = 'harvest_batch' THEN
    SELECT id, crop_id, qc_status INTO v_harvest, v_crop, v_qc
    FROM harvest_batches WHERE id = NULLIF(p_data->>'harvest_batch_id', '')::UUID AND farm_id = p_farm FOR UPDATE;
    IF v_harvest IS NULL THEN
      RAISE EXCEPTION 'The selected harvest batch does not exist on this farm.';
    END IF;
  ELSIF v_type = 'packing_batch' THEN
    SELECT id, crop_id, qc_status INTO v_packing, v_crop, v_qc
    FROM packing_batches WHERE id = NULLIF(p_data->>'packing_batch_id', '')::UUID AND farm_id = p_farm FOR UPDATE;
    IF v_packing IS NULL THEN
      RAISE EXCEPTION 'The selected packed batch does not exist on this farm.';
    END IF;
    IF v_qc = 'released' THEN
      RAISE EXCEPTION 'This packed batch has already been released for export.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Choose whether a harvest batch or a packed batch is being inspected.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM qc_inspections
    WHERE review_status = 'awaiting_review' AND id IS DISTINCT FROM v_id
      AND ((v_harvest IS NOT NULL AND harvest_batch_id = v_harvest) OR (v_packing IS NOT NULL AND packing_batch_id = v_packing))
  ) THEN
    RAISE EXCEPTION 'This batch already has an inspection awaiting supervisor review. Review or edit that one first.';
  END IF;

  IF COALESCE((p_data->>'rejected_quantity')::NUMERIC, 0) > 0 AND NULLIF(p_data->>'rejection_reason_id', '') IS NULL THEN
    RAISE EXCEPTION 'Select a rejection reason for the rejected quantity.';
  END IF;

  IF v_id IS NULL THEN
    v_seq := farm_next_sequence('qc', to_char(v_date, 'YYYYMMDD'));
    INSERT INTO qc_inspections (
      farm_id, inspection_no, subject_type, harvest_batch_id, packing_batch_id, crop_id, inspection_date,
      inspector_id, sample_size, sample_unit, buyer_specification, result, rejected_quantity,
      rejection_reason_id, corrective_action, notes, created_by
    ) VALUES (
      p_farm, 'QC-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 3, '0'),
      v_type, v_harvest, v_packing, v_crop, v_date,
      NULLIF(p_data->>'inspector_id', '')::UUID, NULLIF(p_data->>'sample_size', '')::NUMERIC, p_data->>'sample_unit',
      p_data->>'buyer_specification', v_result, NULLIF(p_data->>'rejected_quantity', '')::NUMERIC,
      NULLIF(p_data->>'rejection_reason_id', '')::UUID, p_data->>'corrective_action', p_data->>'notes', p_user
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE qc_inspections SET
      inspection_date = v_date,
      inspector_id = NULLIF(p_data->>'inspector_id', '')::UUID,
      sample_size = NULLIF(p_data->>'sample_size', '')::NUMERIC,
      sample_unit = p_data->>'sample_unit',
      buyer_specification = p_data->>'buyer_specification',
      result = v_result,
      rejected_quantity = NULLIF(p_data->>'rejected_quantity', '')::NUMERIC,
      rejection_reason_id = NULLIF(p_data->>'rejection_reason_id', '')::UUID,
      corrective_action = p_data->>'corrective_action',
      notes = p_data->>'notes'
    WHERE id = v_id;
  END IF;

  -- Checks: snapshot each criterion; numeric and scale checks with limits pass or fail by range.
  DELETE FROM qc_inspection_checks WHERE inspection_id = v_id;
  INSERT INTO qc_inspection_checks (
    inspection_id, criterion_id, name, criterion_type, unit, min_value, max_value, is_mandatory,
    value_numeric, value_text, passed, notes, sort_order
  )
  SELECT v_id, c.id, c.name, c.criterion_type, c.unit, c.min_value, c.max_value, c.is_mandatory,
    NULLIF(x->>'value_numeric', '')::NUMERIC, NULLIF(trim(x->>'value_text'), ''),
    CASE
      WHEN c.criterion_type IN ('numeric', 'scale') AND NULLIF(x->>'value_numeric', '') IS NOT NULL
           AND (c.min_value IS NOT NULL OR c.max_value IS NOT NULL)
        THEN (x->>'value_numeric')::NUMERIC BETWEEN COALESCE(c.min_value, '-Infinity'::NUMERIC) AND COALESCE(c.max_value, 'Infinity'::NUMERIC)
      ELSE NULLIF(x->>'passed', '')::BOOLEAN
    END,
    NULLIF(trim(x->>'notes'), ''), c.sort_order
  FROM jsonb_array_elements(COALESCE(p_checks, '[]')) x
  JOIN crop_quality_criteria c ON c.id = (x->>'criterion_id')::UUID AND c.crop_id = v_crop;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> jsonb_array_length(COALESCE(p_checks, '[]')) THEN
    RAISE EXCEPTION 'One of the checks is not a quality criterion of this crop.';
  END IF;

  IF p_id IS NULL THEN
    SELECT string_agg(c.name, ', ' ORDER BY c.sort_order) INTO v_missing
    FROM crop_quality_criteria c
    WHERE c.crop_id = v_crop AND c.status = 'active' AND c.is_mandatory
      AND NOT EXISTS (SELECT 1 FROM qc_inspection_checks k WHERE k.inspection_id = v_id AND k.criterion_id = c.id);
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'Complete the mandatory checks: %.', v_missing;
    END IF;
  END IF;

  SELECT string_agg(name, ', ' ORDER BY sort_order) INTO v_missing
  FROM qc_inspection_checks
  WHERE inspection_id = v_id AND is_mandatory AND CASE criterion_type
    WHEN 'pass_fail' THEN passed IS NULL
    WHEN 'text' THEN value_text IS NULL
    ELSE value_numeric IS NULL
  END;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Complete the mandatory checks: %.', v_missing;
  END IF;

  SELECT string_agg(name, ', ' ORDER BY sort_order) INTO v_failed
  FROM qc_inspection_checks WHERE inspection_id = v_id AND is_mandatory AND passed = FALSE;
  IF v_failed IS NOT NULL AND v_result = 'pass' THEN
    RAISE EXCEPTION 'Mandatory checks failed (%), so the result cannot be Pass. Record it as Conditional pass or Fail.', v_failed;
  END IF;

  PERFORM farm_sync_qc_status(v_harvest, v_packing);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION farm_review_qc_inspection(
  p_id UUID, p_farm UUID, p_user UUID, p_decision TEXT, p_notes TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  i qc_inspections%ROWTYPE;
BEGIN
  SELECT * INTO i FROM qc_inspections WHERE id = p_id AND farm_id = p_farm FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inspection not found' USING ERRCODE = 'P0002';
  END IF;
  IF i.review_status <> 'awaiting_review' THEN
    RAISE EXCEPTION 'This inspection has already been reviewed.';
  END IF;
  IF p_decision NOT IN ('approved', 'rework', 'reinspection', 'rejected') THEN
    RAISE EXCEPTION 'Choose a review decision.';
  END IF;
  IF p_decision = 'approved' AND i.result = 'fail' THEN
    RAISE EXCEPTION 'A failed inspection cannot be approved. Send it for rework or reinspection, or reject the batch.';
  END IF;
  IF (p_decision <> 'approved' OR i.result = 'conditional_pass') AND NULLIF(trim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION 'Add review notes explaining the decision.';
  END IF;
  IF i.packing_batch_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM packing_batches WHERE id = i.packing_batch_id AND qc_status = 'released') THEN
    RAISE EXCEPTION 'This packed batch has already been released for export.';
  END IF;

  UPDATE qc_inspections SET
    review_status = p_decision,
    reviewed_by = p_user,
    reviewed_at = NOW(),
    review_notes = NULLIF(trim(p_notes), '')
  WHERE id = p_id;

  PERFORM farm_sync_qc_status(i.harvest_batch_id, i.packing_batch_id);
END $$;

CREATE OR REPLACE FUNCTION farm_complete_qc_rework(
  p_id UUID, p_farm UUID, p_user UUID, p_notes TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  i qc_inspections%ROWTYPE;
BEGIN
  SELECT * INTO i FROM qc_inspections WHERE id = p_id AND farm_id = p_farm FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inspection not found' USING ERRCODE = 'P0002';
  END IF;
  IF i.review_status <> 'rework' OR i.rework_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This inspection is not waiting for rework.';
  END IF;
  IF NULLIF(trim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION 'Describe the rework or re-sorting that was done.';
  END IF;
  UPDATE qc_inspections SET rework_notes = trim(p_notes), rework_completed_at = NOW(), rework_by = p_user WHERE id = p_id;
  PERFORM farm_sync_qc_status(i.harvest_batch_id, i.packing_batch_id);
END $$;

CREATE OR REPLACE FUNCTION farm_set_export_release(
  p_batch UUID, p_farm UUID, p_user UUID, p_release BOOLEAN
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  b packing_batches%ROWTYPE;
  v_dispatched INT;
BEGIN
  SELECT * INTO b FROM packing_batches WHERE id = p_batch AND farm_id = p_farm FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Packed batch not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_release THEN
    IF b.qc_status <> 'approved' THEN
      RAISE EXCEPTION 'Only QC-approved batches can be released for export (this one is %).', replace(b.qc_status, '_', ' ');
    END IF;
    UPDATE packing_batches SET qc_status = 'released', released_at = NOW(), released_by = p_user WHERE id = p_batch;
  ELSE
    IF b.qc_status <> 'released' THEN
      RAISE EXCEPTION 'This batch has not been released for export.';
    END IF;
    SELECT dispatched INTO v_dispatched FROM packing_batch_stock WHERE packing_batch_id = p_batch;
    IF v_dispatched > 0 THEN
      RAISE EXCEPTION 'Stock from this batch has already been dispatched, so the release cannot be withdrawn.';
    END IF;
    UPDATE packing_batches SET qc_status = 'approved', released_at = NULL, released_by = NULL WHERE id = p_batch;
  END IF;
END $$;

-- ——— Warehouse movements ———

CREATE OR REPLACE FUNCTION farm_record_stock_movement(
  p_batch UUID, p_farm UUID, p_user UUID, p_data JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  b packing_batches%ROWTYPE;
  s packing_batch_stock%ROWTYPE;
  v_type TEXT := p_data->>'movement_type';
  v_date DATE := (p_data->>'movement_date')::DATE;
  v_packages INT := NULLIF(p_data->>'packages', '')::INT;
  v_to UUID := NULLIF(p_data->>'to_location_id', '')::UUID;
  v_reason TEXT := NULLIF(trim(p_data->>'reason'), '');
  v_ref TEXT := NULLIF(trim(p_data->>'reference'), '');
  v_id UUID;
BEGIN
  SELECT * INTO b FROM packing_batches WHERE id = p_batch AND farm_id = p_farm FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Packed batch not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO s FROM packing_batch_stock WHERE packing_batch_id = p_batch;

  IF v_type <> 'receive' THEN
    IF b.received_date IS NULL THEN
      RAISE EXCEPTION 'Receive % into the warehouse first.', b.packing_no;
    END IF;
    IF v_date < b.received_date THEN
      RAISE EXCEPTION 'The date cannot be before the batch was received (%).', to_char(b.received_date, 'DD Mon YYYY');
    END IF;
  END IF;
  IF v_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM warehouse_locations WHERE id = v_to AND status = 'active') THEN
    RAISE EXCEPTION 'Choose an active warehouse location.';
  END IF;

  IF v_type = 'receive' THEN
    IF b.received_date IS NOT NULL THEN
      RAISE EXCEPTION '% was already received on %.', b.packing_no, to_char(b.received_date, 'DD Mon YYYY');
    END IF;
    IF v_to IS NULL THEN
      RAISE EXCEPTION 'Choose the warehouse location.';
    END IF;
    IF v_date < b.packing_date THEN
      RAISE EXCEPTION 'The received date cannot be before the packing date (%).', to_char(b.packing_date, 'DD Mon YYYY');
    END IF;
    INSERT INTO stock_movements (farm_id, packing_batch_id, movement_type, from_bucket, to_bucket, packages,
      to_location_id, movement_date, reference, reason, created_by)
    VALUES (p_farm, b.id, 'receive', NULL, 'available', b.package_count, v_to, v_date, v_ref, v_reason, p_user)
    RETURNING id INTO v_id;
    UPDATE packing_batches SET received_date = v_date, location_id = v_to WHERE id = b.id;

  ELSIF v_type = 'relocate' THEN
    IF v_to IS NULL OR v_to = b.location_id THEN
      RAISE EXCEPTION 'Choose a different location to move the batch to.';
    END IF;
    IF s.available + s.reserved = 0 THEN
      RAISE EXCEPTION 'There is nothing left in stock to move.';
    END IF;
    INSERT INTO stock_movements (farm_id, packing_batch_id, movement_type, packages, from_location_id,
      to_location_id, movement_date, reference, reason, created_by)
    VALUES (p_farm, b.id, 'relocate', s.available + s.reserved, b.location_id, v_to, v_date, v_ref, v_reason, p_user)
    RETURNING id INTO v_id;
    UPDATE packing_batches SET location_id = v_to WHERE id = b.id;

  ELSIF v_type IN ('damage', 'spoil', 'dispatch') THEN
    IF v_packages IS NULL OR v_packages <= 0 THEN
      RAISE EXCEPTION 'Enter the number of packages.';
    END IF;
    IF v_packages > s.available THEN
      RAISE EXCEPTION 'Only % packages of % are available.', s.available, b.packing_no;
    END IF;
    IF v_type = 'dispatch' THEN
      IF b.qc_status <> 'released' THEN
        RAISE EXCEPTION 'Only batches released for export by QC can be dispatched (this one is %).', replace(b.qc_status, '_', ' ');
      END IF;
      IF v_ref IS NULL THEN
        RAISE EXCEPTION 'Enter the dispatch reference, such as the delivery note or air waybill number.';
      END IF;
    ELSIF v_reason IS NULL THEN
      RAISE EXCEPTION 'Give a reason for the % stock.', CASE v_type WHEN 'damage' THEN 'damaged' ELSE 'spoiled' END;
    END IF;
    INSERT INTO stock_movements (farm_id, packing_batch_id, movement_type, from_bucket, to_bucket, packages,
      from_location_id, movement_date, reference, reason, created_by)
    VALUES (p_farm, b.id, v_type, 'available',
      CASE v_type WHEN 'damage' THEN 'damaged' WHEN 'spoil' THEN 'spoiled' ELSE 'dispatched' END,
      v_packages, b.location_id, v_date, v_ref, v_reason, p_user)
    RETURNING id INTO v_id;

  ELSE
    RAISE EXCEPTION 'Choose a stock movement type.';
  END IF;

  RETURN v_id;
END $$;

-- ——— updated_at triggers ———

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouse_locations', 'packing_batches', 'qc_inspections'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION farm_set_updated_at()',
      t
    );
  END LOOP;
END;
$$;

-- ——— RLS: all access goes through server routes using the service role ———

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouse_locations', 'packing_batches', 'qc_inspections', 'qc_inspection_checks', 'stock_movements'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;
