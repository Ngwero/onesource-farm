-- Apply OneSource Farm branding defaults while preserving customized branding.
ALTER TABLE branding_settings
  ALTER COLUMN company_name SET DEFAULT 'OneSource Farm',
  ALTER COLUMN company_short_name SET DEFAULT 'OneSource Farm';

UPDATE branding_settings
SET company_name = 'OneSource Farm',
    company_short_name = 'OneSource Farm',
    footer_text = 'OneSource Farm',
    updated_at = NOW()
WHERE company_name = 'Rhino Payment Services Limited';
