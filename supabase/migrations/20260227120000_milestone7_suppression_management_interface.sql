ALTER TABLE public.email_governance_tenant_control_state
  ADD COLUMN IF NOT EXISTS suppression_bypass_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppression_bypass_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppression_bypass_reason TEXT,
  ADD COLUMN IF NOT EXISTS suppression_bypass_automation_mode TEXT NOT NULL DEFAULT 'campaign_only';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_suppression_bypass_mode_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_suppression_bypass_mode_check
      CHECK (suppression_bypass_automation_mode IN ('campaign_only', 'campaign_and_automation'));
  END IF;
END;
$$;

-- Normalize suppression_list.email for deterministic matching in canSendEmail.
UPDATE public.suppression_list
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

CREATE OR REPLACE FUNCTION public.normalize_suppression_list_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(btrim(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_suppression_list_email_trigger ON public.suppression_list;
CREATE TRIGGER normalize_suppression_list_email_trigger
  BEFORE INSERT OR UPDATE ON public.suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_suppression_list_email();

CREATE INDEX IF NOT EXISTS idx_suppression_list_admin_active_reason
  ON public.suppression_list (tenant_id, channel, suppression_type, suppressed_at DESC)
  WHERE lifted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppression_list_admin_email_lookup
  ON public.suppression_list (tenant_id, lower(email), suppressed_at DESC)
  WHERE lifted_at IS NULL;

CREATE OR REPLACE FUNCTION public.admin_get_tenant_suppression_controls(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_row RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT
    COALESCE(s.suppression_bypass_enabled, false) AS suppression_bypass_enabled,
    s.suppression_bypass_until,
    s.suppression_bypass_reason,
    COALESCE(s.suppression_bypass_automation_mode, 'campaign_only') AS suppression_bypass_automation_mode
  INTO v_row
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'suppression_bypass_enabled', COALESCE(v_row.suppression_bypass_enabled, false),
    'suppression_bypass_until', v_row.suppression_bypass_until,
    'suppression_bypass_reason', v_row.suppression_bypass_reason,
    'suppression_bypass_automation_mode', COALESCE(v_row.suppression_bypass_automation_mode, 'campaign_only'),
    'suppression_bypass_active', (
      COALESCE(v_row.suppression_bypass_enabled, false)
      AND (v_row.suppression_bypass_until IS NULL OR v_row.suppression_bypass_until > v_now)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_suppression_bypass_state(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT
    COALESCE(s.suppression_bypass_enabled, false) AS suppression_bypass_enabled,
    s.suppression_bypass_until,
    s.suppression_bypass_reason,
    COALESCE(s.suppression_bypass_automation_mode, 'campaign_only') AS suppression_bypass_automation_mode
  INTO v_row
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'suppression_bypass_enabled', COALESCE(v_row.suppression_bypass_enabled, false),
    'suppression_bypass_until', v_row.suppression_bypass_until,
    'suppression_bypass_reason', v_row.suppression_bypass_reason,
    'suppression_bypass_automation_mode', COALESCE(v_row.suppression_bypass_automation_mode, 'campaign_only'),
    'suppression_bypass_active', (
      COALESCE(v_row.suppression_bypass_enabled, false)
      AND (v_row.suppression_bypass_until IS NULL OR v_row.suppression_bypass_until > v_now)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_suppression_bypass(
  p_tenant_id UUID,
  p_enabled BOOLEAN,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_automation_mode TEXT DEFAULT 'campaign_only'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_mode TEXT := COALESCE(NULLIF(btrim(p_automation_mode), ''), 'campaign_only');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF v_mode NOT IN ('campaign_only', 'campaign_and_automation') THEN
    RAISE EXCEPTION 'Invalid p_automation_mode. Must be campaign_only or campaign_and_automation';
  END IF;

  IF COALESCE(p_enabled, false) = false THEN
    p_until := NULL;
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    suppression_bypass_enabled,
    suppression_bypass_until,
    suppression_bypass_reason,
    suppression_bypass_automation_mode,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_enabled, false),
    p_until,
    NULLIF(btrim(p_reason), ''),
    v_mode,
    v_now,
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), 'admin_set_tenant_suppression_bypass')
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    suppression_bypass_enabled = EXCLUDED.suppression_bypass_enabled,
    suppression_bypass_until = EXCLUDED.suppression_bypass_until,
    suppression_bypass_reason = EXCLUDED.suppression_bypass_reason,
    suppression_bypass_automation_mode = EXCLUDED.suppression_bypass_automation_mode,
    updated_at = v_now,
    updated_by = v_actor,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_bypass_updated',
    jsonb_build_object(
      'enabled', COALESCE(p_enabled, false),
      'until', p_until,
      'automation_mode', v_mode,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_bypass_update')
    )
  );

  RETURN public.admin_get_tenant_suppression_controls(p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_tenant_suppressions(
  p_tenant_id UUID,
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
  v_reason TEXT := lower(COALESCE(NULLIF(btrim(p_reason_filter), ''), 'all'));
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH filtered AS (
    SELECT s.*
    FROM public.suppression_list s
    WHERE s.tenant_id = p_tenant_id
      AND s.channel IN ('email', 'all')
      AND s.lifted_at IS NULL
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR s.email ILIKE '%' || btrim(p_search) || '%'
      )
      AND (
        v_reason = 'all'
        OR (
          v_reason = 'bounce'
          AND s.suppression_type IN ('bounced', 'hard_bounce')
        )
        OR (
          v_reason = 'complaint'
          AND s.suppression_type IN ('complaint', 'complained')
        )
        OR (
          v_reason = 'unsubscribe'
          AND s.suppression_type IN ('unsubscribed')
        )
      )
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM filtered;

  WITH filtered AS (
    SELECT s.*
    FROM public.suppression_list s
    WHERE s.tenant_id = p_tenant_id
      AND s.channel IN ('email', 'all')
      AND s.lifted_at IS NULL
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR s.email ILIKE '%' || btrim(p_search) || '%'
      )
      AND (
        v_reason = 'all'
        OR (
          v_reason = 'bounce'
          AND s.suppression_type IN ('bounced', 'hard_bounce')
        )
        OR (
          v_reason = 'complaint'
          AND s.suppression_type IN ('complaint', 'complained')
        )
        OR (
          v_reason = 'unsubscribe'
          AND s.suppression_type IN ('unsubscribed')
        )
      )
    ORDER BY s.suppressed_at DESC
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

CREATE OR REPLACE FUNCTION public.admin_add_tenant_suppression(
  p_tenant_id UUID,
  p_email TEXT,
  p_suppression_type TEXT,
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
  v_type TEXT := lower(btrim(COALESCE(p_suppression_type, '')));
  v_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'p_email is required';
  END IF;

  IF v_type NOT IN ('unsubscribed', 'bounced', 'hard_bounce', 'complaint', 'complained') THEN
    RAISE EXCEPTION 'Invalid p_suppression_type';
  END IF;

  INSERT INTO public.suppression_list (
    tenant_id,
    email,
    suppression_type,
    channel,
    reason,
    auto_suppressed,
    expires_at,
    suppressed_at,
    lifted_at,
    lifted_by
  ) VALUES (
    p_tenant_id,
    v_email,
    v_type,
    'email',
    NULLIF(btrim(p_reason), ''),
    false,
    p_expires_at,
    now(),
    NULL,
    NULL
  )
  ON CONFLICT (tenant_id, email, channel, suppression_type)
  DO UPDATE SET
    reason = EXCLUDED.reason,
    auto_suppressed = false,
    expires_at = EXCLUDED.expires_at,
    suppressed_at = now(),
    lifted_at = NULL,
    lifted_by = NULL,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.email_governance_suppression_events (
    tenant_id,
    email,
    channel,
    suppression_type,
    reason,
    source,
    is_active,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    v_email,
    'email',
    v_type,
    NULLIF(btrim(p_reason), ''),
    'admin',
    true,
    jsonb_build_object('admin_user_id', v_actor),
    now()
  );

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_added',
    jsonb_build_object(
      'suppression_id', v_id,
      'email', v_email,
      'suppression_type', v_type,
      'expires_at', p_expires_at,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_add')
    )
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'email', v_email,
    'suppression_type', v_type,
    'expires_at', p_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_lift_tenant_suppression(
  p_tenant_id UUID,
  p_suppression_id UUID,
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

  IF p_tenant_id IS NULL OR p_suppression_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id and p_suppression_id are required';
  END IF;

  UPDATE public.suppression_list s
  SET
    lifted_at = now(),
    lifted_by = v_actor,
    updated_at = now()
  WHERE s.tenant_id = p_tenant_id
    AND s.id = p_suppression_id
    AND s.lifted_at IS NULL
  RETURNING s.id, s.email, s.suppression_type INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('updated_count', 0);
  END IF;

  INSERT INTO public.email_governance_suppression_events (
    tenant_id,
    email,
    channel,
    suppression_type,
    reason,
    source,
    is_active,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    v_row.email,
    'email',
    v_row.suppression_type,
    NULLIF(btrim(p_reason), ''),
    'admin',
    false,
    jsonb_build_object('admin_user_id', v_actor, 'lifted_from_suppression_id', v_row.id),
    now()
  );

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_lifted',
    jsonb_build_object(
      'suppression_id', v_row.id,
      'email', v_row.email,
      'suppression_type', v_row.suppression_type,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_lift')
    )
  );

  RETURN jsonb_build_object('updated_count', 1, 'id', v_row.id, 'email', v_row.email);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_lift_tenant_suppressions(
  p_tenant_id UUID,
  p_suppression_ids UUID[],
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

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH target_ids AS (
    SELECT UNNEST(COALESCE(p_suppression_ids, ARRAY[]::UUID[])) AS id
  ), updated AS (
    UPDATE public.suppression_list s
    SET
      lifted_at = now(),
      lifted_by = v_actor,
      updated_at = now()
    WHERE s.tenant_id = p_tenant_id
      AND s.lifted_at IS NULL
      AND s.id IN (SELECT id FROM target_ids)
    RETURNING s.id, s.email, s.suppression_type
  )
  SELECT COUNT(*)::INTEGER INTO v_updated_count FROM updated;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_bulk_lifted',
    jsonb_build_object(
      'updated_count', COALESCE(v_updated_count, 0),
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_bulk_lift')
    )
  );

  RETURN jsonb_build_object('updated_count', COALESCE(v_updated_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_tenant_suppression_history(
  p_tenant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_deleted_current INTEGER := 0;
  v_deleted_history INTEGER := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH deleted_current AS (
    DELETE FROM public.suppression_list
    WHERE tenant_id = p_tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_current FROM deleted_current;

  WITH deleted_history AS (
    DELETE FROM public.email_governance_suppression_events
    WHERE tenant_id = p_tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_history FROM deleted_history;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_history_cleared',
    jsonb_build_object(
      'deleted_suppression_list_rows', COALESCE(v_deleted_current, 0),
      'deleted_suppression_event_rows', COALESCE(v_deleted_history, 0),
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_history_clear')
    )
  );

  RETURN jsonb_build_object(
    'deleted_suppression_list_rows', COALESCE(v_deleted_current, 0),
    'deleted_suppression_event_rows', COALESCE(v_deleted_history, 0)
  );
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.admin_get_tenant_suppression_controls(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_suppression_bypass_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_suppression_bypass(UUID, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_tenant_suppressions(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_tenant_suppression(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lift_tenant_suppression(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_lift_tenant_suppressions(UUID, UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_suppression_history(UUID, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_global_email_suppressions(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_global_email_suppression(TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lift_global_email_suppression(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_lift_global_email_suppressions(UUID[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
