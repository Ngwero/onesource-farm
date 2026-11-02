-- Apply OneSource branding defaults while preserving customized branding.
ALTER TABLE branding_settings
  ALTER COLUMN company_name SET DEFAULT 'OneSource',
  ALTER COLUMN company_short_name SET DEFAULT 'OneSource';

UPDATE branding_settings
SET company_name = 'OneSource',
    company_short_name = 'OneSource',
    footer_text = 'OneSource',
    updated_at = NOW()
WHERE company_name = 'Rhino Payment Services Limited';
