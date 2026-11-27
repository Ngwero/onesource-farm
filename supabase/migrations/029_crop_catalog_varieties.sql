-- Crop catalog: Chilies, Hot Pepper, Karela, Avocado, Jackfruit, Citrus + varieties.
-- Idempotent: safe to re-run.

-- ——— Crops ———
-- Existing CHILLI → rename display to Chilies; keep code for compatibility.
UPDATE crops
SET
  name = 'Chilies',
  scientific_name = COALESCE(scientific_name, 'Capsicum annuum / Capsicum spp.'),
  description = COALESCE(description, 'Fresh chillies for export and local market'),
  updated_at = NOW()
WHERE code = 'CHILLI';

INSERT INTO crops (code, name, scientific_name, production_cycle, default_unit, maturity_days, description)
VALUES
  ('CHILLI', 'Chilies', 'Capsicum annuum / Capsicum spp.', 'seasonal', 'kg', 90, 'Fresh chillies for export and local market'),
  ('HOTPEPPER', 'Hot Pepper', 'Capsicum chinense / Capsicum frutescens', 'seasonal', 'kg', 100, 'Hot peppers for export and local market'),
  ('KARELA', 'Karela (Bitter Gourd)', 'Momordica charantia', 'seasonal', 'kg', 60, 'Bitter gourd (karela) varieties'),
  ('AVOCADO', 'Avocado', 'Persea americana', 'perennial', 'kg', 365, 'Avocado varieties for export and local market'),
  ('JACKFRUIT', 'Jackfruit', 'Artocarpus heterophyllus', 'perennial', 'kg', 180, 'Jackfruit varieties'),
  ('CITRUS', 'Citrus', 'Citrus spp.', 'perennial', 'kg', 365, 'Citrus fruits — oranges, lemons, limes and related')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  scientific_name = EXCLUDED.scientific_name,
  production_cycle = EXCLUDED.production_cycle,
  default_unit = EXCLUDED.default_unit,
  maturity_days = COALESCE(crops.maturity_days, EXCLUDED.maturity_days),
  description = EXCLUDED.description,
  status = 'active',
  updated_at = NOW();

-- Link all active grades to every catalog crop.
INSERT INTO crop_grades (crop_id, grade_id)
SELECT c.id, g.id
FROM crops c
CROSS JOIN grades g
WHERE c.code IN ('CHILLI', 'HOTPEPPER', 'KARELA', 'AVOCADO', 'JACKFRUIT', 'CITRUS')
  AND g.status = 'active'
ON CONFLICT DO NOTHING;

-- Default QC criteria (same baseline as chilli seed).
INSERT INTO crop_quality_criteria (crop_id, name, criterion_type, is_mandatory, sort_order)
SELECT c.id, v.name, 'pass_fail', TRUE, v.sort_order
FROM crops c
CROSS JOIN (VALUES
  ('Size', 1), ('Colour', 2), ('Weight', 3), ('Damage', 4), ('Defects', 5), ('Maturity', 6),
  ('Ripeness', 7), ('Pest signs', 8), ('Disease signs', 9), ('Moisture / condition', 10),
  ('Appearance', 11)
) AS v(name, sort_order)
WHERE c.code IN ('CHILLI', 'HOTPEPPER', 'KARELA', 'AVOCADO', 'JACKFRUIT', 'CITRUS')
ON CONFLICT (crop_id, name) DO NOTHING;

