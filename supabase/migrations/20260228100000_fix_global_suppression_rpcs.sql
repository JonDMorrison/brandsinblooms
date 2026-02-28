-- Forward-only repair migration: ensure global suppression objects exist.
--
-- Why: the remote DB can be missing the RPCs even when earlier migration versions are
-- marked as applied (e.g., if an old migration was edited after apply, or applied in a
-- different environment). This migration safely reintroduces the expected table + RPCs.

-- 1) Global suppression table (idempotent)
CREATE TABLE IF NOT EXISTS public.global_email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  suppression_type TEXT NOT NULL DEFAULT 'global_block',
  reason TEXT,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT global_email_suppression_list_email_normalized
    CHECK (email = lower(btrim(email)))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_email_suppression_unique_active
  ON public.global_email_suppression_list (lower(email), suppression_type)
  WHERE lifted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_global_email_suppression_active_email
  ON public.global_email_suppression_list (lower(email), suppressed_at DESC)
  WHERE lifted_at IS NULL;

ALTER TABLE public.global_email_suppression_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master admins can view global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can view global email suppression"
  ON public.global_email_suppression_list FOR SELECT
  USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can insert global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can insert global email suppression"
  ON public.global_email_suppression_list FOR INSERT
  WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can update global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can update global email suppression"
  ON public.global_email_suppression_list FOR UPDATE
  USING (public.is_master_admin(auth.uid()))
  WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can delete global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can delete global email suppression"
  ON public.global_email_suppression_list FOR DELETE
  USING (public.is_master_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_global_email_suppression_list_updated_at ON public.global_email_suppression_list;
CREATE TRIGGER update_global_email_suppression_list_updated_at
  BEFORE UPDATE ON public.global_email_suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) RPCs used by the Super Admin governance page
CREATE OR REPLACE FUNCTION public.admin_list_global_email_suppressions(
  p_search TEXT DEFAULT NULL,
  p_reason_filter TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_offset INTEGER := GREATEST(COALESCE(p_page, 0), 0) * GREATEST(COALESCE(p_page_size, 50), 1);
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
  v_count INTEGER := 0;
  v_data JSONB := '[]'::jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  WITH filtered AS (
    SELECT g.*
    FROM public.global_email_suppression_list g
    WHERE g.lifted_at IS NULL
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR g.email ILIKE '%' || btrim(p_search) || '%'
      )
      AND (
        p_reason_filter IS NULL
        OR btrim(p_reason_filter) = ''
        OR lower(COALESCE(g.reason, '')) ILIKE '%' || lower(btrim(p_reason_filter)) || '%'
      )
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM filtered;

  WITH filtered AS (
    SELECT g.*
    FROM public.global_email_suppression_list g
    WHERE g.lifted_at IS NULL
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR g.email ILIKE '%' || btrim(p_search) || '%'
      )
      AND (
        p_reason_filter IS NULL
        OR btrim(p_reason_filter) = ''
        OR lower(COALESCE(g.reason, '')) ILIKE '%' || lower(btrim(p_reason_filter)) || '%'
      )
    ORDER BY g.suppressed_at DESC
    OFFSET v_offset
    LIMIT v_limit
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(filtered)), '[]'::jsonb)
  INTO v_data
  FROM filtered;

  RETURN jsonb_build_object(
    'data', v_data,
    'count', v_count,
    'page', GREATEST(COALESCE(p_page, 0), 0),
    'page_size', v_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_global_email_suppression(
  p_email TEXT,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'p_email is required';
  END IF;

  INSERT INTO public.global_email_suppression_list (
    email,
    suppression_type,
    reason,
    source,
    expires_at,
    suppressed_at,
    lifted_at,
    metadata
  ) VALUES (
    v_email,
    'global_block',
    NULLIF(btrim(p_reason), ''),
    'admin',
    p_expires_at,
    now(),
    NULL,
    jsonb_build_object('admin_user_id', v_actor)
  )
  ON CONFLICT (lower(email), suppression_type)
  WHERE lifted_at IS NULL
  DO UPDATE SET
    reason = EXCLUDED.reason,
    expires_at = EXCLUDED.expires_at,
    source = 'admin',
    metadata = EXCLUDED.metadata,
    suppressed_at = now(),
    lifted_at = NULL,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    NULL,
    'global_suppression_added',
    jsonb_build_object(
      'id', v_id,
      'email', v_email,
      'expires_at', p_expires_at,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_global_suppression_add')
    )
  );

  RETURN jsonb_build_object('id', v_id, 'email', v_email, 'expires_at', p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_lift_global_email_suppression(
  p_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_row RECORD;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'p_id is required';
  END IF;

  UPDATE public.global_email_suppression_list g
  SET
    lifted_at = now(),
    updated_at = now(),
    metadata = COALESCE(g.metadata, '{}'::jsonb) || jsonb_build_object('lifted_by_admin_user_id', v_actor)
  WHERE g.id = p_id
    AND g.lifted_at IS NULL
  RETURNING g.id, g.email INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('updated_count', 0);
  END IF;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    NULL,
    'global_suppression_lifted',
    jsonb_build_object(
      'id', v_row.id,
      'email', v_row.email,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_global_suppression_lift')
    )
  );

  RETURN jsonb_build_object('updated_count', 1, 'id', v_row.id, 'email', v_row.email);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_lift_global_email_suppressions(
  p_ids UUID[],
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_updated_count INTEGER := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  WITH target_ids AS (
    SELECT UNNEST(COALESCE(p_ids, ARRAY[]::UUID[])) AS id
  ), updated AS (
    UPDATE public.global_email_suppression_list g
    SET
      lifted_at = now(),
      updated_at = now(),
      metadata = COALESCE(g.metadata, '{}'::jsonb) || jsonb_build_object('lifted_by_admin_user_id', v_actor)
    WHERE g.lifted_at IS NULL
      AND g.id IN (SELECT id FROM target_ids)
    RETURNING g.id
  )
  SELECT COUNT(*)::INTEGER INTO v_updated_count FROM updated;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    NULL,
    'global_suppression_bulk_lifted',
    jsonb_build_object(
      'updated_count', COALESCE(v_updated_count, 0),
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_global_suppression_bulk_lift')
    )
  );

  RETURN jsonb_build_object('updated_count', COALESCE(v_updated_count, 0));
END;
$$;

-- 3) Grants and schema reload
GRANT EXECUTE ON FUNCTION public.admin_list_global_email_suppressions(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_global_email_suppression(TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lift_global_email_suppression(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_lift_global_email_suppressions(UUID[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
