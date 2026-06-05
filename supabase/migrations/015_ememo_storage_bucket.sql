-- Private bucket for signatures, memo attachments, and branding logos.
-- The app reads/writes via service role; files are not public.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ememo-files', 'ememo-files', false, 10485760)
ON CONFLICT (id) DO NOTHING;
