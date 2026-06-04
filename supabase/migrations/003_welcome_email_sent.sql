-- Track one-time welcome email after first successful sign-in
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
