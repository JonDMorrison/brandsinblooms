-- Harden the global image catalog with tenant attribution, durable usage tracking,
-- scheduled post foreign keys, and tenant-scoped access.

-- ============================================================
-- 1. Global gallery tenant attribution + query indexes
-- ============================================================
ALTER TABLE public.global_image_gallery
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'global_image_gallery_tenant_id_fkey'
      AND conrelid = 'public.global_image_gallery'::regclass
  ) THEN
    ALTER TABLE public.global_image_gallery
      ADD CONSTRAINT global_image_gallery_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'global_image_gallery_created_by_fkey'
      AND conrelid = 'public.global_image_gallery'::regclass
  ) THEN
    ALTER TABLE public.global_image_gallery
      ADD CONSTRAINT global_image_gallery_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

WITH gallery_sources AS (
  SELECT
    gig.id AS image_id,
    source.tenant_id,
    source.created_by
  FROM public.global_image_gallery gig
  JOIN LATERAL (
    SELECT candidate.tenant_id, candidate.created_by
    FROM (
      SELECT
        ct.tenant_id,
        COALESCE(ct.created_by_user_id, ct.user_id) AS created_by,
        ct.created_at,
        1 AS priority
      FROM public.content_tasks ct
      WHERE COALESCE(ct.image_metadata ->> 'globalImageId', '') = gig.id::text
        AND ct.tenant_id IS NOT NULL
        AND COALESCE(ct.created_by_user_id, ct.user_id) IS NOT NULL

      UNION ALL

      SELECT
        itu.tenant_id,
        itu.user_id AS created_by,
        itu.created_at,
        2 AS priority
      FROM public.image_tenant_usage itu
      WHERE itu.image_id = gig.id
        AND itu.tenant_id IS NOT NULL
        AND itu.user_id IS NOT NULL

      UNION ALL

      SELECT
        ais.tenant_id,
        ais.user_id AS created_by,
        aagi.created_at,
        3 AS priority
      FROM public.ai_assistant_generated_images aagi
      INNER JOIN public.ai_assistant_sessions ais
        ON ais.id = aagi.session_id
      WHERE aagi.global_image_id = gig.id
        AND ais.tenant_id IS NOT NULL
        AND ais.user_id IS NOT NULL
    ) AS candidate
    ORDER BY candidate.priority, candidate.created_at
    LIMIT 1
  ) AS source ON true
)
UPDATE public.global_image_gallery gig
SET
  tenant_id = COALESCE(gig.tenant_id, gallery_sources.tenant_id),
  created_by = COALESCE(gig.created_by, gallery_sources.created_by)
FROM gallery_sources
WHERE gig.id = gallery_sources.image_id
  AND (gig.tenant_id IS NULL OR gig.created_by IS NULL);

UPDATE public.global_image_gallery gig
SET tenant_id = u.tenant_id
FROM public.users u
WHERE gig.tenant_id IS NULL
  AND gig.created_by = u.id
  AND u.tenant_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.global_image_gallery
    WHERE tenant_id IS NULL OR created_by IS NULL
  ) THEN
    RAISE EXCEPTION 'global_image_gallery rows remain without tenant attribution after backfill';
  END IF;
END $$;

ALTER TABLE public.global_image_gallery
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN last_used_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_global_images_tenant_id
  ON public.global_image_gallery(tenant_id);

CREATE INDEX IF NOT EXISTS idx_global_images_tenant_created_at
  ON public.global_image_gallery(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_tags_name_category
  ON public.global_image_tags(tag_name, tag_category);

-- ============================================================
-- 2. Usage table normalization + scheduled post foreign key
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'image_tenant_usage'
      AND column_name = 'used_in_context'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'image_tenant_usage'
      AND column_name = 'usage_context'
  ) THEN
    ALTER TABLE public.image_tenant_usage
      RENAME COLUMN used_in_context TO usage_context;
  END IF;
END $$;

