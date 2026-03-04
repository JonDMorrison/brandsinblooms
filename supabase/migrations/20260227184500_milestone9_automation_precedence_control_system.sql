-- Milestone 9: Automation Precedence Control System
-- Objective:
-- - Establish explicit hierarchy between admin overrides and automation decisions.
-- - Support precedence modes: final_override | automation_allowed.
-- - Automatically expire and revert override states.
-- - Log all system/admin precedence decisions.

ALTER TABLE public.email_governance_campaign_intervention_state
  ADD COLUMN IF NOT EXISTS autopause_override_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS autopause_override_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_intervention_override_expiry
  ON public.email_governance_campaign_intervention_state (autopause_override_until)
  WHERE autopause_override_enabled = true
    AND autopause_override_until IS NOT NULL;

ALTER TABLE public.email_governance_tenant_control_state
  ADD COLUMN IF NOT EXISTS reputation_override_precedence TEXT NOT NULL DEFAULT 'final_override',
  ADD COLUMN IF NOT EXISTS under_review_override_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS under_review_override_precedence TEXT NOT NULL DEFAULT 'automation_allowed',
  ADD COLUMN IF NOT EXISTS under_review_override_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS under_review_override_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_reputation_override_precedence_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_reputation_override_precedence_check
      CHECK (reputation_override_precedence IN ('final_override', 'automation_allowed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_under_review_override_precedence_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_under_review_override_precedence_check
      CHECK (under_review_override_precedence IN ('final_override', 'automation_allowed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tenant_control_under_review_override_expiry
  ON public.email_governance_tenant_control_state (tenant_id, under_review_override_until)
  WHERE under_review_override_enabled = true
    AND under_review_override_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cleanup_expired_email_governance_overrides(
  p_source TEXT DEFAULT 'system',
  p_tenant_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_source TEXT := COALESCE(NULLIF(btrim(p_source), ''), 'system');
  v_campaign_cleared INTEGER := 0;
  v_tenant_reputation_cleared INTEGER := 0;
  v_tenant_suppression_cleared INTEGER := 0;
  v_tenant_under_review_cleared INTEGER := 0;
BEGIN
  WITH expired_campaign_overrides AS (
    UPDATE public.email_governance_campaign_intervention_state s
    SET
      autopause_override_enabled = false,
      autopause_override_precedence = 'automation_allowed',
      autopause_override_until = NULL,
      autopause_override_reason = NULL,
      updated_at = v_now,
      updated_reason = 'autopause_override_expired'
    WHERE COALESCE(s.autopause_override_enabled, false) = true
      AND s.autopause_override_until IS NOT NULL
      AND s.autopause_override_until <= v_now
      AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id)
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.campaign_id, s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      campaign_id,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'campaign_autopause_override_expired',
      'log',
      'Campaign auto-pause override expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      e.campaign_id,
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_campaign_overrides e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_campaign_cleared FROM logged;

  WITH expired_reputation_overrides AS (
    UPDATE public.email_governance_tenant_control_state s
    SET
      manual_reputation_score = NULL,
      reputation_override_mode = NULL,
      reputation_override_expires_at = NULL,
      reputation_override_reason = NULL,
      updated_at = v_now,
      updated_reason = 'reputation_override_expired'
    WHERE s.reputation_override_mode = 'temporary'
      AND s.reputation_override_expires_at IS NOT NULL
      AND s.reputation_override_expires_at <= v_now
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'tenant_reputation_override_expired',
      'log',
      'Tenant reputation override expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_reputation_overrides e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_tenant_reputation_cleared FROM logged;

  WITH expired_suppression_bypass AS (
    UPDATE public.email_governance_tenant_control_state s
    SET
      suppression_bypass_enabled = false,
      suppression_bypass_until = NULL,
      suppression_bypass_reason = NULL,
      updated_at = v_now,
      updated_reason = 'suppression_bypass_expired'
    WHERE COALESCE(s.suppression_bypass_enabled, false) = true
      AND s.suppression_bypass_until IS NOT NULL
      AND s.suppression_bypass_until <= v_now
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'tenant_suppression_bypass_expired',
      'log',
      'Tenant suppression bypass expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_suppression_bypass e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_tenant_suppression_cleared FROM logged;

  WITH expired_under_review_overrides AS (
    UPDATE public.email_governance_tenant_control_state s
    SET
      under_review_override_enabled = false,
      under_review_override_precedence = 'automation_allowed',
      under_review_override_until = NULL,
      under_review_override_reason = NULL,
      updated_at = v_now,
      updated_reason = 'under_review_override_expired'
    WHERE COALESCE(s.under_review_override_enabled, false) = true
      AND s.under_review_override_until IS NOT NULL
      AND s.under_review_override_until <= v_now
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    RETURNING s.tenant_id
  ), logged AS (
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      metadata,
      occurred_at
    )
    SELECT
      e.tenant_id,
      'system',
      'tenant_under_review_override_expired',
      'log',
      'Tenant under-review override expired and was reverted.',
      'milestone9_automation_precedence',
      '2026-02-27',
      jsonb_build_object('source', v_source),
      v_now
    FROM expired_under_review_overrides e
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_tenant_under_review_cleared FROM logged;

  RETURN jsonb_build_object(
    'campaign_overrides_cleared', COALESCE(v_campaign_cleared, 0),
    'tenant_reputation_overrides_cleared', COALESCE(v_tenant_reputation_cleared, 0),
    'tenant_suppression_bypass_cleared', COALESCE(v_tenant_suppression_cleared, 0),
    'tenant_under_review_overrides_cleared', COALESCE(v_tenant_under_review_cleared, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_under_review_override_state(
  p_tenant_id UUID
)
RETURNS TABLE (
  tenant_id UUID,
  under_review_override_enabled BOOLEAN,
  under_review_override_precedence TEXT,
  under_review_override_until TIMESTAMPTZ,
  under_review_override_reason TEXT,
  under_review_override_active BOOLEAN,
  under_review_override_final BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p_tenant_id,
    COALESCE(s.under_review_override_enabled, false),
    COALESCE(s.under_review_override_precedence, 'automation_allowed'),
    s.under_review_override_until,
    s.under_review_override_reason,
    (
      COALESCE(s.under_review_override_enabled, false)
      AND (
        s.under_review_override_until IS NULL
        OR s.under_review_override_until > v_now
      )
    ) AS under_review_override_active,
    (
      COALESCE(s.under_review_override_enabled, false)
      AND COALESCE(s.under_review_override_precedence, 'automation_allowed') = 'final_override'
      AND (
        s.under_review_override_until IS NULL
        OR s.under_review_override_until > v_now
      )
    ) AS under_review_override_final
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.get_campaign_intervention_state(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  admin_paused BOOLEAN,
  force_stopped BOOLEAN,
  autopause_override_enabled BOOLEAN,
  autopause_override_precedence TEXT,
  autopause_override_final BOOLEAN,
  autopause_override_until TIMESTAMPTZ,
  autopause_override_reason TEXT,
  autopause_override_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_tenant_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT c.tenant_id
  INTO v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p_campaign_id,
    v_campaign_tenant_id,
    COALESCE(s.admin_paused, false) AS admin_paused,
    COALESCE(s.force_stopped, false) AS force_stopped,
    (
      COALESCE(s.autopause_override_enabled, false)
      AND (
        s.autopause_override_until IS NULL
        OR s.autopause_override_until > v_now
      )
    ) AS autopause_override_enabled,
    COALESCE(s.autopause_override_precedence, 'automation_allowed') AS autopause_override_precedence,
    (
      COALESCE(s.autopause_override_enabled, false)
      AND COALESCE(s.autopause_override_precedence, 'automation_allowed') = 'final_override'
      AND (
        s.autopause_override_until IS NULL
        OR s.autopause_override_until > v_now
      )
    ) AS autopause_override_final,
    s.autopause_override_until,
    s.autopause_override_reason,
    (
      COALESCE(s.autopause_override_enabled, false)
      AND (
        s.autopause_override_until IS NULL
        OR s.autopause_override_until > v_now
      )
    ) AS autopause_override_active
  FROM public.crm_campaigns c
  LEFT JOIN public.email_governance_campaign_intervention_state s
    ON s.campaign_id = c.id
  WHERE c.id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_campaign_intervention_state(
  p_campaign_id UUID,
  p_admin_paused BOOLEAN,
  p_force_stopped BOOLEAN,
  p_autopause_override_enabled BOOLEAN,
  p_autopause_override_precedence TEXT DEFAULT 'automation_allowed',
  p_reason TEXT DEFAULT NULL,
  p_autopause_override_until TIMESTAMPTZ DEFAULT NULL
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
    WHEN lower(COALESCE(p_autopause_override_precedence, 'automation_allowed')) = 'final_override' THEN 'final_override'
    ELSE 'automation_allowed'
  END;
  v_effective_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_intervention_state_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

  IF COALESCE(p_autopause_override_enabled, false)
    AND p_autopause_override_until IS NOT NULL
    AND p_autopause_override_until <= now() THEN
    RAISE EXCEPTION 'p_autopause_override_until must be in the future when provided';
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
    COALESCE(p_admin_paused, false),
    COALESCE(p_force_stopped, false),
    COALESCE(p_autopause_override_enabled, false),
    v_precedence,
    CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN p_autopause_override_until ELSE NULL END,
    CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN v_effective_reason ELSE NULL END,
    now(),
    v_actor,
    v_effective_reason
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    admin_paused = EXCLUDED.admin_paused,
    force_stopped = EXCLUDED.force_stopped,
    autopause_override_enabled = EXCLUDED.autopause_override_enabled,
    autopause_override_precedence = EXCLUDED.autopause_override_precedence,
    autopause_override_until = EXCLUDED.autopause_override_until,
    autopause_override_reason = EXCLUDED.autopause_override_reason,
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
    v_tenant_id,
    'campaign_intervention_state_updated',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'admin_paused', COALESCE(p_admin_paused, false),
      'force_stopped', COALESCE(p_force_stopped, false),
      'autopause_override_enabled', COALESCE(p_autopause_override_enabled, false),
      'autopause_override_precedence', v_precedence,
      'autopause_override_until', CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN p_autopause_override_until ELSE NULL END,
      'reason', v_effective_reason
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'tenant_id', v_tenant_id,
    'admin_paused', COALESCE(p_admin_paused, false),
    'force_stopped', COALESCE(p_force_stopped, false),
    'autopause_override_enabled', COALESCE(p_autopause_override_enabled, false),
    'autopause_override_precedence', v_precedence,
    'autopause_override_until', CASE WHEN COALESCE(p_autopause_override_enabled, false) THEN p_autopause_override_until ELSE NULL END,
    'updated_reason', v_effective_reason
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.ensure_campaign_sending(p_campaign_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  current_status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st TEXT;
  v_tenant_id UUID;
  v_under_review BOOLEAN := false;
  v_policy RECORD;
  v_reason TEXT;
  v_admin_paused BOOLEAN := false;
  v_force_stopped BOOLEAN := false;
  v_override_final BOOLEAN := false;
  v_under_review_override_final BOOLEAN := false;
BEGIN
  SELECT c.status, c.tenant_id
  INTO st, v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF st IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;

  PERFORM public.cleanup_expired_email_governance_overrides('ensure_campaign_sending', v_tenant_id, p_campaign_id);

  SELECT
    COALESCE(i.admin_paused, false),
    COALESCE(i.force_stopped, false),
    (
      COALESCE(i.autopause_override_enabled, false)
      AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
      AND (
        i.autopause_override_until IS NULL
        OR i.autopause_override_until > now()
      )
    )
  INTO v_admin_paused, v_force_stopped, v_override_final
  FROM public.email_governance_campaign_intervention_state i
  WHERE i.campaign_id = p_campaign_id;

  SELECT COALESCE(s.under_review_override_final, false)
  INTO v_under_review_override_final
  FROM public.get_tenant_under_review_override_state(v_tenant_id) s
  LIMIT 1;

  IF COALESCE(v_force_stopped, false) THEN
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, 'Campaign is paused.'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(v_admin_paused, false) THEN
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, 'Campaign is paused.'::TEXT;
    RETURN;
  END IF;

  SELECT t.email_under_review
  INTO v_under_review
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF COALESCE(v_under_review, false)
     AND NOT COALESCE(v_override_final, false)
     AND NOT COALESCE(v_under_review_override_final, false) THEN
    v_reason := 'Campaign blocked: tenant is under review due to deliverability hard-stop enforcement.';
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'tenant_hard_stop_under_review',
      v_reason
    );
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, v_reason;
    RETURN;
  END IF;

  SELECT * INTO v_policy
  FROM public.get_campaign_reputation_policy(p_campaign_id);

  IF v_policy.action = 'pause' AND NOT COALESCE(v_override_final, false) THEN
    v_reason := format('Campaign auto-paused: reputation score %s is below 60.', v_policy.score);
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'reputation_critical_autopause',
      v_reason
    );
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, v_reason;
    RETURN;
  END IF;

  IF v_policy.action = 'restrict' THEN
    v_reason := format('Campaign blocked: reputation score %s is in restricted tier (60-74).', v_policy.score);

    UPDATE public.crm_campaigns
    SET
      send_blocked_reason = 'reputation_restricted',
      send_error = v_reason,
      updated_at = now()
    WHERE id = p_campaign_id;

    RETURN QUERY SELECT FALSE, st, v_reason;
    RETURN;
  END IF;

  IF st IN ('sent') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign already sent'::TEXT;
    RETURN;
  END IF;

  IF st IN ('failed') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign previously failed - reset to draft first'::TEXT;
    RETURN;
  END IF;

  IF st IN ('draft', 'scheduled', 'queued', 'partially_queued') THEN
    UPDATE public.crm_campaigns
    SET
      status = 'sending',
      send_started_at = COALESCE(send_started_at, NOW()),
      send_error = NULL,
      send_blocked_reason = NULL
    WHERE id = p_campaign_id;

    RETURN QUERY SELECT TRUE, 'sending'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF st = 'sending' THEN
    RETURN QUERY SELECT TRUE, st, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, st, 'Campaign cannot be sent from status: ' || st;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_enforce_tenant_hard_stop(
  p_tenant_id UUID,
  p_source TEXT DEFAULT 'system',
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  triggered BOOLEAN,
  enforced BOOLEAN,
  action_id UUID,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval RECORD;
  v_enforce RECORD;
  v_override RECORD;
BEGIN
  PERFORM public.cleanup_expired_email_governance_overrides(p_source, p_tenant_id, NULL);

  SELECT * INTO v_eval
  FROM public.evaluate_tenant_hard_stop(p_tenant_id, p_as_of);

  SELECT * INTO v_override
  FROM public.get_tenant_under_review_override_state(p_tenant_id)
  LIMIT 1;

  IF COALESCE(v_eval.should_enforce, false) AND COALESCE(v_override.under_review_override_final, false) THEN
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      metadata,
      occurred_at
    ) VALUES (
      p_tenant_id,
      'system',
      'tenant_hard_stop_override_respected',
      'allow',
      'Hard-stop enforcement skipped due to final admin override.',
      'milestone9_automation_precedence',
      '2026-02-27',
      jsonb_build_object(
        'source', p_source,
        'trigger_reasons', COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
        'override_precedence', COALESCE(v_override.under_review_override_precedence, 'automation_allowed')
      ),
      now()
    );

    triggered := true;
    enforced := false;
    action_id := NULL;
    reason := 'Hard-stop criteria met but skipped due to final admin override.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF COALESCE(v_eval.should_enforce, false) THEN
    SELECT * INTO v_enforce
    FROM public.enforce_tenant_hard_stop(
      p_tenant_id,
      COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
      jsonb_build_object(
        'window_start', v_eval.window_start,
        'window_end', v_eval.window_end,
        'sent_count', v_eval.sent_count,
        'hard_bounce_count', v_eval.hard_bounce_count,
        'complaint_count', v_eval.complaint_count,
        'spam_count', v_eval.spam_count,
        'failed_count', v_eval.failed_count,
        'rejected_count', v_eval.rejected_count,
        'reputation_score', v_eval.reputation_score,
        'bounce_rate', v_eval.bounce_rate,
        'complaint_rate', v_eval.complaint_rate,
        'spam_rate', v_eval.spam_rate,
        'failed_delivery_rate', v_eval.failed_delivery_rate,
        'rejected_rate', v_eval.rejected_rate
      ),
      p_source
    );

    triggered := true;
    enforced := COALESCE(v_enforce.enforced, false);
    action_id := v_enforce.action_id;
    reason := COALESCE(v_enforce.reason, array_to_string(v_eval.trigger_reasons, ', '));
    RETURN NEXT;
    RETURN;
  END IF;

  triggered := false;
  enforced := false;
  action_id := NULL;
  reason := NULL;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_enforce_tenant_abuse_under_review(
  p_campaign_id UUID,
  p_source TEXT DEFAULT 'send_preflight',
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  was_blocked BOOLEAN,
  state_changed BOOLEAN,
  risk_level TEXT,
  reasons TEXT[],
  monitoring_severity TEXT,
  message TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval RECORD;
  v_under_review BOOLEAN := false;
  v_state_changed BOOLEAN := false;
  v_reason TEXT;
  v_message TEXT;
  v_override RECORD;
BEGIN
  SELECT *
  INTO v_eval
  FROM public.evaluate_campaign_abuse_risk(p_campaign_id, p_as_of)
  LIMIT 1;

  IF v_eval.campaign_id IS NULL THEN
    RAISE EXCEPTION 'Failed to evaluate abuse risk for campaign %', p_campaign_id;
  END IF;

  PERFORM public.cleanup_expired_email_governance_overrides(p_source, v_eval.tenant_id, p_campaign_id);

  SELECT * INTO v_override
  FROM public.get_tenant_under_review_override_state(v_eval.tenant_id)
  LIMIT 1;

  IF NOT COALESCE(v_eval.should_block, false) THEN
    campaign_id := v_eval.campaign_id;
    tenant_id := v_eval.tenant_id;
    was_blocked := false;
    state_changed := false;
    risk_level := v_eval.risk_level;
    reasons := COALESCE(v_eval.reasons, ARRAY[]::TEXT[]);
    monitoring_severity := 'normal';
    message := NULL;
    details := v_eval.details;
    RETURN NEXT;
    RETURN;
  END IF;

  IF COALESCE(v_override.under_review_override_final, false) THEN
    INSERT INTO public.email_governance_audit_logs (
      tenant_id,
      actor_type,
      action_type,
      decision,
      reason,
      policy_name,
      policy_version,
      campaign_id,
      metadata,
      occurred_at
    ) VALUES (
      v_eval.tenant_id,
      'system',
      'abuse_pattern_detection_override_respected',
      'allow',
      'Abuse under-review enforcement skipped due to final admin override.',
      'milestone9_automation_precedence',
      '2026-02-27',
      v_eval.campaign_id,
      jsonb_build_object(
        'source', p_source,
        'risk_level', v_eval.risk_level,
        'reasons', COALESCE(v_eval.reasons, ARRAY[]::TEXT[]),
        'override_precedence', COALESCE(v_override.under_review_override_precedence, 'automation_allowed')
      ),
      now()
    );

    campaign_id := v_eval.campaign_id;
    tenant_id := v_eval.tenant_id;
    was_blocked := false;
    state_changed := false;
    risk_level := v_eval.risk_level;
    reasons := COALESCE(v_eval.reasons, ARRAY[]::TEXT[]);
    monitoring_severity := COALESCE(v_eval.monitoring_severity, 'normal');
    message := 'Abuse risk detected, but final admin override allows automation bypass.';
    details := v_eval.details;
    RETURN NEXT;
    RETURN;
  END IF;

  v_reason := 'abuse_pattern_detection_manual_review';
  v_message := format(
    'Campaign blocked pending manual review: %s',
    COALESCE(array_to_string(v_eval.reasons, ', '), 'abuse risk detected')
  );

  SELECT t.email_under_review
  INTO v_under_review
  FROM public.tenants t
  WHERE t.id = v_eval.tenant_id
  FOR UPDATE;

  IF NOT COALESCE(v_under_review, false) THEN
    UPDATE public.tenants t
    SET
      email_under_review = true,
      email_under_review_at = now(),
      email_under_review_reason = v_reason,
      email_under_review_details = jsonb_build_object(
        'source', p_source,
        'campaign_id', v_eval.campaign_id,
        'risk_level', v_eval.risk_level,
        'monitoring_severity', v_eval.monitoring_severity,
        'reasons', COALESCE(v_eval.reasons, ARRAY[]::TEXT[]),
        'details', COALESCE(v_eval.details, '{}'::jsonb),
        'triggered_at', now()
      ),
      updated_at = now()
    WHERE t.id = v_eval.tenant_id;

    v_state_changed := true;
  END IF;

  INSERT INTO public.email_governance_audit_logs (
    tenant_id,
    actor_type,
    action_type,
    decision,
    reason,
    policy_name,
    policy_version,
    campaign_id,
    metadata,
    occurred_at
  ) VALUES (
    v_eval.tenant_id,
    'system',
    'abuse_pattern_detection',
    'block',
    v_message,
    'milestone11_abuse_detection',
    '2026-02-25',
    v_eval.campaign_id,
    jsonb_build_object(
      'source', p_source,
      'risk_level', v_eval.risk_level,
      'monitoring_severity', v_eval.monitoring_severity,
      'reasons', COALESCE(v_eval.reasons, ARRAY[]::TEXT[]),
      'details', COALESCE(v_eval.details, '{}'::jsonb),
      'tenant_under_review_changed', v_state_changed
    ),
    now()
  );

  BEGIN
    INSERT INTO public.analytics_alerts (
      tenant_id,
      metric,
      value,
      threshold,
      severity,
      created_at
    ) VALUES (
      v_eval.tenant_id,
      'email_abuse_risk',
      1,
      1,
      'critical',
      now()
    );
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
  END;

  campaign_id := v_eval.campaign_id;
  tenant_id := v_eval.tenant_id;
  was_blocked := true;
  state_changed := v_state_changed;
  risk_level := v_eval.risk_level;
  reasons := COALESCE(v_eval.reasons, ARRAY[]::TEXT[]);
  monitoring_severity := COALESCE(v_eval.monitoring_severity, 'critical');
  message := v_message;
  details := COALESCE(v_eval.details, '{}'::jsonb);

  RETURN NEXT;
END;
$$;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  BEGIN
    SELECT j.jobid
    INTO v_job_id
    FROM cron.job j
    WHERE j.jobname = 'email-governance-override-expiry-cleanup'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'email-governance-override-expiry-cleanup',
      '*/5 * * * *',
      $job$SELECT public.cleanup_expired_email_governance_overrides('cron');$job$
    );
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_email_governance_overrides(TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_email_governance_overrides(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_under_review_override_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_under_review_override_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_under_review_override(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_under_review_override(UUID, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_campaign_intervention_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_intervention_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_campaign_intervention_state(UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_campaign_autopause_override(UUID, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_hard_stop(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_hard_stop(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_abuse_under_review(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_abuse_under_review(UUID, TEXT, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';
