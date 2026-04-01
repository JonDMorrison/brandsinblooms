DO $$
DECLARE
  status_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO status_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.import_jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS %I',
      status_constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.import_jobs
  ADD CONSTRAINT import_jobs_status_check
  CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled'));

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
