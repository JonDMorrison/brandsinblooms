-- Ensure email_send_jobs.available_at exists and force PostgREST schema reload.
--
-- Motivation:
-- Edge Functions insert/upsert into public.email_send_jobs.available_at.
-- If the column exists but PostgREST schema cache is stale (or the column is missing),
-- requests can fail with PGRST204: "Could not find the 'available_at' column ... in the schema cache".

ALTER TABLE public.email_send_jobs
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_send_jobs'
      AND column_name = 'available_at'
  ) THEN
    -- Backfill nulls (if any) and standardize defaults/constraints.
    EXECUTE 'UPDATE public.email_send_jobs SET available_at = COALESCE(available_at, now()) WHERE available_at IS NULL';
    EXECUTE 'ALTER TABLE public.email_send_jobs ALTER COLUMN available_at SET DEFAULT now()';
    EXECUTE 'ALTER TABLE public.email_send_jobs ALTER COLUMN available_at SET NOT NULL';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_email_send_jobs_claimable_available
  ON public.email_send_jobs (status, available_at, created_at)
  WHERE status IN ('pending', 'in_progress');

DO $$
BEGIN
  -- Force PostgREST to refresh schema cache after DDL.
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
