-- Phase 2: workforce, farm activities, pest & disease, harvest batches and grading.
-- Multi-row writes (record + child rows) go through the farm_save_* functions so they are atomic.
-- Business-rule violations are raised with SQLSTATE P0001 and a user-readable message.

-- ——— Settings used for labour costing ———

INSERT INTO system_settings (key, value, description) VALUES
  ('workforce.standard_day_hours', '8', 'Hours in a standard working day, used to cost labour by the hour'),
  ('workforce.working_days_per_month', '26', 'Working days per month, used to cost salaried staff by the hour')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION farm_setting_num(p_key TEXT, p_default NUMERIC) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::NUMERIC FROM system_settings WHERE key = p_key), p_default)
$$;

-- ——— Master data ———

CREATE TABLE IF NOT EXISTS activity_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]{1,24}$'),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'planting', 'nutrition', 'crop_protection', 'irrigation', 'maintenance', 'inspection', 'harvest', 'other'
  )),
  uses_inputs BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO activity_types (code, name, category, uses_inputs, sort_order) VALUES
  ('PLANTING', 'Planting', 'planting', TRUE, 10),
  ('FERTILIZER', 'Fertilizer application', 'nutrition', TRUE, 20),
  ('PESTICIDE', 'Pesticide application', 'crop_protection', TRUE, 30),
  ('HERBICIDE', 'Herbicide application', 'crop_protection', TRUE, 40),
  ('IRRIGATION', 'Irrigation', 'irrigation', FALSE, 50),
  ('WEEDING', 'Weeding', 'maintenance', FALSE, 60),
  ('PRUNING', 'Pruning', 'maintenance', FALSE, 70),
  ('PEST_MANAGEMENT', 'Pest management', 'crop_protection', TRUE, 80),
  ('DISEASE_TREATMENT', 'Disease treatment', 'crop_protection', TRUE, 90),
  ('FIELD_INSPECTION', 'Field inspection', 'inspection', FALSE, 100),
  ('SOIL_WORK', 'Soil-related activity', 'maintenance', TRUE, 110),
  ('HARVEST_PREP', 'Harvest preparation', 'harvest', FALSE, 120),
  ('OTHER', 'Other activity', 'other', TRUE, 999)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS rejection_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]{1,24}$'),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO rejection_reasons (code, name, sort_order) VALUES
  ('MECHANICAL_DAMAGE', 'Mechanical damage / bruising', 10),
  ('UNDERSIZE', 'Undersize', 20),
  ('OVERSIZE', 'Oversize / misshapen', 30),
  ('OVER_RIPE', 'Over-ripe', 40),
  ('UNDER_RIPE', 'Under-ripe', 50),
  ('DISCOLOURATION', 'Discolouration', 60),
  ('PEST_DAMAGE', 'Pest damage', 70),
  ('DISEASE', 'Disease / rot', 80),
  ('FOREIGN_MATTER', 'Foreign matter / dirt', 90),
  ('OTHER', 'Other', 999)
ON CONFLICT (code) DO NOTHING;

-- ——— Workers ———

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  worker_code TEXT NOT NULL CHECK (worker_code ~ '^[A-Z0-9-]{1,20}$'),
  full_name TEXT NOT NULL,
  phone TEXT,
  national_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('permanent', 'casual')),
  job_role TEXT,
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  start_date DATE,
  end_date DATE,
  pay_basis TEXT NOT NULL CHECK (pay_basis IN ('daily', 'monthly')),
  daily_rate NUMERIC(12, 2) CHECK (daily_rate IS NULL OR daily_rate >= 0),
  monthly_salary NUMERIC(14, 2) CHECK (monthly_salary IS NULL OR monthly_salary >= 0),
  overtime_rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (overtime_rate >= 0),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, worker_code),
  UNIQUE (id, farm_id),
  CHECK ((pay_basis = 'daily' AND daily_rate IS NOT NULL) OR (pay_basis = 'monthly' AND monthly_salary IS NOT NULL)),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_workers_farm ON workers(farm_id, status);

-- Hourly cost of a worker, used to value labour on activities and harvests.
CREATE OR REPLACE FUNCTION farm_worker_hourly_rate(p_worker UUID) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT ROUND(
    CASE
      WHEN w.pay_basis = 'daily' THEN w.daily_rate / farm_setting_num('workforce.standard_day_hours', 8)
      ELSE w.monthly_salary
        / farm_setting_num('workforce.working_days_per_month', 26)
        / farm_setting_num('workforce.standard_day_hours', 8)
    END, 4)
  FROM workers w
  WHERE w.id = p_worker
