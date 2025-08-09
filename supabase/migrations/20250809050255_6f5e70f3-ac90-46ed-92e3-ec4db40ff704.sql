-- Add new doc_type for content bundles and index for fast head lookups
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'draft_doc_type' AND n.nspname = 'public') THEN
    -- If enum doesn't exist, skip silently
    RAISE NOTICE 'draft_doc_type enum not found; skipping enum alteration';
  ELSE
    ALTER TYPE public.draft_doc_type ADD VALUE IF NOT EXISTS 'content_bundle';
  END IF;
END $$;

-- Create helpful index for retrieving latest version of a document
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_draft_snapshots_head' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_draft_snapshots_head ON public.draft_snapshots (tenant_id, doc_type, doc_id, version DESC);
  END IF;
END $$;