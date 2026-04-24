ALTER TABLE public.crm_segments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_segments_status_check'
      AND conrelid = 'public.crm_segments'::regclass
  ) THEN
    ALTER TABLE public.crm_segments
      ADD CONSTRAINT crm_segments_status_check
      CHECK (status IN ('draft', 'active', 'paused', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_segments_tenant_status
  ON public.crm_segments (tenant_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_segments_tenant_deleted_at
  ON public.crm_segments (tenant_id, deleted_at);