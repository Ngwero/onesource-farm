-- Land preparation as first-class farm activity types (client-critical).
-- Uses existing category 'maintenance' so it applies without a CHECK-constraint change.
-- UI groups these by code (LAND_PREP, CLEARING, TILLAGE, BED_PREP, RIDGING, SOIL_WORK).

INSERT INTO activity_types (code, name, category, uses_inputs, sort_order, description) VALUES
  ('LAND_PREP', 'Land preparation', 'maintenance', TRUE, 1,
   'General land preparation before planting — clearing, tillage, beds, and soil work'),
  ('CLEARING', 'Land clearing', 'maintenance', TRUE, 2,
   'Clearing bush, stubble, stones, or previous crop residue'),
  ('TILLAGE', 'Tillage / ploughing', 'maintenance', TRUE, 3,
   'Ploughing, harrowing, or other soil tillage'),
  ('BED_PREP', 'Bed preparation', 'maintenance', TRUE, 4,
   'Making planting beds, leveling, and layout'),
  ('RIDGING', 'Ridging / furrowing', 'maintenance', TRUE, 5,
   'Forming ridges or furrows for planting and drainage')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  uses_inputs = EXCLUDED.uses_inputs,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  status = 'active',
  updated_at = NOW();

-- Clarify the older generic soil type so it sits with land prep.
UPDATE activity_types
SET
  name = 'Soil amendment',
  sort_order = 6,
  description = COALESCE(NULLIF(description, ''), 'Manure, compost, lime, or other soil amendments during land prep'),
  status = 'active',
  updated_at = NOW()
WHERE code = 'SOIL_WORK';