ALTER TABLE public.image_tenant_usage
  ADD COLUMN IF NOT EXISTS content_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'image_tenant_usage_content_id_fkey'
      AND conrelid = 'public.image_tenant_usage'::regclass
  ) THEN
    ALTER TABLE public.image_tenant_usage
      ADD CONSTRAINT image_tenant_usage_content_id_fkey
      FOREIGN KEY (content_id) REFERENCES public.content_tasks(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'image_tenant_usage_image_tenant_content_key'
      AND conrelid = 'public.image_tenant_usage'::regclass
  ) THEN
    ALTER TABLE public.image_tenant_usage
      ADD CONSTRAINT image_tenant_usage_image_tenant_content_key
      UNIQUE (image_id, tenant_id, content_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_image_tenant_usage_content_id
  ON public.image_tenant_usage(content_id)
  WHERE content_id IS NOT NULL;

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS global_image_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scheduled_posts_global_image_id_fkey'
      AND conrelid = 'public.scheduled_posts'::regclass
  ) THEN
    ALTER TABLE public.scheduled_posts
      ADD CONSTRAINT scheduled_posts_global_image_id_fkey
      FOREIGN KEY (global_image_id) REFERENCES public.global_image_gallery(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_global_image_id
  ON public.scheduled_posts(global_image_id)
  WHERE global_image_id IS NOT NULL;

UPDATE public.scheduled_posts sp
SET global_image_id = (ct.image_metadata ->> 'globalImageId')::uuid
FROM public.content_tasks ct
WHERE sp.task_id = ct.id
  AND sp.global_image_id IS NULL
  AND COALESCE(ct.image_metadata ->> 'globalImageId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- ============================================================
-- 3. Tenant-scoped policies for gallery and tags
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can view global images"
  ON public.global_image_gallery;
DROP POLICY IF EXISTS "Tenants can view their global images"
  ON public.global_image_gallery;
CREATE POLICY "Tenants can view their global images"
  ON public.global_image_gallery
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = global_image_gallery.tenant_id
  ));

DROP POLICY IF EXISTS "Service role manages global images"
  ON public.global_image_gallery;
DROP POLICY IF EXISTS "Service role full access on global images"
  ON public.global_image_gallery;
CREATE POLICY "Service role full access on global images"
  ON public.global_image_gallery
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone authenticated can view image tags"
  ON public.global_image_tags;
DROP POLICY IF EXISTS "Tenants can view image tags for their gallery"
  ON public.global_image_tags;
CREATE POLICY "Tenants can view image tags for their gallery"
  ON public.global_image_tags
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.global_image_gallery gig
    INNER JOIN public.users u
      ON u.tenant_id = gig.tenant_id
    WHERE gig.id = global_image_tags.image_id
      AND u.id = auth.uid()
  ));

DROP POLICY IF EXISTS "Service role manages image tags"
  ON public.global_image_tags;
DROP POLICY IF EXISTS "Service role full access on image tags"
  ON public.global_image_tags;
