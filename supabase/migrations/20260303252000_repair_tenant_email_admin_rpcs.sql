-- Repair migration: recreate missing admin RPCs used by the Tenant Email Management admin page
-- Generated from existing milestone migrations to ensure canonical behavior.

BEGIN;

-- Source: supabase/migrations/20260227120000_milestone7_suppression_management_interface.sql
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

GRANT EXECUTE ON FUNCTION public.admin_bulk_lift_tenant_suppressions(UUID, UUID[], TEXT) TO authenticated;

-- Source: supabase/migrations/20260227235500_milestone2_reputation_scheduling_and_silent_overrides.sql
CREATE OR REPLACE FUNCTION public.admin_clear_tenant_reputation_override(
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
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_override_cleared');
  v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    manual_reputation_score,
    reputation_override_mode,
    reputation_override_expires_at,
    reputation_override_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    manual_reputation_score = NULL,
    reputation_override_mode = NULL,
    reputation_override_expires_at = NULL,
    reputation_override_reason = NULL,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  v_result := public.refresh_email_governance_tenant_reputation_score(p_tenant_id, now());

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_reputation_override_cleared',
    jsonb_build_object('reason', v_reason)
  );

  RETURN jsonb_build_object(
    'override_cleared', true,
    'reason', v_reason,
    'score_result', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_reputation_override(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226162000_milestone4_tenant_email_management_control_panel.sql
CREATE OR REPLACE FUNCTION public.admin_clear_tenant_suppression_list(
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
  v_deleted_count INTEGER := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH deleted AS (
    DELETE FROM public.suppression_list
    WHERE tenant_id = p_tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count FROM deleted;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_list_cleared',
    jsonb_build_object(
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_clear'),
      'deleted_count', COALESCE(v_deleted_count, 0)
    )
  );

  RETURN jsonb_build_object('deleted_count', COALESCE(v_deleted_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_suppression_list(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227103000_milestone6_unlimited_custom_sending_limit_control.sql
CREATE OR REPLACE FUNCTION public.admin_clear_tenant_temporary_boost(
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
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_temporary_boost_cleared');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    boost_until,
    boost_monthly,
    boost_daily,
    boost_hourly,
    boost_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    boost_until = NULL,
    boost_monthly = NULL,
    boost_daily = NULL,
    boost_hourly = NULL,
    boost_reason = NULL,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_temporary_boost_cleared',
    jsonb_build_object('reason', v_reason)
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'boost_cleared', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_temporary_boost(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226200000_milestone5_reputation_override_reset_engine.sql
CREATE OR REPLACE FUNCTION public.admin_disable_tenant_reputation_penalties(
  p_tenant_id UUID,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_penalties_disabled');
  v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_until IS NOT NULL AND p_until <= now() THEN
    RAISE EXCEPTION 'p_until must be in the future';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    penalties_disabled_until,
    penalties_disabled_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    p_until,
    v_reason,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    penalties_disabled_until = EXCLUDED.penalties_disabled_until,
    penalties_disabled_reason = EXCLUDED.penalties_disabled_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  v_result := public.refresh_email_governance_tenant_reputation_score(p_tenant_id, now());

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_reputation_penalties_disabled',
    jsonb_build_object(
      'disabled_until', p_until,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'penalties_disabled_until', p_until,
    'reason', v_reason,
    'score_result', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_disable_tenant_reputation_penalties(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226200000_milestone5_reputation_override_reset_engine.sql
CREATE OR REPLACE FUNCTION public.admin_enable_tenant_reputation_penalties(
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
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_penalties_enabled');
  v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    penalties_disabled_until,
    penalties_disabled_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    now(),
    NULL,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    penalties_disabled_until = now(),
    penalties_disabled_reason = NULL,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  v_result := public.refresh_email_governance_tenant_reputation_score(p_tenant_id, now());

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_reputation_penalties_enabled',
    jsonb_build_object(
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'penalties_disabled_until', now(),
    'reason', v_reason,
    'score_result', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enable_tenant_reputation_penalties(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227153000_milestone8_campaign_admin_intervention_controls.sql
CREATE OR REPLACE FUNCTION public.admin_force_stop_campaign(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_jobs_paused INTEGER := 0;
  v_messages_paused INTEGER := 0;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_force_stop');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    true,
    true,
    COALESCE((SELECT autopause_override_enabled FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), false),
    COALESCE((SELECT autopause_override_precedence FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), 'automation_allowed'),
    v_reason
  );

  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('scheduled', 'sending', 'paused', 'queued', 'partially_queued');

  WITH paused_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    RETURNING 1
  ), paused_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending')
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM paused_jobs),
    (SELECT COUNT(*)::INTEGER FROM paused_messages)
  INTO v_jobs_paused, v_messages_paused;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_force_stopped',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_reason,
      'jobs_paused', COALESCE(v_jobs_paused, 0),
      'messages_paused', COALESCE(v_messages_paused, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'jobs_paused', COALESCE(v_jobs_paused, 0),
    'messages_paused', COALESCE(v_messages_paused, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_stop_campaign(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226162000_milestone4_tenant_email_management_control_panel.sql
CREATE OR REPLACE FUNCTION public.admin_forgive_tenant_bounce_history(
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
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    forgive_bounce_before,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    v_now,
    v_now,
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), 'forgive_bounce_history')
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    forgive_bounce_before = EXCLUDED.forgive_bounce_before,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  PERFORM public.refresh_email_governance_tenant_reputation_score(p_tenant_id, v_now);

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_bounce_history_forgiven',
    jsonb_build_object(
      'forgive_before', v_now,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'forgive_bounce_history')
    )
  );

  RETURN jsonb_build_object('forgive_bounce_before', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_forgive_tenant_bounce_history(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226162000_milestone4_tenant_email_management_control_panel.sql
CREATE OR REPLACE FUNCTION public.admin_forgive_tenant_complaint_history(
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
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    forgive_complaint_before,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    v_now,
    v_now,
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), 'forgive_complaint_history')
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    forgive_complaint_before = EXCLUDED.forgive_complaint_before,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  PERFORM public.refresh_email_governance_tenant_reputation_score(p_tenant_id, v_now);

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_complaint_history_forgiven',
    jsonb_build_object(
      'forgive_before', v_now,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'forgive_complaint_history')
    )
  );

  RETURN jsonb_build_object('forgive_complaint_before', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_forgive_tenant_complaint_history(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226162000_milestone4_tenant_email_management_control_panel.sql
CREATE OR REPLACE FUNCTION public.admin_freeze_tenant_reputation_score(
  p_tenant_id UUID,
  p_is_frozen BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    is_reputation_frozen,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_is_frozen, false),
    now(),
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_freeze_update')
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    is_reputation_frozen = EXCLUDED.is_reputation_frozen,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_reputation_score_freeze_updated',
    jsonb_build_object(
      'is_frozen', COALESCE(p_is_frozen, false),
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_freeze_update')
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'is_reputation_frozen', COALESCE(p_is_frozen, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_freeze_tenant_reputation_score(UUID, BOOLEAN, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227153000_milestone8_campaign_admin_intervention_controls.sql
CREATE OR REPLACE FUNCTION public.admin_get_tenant_campaign_creation_lock(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'campaign_creation_locked', COALESCE(s.campaign_creation_locked, false),
      'campaign_creation_locked_reason', s.campaign_creation_locked_reason
    )
    FROM (
      SELECT 1
    ) x
    LEFT JOIN public.email_governance_tenant_control_state s
      ON s.tenant_id = p_tenant_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_tenant_campaign_creation_lock(UUID) TO authenticated;

-- Source: supabase/migrations/20260227120000_milestone7_suppression_management_interface.sql
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

GRANT EXECUTE ON FUNCTION public.admin_get_tenant_suppression_controls(UUID) TO authenticated;

-- Source: supabase/migrations/20260227184500_milestone9_automation_precedence_control_system.sql
CREATE OR REPLACE FUNCTION public.admin_get_tenant_under_review_override(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_state RECORD;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  PERFORM public.cleanup_expired_email_governance_overrides('admin_get_under_review_override', p_tenant_id, NULL);

  SELECT *
  INTO v_state
  FROM public.get_tenant_under_review_override_state(p_tenant_id)
  LIMIT 1;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'under_review_override_enabled', COALESCE(v_state.under_review_override_enabled, false),
    'under_review_override_precedence', COALESCE(v_state.under_review_override_precedence, 'automation_allowed'),
    'under_review_override_until', v_state.under_review_override_until,
    'under_review_override_reason', v_state.under_review_override_reason,
    'under_review_override_active', COALESCE(v_state.under_review_override_active, false),
    'under_review_override_final', COALESCE(v_state.under_review_override_final, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_tenant_under_review_override(UUID) TO authenticated;

-- Source: supabase/migrations/20260227153000_milestone8_campaign_admin_intervention_controls.sql
CREATE OR REPLACE FUNCTION public.admin_pause_campaign(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_jobs_paused INTEGER := 0;
  v_messages_paused INTEGER := 0;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_admin_pause');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    true,
    false,
    COALESCE((SELECT autopause_override_enabled FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), false),
    COALESCE((SELECT autopause_override_precedence FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), 'automation_allowed'),
    v_reason
  );

  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('scheduled', 'sending', 'paused', 'queued', 'partially_queued');

  WITH paused_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    RETURNING 1
  ), paused_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending')
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM paused_jobs),
    (SELECT COUNT(*)::INTEGER FROM paused_messages)
  INTO v_jobs_paused, v_messages_paused;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_paused',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_reason,
      'jobs_paused', COALESCE(v_jobs_paused, 0),
      'messages_paused', COALESCE(v_messages_paused, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'jobs_paused', COALESCE(v_jobs_paused, 0),
    'messages_paused', COALESCE(v_messages_paused, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pause_campaign(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226162000_milestone4_tenant_email_management_control_panel.sql
CREATE OR REPLACE FUNCTION public.admin_pause_tenant_email_campaigns(
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
  v_result RECORD;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT * INTO v_result
  FROM public.enforce_tenant_hard_stop(
    p_tenant_id,
    ARRAY['manual_admin_pause'],
    jsonb_build_object(
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_admin_pause')
    ),
    'admin'
  );

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_campaigns_paused',
    jsonb_build_object(
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_admin_pause'),
      'result', row_to_json(v_result)
    )
  );

  RETURN to_jsonb(v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pause_tenant_email_campaigns(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227235900_milestone3_campaign_enforcement_silent_controls.sql
CREATE OR REPLACE FUNCTION public.admin_reset_campaign_restrictions(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_effective_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_restrictions_reset');
  v_jobs_paused INTEGER := 0;
  v_messages_paused INTEGER := 0;
  v_target_status TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  INSERT INTO public.email_governance_campaign_intervention_state (
    campaign_id,
    tenant_id,
    admin_paused,
    force_stopped,
    autopause_override_enabled,
    autopause_override_precedence,
    autopause_override_until,
    autopause_override_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_campaign_id,
    v_tenant_id,
    false,
    false,
    false,
    'automation_allowed',
    NULL,
    NULL,
    now(),
    v_actor,
    v_effective_reason
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    admin_paused = false,
    force_stopped = false,
    autopause_override_enabled = false,
    autopause_override_precedence = 'automation_allowed',
    autopause_override_until = NULL,
    autopause_override_reason = NULL,
    updated_at = now(),
    updated_by = v_actor,
    updated_reason = v_effective_reason;

  UPDATE public.email_governance_campaign_throttle_states s
  SET
    is_throttled = false,
    trigger_reasons = ARRAY[]::TEXT[],
    trigger_details = '{}'::jsonb,
    cleared_at = now(),
    next_claimable_at = NULL,
    last_evaluated_at = now(),
    updated_at = now()
  WHERE s.campaign_id = p_campaign_id;

  INSERT INTO public.email_governance_campaign_throttle_events (
    campaign_id,
    tenant_id,
    event_type,
    source,
    reasons,
    details
  )
  VALUES (
    p_campaign_id,
    v_tenant_id,
    'cleared',
    'admin_reset_campaign_restrictions',
    ARRAY[]::TEXT[],
    jsonb_build_object('reason', v_effective_reason)
  );

  WITH paused_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    RETURNING 1
  ), paused_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending')
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM paused_jobs),
    (SELECT COUNT(*)::INTEGER FROM paused_messages)
  INTO v_jobs_paused, v_messages_paused;

  UPDATE public.crm_campaigns c
  SET
    status = CASE WHEN c.scheduled_at IS NOT NULL THEN 'scheduled' ELSE 'draft' END,
    send_error = NULL,
    send_blocked_reason = NULL,
    claim_token = NULL,
    send_started_at = NULL,
    sending_started_at = NULL,
    updated_at = now()
  WHERE c.id = p_campaign_id
  RETURNING status INTO v_target_status;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_restrictions_reset',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_effective_reason,
      'status', COALESCE(v_target_status, 'draft'),
      'jobs_paused', COALESCE(v_jobs_paused, 0),
      'messages_paused', COALESCE(v_messages_paused, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'status', COALESCE(v_target_status, 'draft'),
    'jobs_paused', COALESCE(v_jobs_paused, 0),
    'messages_paused', COALESCE(v_messages_paused, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_campaign_restrictions(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227153000_milestone8_campaign_admin_intervention_controls.sql
CREATE OR REPLACE FUNCTION public.admin_resume_campaign(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_jobs_resumed INTEGER := 0;
  v_messages_resumed INTEGER := 0;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_admin_resume');
  v_override_enabled BOOLEAN := false;
  v_override_precedence TEXT := 'automation_allowed';
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT
    COALESCE(s.autopause_override_enabled, false),
    COALESCE(s.autopause_override_precedence, 'automation_allowed')
  INTO v_override_enabled, v_override_precedence
  FROM public.email_governance_campaign_intervention_state s
  WHERE s.campaign_id = p_campaign_id;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    false,
    false,
    COALESCE(v_override_enabled, false),
    COALESCE(v_override_precedence, 'automation_allowed'),
    v_reason
  );

  UPDATE public.crm_campaigns c
  SET
    status = 'sending',
    send_started_at = COALESCE(c.send_started_at, now()),
    send_blocked_reason = CASE
      WHEN c.send_blocked_reason = 'paused_by_user' THEN NULL
      ELSE c.send_blocked_reason
    END,
    send_error = CASE
      WHEN c.send_blocked_reason = 'paused_by_user' THEN NULL
      ELSE c.send_error
    END,
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('paused', 'scheduled', 'queued', 'partially_queued', 'sending');

  WITH resumed_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'pending',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id = p_campaign_id
      AND j.status = 'paused'
    RETURNING 1
  ), resumed_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status = 'paused'
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM resumed_jobs),
    (SELECT COUNT(*)::INTEGER FROM resumed_messages)
  INTO v_jobs_resumed, v_messages_resumed;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_resumed',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_reason,
      'jobs_resumed', COALESCE(v_jobs_resumed, 0),
      'messages_resumed', COALESCE(v_messages_resumed, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'jobs_resumed', COALESCE(v_jobs_resumed, 0),
    'messages_resumed', COALESCE(v_messages_resumed, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resume_campaign(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226162000_milestone4_tenant_email_management_control_panel.sql
CREATE OR REPLACE FUNCTION public.admin_resume_tenant_email_campaigns(
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
  v_campaigns_resumed INTEGER := 0;
  v_jobs_resumed INTEGER := 0;
  v_messages_resumed INTEGER := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  UPDATE public.tenants t
  SET
    email_under_review = false,
    email_under_review_at = NULL,
    email_under_review_reason = NULL,
    email_under_review_details = '{}'::jsonb,
    updated_at = now()
  WHERE t.id = p_tenant_id;

  WITH target_campaigns AS (
    SELECT c.id
    FROM public.crm_campaigns c
    WHERE c.tenant_id = p_tenant_id
      AND c.status = 'paused'
      AND c.send_blocked_reason = 'tenant_hard_stop_under_review'
  ), resumed_campaigns AS (
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_blocked_reason = NULL,
      send_error = NULL,
      send_started_at = COALESCE(c.send_started_at, now()),
      updated_at = now()
    WHERE c.id IN (SELECT id FROM target_campaigns)
    RETURNING c.id
  ), resumed_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'pending',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id IN (SELECT id FROM resumed_campaigns)
      AND j.status = 'paused'
    RETURNING j.id
  ), resumed_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id IN (SELECT id FROM resumed_campaigns)
      AND m.status = 'paused'
      AND m.resend_id IS NULL
    RETURNING m.id
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM resumed_campaigns),
    (SELECT COUNT(*)::INTEGER FROM resumed_jobs),
    (SELECT COUNT(*)::INTEGER FROM resumed_messages)
  INTO v_campaigns_resumed, v_jobs_resumed, v_messages_resumed;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_campaigns_resumed',
    jsonb_build_object(
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_admin_resume'),
      'campaigns_resumed', COALESCE(v_campaigns_resumed, 0),
      'jobs_resumed', COALESCE(v_jobs_resumed, 0),
      'messages_resumed', COALESCE(v_messages_resumed, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaigns_resumed', COALESCE(v_campaigns_resumed, 0),
    'jobs_resumed', COALESCE(v_jobs_resumed, 0),
    'messages_resumed', COALESCE(v_messages_resumed, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resume_tenant_email_campaigns(UUID, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227184500_milestone9_automation_precedence_control_system.sql
CREATE OR REPLACE FUNCTION public.admin_set_campaign_autopause_override(
  p_campaign_id UUID,
  p_enabled BOOLEAN,
  p_precedence TEXT DEFAULT 'automation_allowed',
  p_reason TEXT DEFAULT NULL,
  p_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_precedence TEXT := CASE
    WHEN lower(COALESCE(p_precedence, 'automation_allowed')) = 'final_override' THEN 'final_override'
    ELSE 'automation_allowed'
  END;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_autopause_override_updated');
  v_admin_paused BOOLEAN := false;
  v_force_stopped BOOLEAN := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT
    COALESCE(s.admin_paused, false),
    COALESCE(s.force_stopped, false)
  INTO v_admin_paused, v_force_stopped
  FROM public.email_governance_campaign_intervention_state s
  WHERE s.campaign_id = p_campaign_id;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    COALESCE(v_admin_paused, false),
    COALESCE(v_force_stopped, false),
    COALESCE(p_enabled, false),
    v_precedence,
    v_reason,
    CASE WHEN COALESCE(p_enabled, false) THEN p_until ELSE NULL END
  );

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_autopause_override_updated',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'enabled', COALESCE(p_enabled, false),
      'precedence', v_precedence,
      'until', CASE WHEN COALESCE(p_enabled, false) THEN p_until ELSE NULL END,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'autopause_override_enabled', COALESCE(p_enabled, false),
    'autopause_override_precedence', v_precedence,
    'autopause_override_until', CASE WHEN COALESCE(p_enabled, false) THEN p_until ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_campaign_autopause_override(UUID, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- Source: supabase/migrations/20260227153000_milestone8_campaign_admin_intervention_controls.sql
CREATE OR REPLACE FUNCTION public.admin_set_tenant_campaign_creation_lock(
  p_tenant_id UUID,
  p_locked BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_effective_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), CASE WHEN COALESCE(p_locked, false) THEN 'campaign_creation_locked' ELSE 'campaign_creation_unlocked' END);
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    campaign_creation_locked,
    campaign_creation_locked_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_locked, false),
    CASE WHEN COALESCE(p_locked, false) THEN v_effective_reason ELSE NULL END,
    now(),
    v_actor,
    v_effective_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    campaign_creation_locked = EXCLUDED.campaign_creation_locked,
    campaign_creation_locked_reason = EXCLUDED.campaign_creation_locked_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    CASE WHEN COALESCE(p_locked, false) THEN 'tenant_campaign_creation_locked' ELSE 'tenant_campaign_creation_unlocked' END,
    jsonb_build_object(
      'locked', COALESCE(p_locked, false),
      'reason', v_effective_reason
    )
  );

  RETURN jsonb_build_object(
    'campaign_creation_locked', COALESCE(p_locked, false),
    'campaign_creation_locked_reason', CASE WHEN COALESCE(p_locked, false) THEN v_effective_reason ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_campaign_creation_lock(UUID, BOOLEAN, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227103000_milestone6_unlimited_custom_sending_limit_control.sql
CREATE OR REPLACE FUNCTION public.admin_set_tenant_emergency_restriction(
  p_tenant_id UUID,
  p_enabled BOOLEAN,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_enabled BOOLEAN := COALESCE(p_enabled, false);
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_emergency_restriction_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF v_enabled AND p_until IS NOT NULL AND p_until <= now() THEN
    RAISE EXCEPTION 'p_until must be in the future when provided';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    emergency_restriction_enabled,
    emergency_restriction_until,
    emergency_restriction_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    v_enabled,
    CASE WHEN v_enabled THEN p_until ELSE NULL END,
    CASE WHEN v_enabled THEN v_reason ELSE NULL END,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    emergency_restriction_enabled = EXCLUDED.emergency_restriction_enabled,
    emergency_restriction_until = EXCLUDED.emergency_restriction_until,
    emergency_restriction_reason = EXCLUDED.emergency_restriction_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    CASE WHEN v_enabled THEN 'tenant_emergency_restriction_enabled' ELSE 'tenant_emergency_restriction_disabled' END,
    jsonb_build_object(
      'enabled', v_enabled,
      'until', CASE WHEN v_enabled THEN p_until ELSE NULL END,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'emergency_restriction_enabled', v_enabled,
    'emergency_restriction_until', CASE WHEN v_enabled THEN p_until ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_emergency_restriction(UUID, BOOLEAN, TIMESTAMPTZ, TEXT) TO authenticated;

-- Source: supabase/migrations/20260226200000_milestone5_reputation_override_reset_engine.sql
CREATE OR REPLACE FUNCTION public.admin_set_tenant_reputation_override(
  p_tenant_id UUID,
  p_score INTEGER,
  p_mode TEXT DEFAULT 'final',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_mode TEXT := lower(COALESCE(NULLIF(btrim(p_mode), ''), 'final'));
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_override_set');
  v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_score IS NULL OR p_score < 0 OR p_score > 100 THEN
    RAISE EXCEPTION 'p_score must be between 0 and 100';
  END IF;

  IF v_mode NOT IN ('final', 'temporary') THEN
    RAISE EXCEPTION 'p_mode must be one of: final, temporary';
  END IF;

  IF v_mode = 'temporary' AND p_expires_at IS NULL THEN
    RAISE EXCEPTION 'p_expires_at is required for temporary override mode';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'p_expires_at must be in the future';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    manual_reputation_score,
    reputation_override_mode,
    reputation_override_expires_at,
    reputation_override_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    p_score,
    v_mode,
    CASE WHEN v_mode = 'temporary' THEN p_expires_at ELSE NULL END,
    v_reason,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    manual_reputation_score = EXCLUDED.manual_reputation_score,
    reputation_override_mode = EXCLUDED.reputation_override_mode,
    reputation_override_expires_at = EXCLUDED.reputation_override_expires_at,
    reputation_override_reason = EXCLUDED.reputation_override_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  v_result := public.refresh_email_governance_tenant_reputation_score(p_tenant_id, now());

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_reputation_override_set',
    jsonb_build_object(
      'score', p_score,
      'mode', v_mode,
      'expires_at', CASE WHEN v_mode = 'temporary' THEN p_expires_at ELSE NULL END,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'override', jsonb_build_object(
      'score', p_score,
      'mode', v_mode,
      'expires_at', CASE WHEN v_mode = 'temporary' THEN p_expires_at ELSE NULL END,
      'reason', v_reason
    ),
    'score_result', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_reputation_override(UUID, INTEGER, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227103000_milestone6_unlimited_custom_sending_limit_control.sql
CREATE OR REPLACE FUNCTION public.admin_set_tenant_sending_limits(
  p_tenant_id UUID,
  p_monthly INTEGER DEFAULT NULL,
  p_daily INTEGER DEFAULT NULL,
  p_hourly INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_sending_limits_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_monthly IS NOT NULL AND p_monthly < 0 THEN
    RAISE EXCEPTION 'p_monthly must be >= 0 or null';
  END IF;

  IF p_daily IS NOT NULL AND p_daily < 0 THEN
    RAISE EXCEPTION 'p_daily must be >= 0 or null';
  END IF;

  IF p_hourly IS NOT NULL AND p_hourly < 0 THEN
    RAISE EXCEPTION 'p_hourly must be >= 0 or null';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    send_limit_monthly,
    send_limit_daily,
    send_limit_hourly,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    p_monthly,
    p_daily,
    p_hourly,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    send_limit_monthly = EXCLUDED.send_limit_monthly,
    send_limit_daily = EXCLUDED.send_limit_daily,
    send_limit_hourly = EXCLUDED.send_limit_hourly,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_sending_limits_updated',
    jsonb_build_object(
      'monthly_limit', p_monthly,
      'daily_limit', p_daily,
      'hourly_limit', p_hourly,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'monthly_limit', p_monthly,
    'daily_limit', p_daily,
    'hourly_limit', p_hourly
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_sending_limits(UUID, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227103000_milestone6_unlimited_custom_sending_limit_control.sql
CREATE OR REPLACE FUNCTION public.admin_set_tenant_temporary_boost(
  p_tenant_id UUID,
  p_monthly INTEGER DEFAULT NULL,
  p_daily INTEGER DEFAULT NULL,
  p_hourly INTEGER DEFAULT NULL,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_temporary_boost_set');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_until IS NULL OR p_until <= now() THEN
    RAISE EXCEPTION 'p_until must be in the future';
  END IF;

  IF p_monthly IS NULL AND p_daily IS NULL AND p_hourly IS NULL THEN
    RAISE EXCEPTION 'At least one boost limit is required';
  END IF;

  IF p_monthly IS NOT NULL AND p_monthly < 0 THEN
    RAISE EXCEPTION 'p_monthly must be >= 0 or null';
  END IF;

  IF p_daily IS NOT NULL AND p_daily < 0 THEN
    RAISE EXCEPTION 'p_daily must be >= 0 or null';
  END IF;

  IF p_hourly IS NOT NULL AND p_hourly < 0 THEN
    RAISE EXCEPTION 'p_hourly must be >= 0 or null';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    boost_until,
    boost_monthly,
    boost_daily,
    boost_hourly,
    boost_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    p_until,
    p_monthly,
    p_daily,
    p_hourly,
    v_reason,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    boost_until = EXCLUDED.boost_until,
    boost_monthly = EXCLUDED.boost_monthly,
    boost_daily = EXCLUDED.boost_daily,
    boost_hourly = EXCLUDED.boost_hourly,
    boost_reason = EXCLUDED.boost_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_temporary_boost_set',
    jsonb_build_object(
      'monthly_limit', p_monthly,
      'daily_limit', p_daily,
      'hourly_limit', p_hourly,
      'until', p_until,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'boost_until', p_until,
    'boost_monthly', p_monthly,
    'boost_daily', p_daily,
    'boost_hourly', p_hourly
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_temporary_boost(UUID, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227184500_milestone9_automation_precedence_control_system.sql
CREATE OR REPLACE FUNCTION public.admin_set_tenant_under_review_override(
  p_tenant_id UUID,
  p_enabled BOOLEAN,
  p_precedence TEXT DEFAULT 'automation_allowed',
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_precedence TEXT := CASE
    WHEN lower(COALESCE(p_precedence, 'automation_allowed')) = 'final_override' THEN 'final_override'
    ELSE 'automation_allowed'
  END;
  v_now TIMESTAMPTZ := now();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_under_review_override_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF COALESCE(p_enabled, false) AND p_until IS NOT NULL AND p_until <= v_now THEN
    RAISE EXCEPTION 'p_until must be in the future when provided';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    under_review_override_enabled,
    under_review_override_precedence,
    under_review_override_until,
    under_review_override_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_enabled, false),
    v_precedence,
    CASE WHEN COALESCE(p_enabled, false) THEN p_until ELSE NULL END,
    CASE WHEN COALESCE(p_enabled, false) THEN v_reason ELSE NULL END,
    v_now,
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    under_review_override_enabled = EXCLUDED.under_review_override_enabled,
    under_review_override_precedence = EXCLUDED.under_review_override_precedence,
    under_review_override_until = EXCLUDED.under_review_override_until,
    under_review_override_reason = EXCLUDED.under_review_override_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_under_review_override_updated',
    jsonb_build_object(
      'enabled', COALESCE(p_enabled, false),
      'precedence', v_precedence,
      'until', CASE WHEN COALESCE(p_enabled, false) THEN p_until ELSE NULL END,
      'reason', v_reason
    )
  );

  RETURN public.admin_get_tenant_under_review_override(p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_under_review_override(UUID, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- Source: supabase/migrations/20260227103000_milestone6_unlimited_custom_sending_limit_control.sql
CREATE OR REPLACE FUNCTION public.admin_set_tenant_unlimited_sending(
  p_tenant_id UUID,
  p_enabled BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_enabled BOOLEAN := COALESCE(p_enabled, false);
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_unlimited_sending_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    unlimited_sending_enabled,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    v_enabled,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    unlimited_sending_enabled = EXCLUDED.unlimited_sending_enabled,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    CASE WHEN v_enabled THEN 'tenant_unlimited_sending_enabled' ELSE 'tenant_unlimited_sending_disabled' END,
    jsonb_build_object(
      'enabled', v_enabled,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'unlimited_sending_enabled', v_enabled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_unlimited_sending(UUID, BOOLEAN, TEXT) TO authenticated;

-- Ensure PostgREST picks up the refreshed function definitions.
NOTIFY pgrst, 'reload schema';

COMMIT;