-- ——— Varieties ———
-- Chilies
INSERT INTO crop_varieties (crop_id, code, name, maturity_days)
SELECT c.id, v.code, v.name, v.maturity_days
FROM crops c
CROSS JOIN (VALUES
  ('GREEN', 'Green Chilli', 90),
  ('RED', 'Red Chilli', 90),
  ('YELLOW', 'Yellow Chilli', 90),
  ('BIRDS-EYE', 'Bird''s Eye Chilli', 85),
  ('BULLET', 'Bullet Chilli', 90),
  ('CAYENNE', 'Cayenne Chilli', 95),
  ('THAI', 'Thai Chilli', 90),
  ('FINGER', 'Finger Chilli', 90)
) AS v(code, name, maturity_days)
WHERE c.code = 'CHILLI'
ON CONFLICT (crop_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  maturity_days = COALESCE(crop_varieties.maturity_days, EXCLUDED.maturity_days),
  status = 'active',
  updated_at = NOW();

-- Hot Pepper
INSERT INTO crop_varieties (crop_id, code, name, maturity_days)
SELECT c.id, v.code, v.name, v.maturity_days
FROM crops c
CROSS JOIN (VALUES
  ('SCOTCH-BONNET', 'Scotch Bonnet', 100),
  ('HABANERO', 'Habanero', 100),
  ('PIRI-PIRI', 'Piri Piri', 95),
  ('AFR-BIRDS-EYE', 'African Bird''s Eye Pepper', 90),
  ('RED-HOT', 'Red Hot Pepper', 95),
  ('YELLOW-HOT', 'Yellow Hot Pepper', 95),
  ('ORANGE-HAB', 'Orange Habanero', 100),
  ('CAYENNE', 'Cayenne Pepper', 95)
) AS v(code, name, maturity_days)
WHERE c.code = 'HOTPEPPER'
ON CONFLICT (crop_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  maturity_days = COALESCE(crop_varieties.maturity_days, EXCLUDED.maturity_days),
  status = 'active',
  updated_at = NOW();

-- Karela (Bitter Gourd)
INSERT INTO crop_varieties (crop_id, code, name, maturity_days)
SELECT c.id, v.code, v.name, v.maturity_days
FROM crops c
CROSS JOIN (VALUES
  ('LONG-GREEN', 'Long Green Karela', 60),
  ('SHORT-GREEN', 'Short Green Karela', 55),
  ('DARK-GREEN', 'Dark Green Karela', 60),
  ('WHITE', 'White Karela', 60),
  ('INDIAN', 'Indian Karela', 60),
  ('CHINESE', 'Chinese Karela', 55)
) AS v(code, name, maturity_days)
WHERE c.code = 'KARELA'
ON CONFLICT (crop_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  maturity_days = COALESCE(crop_varieties.maturity_days, EXCLUDED.maturity_days),
  status = 'active',
  updated_at = NOW();

-- Avocado
INSERT INTO crop_varieties (crop_id, code, name, maturity_days)
SELECT c.id, v.code, v.name, v.maturity_days
FROM crops c
CROSS JOIN (VALUES
  ('HASS', 'Hass Avocado', 365),
  ('FUERTE', 'Fuerte Avocado', 365),
  ('REED', 'Reed Avocado', 365),
  ('BACON', 'Bacon Avocado', 365),
  ('SEMIL-34', 'Semil 34 Avocado', 365),
  ('LOCAL-GREEN', 'Local Green Avocado', 300),
  ('JUMBO', 'Jumbo Avocado', 365)
) AS v(code, name, maturity_days)
WHERE c.code = 'AVOCADO'
ON CONFLICT (crop_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  maturity_days = COALESCE(crop_varieties.maturity_days, EXCLUDED.maturity_days),
  status = 'active',
  updated_at = NOW();

-- Jackfruit
INSERT INTO crop_varieties (crop_id, code, name, maturity_days)
SELECT c.id, v.code, v.name, v.maturity_days
FROM crops c
CROSS JOIN (VALUES
  ('SOFT-YELLOW', 'Soft Yellow Jackfruit', 180),
  ('FIRM-YELLOW', 'Firm Yellow Jackfruit', 180),
  ('FIRM-WHITE', 'Firm White Jackfruit', 180),
  ('RED', 'Red Jackfruit', 180),
  ('SWEET', 'Sweet Jackfruit', 180),
  ('SEEDLESS', 'Seedless Jackfruit', 180)
) AS v(code, name, maturity_days)
WHERE c.code = 'JACKFRUIT'
ON CONFLICT (crop_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  maturity_days = COALESCE(crop_varieties.maturity_days, EXCLUDED.maturity_days),
  status = 'active',
  updated_at = NOW();

-- Citrus
INSERT INTO crop_varieties (crop_id, code, name, maturity_days)
SELECT c.id, v.code, v.name, v.maturity_days
FROM crops c
CROSS JOIN (VALUES
  ('VALENCIA', 'Valencia Orange', 365),
  ('NAVEL', 'Navel Orange', 365),
  ('TANGERINE', 'Tangerine', 300),
  ('MANDARIN', 'Mandarin', 300),
  ('CLEMENTINE', 'Clementine', 300),
  ('LEMON', 'Lemon', 365),
  ('LIME', 'Lime', 300),
  ('PERSIAN-LIME', 'Persian Lime', 300),
  ('GRAPEFRUIT', 'Grapefruit', 365),
  ('POMELO', 'Pomelo', 365),
  ('BLOOD-ORANGE', 'Blood Orange', 365),
  ('SWEET-ORANGE', 'Sweet Orange', 365)
) AS v(code, name, maturity_days)
WHERE c.code = 'CITRUS'
ON CONFLICT (crop_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  maturity_days = COALESCE(crop_varieties.maturity_days, EXCLUDED.maturity_days),
  status = 'active',
  updated_at = NOW();
