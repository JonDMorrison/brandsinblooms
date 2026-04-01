DO $$
BEGIN
  IF to_regclass('public.provider_artifacts') IS NULL THEN
    RETURN;
  END IF;

  WITH ranked_artifacts AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, provider, artifact_type, external_id
        ORDER BY created_at DESC, id DESC
      ) AS row_number
    FROM public.provider_artifacts
  )
  DELETE FROM public.provider_artifacts
  WHERE id IN (
    SELECT id
    FROM ranked_artifacts
    WHERE row_number > 1
  );

  ALTER TABLE public.provider_artifacts
    DROP CONSTRAINT IF EXISTS provider_artifacts_provider_check;

  ALTER TABLE public.provider_artifacts
    ADD CONSTRAINT provider_artifacts_provider_check
    CHECK (
      provider IN ('mailchimp', 'klaviyo', 'constant_contact')
    );

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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.provider_artifacts'::regclass
      AND conname = 'provider_artifacts_unique_artifact'
  ) THEN
    ALTER TABLE public.provider_artifacts
      ADD CONSTRAINT provider_artifacts_unique_artifact
      UNIQUE (tenant_id, provider, artifact_type, external_id);
  END IF;
END $$;
