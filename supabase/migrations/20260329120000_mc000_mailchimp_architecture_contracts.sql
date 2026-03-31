-- MC-000: Mailchimp architecture decisions and schema contracts
-- Contract-only migration. No runtime behavior is implemented here.

-- Add resumability tracking to import_jobs.
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS current_page INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pages_est INTEGER,
  ADD COLUMN IF NOT EXISTS fetched_rows INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inserted_rows INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_rows INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_rows INTEGER NOT NULL DEFAULT 0;

-- Normalize provider_connections.status values and explicitly exclude disconnected.
DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT conname
  INTO existing_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.provider_connections'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.provider_connections DROP CONSTRAINT %I',
      existing_constraint
    );
  END IF;
END $$;

ALTER TABLE public.provider_connections
  ADD CONSTRAINT provider_connections_status_check
  CHECK (status IN ('pending', 'connected', 'expired', 'revoked', 'error'));

-- Extend existing CRM segments for provider-sourced segment imports.
ALTER TABLE public.crm_segments
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_segments_tenant_source_source_id
  ON public.crm_segments (tenant_id, source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- Add the missing explicit segment foreign key on customer_segments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_customer_segments_segment'
      AND conrelid = 'public.customer_segments'::regclass
  ) THEN
    ALTER TABLE public.customer_segments
      ADD CONSTRAINT fk_customer_segments_segment
      FOREIGN KEY (segment_id)
      REFERENCES public.crm_segments(id)
      ON DELETE CASCADE;
  END IF;
END $$;