-- 1) Columns on draft_snapshots
ALTER TABLE public.draft_snapshots
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- 1a) Ensure timestamps exist (no-op if already present)
ALTER TABLE public.draft_snapshots
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 1b) Trigger to set workspace_id from current user's tenant if null
CREATE OR REPLACE FUNCTION public.set_draft_workspace_id()
RETURNS trigger AS $$
DECLARE
  wid uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT tenant_id INTO wid FROM public.users WHERE id = auth.uid();
    NEW.workspace_id := wid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_draft_workspace_id ON public.draft_snapshots;
CREATE TRIGGER trg_set_draft_workspace_id
BEFORE INSERT ON public.draft_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.set_draft_workspace_id();

-- 1c) Update updated_at on change
CREATE OR REPLACE FUNCTION public.update_draft_snapshots_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_draft_snapshots_updated_at ON public.draft_snapshots;
CREATE TRIGGER trg_update_draft_snapshots_updated_at
BEFORE UPDATE ON public.draft_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_draft_snapshots_updated_at();

-- 2) Helper functions
CREATE OR REPLACE FUNCTION public.bundle_first_media_url(j jsonb)
RETURNS text LANGUAGE sql AS $$
  WITH items AS (
    SELECT elem
    FROM jsonb_array_elements(j->'items') elem
  ),
  first_item_media AS (
    SELECT (elem->'media'->>'url') AS url
    FROM items
    WHERE (elem->'media'->>'url') IS NOT NULL
    LIMIT 1
  ),
  first_recommended AS (
    SELECT (j->'recommendedImages'->0->>'url') AS url
  )
  SELECT COALESCE(
    (SELECT url FROM first_item_media WHERE url IS NOT NULL),
    (SELECT url FROM first_recommended WHERE url IS NOT NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.bundle_channels(j jsonb)
RETURNS text[] LANGUAGE sql AS $$
  SELECT ARRAY_AGG(DISTINCT (elem->>'channel'))::text[]
  FROM jsonb_array_elements(j->'items') elem;
$$;

CREATE OR REPLACE FUNCTION public.bundle_approved_counts(j jsonb)
RETURNS json LANGUAGE sql AS $$
  WITH items AS (
    SELECT elem
    FROM jsonb_array_elements(j->'items') elem
  )
  SELECT json_build_object(
    'approved', COALESCE(SUM(CASE 
        WHEN (elem->>'_approved')::boolean IS TRUE THEN 1 
        WHEN (elem->>'approved')::boolean IS TRUE THEN 1 
        ELSE 0 END),0),
    'total', COUNT(*)
  )
  FROM items;
$$;

-- 3) View returning latest non-deleted bundle per bundle id
CREATE OR REPLACE VIEW public.content_library_view
WITH (security_invoker = true)
AS
WITH bundles AS (
  SELECT
    ds.id AS snapshot_id,
    ds.workspace_id,
    (ds.content->>'id')::text AS bundle_id,
    (ds.content->'meta'->>'mode')::text AS mode,
    COALESCE(ds.content->'meta'->>'sourceId', NULL) AS source_id,
    COALESCE(
      ds.content->>'title',
      ds.content->'userIdea'->>'title',
      ds.doc_id::text
    ) AS source_label,
    public.bundle_channels(ds.content) AS channels,
    (public.bundle_approved_counts(ds.content)->>'approved')::int AS approved_count,
    (public.bundle_approved_counts(ds.content)->>'total')::int AS total_items,
    public.bundle_first_media_url(ds.content) AS thumbnail,
    ds.created_at,
    ds.updated_at,
    row_number() OVER (
      PARTITION BY (ds.content->>'id') ORDER BY ds.updated_at DESC
    ) AS rn
  FROM public.draft_snapshots ds
  WHERE ds.doc_type = 'content_bundle'
    AND ds.deleted_at IS NULL
    AND (ds.content->>'id') IS NOT NULL
)
SELECT
  snapshot_id,
  workspace_id,
  bundle_id,
  mode,
  source_id,
  source_label,
  channels,
  approved_count,
  total_items,
  thumbnail,
  created_at,
  updated_at
FROM bundles
WHERE rn = 1;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS draft_snapshots_doc_type_idx
  ON public.draft_snapshots (doc_type);

CREATE INDEX IF NOT EXISTS draft_snapshots_not_deleted_idx
  ON public.draft_snapshots (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS draft_snapshots_bundle_id_idx
  ON public.draft_snapshots ((content->>'id'));

CREATE INDEX IF NOT EXISTS draft_snapshots_workspace_updated_idx
  ON public.draft_snapshots (workspace_id, updated_at DESC);

-- 5) RLS
ALTER TABLE public.draft_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_select_content_bundles ON public.draft_snapshots;
CREATE POLICY p_select_content_bundles
  ON public.draft_snapshots FOR SELECT
  USING (
    doc_type = 'content_bundle' AND deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = draft_snapshots.workspace_id AND u.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS p_update_content_bundles ON public.draft_snapshots;
CREATE POLICY p_update_content_bundles
  ON public.draft_snapshots FOR UPDATE
  USING (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = draft_snapshots.workspace_id AND u.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = draft_snapshots.workspace_id AND u.id = auth.uid()
  ));

DROP POLICY IF EXISTS p_insert_content_bundles ON public.draft_snapshots;
CREATE POLICY p_insert_content_bundles
  ON public.draft_snapshots FOR INSERT
  WITH CHECK (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = draft_snapshots.workspace_id AND u.id = auth.uid()
  ));
