-- Field ops: block GPS polygons, attachment geo meta, structured weather, digest subscriptions.

-- ——— Block GPS ———

ALTER TABLE blocks
  ADD COLUMN IF NOT EXISTS centroid_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS centroid_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS boundary_geojson JSONB,
  ADD COLUMN IF NOT EXISTS map_zoom INT DEFAULT 16;

ALTER TABLE blocks
  DROP CONSTRAINT IF EXISTS blocks_centroid_lat_check;
ALTER TABLE blocks
  ADD CONSTRAINT blocks_centroid_lat_check
  CHECK (centroid_lat IS NULL OR (centroid_lat >= -90 AND centroid_lat <= 90));

ALTER TABLE blocks
  DROP CONSTRAINT IF EXISTS blocks_centroid_lng_check;
ALTER TABLE blocks
  ADD CONSTRAINT blocks_centroid_lng_check
  CHECK (centroid_lng IS NULL OR (centroid_lng >= -180 AND centroid_lng <= 180));

-- ——— Attachment capture meta (GPS + device) ———

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS captured_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS captured_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

-- ——— Activity weather snapshot ———

ALTER TABLE farm_activities
  ADD COLUMN IF NOT EXISTS weather_temp_c NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS weather_wind_kmh NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS weather_precip_mm NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS weather_humidity_pct NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS weather_code INT,
  ADD COLUMN IF NOT EXISTS weather_source TEXT,
  ADD COLUMN IF NOT EXISTS spray_window_score NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS spray_window_label TEXT;

-- ——— Scheduled digest subscriptions (server-side, replaces localStorage-only stub) ———

CREATE TABLE IF NOT EXISTS report_digest_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  report_types TEXT[] NOT NULL DEFAULT ARRAY['executive']::TEXT[],
  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily', 'weekly')),
  weekday INT NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  hour_utc INT NOT NULL DEFAULT 6 CHECK (hour_utc BETWEEN 0 AND 23),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_report_digests_active ON report_digest_subscriptions(is_active, cadence);

CREATE OR REPLACE FUNCTION touch_report_digest_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_report_digest_updated_at ON report_digest_subscriptions;
CREATE TRIGGER trg_report_digest_updated_at
  BEFORE UPDATE ON report_digest_subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_report_digest_updated_at();

INSERT INTO system_settings (key, value, description) VALUES
  ('reports.digest_enabled', 'true', 'Allow cron to send scheduled farm report digests'),
  ('reports.default_digest_types', '"executive,harvests,activities"', 'Comma-separated report types for new digest subscriptions')
ON CONFLICT (key) DO NOTHING;
