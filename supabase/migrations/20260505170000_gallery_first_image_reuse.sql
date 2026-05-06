-- Add tenant-scoped, confidence-weighted gallery search for image reuse.

DROP FUNCTION IF EXISTS public.find_images_by_tags(TEXT[], TEXT, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS public.find_images_by_tags(TEXT[], UUID, TEXT, NUMERIC, INTEGER);

CREATE OR REPLACE FUNCTION public.find_images_by_tags(
  p_tags TEXT[],
  p_tenant_id UUID DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0.7,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  image_id UUID,
  public_url TEXT,
  storage_path TEXT,
  match_count INTEGER,
  matched_tags TEXT[],
  matched_confidence_total DOUBLE PRECISION,
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
    ARRAY_AGG(DISTINCT git.tag_name ORDER BY git.tag_name) AS matched_tags,
    COALESCE(SUM(git.confidence_score), 0)::DOUBLE PRECISION AS matched_confidence_total,
    COALESCE(gi.total_usage_count, 0)::INTEGER AS total_usage_count
  FROM public.global_image_gallery gi
  INNER JOIN public.global_image_tags git
    ON gi.id = git.image_id
  WHERE git.tag_name = ANY(p_tags)
    AND git.confidence_score >= p_min_confidence
    AND gi.is_active = true
    AND (p_tenant_id IS NULL OR gi.tenant_id = p_tenant_id)
    AND (p_channel IS NULL OR gi.channel = p_channel)
    AND (
      auth.jwt() ->> 'role' = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = gi.tenant_id
          AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
      )
    )
  GROUP BY
    gi.id,
    gi.public_url,
    gi.storage_path,
    gi.total_usage_count,
    gi.created_at
  ORDER BY
    matched_confidence_total DESC,
    match_count DESC,
    gi.created_at DESC,
    COALESCE(gi.total_usage_count, 0) DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 5);
END;
$$;