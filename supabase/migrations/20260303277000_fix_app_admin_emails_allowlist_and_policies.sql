-- Repair migration: ensure app_admin_emails exists + is readable by authenticated users
-- The frontend determines Super Admin access by querying public.app_admin_emails.
-- Some environments skipped the original migrations due to filename pattern mismatch.

CREATE TABLE IF NOT EXISTS public.app_admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Ensure the target user is allowlisted
INSERT INTO public.app_admin_emails (email, created_by)
VALUES ('furqanhameedjutt.311@gmail.com', 'manual promotion')
ON CONFLICT (email) DO NOTHING;

-- Allow the `authenticated` API role to read the table (RLS still applies)
GRANT SELECT ON public.app_admin_emails TO authenticated;

-- Enable RLS and ensure the expected SELECT policy exists
ALTER TABLE public.app_admin_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to check admin status" ON public.app_admin_emails;
CREATE POLICY "Allow authenticated users to check admin status"
  ON public.app_admin_emails
  FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