$$;

CREATE TABLE IF NOT EXISTS worker_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'off')),
  hours_worked NUMERIC(5, 2) CHECK (hours_worked IS NULL OR (hours_worked >= 0 AND hours_worked <= 24)),
  overtime_hours NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (worker_id, farm_id) REFERENCES workers(id, farm_id) ON DELETE RESTRICT,
  UNIQUE (worker_id, attendance_date),
  CHECK (status = 'present' OR (COALESCE(hours_worked, 0) = 0 AND overtime_hours = 0))
);

CREATE INDEX IF NOT EXISTS idx_attendance_farm_date ON worker_attendance(farm_id, attendance_date);

-- planting_cycles(id, block_id, crop_id) lets child records prove block and crop match the planting.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_planting_cycles_id_block_crop') THEN
    ALTER TABLE planting_cycles ADD CONSTRAINT uq_planting_cycles_id_block_crop UNIQUE (id, block_id, crop_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS worker_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  block_id UUID,
  planting_cycle_id UUID,
  crop_id UUID REFERENCES crops(id) ON DELETE RESTRICT,
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
  target_quantity NUMERIC(14, 3) CHECK (target_quantity IS NULL OR target_quantity > 0),
  achieved_quantity NUMERIC(14, 3) CHECK (achieved_quantity IS NULL OR achieved_quantity >= 0),
  quantity_unit TEXT,
  hours_spent NUMERIC(6, 2) CHECK (hours_spent IS NULL OR hours_spent >= 0),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (worker_id, farm_id) REFERENCES workers(id, farm_id) ON DELETE RESTRICT,
  FOREIGN KEY (block_id, farm_id) REFERENCES blocks(id, farm_id) ON DELETE RESTRICT,
  FOREIGN KEY (planting_cycle_id, block_id, crop_id) REFERENCES planting_cycles(id, block_id, crop_id) ON DELETE RESTRICT,
  CHECK (planting_cycle_id IS NULL OR (block_id IS NOT NULL AND crop_id IS NOT NULL)),
  CHECK (due_at IS NULL OR due_at >= start_at),
  CHECK (completed_at IS NULL OR completed_at >= start_at),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_worker_tasks_farm ON worker_tasks(farm_id, status, start_at);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_worker ON worker_tasks(worker_id);

-- ——— Payroll costing (operational, not a payroll ERP) ———

CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'paid')),
  notes TEXT,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, name),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  pay_basis TEXT NOT NULL CHECK (pay_basis IN ('daily', 'monthly')),
  rate NUMERIC(14, 2) NOT NULL CHECK (rate >= 0),
  days_present NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (days_present >= 0),
  leave_days NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (leave_days >= 0),
  base_pay NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (base_pay >= 0),
  overtime_hours NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  overtime_rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (overtime_rate >= 0),
  overtime_pay NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(overtime_hours * overtime_rate, 2)) STORED,
  advances NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (advances >= 0),
  deductions NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  amount_payable NUMERIC(14, 2) GENERATED ALWAYS AS (
    base_pay + ROUND(overtime_hours * overtime_rate, 2) - advances - deductions
  ) STORED,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  paid_at DATE,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, worker_id),
  CHECK (payment_status = 'unpaid' OR paid_at IS NOT NULL)
);

-- Once a period is finalized only payment details may change.
CREATE OR REPLACE FUNCTION farm_guard_payroll_line() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM payroll_periods WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  IF v_status IS NULL OR v_status = 'draft' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP <> 'UPDATE' OR (NEW.rate, NEW.days_present, NEW.leave_days, NEW.base_pay, NEW.overtime_hours,
      NEW.overtime_rate, NEW.advances, NEW.deductions, NEW.worker_id)
      IS DISTINCT FROM (OLD.rate, OLD.days_present, OLD.leave_days, OLD.base_pay, OLD.overtime_hours,
      OLD.overtime_rate, OLD.advances, OLD.deductions, OLD.worker_id) THEN
    RAISE EXCEPTION 'This payroll period is finalized. Reopen it before changing amounts.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payroll_lines_guard ON payroll_lines;