CREATE POLICY "Service role full access on image tags"
  ON public.global_image_tags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. Usage counter synchronization
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_global_image_gallery_usage_metrics(
  p_image_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage_count INTEGER := 0;
  v_total_usage_count INTEGER := 0;
  v_unique_tenant_count INTEGER := 0;
  v_first_used_at TIMESTAMPTZ;
  v_last_used_at TIMESTAMPTZ;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(usage_count), 0)::INTEGER,
    COUNT(DISTINCT tenant_id)::INTEGER,
    MIN(first_used_at),
    MAX(last_used_at)
  INTO
    v_usage_count,
    v_total_usage_count,
    v_unique_tenant_count,
    v_first_used_at,
    v_last_used_at
  FROM public.image_tenant_usage
  WHERE image_id = p_image_id;

  UPDATE public.global_image_gallery gig
  SET
    usage_count = v_usage_count,
    total_usage_count = v_total_usage_count,
    unique_tenant_count = v_unique_tenant_count,
    first_used_at = COALESCE(v_first_used_at, gig.first_used_at),
    last_used_at = COALESCE(v_last_used_at, gig.last_used_at),
    updated_at = now()
  WHERE gig.id = p_image_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_global_image_gallery_usage_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_global_image_gallery_usage_metrics(OLD.image_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_global_image_gallery_usage_metrics(NEW.image_id);

  IF TG_OP = 'UPDATE' AND OLD.image_id IS DISTINCT FROM NEW.image_id THEN
    PERFORM public.refresh_global_image_gallery_usage_metrics(OLD.image_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_global_image_gallery_usage_metrics
  ON public.image_tenant_usage;
CREATE TRIGGER sync_global_image_gallery_usage_metrics
  AFTER INSERT OR UPDATE OR DELETE ON public.image_tenant_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_global_image_gallery_usage_metrics();

UPDATE public.global_image_gallery gig
SET usage_count = 0
WHERE gig.usage_count IS NULL;

DO $$
DECLARE
  image_record RECORD;
BEGIN
  FOR image_record IN
    SELECT id FROM public.global_image_gallery
  LOOP
    PERFORM public.refresh_global_image_gallery_usage_metrics(image_record.id);
  END LOOP;
END $$;

-- ============================================================
-- 5. Updated usage tracking + tenant-scoped tag search
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_global_image_usage(
  p_image_id UUID,
  p_tenant_id UUID,
  p_user_id UUID,
  p_usage_context TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_block_id UUID DEFAULT NULL,
  p_content_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_content_id IS NOT NULL THEN
    INSERT INTO public.image_tenant_usage (
      image_id,
      tenant_id,
      user_id,
      usage_context,
      campaign_id,
      block_id,
      content_id,
      usage_count,
      first_used_at,
      last_used_at,
      updated_at
    )
    VALUES (
      p_image_id,
      p_tenant_id,
      p_user_id,
      p_usage_context,
      p_campaign_id,
      p_block_id,
      p_content_id,
      1,
      now(),
      now(),
      now()
    )
    ON CONFLICT (image_id, tenant_id, content_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      usage_context = EXCLUDED.usage_context,
      campaign_id = COALESCE(EXCLUDED.campaign_id, image_tenant_usage.campaign_id),
      block_id = COALESCE(EXCLUDED.block_id, image_tenant_usage.block_id),
      usage_count = image_tenant_usage.usage_count + 1,
      last_used_at = now(),
      updated_at = now();

    RETURN;
  END IF;

  IF p_block_id IS NOT NULL THEN
    INSERT INTO public.image_tenant_usage (
      image_id,
      tenant_id,
      user_id,
      usage_context,
      campaign_id,
      block_id,
      content_id,
      usage_count,
      first_used_at,
      last_used_at,
      updated_at
    )
    VALUES (
      p_image_id,
      p_tenant_id,
      p_user_id,
      p_usage_context,
      p_campaign_id,
      p_block_id,
      NULL,
      1,
      now(),
      now(),
      now()
    )
    ON CONFLICT (image_id, tenant_id, block_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      usage_context = EXCLUDED.usage_context,
      campaign_id = COALESCE(EXCLUDED.campaign_id, image_tenant_usage.campaign_id),
      usage_count = image_tenant_usage.usage_count + 1,
      last_used_at = now(),
      updated_at = now();

    RETURN;
  END IF;

  INSERT INTO public.image_tenant_usage (
    image_id,
    tenant_id,
    user_id,
    usage_context,
    campaign_id,
    block_id,
    content_id,
    usage_count,
    first_used_at,
    last_used_at,
    updated_at
  )
  VALUES (
    p_image_id,
    p_tenant_id,
    p_user_id,
    p_usage_context,
    p_campaign_id,
    p_block_id,
    p_content_id,
    1,
    now(),
    now(),
    now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.find_images_by_tags(
  p_tags TEXT[],
  p_channel TEXT DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0.7,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  image_id UUID,
  public_url TEXT,
  storage_path TEXT,
  match_count INTEGER,
  matched_tags TEXT[],
  total_usage_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gi.id AS image_id,
    gi.public_url,
    gi.storage_path,
    COUNT(DISTINCT git.tag_name)::INTEGER AS match_count,
    ARRAY_AGG(DISTINCT git.tag_name) AS matched_tags,
    gi.total_usage_count
  FROM public.global_image_gallery gi
  INNER JOIN public.global_image_tags git
    ON gi.id = git.image_id
  WHERE git.tag_name = ANY(p_tags)
    AND git.confidence_score >= p_min_confidence
    AND gi.is_active = true
    AND (p_channel IS NULL OR gi.channel = p_channel)
    AND (
      auth.jwt() ->> 'role' = 'service_role'
      OR gi.tenant_id = (
        SELECT u.tenant_id
        FROM public.users u
        WHERE u.id = auth.uid()
        LIMIT 1
      )
    )
  GROUP BY gi.id, gi.public_url, gi.storage_path, gi.total_usage_count, gi.created_at
  ORDER BY
    match_count DESC,
    gi.total_usage_count DESC,
    gi.created_at DESC
  LIMIT p_limit;
END;
$$;