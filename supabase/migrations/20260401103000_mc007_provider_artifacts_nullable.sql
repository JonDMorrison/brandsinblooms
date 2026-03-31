DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'provider_artifacts'
      AND column_name = 'import_job_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.provider_artifacts
      ALTER COLUMN import_job_id DROP NOT NULL;
  END IF;
END $$;

UPDATE public.provider_artifacts AS artifact
SET import_job_id = NULL
FROM public.import_jobs AS job
WHERE artifact.import_job_id = job.id
  AND artifact.provider = 'mailchimp'
  AND jsonb_typeof(job.config) = 'object'
  AND job.config @> '{"artifact_cache": true, "hidden": true, "generated_by": "mailchimp-fetch-lists"}'::jsonb;