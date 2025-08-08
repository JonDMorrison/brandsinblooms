
-- 1) Enum for document types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'draft_doc_type') THEN
    CREATE TYPE public.draft_doc_type AS ENUM ('newsletter', 'automation');
  END IF;
END$$;

-- 2) Draft snapshots table (append-only)
CREATE TABLE IF NOT EXISTS public.draft_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  doc_type public.draft_doc_type NOT NULL,
  doc_id UUID NOT NULL,
  version INT NOT NULL DEFAULT 1,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Optional blob storing conflict info produced during merge
  conflict_diff JSONB,
  -- Optional pointer to large content stored in storage if needed
  content_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT draft_snapshots_doc_version_unique UNIQUE (tenant_id, doc_type, doc_id, version)
);

-- 3) Indexes for fast head lookups and filtering
CREATE INDEX IF NOT EXISTS idx_draft_snapshots_doc ON public.draft_snapshots (tenant_id, doc_type, doc_id, version);
CREATE INDEX IF NOT EXISTS idx_draft_snapshots_user ON public.draft_snapshots (user_id);
CREATE INDEX IF NOT EXISTS idx_draft_snapshots_created_at ON public.draft_snapshots (created_at);

-- 4) RLS: enable and policies (tenant-scoped; user must belong to tenant)
ALTER TABLE public.draft_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper predicate reused across policies:
-- User must belong to the same tenant as the record
-- and user_id must match for mutations
CREATE POLICY "Drafts: select within tenant"
  ON public.draft_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = draft_snapshots.tenant_id
    )
  );

CREATE POLICY "Drafts: insert by owner in tenant"
  ON public.draft_snapshots
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = draft_snapshots.tenant_id
    )
  );

CREATE POLICY "Drafts: update by owner in tenant"
  ON public.draft_snapshots
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = draft_snapshots.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = draft_snapshots.tenant_id
    )
  );

CREATE POLICY "Drafts: delete by owner in tenant"
  ON public.draft_snapshots
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = draft_snapshots.tenant_id
    )
  );

-- 5) updated_at trigger
CREATE OR REPLACE FUNCTION public.update_draft_snapshots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_draft_snapshots_updated_at ON public.draft_snapshots;

CREATE TRIGGER trg_update_draft_snapshots_updated_at
BEFORE UPDATE ON public.draft_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_draft_snapshots_updated_at();

-- 6) Realtime: ensure full row data and add to publication
ALTER TABLE public.draft_snapshots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_snapshots;