CREATE TRIGGER trg_payroll_lines_guard
  BEFORE INSERT OR UPDATE OR DELETE ON payroll_lines
  FOR EACH ROW EXECUTE FUNCTION farm_guard_payroll_line();

-- Build or refresh draft payroll lines from attendance; advances, deductions and payments are kept.
CREATE OR REPLACE FUNCTION farm_generate_payroll(p_period UUID) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  p payroll_periods%ROWTYPE;
  v_count INT;
  v_month_days NUMERIC;
BEGIN
  SELECT * INTO p FROM payroll_periods WHERE id = p_period FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll period not found' USING ERRCODE = 'P0002';
  END IF;
  IF p.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft payroll periods can be recalculated.';
  END IF;
  v_month_days := EXTRACT(DAY FROM (date_trunc('month', p.period_start) + INTERVAL '1 month - 1 day'));

  WITH att AS (
    SELECT a.worker_id,
      COUNT(*) FILTER (WHERE a.status = 'present') AS days_present,
      COUNT(*) FILTER (WHERE a.status = 'leave') AS leave_days,
      COALESCE(SUM(a.overtime_hours), 0) AS overtime_hours
    FROM worker_attendance a
    WHERE a.farm_id = p.farm_id AND a.attendance_date BETWEEN p.period_start AND p.period_end
    GROUP BY a.worker_id
  ),
  eligible AS (
    SELECT w.*,
      COALESCE(att.days_present, 0) AS days_present,
      COALESCE(att.leave_days, 0) AS leave_days,
      COALESCE(att.overtime_hours, 0) AS overtime_hours,
      GREATEST(0, (LEAST(p.period_end, COALESCE(w.end_date, p.period_end))
        - GREATEST(p.period_start, COALESCE(w.start_date, p.period_start)) + 1)) AS employed_days
    FROM workers w
    LEFT JOIN att ON att.worker_id = w.id
    WHERE w.farm_id = p.farm_id
      AND (att.worker_id IS NOT NULL OR (w.status = 'active' AND w.pay_basis = 'monthly'))
  )
  INSERT INTO payroll_lines (period_id, worker_id, pay_basis, rate, days_present, leave_days, base_pay, overtime_hours, overtime_rate)
  SELECT p.id, e.id, e.pay_basis,
    CASE WHEN e.pay_basis = 'daily' THEN e.daily_rate ELSE e.monthly_salary END,
    e.days_present, e.leave_days,
    ROUND(CASE
      WHEN e.pay_basis = 'daily' THEN e.days_present * e.daily_rate
      ELSE e.monthly_salary * LEAST(e.employed_days / v_month_days, 1.0 * (p.period_end - p.period_start + 1) / v_month_days)
    END, 2),
    e.overtime_hours, e.overtime_rate
  FROM eligible e
  ON CONFLICT (period_id, worker_id) DO UPDATE SET
    pay_basis = EXCLUDED.pay_basis,
    rate = EXCLUDED.rate,
    days_present = EXCLUDED.days_present,
    leave_days = EXCLUDED.leave_days,
    base_pay = EXCLUDED.base_pay,
    overtime_hours = EXCLUDED.overtime_hours,
    overtime_rate = EXCLUDED.overtime_rate;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ——— Farm activities ———

