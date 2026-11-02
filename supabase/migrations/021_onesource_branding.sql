-- Rebrand from RukaPay / Rhino Payment Services to OneSource.
-- Only rows still carrying the old defaults are touched, so edits made via Admin → Branding are kept.

ALTER TABLE branding_settings
  ALTER COLUMN company_name SET DEFAULT 'OneSource',
  ALTER COLUMN company_short_name SET DEFAULT 'OneSource';

UPDATE branding_settings
SET company_name = 'OneSource', updated_at = NOW()
WHERE company_name = 'Rhino Payment Services Limited';

UPDATE branding_settings
SET company_short_name = 'OneSource', updated_at = NOW()
WHERE company_short_name = 'RukaPay';

UPDATE branding_settings
SET footer_text = 'OneSource', updated_at = NOW()
WHERE footer_text = 'Rhino Payment Services Limited | RukaPay | www.rukapay.com';
