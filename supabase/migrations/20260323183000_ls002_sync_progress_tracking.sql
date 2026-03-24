ALTER TABLE public.pos_sync_jobs_v2
  ADD COLUMN IF NOT EXISTS progress_message text,
  ADD COLUMN IF NOT EXISTS last_progress_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS fetched_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inserted_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_page integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pages_est integer,
  ADD COLUMN IF NOT EXISTS provider_job_id text;

UPDATE public.pos_sync_jobs_v2
SET fetched_rows = COALESCE(fetched_rows, processed_rows, 0),
    inserted_rows = COALESCE(inserted_rows, processed_rows, 0),
    skipped_rows = COALESCE(skipped_rows, 0),
    failed_rows = COALESCE(failed_rows, error_count, 0),
    current_page = GREATEST(COALESCE(current_page, 0), COALESCE(current_batch, 0)),
    total_pages_est = COALESCE(total_pages_est, total_batches),
    last_progress_at = COALESCE(last_progress_at, updated_at, created_at)
WHERE true;

ALTER TABLE public.pos_sync_jobs_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant POS sync jobs v2" ON public.pos_sync_jobs_v2;

CREATE POLICY "Users can view own tenant POS sync jobs v2"
ON public.pos_sync_jobs_v2
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.tenant_id = pos_sync_jobs_v2.tenant_id
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pos_sync_jobs_v2'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_sync_jobs_v2;
  END IF;
END $$;