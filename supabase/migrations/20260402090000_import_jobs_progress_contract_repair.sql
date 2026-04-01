DO $$
BEGIN
  IF to_regclass('public.import_jobs') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.import_jobs
    ADD COLUMN IF NOT EXISTS current_page INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_pages_est INTEGER,
    ADD COLUMN IF NOT EXISTS fetched_rows INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inserted_rows INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS skipped_rows INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS failed_rows INTEGER NOT NULL DEFAULT 0;
END $$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;