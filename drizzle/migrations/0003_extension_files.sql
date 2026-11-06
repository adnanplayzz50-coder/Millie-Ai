-- Stores the downloadable Millie Chrome extension ZIP.
-- Access is server-side only: uploads require the admin session and reads use the service role.
CREATE TABLE IF NOT EXISTS public.extension_files (
  id integer PRIMARY KEY,
  filename text NOT NULL,
  version text NOT NULL DEFAULT '',
  content_base64 text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extension_files ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.extension_files FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.extension_files TO service_role;

NOTIFY pgrst, 'reload schema';
