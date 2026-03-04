-- Milestone 1 completion: governance config hardening + strict/relaxed profiles

-- 1) Lock down global governance config visibility
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to system_config" ON public.system_config;
DROP POLICY IF EXISTS "Master admins can read system_config" ON public.system_config;

CREATE POLICY "Master admins can read system_config"
  ON public.system_config
  FOR SELECT
  TO authenticated
  USING (public.is_master_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.get_email_governance_config() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_value(TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_num(TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_int(TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_cfg_interval(TEXT[]) FROM authenticated;

-- 2) Tenant override access hardening
CREATE OR REPLACE FUNCTION public.get_tenant_email_governance_overrides(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overrides JSONB;
  v_actor UUID := auth.uid();
  v_actor_tenant_id UUID;
  v_request_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
      RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;
  END IF;

  SELECT o.overrides
  INTO v_overrides
  FROM public.tenant_email_governance_overrides o
  WHERE o.tenant_id = p_tenant_id;

  RETURN COALESCE(v_overrides, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_email_governance_effective_runtime_config(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_tenant_id UUID;
  v_request_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'Access denied';
    END IF;

    IF NOT public.is_master_admin(v_actor) THEN
      SELECT u.tenant_id INTO v_actor_tenant_id
      FROM public.users u
      WHERE u.id = v_actor;

      IF v_actor_tenant_id IS NULL OR v_actor_tenant_id <> p_tenant_id THEN
        RAISE EXCEPTION 'Access denied';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'batch', jsonb_build_object(
      'max_batch_size', public.email_gov_eff_int(p_tenant_id, ARRAY['batch','max_batch_size']),
      'delay_min_seconds', public.email_gov_cfg_int(ARRAY['batch','delay_min_seconds']),
      'delay_max_seconds', public.email_gov_cfg_int(ARRAY['batch','delay_max_seconds'])
    ),
    'compliance', jsonb_build_object(
      'high_volume_threshold', public.email_gov_cfg_int(ARRAY['compliance','high_volume_threshold']),
      'spam_score_threshold', public.email_gov_cfg_num(ARRAY['compliance','spam_score_threshold'])
    ),
    'list_hygiene', jsonb_build_object(
      'invalid_block_threshold_pct', public.email_gov_cfg_num(ARRAY['list_hygiene','invalid_block_threshold_pct']),
      'inactive_warning_threshold_pct', public.email_gov_cfg_num(ARRAY['list_hygiene','inactive_warning_threshold_pct']),
      'bounce_warning_threshold_pct', public.email_gov_cfg_num(ARRAY['list_hygiene','bounce_warning_threshold_pct']),
      'inactive_days', public.email_gov_cfg_int(ARRAY['list_hygiene','inactive_days'])
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_eff_source(
  p_tenant_id UUID,
  p_path TEXT[]
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overrides JSONB;
  v_actor UUID := auth.uid();
  v_request_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'Config path is required';
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
      RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;
  END IF;

  v_overrides := public.get_tenant_email_governance_overrides(p_tenant_id);

  IF (v_overrides #> p_path) IS NOT NULL THEN
    RETURN 'tenant';
  END IF;

  RETURN 'global';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_email_governance_overrides(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_value(UUID, TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_num(UUID, TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_int(UUID, TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_source(UUID, TEXT[]) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.maybe_enforce_tenant_hard_stop(UUID, TEXT, TIMESTAMPTZ) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.maybe_enforce_tenant_abuse_under_review(UUID, TEXT, TIMESTAMPTZ) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_email_governance_effective_runtime_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_governance_effective_runtime_config(UUID) TO service_role;

-- 3) Config-driven threshold enforcement
CREATE OR REPLACE FUNCTION public.evaluate_campaign_batch_safety(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  sent_count INTEGER,
  failed_count INTEGER,
  bounced_count INTEGER,
  complained_count INTEGER,
  failed_delivery_rate NUMERIC,
  bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  should_pause BOOLEAN,
  pause_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_bounced_count INTEGER := 0;
  v_complained_count INTEGER := 0;
  v_failed_delivery_rate NUMERIC := 0;
  v_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;
  v_should_pause BOOLEAN := FALSE;
  v_pause_reason TEXT := NULL;
  v_tenant_id UUID;
  v_tenant_enforcement RECORD;
  v_throttle_state RECORD;
  v_override_final BOOLEAN := false;
  v_complaint_threshold NUMERIC;
  v_bounce_threshold NUMERIC;
  v_failed_threshold NUMERIC;
BEGIN
  SELECT
    c.tenant_id,
    (
      COALESCE(i.autopause_override_enabled, false)
      AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
    )
  INTO v_tenant_id, v_override_final
  FROM public.crm_campaigns c
  LEFT JOIN public.email_governance_campaign_intervention_state i ON i.campaign_id = c.id
  WHERE c.id = p_campaign_id;

  v_complaint_threshold := public.email_gov_eff_num(v_tenant_id, ARRAY['hard_stop_thresholds','complaint_rate']);
  v_bounce_threshold := public.email_gov_eff_num(v_tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate']);
  v_failed_threshold := public.email_gov_eff_num(v_tenant_id, ARRAY['hard_stop_thresholds','failed_delivery_rate']);

  SELECT
    COUNT(*) FILTER (WHERE m.status = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE m.status = 'failed')::INTEGER
  INTO v_sent_count, v_failed_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'bounced')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO v_bounced_count, v_complained_count
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id;

  v_sent_count := COALESCE(v_sent_count, 0);
  v_failed_count := COALESCE(v_failed_count, 0);
  v_bounced_count := COALESCE(v_bounced_count, 0);
  v_complained_count := COALESCE(v_complained_count, 0);

  v_failed_delivery_rate := v_failed_count::NUMERIC / GREATEST(v_sent_count + v_failed_count, 1);
  v_bounce_rate := v_bounced_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_complaint_rate := v_complained_count::NUMERIC / GREATEST(v_sent_count, 1);

  IF NOT COALESCE(v_override_final, false) THEN
    IF v_complaint_rate >= v_complaint_threshold THEN
      v_should_pause := TRUE;
      v_pause_reason := format(
        'Campaign auto-paused mid-send: complaint rate %.3f%% exceeded %.3f%% threshold.',
        v_complaint_rate * 100,
        v_complaint_threshold * 100
      );
    ELSIF v_bounce_rate >= v_bounce_threshold THEN
      v_should_pause := TRUE;
      v_pause_reason := format(
        'Campaign auto-paused mid-send: hard bounce rate %.2f%% exceeded %.2f%% threshold.',
        v_bounce_rate * 100,
        v_bounce_threshold * 100
      );
    ELSIF v_failed_delivery_rate >= v_failed_threshold THEN
      v_should_pause := TRUE;
      v_pause_reason := format(
        'Campaign auto-paused mid-send: failed delivery rate %.2f%% exceeded %.2f%% threshold.',
        v_failed_delivery_rate * 100,
        v_failed_threshold * 100
      );
    END IF;

    IF v_should_pause THEN
      PERFORM public.system_pause_email_campaign_sending(
        p_campaign_id,
        'batch_safety_threshold_exceeded',
        v_pause_reason
      );
    END IF;
  END IF;

  IF v_tenant_id IS NOT NULL AND NOT COALESCE(v_override_final, false) THEN
    SELECT *
    INTO v_tenant_enforcement
    FROM public.maybe_enforce_tenant_hard_stop(v_tenant_id, 'batch_eval', now());

    IF COALESCE(v_tenant_enforcement.triggered, false) THEN
      v_should_pause := TRUE;
      v_pause_reason := COALESCE(
        v_pause_reason,
        'Campaign paused by tenant hard-stop enforcement (under review).'
      );
    END IF;
  END IF;

  SELECT *
  INTO v_throttle_state
  FROM public.maybe_update_campaign_throttle_state(p_campaign_id, 'batch_eval', now());

  campaign_id := p_campaign_id;
  sent_count := v_sent_count;
  failed_count := v_failed_count;
  bounced_count := v_bounced_count;
  complained_count := v_complained_count;
  failed_delivery_rate := v_failed_delivery_rate;
  bounce_rate := v_bounce_rate;
  complaint_rate := v_complaint_rate;
  should_pause := CASE WHEN COALESCE(v_override_final, false) THEN false ELSE v_should_pause END;
  pause_reason := CASE WHEN COALESCE(v_override_final, false) THEN NULL ELSE v_pause_reason END;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_governance_visibility(
  p_campaign_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  sent_count INTEGER,
  delivered_count INTEGER,
  hard_bounce_count INTEGER,
  soft_bounce_count INTEGER,
  complaint_count INTEGER,
  unsubscribed_count INTEGER,
  failed_count INTEGER,
  delivery_rate NUMERIC,
  hard_bounce_rate NUMERIC,
  soft_bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  unsubscribe_rate NUMERIC,
  failed_delivery_rate NUMERIC,
  risk_indicator TEXT,
  threshold_exceeded TEXT[],
  threshold_details JSONB,
  reputation_score INTEGER,
  reputation_tier TEXT,
  reputation_action TEXT,
  policy_recipient_cap INTEGER,
  policy_job_batch_size INTEGER,
  policy_send_pacing_multiplier NUMERIC,
  is_throttled BOOLEAN,
  throttle_reasons TEXT[],
  reputation_impact TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_window_start TIMESTAMPTZ := v_window_end - public.email_gov_cfg_interval(ARRAY['windows','hard_stop_window']);

  v_sent_count INTEGER := 0;
  v_delivered_count INTEGER := 0;
  v_hard_bounce_count INTEGER := 0;
  v_soft_bounce_count INTEGER := 0;
  v_complaint_count INTEGER := 0;
  v_unsubscribed_count INTEGER := 0;
  v_failed_count INTEGER := 0;

  v_delivery_rate NUMERIC := 0;
  v_hard_bounce_rate NUMERIC := 0;
  v_soft_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;
  v_unsubscribe_rate NUMERIC := 0;
  v_failed_delivery_rate NUMERIC := 0;

  v_warning_eval RECORD;
  v_policy RECORD;
  v_throttle RECORD;

  v_threshold_exceeded TEXT[] := ARRAY[]::TEXT[];
  v_threshold_details JSONB := '{}'::jsonb;
  v_risk_indicator TEXT := 'green';
  v_reputation_impact TEXT := 'normal';

  v_hard_stop_hard_bounce_threshold NUMERIC := 0;
  v_hard_stop_complaint_threshold NUMERIC := 0;
  v_hard_stop_failed_threshold NUMERIC := 0;
  v_warning_hard_bounce_threshold NUMERIC := 0;
  v_warning_soft_bounce_threshold NUMERIC := 0;
  v_warning_complaint_threshold NUMERIC := 0;
BEGIN
  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_campaign_user_id = v_actor_user_id THEN
    NULL;
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    NULL;
  ELSE
    RETURN;
  END IF;

  v_hard_stop_hard_bounce_threshold := public.email_gov_eff_num(v_effective_tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate']);
  v_hard_stop_complaint_threshold := public.email_gov_eff_num(v_effective_tenant_id, ARRAY['hard_stop_thresholds','complaint_rate']);
  v_hard_stop_failed_threshold := public.email_gov_eff_num(v_effective_tenant_id, ARRAY['hard_stop_thresholds','failed_delivery_rate']);
  v_warning_hard_bounce_threshold := public.email_gov_eff_num(v_effective_tenant_id, ARRAY['warning_thresholds','hard_bounce_rate']);
  v_warning_soft_bounce_threshold := public.email_gov_eff_num(v_effective_tenant_id, ARRAY['warning_thresholds','soft_bounce_rate']);
  v_warning_complaint_threshold := public.email_gov_eff_num(v_effective_tenant_id, ARRAY['warning_thresholds','complaint_rate']);

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'delivered')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'unsubscribed')::INTEGER
  INTO
    v_sent_count,
    v_delivered_count,
    v_hard_bounce_count,
    v_soft_bounce_count,
    v_complaint_count,
    v_unsubscribed_count
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_window_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  SELECT COUNT(*)::INTEGER
  INTO v_failed_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.status = 'failed'
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) >= v_window_start
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  v_sent_count := COALESCE(v_sent_count, 0);
  v_delivered_count := COALESCE(v_delivered_count, 0);
  v_hard_bounce_count := COALESCE(v_hard_bounce_count, 0);
  v_soft_bounce_count := COALESCE(v_soft_bounce_count, 0);
  v_complaint_count := COALESCE(v_complaint_count, 0);
  v_unsubscribed_count := COALESCE(v_unsubscribed_count, 0);
  v_failed_count := COALESCE(v_failed_count, 0);

  v_delivery_rate := v_delivered_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_hard_bounce_rate := v_hard_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_soft_bounce_rate := v_soft_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_complaint_rate := v_complaint_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_unsubscribe_rate := v_unsubscribed_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_failed_delivery_rate := v_failed_count::NUMERIC / GREATEST(v_sent_count + v_failed_count, 1);

  SELECT *
  INTO v_warning_eval
  FROM public.evaluate_campaign_warning_thresholds(p_campaign_id, v_window_end);

  SELECT *
  INTO v_policy
  FROM public.get_campaign_reputation_policy(p_campaign_id);

  SELECT ts.is_throttled, ts.trigger_reasons
  INTO v_throttle
  FROM public.email_governance_campaign_throttle_states ts
  WHERE ts.campaign_id = p_campaign_id;

  IF v_hard_bounce_rate >= v_hard_stop_hard_bounce_threshold THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('hard_bounce_rate=%.4f (threshold=%.4f)', v_hard_bounce_rate, v_hard_stop_hard_bounce_threshold));
  END IF;

  IF v_complaint_rate >= v_hard_stop_complaint_threshold THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('complaint_rate=%.4f (threshold=%.4f)', v_complaint_rate, v_hard_stop_complaint_threshold));
  END IF;

  IF v_failed_delivery_rate >= v_hard_stop_failed_threshold THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('failed_delivery_rate=%.4f (threshold=%.4f)', v_failed_delivery_rate, v_hard_stop_failed_threshold));
  END IF;

  IF cardinality(v_threshold_exceeded) > 0 THEN
    v_risk_indicator := 'red';
  ELSIF COALESCE(v_warning_eval.should_throttle, false) THEN
    v_risk_indicator := 'yellow';
  ELSE
    v_risk_indicator := 'green';
  END IF;

  v_threshold_details := jsonb_build_object(
    'warning_thresholds', jsonb_build_object(
      'hard_bounce_rate', v_warning_hard_bounce_threshold,
      'soft_bounce_rate', v_warning_soft_bounce_threshold,
      'complaint_rate', v_warning_complaint_threshold
    ),
    'hard_stop_thresholds', jsonb_build_object(
      'hard_bounce_rate', v_hard_stop_hard_bounce_threshold,
      'complaint_rate', v_hard_stop_complaint_threshold,
      'failed_delivery_rate', v_hard_stop_failed_threshold
    ),
    'warning_triggered', COALESCE(v_warning_eval.should_throttle, false),
    'warning_reasons', COALESCE(v_warning_eval.trigger_reasons, ARRAY[]::TEXT[]),
    'hard_stop_reasons', v_threshold_exceeded
  );

  IF COALESCE(v_policy.action, 'allow') <> 'allow' AND COALESCE(v_throttle.is_throttled, false) THEN
    v_reputation_impact := 'policy_and_throttle';
  ELSIF COALESCE(v_policy.action, 'allow') <> 'allow' THEN
    v_reputation_impact := 'policy_only';
  ELSIF COALESCE(v_throttle.is_throttled, false) THEN
    v_reputation_impact := 'throttle_only';
  ELSE
    v_reputation_impact := 'none';
  END IF;

  campaign_id := p_campaign_id;
  tenant_id := v_effective_tenant_id;
  sent_count := v_sent_count;
  delivered_count := v_delivered_count;
  hard_bounce_count := v_hard_bounce_count;
  soft_bounce_count := v_soft_bounce_count;
  complaint_count := v_complaint_count;
  unsubscribed_count := v_unsubscribed_count;
  failed_count := v_failed_count;
  delivery_rate := v_delivery_rate;
  hard_bounce_rate := v_hard_bounce_rate;
  soft_bounce_rate := v_soft_bounce_rate;
  complaint_rate := v_complaint_rate;
  unsubscribe_rate := v_unsubscribe_rate;
  failed_delivery_rate := v_failed_delivery_rate;
  risk_indicator := v_risk_indicator;
  threshold_exceeded := COALESCE(v_threshold_exceeded, ARRAY[]::TEXT[]);
  threshold_details := COALESCE(v_threshold_details, '{}'::jsonb);
  reputation_score := COALESCE(v_policy.score, 100);
  reputation_tier := COALESCE(v_policy.tier, 'normal');
  reputation_action := COALESCE(v_policy.action, 'allow');
  policy_recipient_cap := v_policy.recipient_cap;
  policy_job_batch_size := COALESCE(v_policy.job_batch_size, 50);
  policy_send_pacing_multiplier := COALESCE(v_policy.send_pacing_multiplier, 1);
  is_throttled := COALESCE(v_throttle.is_throttled, false);
  throttle_reasons := COALESCE(v_throttle.trigger_reasons, ARRAY[]::TEXT[]);
  reputation_impact := v_reputation_impact;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_send_quota(
  p_tenant_id uuid,
  p_domain_id uuid DEFAULT NULL,
  p_recipient_count integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain record;
  v_tenant record;
  v_from_email text;
  v_from_name text;
  v_high_volume_threshold integer := public.email_gov_cfg_int(ARRAY['compliance','high_volume_threshold']);
  v_is_high_volume boolean := COALESCE(p_recipient_count, 0) > v_high_volume_threshold;
  v_spf_ok boolean := false;
  v_dkim_ok boolean := false;
  v_return_path_ok boolean := false;
  v_dmarc_ok boolean := false;
  v_domain_verification_ok boolean := false;
  v_ownership_ok boolean := false;
  v_failures text[] := ARRAY[]::text[];
  v_warnings text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'tenant_not_found',
      'message', 'Tenant not found'
    );
  END IF;

  v_from_name := COALESCE(v_tenant.fallback_from_name, 'BloomSuite');

  IF p_domain_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'sender_domain_required',
      'message', 'Campaign sending requires an explicit sending domain.'
    );
  END IF;

  SELECT * INTO v_domain
  FROM email_domains
  WHERE id = p_domain_id AND tenant_id = p_tenant_id;

  IF v_domain IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_found',
      'message', 'Sending domain not found'
    );
  END IF;

  IF COALESCE(v_domain.investigation_mode, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_under_investigation',
      'message', 'Sending domain is under investigation. Sending is halted until recovery is completed.',
      'domain', jsonb_build_object(
        'id', v_domain.id,
        'domain', v_domain.domain,
        'status', v_domain.status,
        'investigation_mode', true,
        'investigation_mode_at', v_domain.investigation_mode_at,
        'investigation_mode_reason', v_domain.investigation_mode_reason
      )
    );
  END IF;

  IF v_domain.status NOT IN ('active', 'warming_up') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_operational',
      'message', 'Sending domain is not operational'
    );
  END IF;

  v_from_email := COALESCE(v_domain.default_from_email, 'mail@' || v_domain.domain);
  v_from_name := COALESCE(v_domain.default_from_name, v_from_name);

  WITH latest_checks AS (
    SELECT DISTINCT ON (check_name) check_name, ok
    FROM email_dns_checks
    WHERE email_domain_id = v_domain.id
      AND check_name IN ('spf', 'dkim', 'return_path', 'dmarc', 'domain_verification')
    ORDER BY check_name, checked_at DESC
  )
  SELECT
    COALESCE(MAX(CASE WHEN check_name = 'spf' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'dkim' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'return_path' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'dmarc' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'domain_verification' THEN ok::int END), 0) = 1
  INTO
    v_spf_ok,
    v_dkim_ok,
    v_return_path_ok,
    v_dmarc_ok,
    v_domain_verification_ok
  FROM latest_checks;

  v_ownership_ok := COALESCE(v_domain_verification_ok, false) OR v_domain.verified_at IS NOT NULL;

  IF NOT v_spf_ok THEN
    v_failures := array_append(v_failures, 'SPF is not verified');
  END IF;

  IF NOT v_dkim_ok THEN
    v_failures := array_append(v_failures, 'DKIM is not verified');
  END IF;

  IF NOT v_return_path_ok THEN
    v_failures := array_append(v_failures, 'Return-path DNS is not verified');
  END IF;

  IF NOT v_dmarc_ok THEN
    v_failures := array_append(v_failures, 'DMARC is missing or does not meet p=none minimum');
  END IF;

  IF NOT v_ownership_ok THEN
    v_failures := array_append(v_failures, 'Domain ownership is not verified');
  END IF;

  IF array_length(v_failures, 1) IS NOT NULL THEN
    IF v_is_high_volume THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'domain_not_compliant_for_scale',
        'message', 'High-volume sending requires SPF, DKIM, DMARC (p=none minimum), and domain ownership verification.',
        'domain', jsonb_build_object(
          'id', v_domain.id,
          'domain', v_domain.domain,
          'status', v_domain.status
        ),
        'sender', jsonb_build_object(
          'from_name', v_from_name,
          'from_email', v_from_email
        ),
        'requested', p_recipient_count,
        'high_volume_threshold', v_high_volume_threshold,
        'compliance', jsonb_build_object(
          'high_volume', true,
          'authenticated_for_scale', false,
          'spf_ok', v_spf_ok,
          'dkim_ok', v_dkim_ok,
          'return_path_ok', v_return_path_ok,
          'dmarc_ok', v_dmarc_ok,
          'ownership_verified', v_ownership_ok,
          'failures', to_jsonb(v_failures),
          'warnings', to_jsonb(v_warnings)
        )
      );
    END IF;

    v_warnings := array_append(v_warnings, 'Domain authentication is incomplete. Low-volume sending is allowed, but high-volume sending is blocked until SPF, DKIM, DMARC, and ownership are verified.');
    v_warnings := v_warnings || v_failures;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'domain', jsonb_build_object(
      'id', v_domain.id,
      'domain', v_domain.domain,
      'status', v_domain.status,
      'investigation_mode', COALESCE(v_domain.investigation_mode, false)
    ),
    'sender', jsonb_build_object(
      'from_name', v_from_name,
      'from_email', v_from_email
    ),
    'requested', p_recipient_count,
    'high_volume_threshold', v_high_volume_threshold,
    'warnings', to_jsonb(v_warnings),
    'compliance', jsonb_build_object(
      'high_volume', v_is_high_volume,
      'authenticated_for_scale', array_length(v_failures, 1) IS NULL,
      'spf_ok', v_spf_ok,
      'dkim_ok', v_dkim_ok,
      'return_path_ok', v_return_path_ok,
      'dmarc_ok', v_dmarc_ok,
      'ownership_verified', v_ownership_ok,
      'failures', to_jsonb(v_failures),
      'warnings', to_jsonb(v_warnings)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_domain_warmup(p_domain_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain record;
  v_days_warming integer;
  v_new_stage integer;
  v_new_daily_limit integer;
  v_new_status text;
  v_bounce_threshold numeric;
  v_complaint_threshold numeric;
  v_base_caps jsonb;
  v_stage_cap_1 integer;
  v_stage_cap_2 integer;
  v_stage_cap_3 integer;
  v_stage_cap_4 integer;
BEGIN
  SELECT * INTO v_domain FROM public.email_domains WHERE id = p_domain_id;

  IF v_domain IS NULL OR v_domain.status NOT IN ('warming_up', 'active') THEN
    RETURN;
  END IF;

  v_bounce_threshold := public.email_gov_eff_num(v_domain.tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate']);
  v_complaint_threshold := public.email_gov_eff_num(v_domain.tenant_id, ARRAY['hard_stop_thresholds','complaint_rate']);
  v_base_caps := public.email_gov_cfg_value(ARRAY['warmup','base_caps']);

  v_stage_cap_1 := COALESCE((v_base_caps->>0)::integer, 50);
  v_stage_cap_2 := COALESCE((v_base_caps->>1)::integer, v_stage_cap_1);
  v_stage_cap_3 := COALESCE((v_base_caps->>2)::integer, v_stage_cap_2);
  v_stage_cap_4 := COALESCE((v_base_caps->>3)::integer, v_stage_cap_3);

  v_days_warming := EXTRACT(DAY FROM (now() - COALESCE(v_domain.warmup_started_at, v_domain.created_at)));

  IF v_days_warming >= 15 THEN
    v_new_stage := 4;
    v_new_daily_limit := v_stage_cap_4;
    v_new_status := 'active';
  ELSIF v_days_warming >= 8 THEN
    v_new_stage := 3;
    v_new_daily_limit := v_stage_cap_3;
    v_new_status := 'warming_up';
  ELSIF v_days_warming >= 4 THEN
    v_new_stage := 2;
    v_new_daily_limit := v_stage_cap_2;
    v_new_status := 'warming_up';
  ELSE
    v_new_stage := 1;
    v_new_daily_limit := v_stage_cap_1;
    v_new_status := 'warming_up';
  END IF;

  IF v_new_status = 'active'
     AND (COALESCE(v_domain.bounce_rate_30d, 0) > v_bounce_threshold
          OR COALESCE(v_domain.complaint_rate_30d, 0) > v_complaint_threshold) THEN
    v_new_status := 'warming_up';
  END IF;

  UPDATE public.email_domains
  SET
    warmup_stage = v_new_stage,
    daily_limit = v_new_daily_limit,
    hourly_limit = GREATEST(v_new_daily_limit / 4, 25),
    status = v_new_status,
    updated_at = now()
  WHERE id = p_domain_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_domain_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bounce_threshold numeric;
  v_complaint_threshold numeric;
BEGIN
  v_bounce_threshold := public.email_gov_eff_num(NEW.tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate']);
  v_complaint_threshold := public.email_gov_eff_num(NEW.tenant_id, ARRAY['hard_stop_thresholds','complaint_rate']);

  IF NEW.bounce_rate_30d > v_bounce_threshold OR NEW.complaint_rate_30d > v_complaint_threshold THEN
    NEW.status := 'paused';
    NEW.notes := COALESCE(NEW.notes, '') ||
      format(
        E'\n[%s] Auto-paused due to reputation issues. Bounce: %s%% (threshold: %s%%), Complaints: %s%% (threshold: %s%%)',
        now()::date,
        round(NEW.bounce_rate_30d * 100, 2),
        round(v_bounce_threshold * 100, 2),
        round(NEW.complaint_rate_30d * 100, 3),
        round(v_complaint_threshold * 100, 3)
      );
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Strict/Relaxed profile apply (admin)
CREATE OR REPLACE FUNCTION public.admin_apply_email_governance_profile(
  p_profile TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_profile TEXT := lower(COALESCE(NULLIF(btrim(p_profile), ''), ''));
  v_cfg JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF v_profile NOT IN ('strict', 'relaxed') THEN
    RAISE EXCEPTION 'Unsupported profile. Expected strict|relaxed.';
  END IF;

  IF v_profile = 'relaxed' THEN
    v_cfg := public.email_governance_default_config();
  ELSE
    v_cfg := public.get_email_governance_config();

    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,hard_bounce_rate}', to_jsonb(0.04::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,complaint_rate}', to_jsonb(0.0015::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,spam_rate}', to_jsonb(0.0025::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,failed_delivery_rate}', to_jsonb(0.06::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,rejected_rate}', to_jsonb(0.08::numeric), true);

    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,hard_bounce_rate}', to_jsonb(0.02::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,soft_bounce_rate}', to_jsonb(0.04::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,complaint_rate}', to_jsonb(0.0007::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,trend_multiplier}', to_jsonb(2::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,trend_prior_min_sent}', to_jsonb(100::integer), true);
  END IF;

  RETURN public.admin_set_email_governance_config(
    v_cfg,
    COALESCE(NULLIF(btrim(p_reason), ''), format('apply_%s_profile', v_profile))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_apply_email_governance_profile(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
