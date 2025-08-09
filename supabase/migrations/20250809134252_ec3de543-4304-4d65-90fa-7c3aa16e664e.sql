-- Harden function search_path for functions created in previous migration
CREATE OR REPLACE FUNCTION public.set_draft_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  wid uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT tenant_id INTO wid FROM public.users WHERE id = auth.uid();
    NEW.workspace_id := wid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_draft_snapshots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bundle_first_media_url(j jsonb)
RETURNS text
LANGUAGE sql
SET search_path TO public
AS $$
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
RETURNS text[]
LANGUAGE sql
SET search_path TO public
AS $$
  SELECT ARRAY_AGG(DISTINCT (elem->>'channel'))::text[]
  FROM jsonb_array_elements(j->'items') elem;
$$;

CREATE OR REPLACE FUNCTION public.bundle_approved_counts(j jsonb)
RETURNS json
LANGUAGE sql
SET search_path TO public
AS $$
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
