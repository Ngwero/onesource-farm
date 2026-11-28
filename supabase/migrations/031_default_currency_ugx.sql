-- Default farm / contract currency to Uganda Shilling (UGX).

ALTER TABLE farms
  ALTER COLUMN default_currency SET DEFAULT 'UGX';

UPDATE farms
SET default_currency = 'UGX'
WHERE COALESCE(NULLIF(TRIM(default_currency), ''), 'USD') = 'USD';

UPDATE system_settings
SET value = '"UGX"'::jsonb,
    description = COALESCE(NULLIF(description, ''), 'Currency used for contracts and reporting')
WHERE key = 'general.default_currency';

INSERT INTO system_settings (key, value, description)
VALUES ('general.default_currency', '"UGX"'::jsonb, 'Currency used for contracts and reporting')
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'buyer_contracts'
      AND column_name = 'currency'
  ) THEN
    EXECUTE $sql$ALTER TABLE buyer_contracts ALTER COLUMN currency SET DEFAULT 'UGX'$sql$;
    EXECUTE $sql$
      UPDATE buyer_contracts
      SET currency = 'UGX'
      WHERE COALESCE(NULLIF(TRIM(currency), ''), 'USD') = 'USD'
    $sql$;
  END IF;
END $$;