CREATE TABLE IF NOT EXISTS farm_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  block_id UUID NOT NULL,
  planting_cycle_id UUID,
  crop_id UUID REFERENCES crops(id) ON DELETE RESTRICT,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  activity_date DATE NOT NULL,
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  casual_labour_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (casual_labour_days >= 0),
  other_labour_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (other_labour_cost >= 0),
  worker_labour_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (worker_labour_cost >= 0),
  input_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (input_cost >= 0),
  other_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  total_cost NUMERIC(14, 2) GENERATED ALWAYS AS (other_labour_cost + worker_labour_cost + input_cost + other_cost) STORED,
  weather TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (block_id, farm_id) REFERENCES blocks(id, farm_id) ON DELETE RESTRICT,
  FOREIGN KEY (planting_cycle_id, block_id, crop_id) REFERENCES planting_cycles(id, block_id, crop_id) ON DELETE RESTRICT,
  CHECK ((planting_cycle_id IS NULL) = (crop_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_farm_activities_farm_date ON farm_activities(farm_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_block ON farm_activities(block_id);
CREATE INDEX IF NOT EXISTS idx_farm_activities_cycle ON farm_activities(planting_cycle_id);

CREATE TABLE IF NOT EXISTS farm_activity_workers (
  activity_id UUID NOT NULL REFERENCES farm_activities(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  hours_worked NUMERIC(6, 2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  hourly_rate NUMERIC(12, 4) NOT NULL CHECK (hourly_rate >= 0),
  cost NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(hours_worked * hourly_rate, 2)) STORED,
  PRIMARY KEY (activity_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_workers_worker ON farm_activity_workers(worker_id);

CREATE TABLE IF NOT EXISTS farm_activity_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES farm_activities(id) ON DELETE CASCADE,
  input_name TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_cost NUMERIC(14, 4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  cost NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(quantity * COALESCE(unit_cost, 0), 2)) STORED,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_activity_inputs_activity ON farm_activity_inputs(activity_id);

-- Shared helper: link workers to a record, snapshotting each new worker's hourly rate.
-- Existing links keep their original rate so historical costs do not move when pay changes.
CREATE OR REPLACE FUNCTION farm_assert_workers_on_farm(p_farm UUID, p_workers JSONB) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_workers, '[]')) x
    LEFT JOIN workers w ON w.id = (x->>'worker_id')::UUID AND w.farm_id = p_farm
    WHERE w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more selected workers do not belong to this farm.';
  END IF;
  IF (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(p_workers, '[]')))
     <> (SELECT COUNT(DISTINCT x->>'worker_id') FROM jsonb_array_elements(COALESCE(p_workers, '[]')) x) THEN
    RAISE EXCEPTION 'A worker is listed more than once.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION farm_save_activity(
  p_id UUID, p_farm UUID, p_user UUID, p_data JSONB, p_workers JSONB, p_inputs JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := p_id;
  v_cycle UUID := NULLIF(p_data->>'planting_cycle_id', '')::UUID;
  v_crop UUID;
BEGIN
  PERFORM farm_assert_workers_on_farm(p_farm, p_workers);
  IF v_cycle IS NOT NULL THEN
    SELECT crop_id INTO v_crop FROM planting_cycles WHERE id = v_cycle AND farm_id = p_farm;
    IF v_crop IS NULL THEN
      RAISE EXCEPTION 'The selected planting does not exist on this farm.';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO farm_activities (
      farm_id, block_id, planting_cycle_id, crop_id, activity_type_id, activity_date, supervisor_id,
      casual_labour_days, other_labour_cost, other_cost, weather, notes, created_by
    ) VALUES (
      p_farm, (p_data->>'block_id')::UUID, v_cycle, v_crop, (p_data->>'activity_type_id')::UUID,
      (p_data->>'activity_date')::DATE, NULLIF(p_data->>'supervisor_id', '')::UUID,
      COALESCE((p_data->>'casual_labour_days')::NUMERIC, 0), COALESCE((p_data->>'other_labour_cost')::NUMERIC, 0),
      COALESCE((p_data->>'other_cost')::NUMERIC, 0), p_data->>'weather', p_data->>'notes', p_user
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE farm_activities SET
      block_id = (p_data->>'block_id')::UUID,
      planting_cycle_id = v_cycle,
      crop_id = v_crop,
      activity_type_id = (p_data->>'activity_type_id')::UUID,
      activity_date = (p_data->>'activity_date')::DATE,
      supervisor_id = NULLIF(p_data->>'supervisor_id', '')::UUID,
      casual_labour_days = COALESCE((p_data->>'casual_labour_days')::NUMERIC, 0),
      other_labour_cost = COALESCE((p_data->>'other_labour_cost')::NUMERIC, 0),
      other_cost = COALESCE((p_data->>'other_cost')::NUMERIC, 0),
      weather = p_data->>'weather',
      notes = p_data->>'notes'
    WHERE id = v_id AND farm_id = p_farm;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Activity not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM farm_activity_workers fw
  WHERE fw.activity_id = v_id
    AND fw.worker_id NOT IN (SELECT (x->>'worker_id')::UUID FROM jsonb_array_elements(COALESCE(p_workers, '[]')) x);

  INSERT INTO farm_activity_workers (activity_id, worker_id, hours_worked, hourly_rate)
  SELECT v_id, (x->>'worker_id')::UUID, (x->>'hours_worked')::NUMERIC, farm_worker_hourly_rate((x->>'worker_id')::UUID)
  FROM jsonb_array_elements(COALESCE(p_workers, '[]')) x
  ON CONFLICT (activity_id, worker_id) DO UPDATE SET hours_worked = EXCLUDED.hours_worked;

  DELETE FROM farm_activity_inputs WHERE activity_id = v_id;
  INSERT INTO farm_activity_inputs (activity_id, input_name, quantity, unit, unit_cost, sort_order)
  SELECT v_id, x->>'input_name', (x->>'quantity')::NUMERIC, x->>'unit', NULLIF(x->>'unit_cost', '')::NUMERIC, ord::INT
  FROM jsonb_array_elements(COALESCE(p_inputs, '[]')) WITH ORDINALITY AS t(x, ord);

  UPDATE farm_activities SET
    worker_labour_cost = (SELECT COALESCE(SUM(cost), 0) FROM farm_activity_workers WHERE activity_id = v_id),
    input_cost = (SELECT COALESCE(SUM(cost), 0) FROM farm_activity_inputs WHERE activity_id = v_id)
  WHERE id = v_id;

  RETURN v_id;
END $$;

-- ——— Pest & disease incidents ———

CREATE TABLE IF NOT EXISTS pest_disease_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  block_id UUID NOT NULL,
  planting_cycle_id UUID,
  crop_id UUID REFERENCES crops(id) ON DELETE RESTRICT,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('pest', 'disease', 'other')),
  name TEXT NOT NULL,
  date_identified DATE NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  area_affected_ha NUMERIC(12, 4) CHECK (area_affected_ha IS NULL OR area_affected_ha > 0),
  action_taken TEXT,
  treatment TEXT,
  follow_up_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'treating', 'monitoring', 'resolved')),
  resolved_date DATE,
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (block_id, farm_id) REFERENCES blocks(id, farm_id) ON DELETE RESTRICT,
  FOREIGN KEY (planting_cycle_id, block_id, crop_id) REFERENCES planting_cycles(id, block_id, crop_id) ON DELETE RESTRICT,
  CHECK ((planting_cycle_id IS NULL) = (crop_id IS NULL)),
  CHECK (follow_up_date IS NULL OR follow_up_date >= date_identified),
  CHECK (status <> 'resolved' OR resolved_date IS NOT NULL),
  CHECK (resolved_date IS NULL OR resolved_date >= date_identified)
);

