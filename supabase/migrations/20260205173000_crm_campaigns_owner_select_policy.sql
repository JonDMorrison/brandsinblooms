-- Allow campaign owners to SELECT their own crm_campaigns rows.
-- This prevents client code from failing schedule updates due to a preflight SELECT
-- being blocked in environments where tenant-based access is misconfigured.

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_campaigns'
      AND policyname = 'Users can view their own campaigns'
  ) THEN
    CREATE POLICY "Users can view their own campaigns"
    ON public.crm_campaigns
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;
END;
$$;

-- Reload PostgREST schema cache
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
