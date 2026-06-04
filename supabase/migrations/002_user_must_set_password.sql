-- First-login password setup flag
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_set_password BOOLEAN NOT NULL DEFAULT FALSE;