CREATE INDEX IF NOT EXISTS idx_pest_incidents_farm ON pest_disease_incidents(farm_id, status, date_identified DESC);

-- ——— Harvest batches ———

CREATE TABLE IF NOT EXISTS harvest_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  batch_no TEXT NOT NULL UNIQUE,
  planting_cycle_id UUID NOT NULL,
  block_id UUID NOT NULL,
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  variety_id UUID,
  harvest_date DATE NOT NULL,
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  casual_labour_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (casual_labour_days >= 0),
  other_labour_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (other_labour_cost >= 0),
  worker_labour_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (worker_labour_cost >= 0),
  status TEXT NOT NULL DEFAULT 'pending_grading' CHECK (status IN ('pending_grading', 'graded')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (planting_cycle_id, block_id, crop_id) REFERENCES planting_cycles(id, block_id, crop_id) ON DELETE RESTRICT,
  FOREIGN KEY (block_id, farm_id) REFERENCES blocks(id, farm_id) ON DELETE RESTRICT,
  FOREIGN KEY (variety_id, crop_id) REFERENCES crop_varieties(id, crop_id) ON DELETE RESTRICT,
  UNIQUE (id, crop_id)
);

CREATE INDEX IF NOT EXISTS idx_harvest_batches_farm_date ON harvest_batches(farm_id, harvest_date DESC);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_cycle ON harvest_batches(planting_cycle_id);

