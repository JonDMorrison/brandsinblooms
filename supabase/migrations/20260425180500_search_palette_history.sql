CREATE TABLE IF NOT EXISTS public.user_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  normalized_query TEXT NOT NULL,
  query TEXT NOT NULL,
  selected_result_title TEXT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_search_history_unique_query UNIQUE (tenant_id, user_id, normalized_query)
);

CREATE TABLE IF NOT EXISTS public.user_recent_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  route TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  icon TEXT NULL,
  category_icon TEXT NOT NULL,
  metadata TEXT NULL,
  group_key TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  visit_count INTEGER NOT NULL DEFAULT 1,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_recent_items_unique_entity UNIQUE (tenant_id, user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS user_search_history_recent_idx
  ON public.user_search_history (tenant_id, user_id, searched_at DESC);

CREATE INDEX IF NOT EXISTS user_recent_items_recent_idx
  ON public.user_recent_items (tenant_id, user_id, visited_at DESC);

ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recent_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own search history" ON public.user_search_history;
CREATE POLICY "Users manage their own search history"
  ON public.user_search_history
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = user_search_history.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = user_search_history.tenant_id
    )
  );

DROP POLICY IF EXISTS "Users manage their own recent items" ON public.user_recent_items;
CREATE POLICY "Users manage their own recent items"
  ON public.user_recent_items
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = user_recent_items.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = user_recent_items.tenant_id
    )
  );

DROP FUNCTION IF EXISTS public.get_user_recent_searches(INTEGER);
CREATE OR REPLACE FUNCTION public.get_user_recent_searches(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  normalized_query TEXT,
  query TEXT,
  selected_result_title TEXT,
  searched_at TIMESTAMPTZ,
  usage_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    ush.normalized_query,
    ush.query,
    ush.selected_result_title,
    ush.searched_at,
    ush.usage_count
  FROM public.user_search_history ush
  WHERE ush.user_id = auth.uid()
  ORDER BY ush.searched_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 10)
$$;

DROP FUNCTION IF EXISTS public.get_user_recent_items(INTEGER);
CREATE OR REPLACE FUNCTION public.get_user_recent_items(p_limit INTEGER DEFAULT 8)
RETURNS TABLE (
  entity_type TEXT,
  entity_id TEXT,
  route TEXT,
  title TEXT,
  subtitle TEXT,
  icon TEXT,
  category_icon TEXT,
  metadata TEXT,
  group_key TEXT,
  keywords TEXT[],
  visited_at TIMESTAMPTZ,
  visit_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    recent.entity_type,
    recent.entity_id,
    recent.route,
    recent.title,
    recent.subtitle,
    recent.icon,
    recent.category_icon,
    recent.metadata,
    recent.group_key,
    recent.keywords,
    recent.visited_at,
    recent.visit_count
  FROM (
    SELECT DISTINCT ON (uri.entity_type, uri.entity_id)
      uri.entity_type,
      uri.entity_id,
      uri.route,
      uri.title,
      uri.subtitle,
      uri.icon,
      uri.category_icon,
      uri.metadata,
      uri.group_key,
      uri.keywords,
      uri.visited_at,
      uri.visit_count
    FROM public.user_recent_items uri
    WHERE uri.user_id = auth.uid()
    ORDER BY uri.entity_type, uri.entity_id, uri.visited_at DESC
  ) recent
  ORDER BY recent.visited_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 8)
$$;

