-- Backfill tenant_id and add a safe fallback RLS policy for crm_campaigns updates.
-- This helps prevent schedule-save failures caused by older rows missing tenant_id
-- or environments where tenant-based UPDATE checks drifted.

-- Ensure RLS stays enabled
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

-- Backfill tenant_id for legacy rows
UPDATE public.crm_campaigns c
SET tenant_id = u.tenant_id
FROM public.users u
WHERE c.tenant_id IS NULL
  AND c.user_id = u.id
  AND u.tenant_id IS NOT NULL;

DO $$
BEGIN
  -- Fallback UPDATE policy: allow users to update rows they own.
  -- This is intentionally narrow (UPDATE only) and requires user_id to remain auth.uid().
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_campaigns'
      AND policyname = 'Users can update their own campaigns'
  ) THEN
    CREATE POLICY "Users can update their own campaigns"
    ON public.crm_campaigns
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END;
$$;

-- Reload PostgREST schema cache (policies can affect API behavior immediately)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
