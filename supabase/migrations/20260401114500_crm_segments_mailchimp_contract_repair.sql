ALTER TABLE public.crm_segments
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_segments_tenant_source_source_id
  ON public.crm_segments (tenant_id, source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