DROP FUNCTION IF EXISTS public.upsert_user_recent_search(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.upsert_user_recent_search(
  p_query TEXT,
  p_selected_result_title TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_trimmed_query TEXT := NULLIF(BTRIM(p_query), '');
  v_normalized_query TEXT;
  v_selected_result_title TEXT := NULLIF(BTRIM(p_selected_result_title), '');
BEGIN
  IF v_user_id IS NULL OR v_trimmed_query IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_tenant_id
  FROM public.users u
  WHERE u.id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_normalized_query := LOWER(REGEXP_REPLACE(v_trimmed_query, '\s+', ' ', 'g'));

  INSERT INTO public.user_search_history (
    tenant_id,
    user_id,
    normalized_query,
    query,
    selected_result_title,
    usage_count,
    searched_at,
    updated_at
  )
  VALUES (
    v_tenant_id,
    v_user_id,
    v_normalized_query,
    v_trimmed_query,
    v_selected_result_title,
    1,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (tenant_id, user_id, normalized_query)
  DO UPDATE SET
    query = EXCLUDED.query,
    selected_result_title = COALESCE(
      EXCLUDED.selected_result_title,
      public.user_search_history.selected_result_title
    ),
    usage_count = public.user_search_history.usage_count + 1,
    searched_at = timezone('utc', now()),
    updated_at = timezone('utc', now());
END;
$$;

DROP FUNCTION IF EXISTS public.delete_user_recent_search(TEXT);
CREATE OR REPLACE FUNCTION public.delete_user_recent_search(p_normalized_query TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.user_search_history
  WHERE user_id = auth.uid()
    AND normalized_query = LOWER(
      REGEXP_REPLACE(
        COALESCE(NULLIF(BTRIM(p_normalized_query), ''), ''),
        '\s+',
        ' ',
        'g'
      )
    )
$$;

DROP FUNCTION IF EXISTS public.clear_user_recent_searches();
CREATE OR REPLACE FUNCTION public.clear_user_recent_searches()
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.user_search_history
  WHERE user_id = auth.uid()
$$;

DROP FUNCTION IF EXISTS public.upsert_user_recent_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]);
CREATE OR REPLACE FUNCTION public.upsert_user_recent_item(
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_route TEXT,
  p_title TEXT,
  p_subtitle TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_category_icon TEXT DEFAULT NULL,
  p_metadata TEXT DEFAULT NULL,
  p_group_key TEXT DEFAULT NULL,
  p_keywords TEXT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_entity_type TEXT := NULLIF(BTRIM(p_entity_type), '');
  v_entity_id TEXT := NULLIF(BTRIM(p_entity_id), '');
  v_route TEXT := NULLIF(BTRIM(p_route), '');
  v_title TEXT := NULLIF(BTRIM(p_title), '');
  v_category_icon TEXT := NULLIF(BTRIM(p_category_icon), '');
  v_group_key TEXT := NULLIF(BTRIM(p_group_key), '');
BEGIN
  IF v_user_id IS NULL
    OR v_entity_type IS NULL
    OR v_entity_id IS NULL
    OR v_route IS NULL
    OR v_title IS NULL
    OR v_category_icon IS NULL
    OR v_group_key IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_tenant_id
  FROM public.users u
  WHERE u.id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_recent_items (
    tenant_id,
    user_id,
    entity_type,
    entity_id,
    route,
    title,
    subtitle,
    icon,
    category_icon,
    metadata,
    group_key,
    keywords,
    visit_count,
    visited_at,
    updated_at
  )
  VALUES (
    v_tenant_id,
    v_user_id,
    v_entity_type,
    v_entity_id,
    v_route,
    v_title,
    NULLIF(BTRIM(p_subtitle), ''),
    NULLIF(BTRIM(p_icon), ''),
    v_category_icon,
    NULLIF(BTRIM(p_metadata), ''),
    v_group_key,
    COALESCE(p_keywords, ARRAY[]::TEXT[]),
    1,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (tenant_id, user_id, entity_type, entity_id)
  DO UPDATE SET
    route = EXCLUDED.route,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    icon = EXCLUDED.icon,
    category_icon = EXCLUDED.category_icon,
    metadata = EXCLUDED.metadata,
    group_key = EXCLUDED.group_key,
    keywords = EXCLUDED.keywords,
    visit_count = public.user_recent_items.visit_count + 1,
    visited_at = timezone('utc', now()),
    updated_at = timezone('utc', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_recent_searches(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_recent_items(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_recent_search(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_recent_search(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_user_recent_searches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_recent_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;