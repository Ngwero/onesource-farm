-- One editable schedule per user and farm, even when its destination changes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM report_digest_subscriptions
    GROUP BY farm_id, user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple digest schedules exist for a user/farm. Reconcile them before applying migration 028.';
  END IF;
END $$;

ALTER TABLE report_digest_subscriptions
  DROP CONSTRAINT IF EXISTS report_digest_subscriptions_farm_id_user_id_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS report_digest_subscriptions_farm_user
  ON report_digest_subscriptions (farm_id, user_id);

-- API handlers enforce access; subscriptions are never exposed through the public Data API.
ALTER TABLE report_digest_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_digest_subscriptions ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMPTZ;

ALTER TABLE attachments ADD CONSTRAINT attachments_capture_coordinates_check CHECK (
  (captured_lat IS NULL AND captured_lng IS NULL) OR
  (captured_lat IS NOT NULL AND captured_lng IS NOT NULL AND
   captured_lat BETWEEN -90 AND 90 AND captured_lng BETWEEN -180 AND 180)
) NOT VALID;
ALTER TABLE farm_activities ADD CONSTRAINT farm_activity_spray_score_check
  CHECK (spray_window_score IS NULL OR spray_window_score BETWEEN 0 AND 100) NOT VALID;
