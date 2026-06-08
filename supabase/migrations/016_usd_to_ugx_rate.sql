-- Admin-configurable USD → UGX rate for financial implication totals
ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS usd_to_ugx_rate NUMERIC(12, 2) DEFAULT 3700;

UPDATE branding_settings
SET usd_to_ugx_rate = COALESCE(usd_to_ugx_rate, 3700)
WHERE usd_to_ugx_rate IS NULL;