CREATE TABLE IF NOT EXISTS harvest_batch_workers (
  batch_id UUID NOT NULL REFERENCES harvest_batches(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  quantity_picked NUMERIC(14, 3) CHECK (quantity_picked IS NULL OR quantity_picked >= 0),
  hours_worked NUMERIC(6, 2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  hourly_rate NUMERIC(12, 4) NOT NULL CHECK (hourly_rate >= 0),
  cost NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(hours_worked * hourly_rate, 2)) STORED,
  PRIMARY KEY (batch_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_harvest_workers_worker ON harvest_batch_workers(worker_id);

-- A batch's planting cannot change, and its quantity is locked once graded.
CREATE OR REPLACE FUNCTION farm_guard_harvest_batch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.planting_cycle_id IS DISTINCT FROM OLD.planting_cycle_id THEN
    RAISE EXCEPTION 'A harvest batch cannot be moved to a different planting.';
  END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity
     AND EXISTS (SELECT 1 FROM harvest_gradings WHERE batch_id = NEW.id) THEN
    RAISE EXCEPTION 'This batch has been graded. Delete the grading before changing the harvested quantity.';
  END IF;
  RETURN NEW;
END $$;

-- Keep the planting's actual yield equal to the sum of its harvest batches.
CREATE OR REPLACE FUNCTION farm_sync_cycle_yield() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle UUID := COALESCE(NEW.planting_cycle_id, OLD.planting_cycle_id);
BEGIN
  UPDATE planting_cycles
  SET actual_yield = (SELECT COALESCE(SUM(quantity), 0) FROM harvest_batches WHERE planting_cycle_id = v_cycle)
  WHERE id = v_cycle;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION farm_save_harvest_batch(
  p_id UUID, p_farm UUID, p_user UUID, p_data JSONB, p_workers JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := p_id;
  c RECORD;
  v_date DATE := (p_data->>'harvest_date')::DATE;
  v_seq INT;
  v_block_part TEXT;
  v_batch_no TEXT;
BEGIN
  PERFORM farm_assert_workers_on_farm(p_farm, p_workers);

  IF v_id IS NULL THEN
    SELECT pc.id, pc.block_id, pc.crop_id, pc.variety_id, pc.yield_unit, pc.status, pc.planting_date,
           cr.code AS crop_code, b.code AS block_code
    INTO c
    FROM planting_cycles pc
    JOIN crops cr ON cr.id = pc.crop_id
    JOIN blocks b ON b.id = pc.block_id
    WHERE pc.id = (p_data->>'planting_cycle_id')::UUID AND pc.farm_id = p_farm
    FOR UPDATE OF pc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected planting does not exist on this farm.';
    END IF;
    IF c.status NOT IN ('active', 'harvesting') THEN
      RAISE EXCEPTION 'Harvests can only be recorded against an active planting (this one is %).', c.status;
    END IF;
    IF v_date < c.planting_date THEN
      RAISE EXCEPTION 'The harvest date cannot be before the planting date (%).', to_char(c.planting_date, 'DD Mon YYYY');
    END IF;

    v_block_part := CASE WHEN c.block_code LIKE 'BLK%' THEN c.block_code ELSE 'BLK-' || c.block_code END;
    v_seq := farm_next_sequence('harvest:' || c.crop_code || ':' || c.block_code, to_char(v_date, 'YYYYMMDD'));
    v_batch_no := c.crop_code || '-' || v_block_part || '-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 3, '0');

    INSERT INTO harvest_batches (
      farm_id, batch_no, planting_cycle_id, block_id, crop_id, variety_id, harvest_date, supervisor_id,
      quantity, unit, casual_labour_days, other_labour_cost, notes, created_by
    ) VALUES (
      p_farm, v_batch_no, c.id, c.block_id, c.crop_id, c.variety_id, v_date,
      NULLIF(p_data->>'supervisor_id', '')::UUID, (p_data->>'quantity')::NUMERIC, c.yield_unit,
      COALESCE((p_data->>'casual_labour_days')::NUMERIC, 0), COALESCE((p_data->>'other_labour_cost')::NUMERIC, 0),
      p_data->>'notes', p_user
    ) RETURNING id INTO v_id;

    IF c.status = 'active' THEN
      UPDATE planting_cycles SET status = 'harvesting' WHERE id = c.id;
    END IF;
  ELSE
    UPDATE harvest_batches hb SET
      harvest_date = v_date,
      supervisor_id = NULLIF(p_data->>'supervisor_id', '')::UUID,
      quantity = (p_data->>'quantity')::NUMERIC,
      casual_labour_days = COALESCE((p_data->>'casual_labour_days')::NUMERIC, 0),
      other_labour_cost = COALESCE((p_data->>'other_labour_cost')::NUMERIC, 0),
      notes = p_data->>'notes'
    WHERE hb.id = v_id AND hb.farm_id = p_farm;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Harvest batch not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM harvest_batch_workers hw
  WHERE hw.batch_id = v_id
    AND hw.worker_id NOT IN (SELECT (x->>'worker_id')::UUID FROM jsonb_array_elements(COALESCE(p_workers, '[]')) x);

  INSERT INTO harvest_batch_workers (batch_id, worker_id, quantity_picked, hours_worked, hourly_rate)
  SELECT v_id, (x->>'worker_id')::UUID, NULLIF(x->>'quantity_picked', '')::NUMERIC, (x->>'hours_worked')::NUMERIC,
         farm_worker_hourly_rate((x->>'worker_id')::UUID)
  FROM jsonb_array_elements(COALESCE(p_workers, '[]')) x
  ON CONFLICT (batch_id, worker_id) DO UPDATE SET
    quantity_picked = EXCLUDED.quantity_picked,
    hours_worked = EXCLUDED.hours_worked;

  UPDATE harvest_batches
  SET worker_labour_cost = (SELECT COALESCE(SUM(cost), 0) FROM harvest_batch_workers WHERE batch_id = v_id)
  WHERE id = v_id;

  RETURN v_id;
END $$;

-- ——— Harvest grading ———

CREATE TABLE IF NOT EXISTS harvest_gradings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL UNIQUE,
  crop_id UUID NOT NULL,
  graded_date DATE NOT NULL,
  inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total_quantity NUMERIC(14, 3) NOT NULL CHECK (total_quantity > 0),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (batch_id, crop_id) REFERENCES harvest_batches(id, crop_id) ON DELETE RESTRICT,
  UNIQUE (id, crop_id)
);

CREATE TABLE IF NOT EXISTS harvest_grading_lines (
  grading_id UUID NOT NULL,
  crop_id UUID NOT NULL,
  grade_id UUID NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (grading_id, grade_id),
  FOREIGN KEY (grading_id, crop_id) REFERENCES harvest_gradings(id, crop_id) ON DELETE CASCADE,
  -- Only grades configured for the crop can be used.
  FOREIGN KEY (crop_id, grade_id) REFERENCES crop_grades(crop_id, grade_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS harvest_grading_rejections (
  grading_id UUID NOT NULL REFERENCES harvest_gradings(id) ON DELETE CASCADE,
  reason_id UUID NOT NULL REFERENCES rejection_reasons(id) ON DELETE RESTRICT,
  quantity NUMERIC(14, 3) CHECK (quantity IS NULL OR quantity >= 0),
  PRIMARY KEY (grading_id, reason_id)
);

-- Grade quantities must add up to the harvested quantity (checked at commit).
CREATE OR REPLACE FUNCTION farm_check_grading_total() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_grading UUID;
  v_total NUMERIC;
  v_batch_qty NUMERIC;
  v_sum NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'harvest_gradings' THEN
    v_grading := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_grading := OLD.grading_id;
  ELSE
    v_grading := NEW.grading_id;
  END IF;
  SELECT g.total_quantity, b.quantity INTO v_total, v_batch_qty
  FROM harvest_gradings g JOIN harvest_batches b ON b.id = g.batch_id
  WHERE g.id = v_grading;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO v_sum FROM harvest_grading_lines WHERE grading_id = v_grading;
  IF v_total <> v_batch_qty THEN
    RAISE EXCEPTION 'The graded total (%) must equal the harvested quantity (%).', trim_scale(v_total), trim_scale(v_batch_qty);
  END IF;
  IF v_sum <> v_total THEN
    RAISE EXCEPTION 'Grade quantities add up to % but the harvested quantity is %.', trim_scale(v_sum), trim_scale(v_total);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_grading_lines_total ON harvest_grading_lines;
CREATE CONSTRAINT TRIGGER trg_grading_lines_total
  AFTER INSERT OR UPDATE OR DELETE ON harvest_grading_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION farm_check_grading_total();

DROP TRIGGER IF EXISTS trg_gradings_total ON harvest_gradings;
CREATE CONSTRAINT TRIGGER trg_gradings_total
  AFTER INSERT OR UPDATE ON harvest_gradings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION farm_check_grading_total();

CREATE OR REPLACE FUNCTION farm_sync_batch_status() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE harvest_batches
  SET status = CASE WHEN TG_OP = 'DELETE' THEN 'pending_grading' ELSE 'graded' END
  WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION farm_save_grading(
  p_batch UUID, p_farm UUID, p_user UUID, p_data JSONB, p_lines JSONB, p_rejections JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  b RECORD;
  v_id UUID;
  v_sum NUMERIC;
  v_rejected NUMERIC;
BEGIN
  SELECT id, crop_id, quantity INTO b FROM harvest_batches WHERE id = p_batch AND farm_id = p_farm FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Harvest batch not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM((x->>'quantity')::NUMERIC), 0) INTO v_sum FROM jsonb_array_elements(COALESCE(p_lines, '[]')) x;
  IF v_sum <> b.quantity THEN
    RAISE EXCEPTION 'Grade quantities add up to % but the harvested quantity is %.', trim_scale(v_sum), trim_scale(b.quantity);
  END IF;

  SELECT COALESCE(SUM((x->>'quantity')::NUMERIC), 0) INTO v_rejected
  FROM jsonb_array_elements(COALESCE(p_lines, '[]')) x
  JOIN grades g ON g.id = (x->>'grade_id')::UUID
  WHERE g.is_reject;
  IF v_rejected > 0 AND jsonb_array_length(COALESCE(p_rejections, '[]')) = 0 THEN
    RAISE EXCEPTION 'Select at least one rejection reason for the rejected quantity.';
  END IF;

  INSERT INTO harvest_gradings (farm_id, batch_id, crop_id, graded_date, inspector_id, total_quantity, notes, created_by)
  VALUES (p_farm, b.id, b.crop_id, (p_data->>'graded_date')::DATE, NULLIF(p_data->>'inspector_id', '')::UUID,
          b.quantity, p_data->>'notes', p_user)
  ON CONFLICT (batch_id) DO UPDATE SET
    graded_date = EXCLUDED.graded_date,
    inspector_id = EXCLUDED.inspector_id,
    total_quantity = EXCLUDED.total_quantity,
    notes = EXCLUDED.notes
  RETURNING id INTO v_id;

  DELETE FROM harvest_grading_lines WHERE grading_id = v_id;
  INSERT INTO harvest_grading_lines (grading_id, crop_id, grade_id, quantity)
  SELECT v_id, b.crop_id, (x->>'grade_id')::UUID, (x->>'quantity')::NUMERIC
  FROM jsonb_array_elements(COALESCE(p_lines, '[]')) x;

  DELETE FROM harvest_grading_rejections WHERE grading_id = v_id;
  INSERT INTO harvest_grading_rejections (grading_id, reason_id, quantity)
  SELECT v_id, (x->>'reason_id')::UUID, NULLIF(x->>'quantity', '')::NUMERIC
  FROM jsonb_array_elements(COALESCE(p_rejections, '[]')) x;

  RETURN v_id;
END $$;

-- ——— Triggers ———

DROP TRIGGER IF EXISTS trg_harvest_batches_guard ON harvest_batches;
CREATE TRIGGER trg_harvest_batches_guard
  BEFORE UPDATE ON harvest_batches
  FOR EACH ROW EXECUTE FUNCTION farm_guard_harvest_batch();

DROP TRIGGER IF EXISTS trg_harvest_batches_yield ON harvest_batches;
CREATE TRIGGER trg_harvest_batches_yield
  AFTER INSERT OR UPDATE OF quantity OR DELETE ON harvest_batches
  FOR EACH ROW EXECUTE FUNCTION farm_sync_cycle_yield();

DROP TRIGGER IF EXISTS trg_harvest_gradings_status ON harvest_gradings;
CREATE TRIGGER trg_harvest_gradings_status
  AFTER INSERT OR DELETE ON harvest_gradings
  FOR EACH ROW EXECUTE FUNCTION farm_sync_batch_status();

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activity_types', 'rejection_reasons', 'workers', 'worker_attendance', 'worker_tasks', 'payroll_periods',
    'payroll_lines', 'farm_activities', 'pest_disease_incidents', 'harvest_batches', 'harvest_gradings'
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

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activity_types', 'rejection_reasons', 'workers', 'worker_attendance', 'worker_tasks', 'payroll_periods',
    'payroll_lines', 'farm_activities', 'farm_activity_workers', 'farm_activity_inputs', 'pest_disease_incidents',
    'harvest_batches', 'harvest_batch_workers', 'harvest_gradings', 'harvest_grading_lines', 'harvest_grading_rejections'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;
