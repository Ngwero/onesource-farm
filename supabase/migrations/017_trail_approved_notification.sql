INSERT INTO notification_settings (event_type, email_enabled, in_app_enabled)
VALUES ('memo_trail_fully_approved', TRUE, TRUE)
ON CONFLICT (event_type) DO NOTHING;
