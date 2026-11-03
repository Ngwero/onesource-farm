-- Persist spray compliance fields and linked input lots on activities,
-- and issue stock from lots when an activity consumes product + lot + quantity.

CREATE OR REPLACE FUNCTION farm_save_activity(
  p_id UUID, p_farm UUID, p_user UUID, p_data JSONB, p_workers JSONB, p_inputs JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := p_id;
  v_cycle UUID := NULLIF(p_data->>'planting_cycle_id', '')::UUID;
  v_crop UUID;
  v_prev RECORD;
  v_inp RECORD;
  v_qty NUMERIC;
  v_product UUID;
  v_lot UUID;
  v_unit_cost NUMERIC;
BEGIN
  PERFORM farm_assert_workers_on_farm(p_farm, p_workers);
  IF v_cycle IS NOT NULL THEN
    SELECT crop_id INTO v_crop FROM planting_cycles WHERE id = v_cycle AND farm_id = p_farm;
    IF v_crop IS NULL THEN
      RAISE EXCEPTION 'The selected planting does not exist on this farm.';
    END IF;
  END IF;

  -- Reversal of prior issues so updates do not double-decrement stock.
  IF v_id IS NOT NULL THEN
    FOR v_prev IN
      SELECT id, lot_id, quantity
      FROM input_movements
      WHERE activity_id = v_id AND farm_id = p_farm AND movement_type = 'issue'
    LOOP
      IF v_prev.lot_id IS NOT NULL THEN
        UPDATE input_lots
        SET quantity_remaining = LEAST(quantity_received, quantity_remaining + v_prev.quantity)
        WHERE id = v_prev.lot_id AND farm_id = p_farm;
      END IF;
      DELETE FROM input_movements WHERE id = v_prev.id;
    END LOOP;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO farm_activities (
      farm_id, block_id, planting_cycle_id, crop_id, activity_type_id, activity_date, supervisor_id,
      casual_labour_days, other_labour_cost, other_cost, weather, notes,
      application_rate_per_ha, treated_area_ha, active_ingredient, product_registration,
      pre_harvest_interval_days, re_entry_interval_hours, applicator_id, safety_equipment,
      spray_window_ok, harvest_compliant, created_by
    ) VALUES (
      p_farm, (p_data->>'block_id')::UUID, v_cycle, v_crop, (p_data->>'activity_type_id')::UUID,
      (p_data->>'activity_date')::DATE, NULLIF(p_data->>'supervisor_id', '')::UUID,
      COALESCE((p_data->>'casual_labour_days')::NUMERIC, 0), COALESCE((p_data->>'other_labour_cost')::NUMERIC, 0),
      COALESCE((p_data->>'other_cost')::NUMERIC, 0), p_data->>'weather', p_data->>'notes',
      NULLIF(p_data->>'application_rate_per_ha', '')::NUMERIC,
      NULLIF(p_data->>'treated_area_ha', '')::NUMERIC,
      NULLIF(p_data->>'active_ingredient', ''),
      NULLIF(p_data->>'product_registration', ''),
      NULLIF(p_data->>'pre_harvest_interval_days', '')::INT,
      NULLIF(p_data->>'re_entry_interval_hours', '')::INT,
      NULLIF(p_data->>'applicator_id', '')::UUID,
      NULLIF(p_data->>'safety_equipment', ''),
      CASE WHEN p_data ? 'spray_window_ok' AND jsonb_typeof(p_data->'spray_window_ok') = 'boolean'
        THEN (p_data->>'spray_window_ok')::BOOLEAN ELSE NULL END,
      CASE WHEN p_data ? 'harvest_compliant' AND jsonb_typeof(p_data->'harvest_compliant') = 'boolean'
        THEN (p_data->>'harvest_compliant')::BOOLEAN ELSE NULL END,
      p_user
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
      notes = p_data->>'notes',
      application_rate_per_ha = NULLIF(p_data->>'application_rate_per_ha', '')::NUMERIC,
      treated_area_ha = NULLIF(p_data->>'treated_area_ha', '')::NUMERIC,
      active_ingredient = NULLIF(p_data->>'active_ingredient', ''),
      product_registration = NULLIF(p_data->>'product_registration', ''),
      pre_harvest_interval_days = NULLIF(p_data->>'pre_harvest_interval_days', '')::INT,
      re_entry_interval_hours = NULLIF(p_data->>'re_entry_interval_hours', '')::INT,
      applicator_id = NULLIF(p_data->>'applicator_id', '')::UUID,
      safety_equipment = NULLIF(p_data->>'safety_equipment', ''),
      spray_window_ok = CASE WHEN p_data ? 'spray_window_ok' AND jsonb_typeof(p_data->'spray_window_ok') = 'boolean'
        THEN (p_data->>'spray_window_ok')::BOOLEAN ELSE NULL END,
      harvest_compliant = CASE WHEN p_data ? 'harvest_compliant' AND jsonb_typeof(p_data->'harvest_compliant') = 'boolean'
        THEN (p_data->>'harvest_compliant')::BOOLEAN ELSE NULL END
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
  INSERT INTO farm_activity_inputs (activity_id, input_name, quantity, unit, unit_cost, product_id, lot_id, sort_order)
  SELECT
    v_id,
    x->>'input_name',
    (x->>'quantity')::NUMERIC,
    x->>'unit',
    NULLIF(x->>'unit_cost', '')::NUMERIC,
    NULLIF(x->>'product_id', '')::UUID,
    NULLIF(x->>'lot_id', '')::UUID,
    ord::INT
  FROM jsonb_array_elements(COALESCE(p_inputs, '[]')) WITH ORDINALITY AS t(x, ord);

  -- Issue stock for inputs linked to a product lot.
  FOR v_inp IN
    SELECT product_id, lot_id, quantity, unit_cost
    FROM farm_activity_inputs
    WHERE activity_id = v_id AND product_id IS NOT NULL AND lot_id IS NOT NULL AND quantity > 0
  LOOP
    v_product := v_inp.product_id;
    v_lot := v_inp.lot_id;
    v_qty := v_inp.quantity;

    IF NOT EXISTS (
      SELECT 1 FROM input_lots
      WHERE id = v_lot AND product_id = v_product AND farm_id = p_farm
    ) THEN
      RAISE EXCEPTION 'Input lot does not belong to the selected product on this farm.';
    END IF;

    SELECT unit_cost INTO v_unit_cost FROM input_lots WHERE id = v_lot;
    v_unit_cost := COALESCE(v_inp.unit_cost, v_unit_cost);

    INSERT INTO input_movements (
      farm_id, product_id, lot_id, movement_type, quantity, unit_cost, activity_id, created_by
    ) VALUES (
      p_farm, v_product, v_lot, 'issue', v_qty, v_unit_cost, v_id, p_user
    );

    UPDATE input_lots
    SET quantity_remaining = quantity_remaining - v_qty
    WHERE id = v_lot
      AND farm_id = p_farm
      AND quantity_remaining >= v_qty;
  END LOOP;

  UPDATE farm_activities SET
    worker_labour_cost = (SELECT COALESCE(SUM(cost), 0) FROM farm_activity_workers WHERE activity_id = v_id),
    input_cost = (SELECT COALESCE(SUM(cost), 0) FROM farm_activity_inputs WHERE activity_id = v_id)
  WHERE id = v_id;

  RETURN v_id;
END $$;
