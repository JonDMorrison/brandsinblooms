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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'provider_artifacts_unique_artifact'
  ) THEN
    ALTER TABLE public.provider_artifacts
      ADD CONSTRAINT provider_artifacts_unique_artifact
      UNIQUE (tenant_id, provider, artifact_type, external_id);
  END IF;
END $$;