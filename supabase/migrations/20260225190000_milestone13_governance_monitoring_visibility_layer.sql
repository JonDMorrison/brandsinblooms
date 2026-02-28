-- Milestone 13: Governance Monitoring & Visibility Layer
-- Adds read-only tenant and campaign visibility RPCs for governance health.

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
  v_window_start TIMESTAMPTZ := COALESCE(p_as_of, now()) - INTERVAL '24 hours';

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

  IF v_hard_bounce_rate >= 0.05 THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('hard_bounce_rate=%.4f (threshold=0.0500)', v_hard_bounce_rate));
  END IF;

  IF v_complaint_rate >= 0.002 THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('complaint_rate=%.4f (threshold=0.0020)', v_complaint_rate));
  END IF;

  IF v_failed_delivery_rate >= 0.08 THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('failed_delivery_rate=%.4f (threshold=0.0800)', v_failed_delivery_rate));
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
      'hard_bounce_rate', 0.03,
      'soft_bounce_rate', 0.05,
      'complaint_rate', 0.001
    ),
    'hard_stop_thresholds', jsonb_build_object(
      'hard_bounce_rate', 0.05,
      'complaint_rate', 0.002,
      'failed_delivery_rate', 0.08
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


CREATE OR REPLACE FUNCTION public.get_tenant_email_health_dashboard(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  tenant_id UUID,
  as_of TIMESTAMPTZ,
  reputation_score INTEGER,
  reputation_tier TEXT,
  reputation_action TEXT,
  trend_direction TEXT,
  trend_delta INTEGER,
  baseline_score_7d INTEGER,
  sent_24h INTEGER,
  delivered_24h INTEGER,
  bounced_24h INTEGER,
  complained_24h INTEGER,
  unsubscribed_24h INTEGER,
  bounce_rate_24h NUMERIC,
  complaint_rate_24h NUMERIC,
  sent_30d INTEGER,
  delivered_30d INTEGER,
  bounced_30d INTEGER,
  complained_30d INTEGER,
  unsubscribed_30d INTEGER,
  bounce_rate_30d NUMERIC,
  complaint_rate_30d NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_effective_as_of TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_policy RECORD;
  v_snapshot_24h RECORD;
  v_snapshot_30d RECORD;
  v_current_score INTEGER := 100;
  v_baseline_score_7d INTEGER := 100;
  v_trend_delta INTEGER := 0;
  v_trend_direction TEXT := 'flat';
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id <> p_tenant_id THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_policy
  FROM public.get_tenant_reputation_policy(p_tenant_id);

  SELECT s.*
  INTO v_snapshot_24h
  FROM public.email_governance_tenant_reputation_snapshots s
  WHERE s.tenant_id = p_tenant_id
    AND s.window_key = '24h'
    AND s.as_of <= v_effective_as_of
  ORDER BY s.as_of DESC
  LIMIT 1;

  SELECT s.*
  INTO v_snapshot_30d
  FROM public.email_governance_tenant_reputation_snapshots s
  WHERE s.tenant_id = p_tenant_id
    AND s.window_key = '30d'
    AND s.as_of <= v_effective_as_of
  ORDER BY s.as_of DESC
  LIMIT 1;

  SELECT r.score
  INTO v_current_score
  FROM public.email_governance_tenant_reputation_scores r
  WHERE r.tenant_id = p_tenant_id
  LIMIT 1;

  SELECT h.score
  INTO v_baseline_score_7d
  FROM public.email_governance_tenant_reputation_score_history h
  WHERE h.tenant_id = p_tenant_id
    AND h.as_of <= (v_effective_as_of - INTERVAL '7 days')
  ORDER BY h.as_of DESC
  LIMIT 1;

  v_current_score := COALESCE(v_current_score, COALESCE(v_policy.score, 100));
  v_baseline_score_7d := COALESCE(v_baseline_score_7d, v_current_score);
  v_trend_delta := v_current_score - v_baseline_score_7d;

  IF v_trend_delta > 1 THEN
    v_trend_direction := 'up';
  ELSIF v_trend_delta < -1 THEN
    v_trend_direction := 'down';
  ELSE
    v_trend_direction := 'flat';
  END IF;

  tenant_id := p_tenant_id;
  as_of := v_effective_as_of;
  reputation_score := v_current_score;
  reputation_tier := COALESCE(v_policy.tier, 'normal');
  reputation_action := COALESCE(v_policy.action, 'allow');
  trend_direction := v_trend_direction;
  trend_delta := v_trend_delta;
  baseline_score_7d := v_baseline_score_7d;

  sent_24h := COALESCE(v_snapshot_24h.sent_count, 0);
  delivered_24h := COALESCE(v_snapshot_24h.delivered_count, 0);
  bounced_24h := COALESCE(v_snapshot_24h.bounced_count, 0);
  complained_24h := COALESCE(v_snapshot_24h.complained_count, 0);
  unsubscribed_24h := COALESCE(v_snapshot_24h.unsubscribed_count, 0);
  bounce_rate_24h := COALESCE(v_snapshot_24h.bounce_rate, 0);
  complaint_rate_24h := COALESCE(v_snapshot_24h.complaint_rate, 0);

  sent_30d := COALESCE(v_snapshot_30d.sent_count, 0);
  delivered_30d := COALESCE(v_snapshot_30d.delivered_count, 0);
  bounced_30d := COALESCE(v_snapshot_30d.bounced_count, 0);
  complained_30d := COALESCE(v_snapshot_30d.complained_count, 0);
  unsubscribed_30d := COALESCE(v_snapshot_30d.unsubscribed_count, 0);
  bounce_rate_30d := COALESCE(v_snapshot_30d.bounce_rate, 0);
  complaint_rate_30d := COALESCE(v_snapshot_30d.complaint_rate, 0);

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_governance_visibility(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_governance_visibility(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_email_health_dashboard(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_email_health_dashboard(UUID, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';
