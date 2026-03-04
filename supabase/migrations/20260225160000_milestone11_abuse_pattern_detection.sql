-- Milestone 11: Abuse & Pattern Detection System
-- Objective: detect high-risk/malicious sending behavior before send and require manual review.

CREATE TABLE IF NOT EXISTS public.email_governance_contact_import_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  contact_count INTEGER NOT NULL CHECK (contact_count > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_import_events_tenant_time
  ON public.email_governance_contact_import_events (tenant_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.record_contact_import_event(
  p_tenant_id UUID,
  p_source TEXT,
  p_contact_count INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  tenant_id UUID,
  source TEXT,
  contact_count INTEGER,
  rolling_24h_total INTEGER,
  occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_rolling_24h_total INTEGER := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF COALESCE(p_contact_count, 0) <= 0 THEN
    RAISE EXCEPTION 'p_contact_count must be > 0';
  END IF;

  INSERT INTO public.email_governance_contact_import_events (
    tenant_id,
    source,
    contact_count,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    COALESCE(NULLIF(trim(p_source), ''), 'unknown'),
    p_contact_count,
    COALESCE(p_metadata, '{}'::jsonb),
    v_now
  );

  SELECT COALESCE(SUM(e.contact_count), 0)::INTEGER
  INTO v_rolling_24h_total
  FROM public.email_governance_contact_import_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.occurred_at >= v_now - INTERVAL '24 hours'
    AND e.occurred_at <= v_now;

  tenant_id := p_tenant_id;
  source := COALESCE(NULLIF(trim(p_source), ''), 'unknown');
  contact_count := p_contact_count;
  rolling_24h_total := v_rolling_24h_total;
  occurred_at := v_now;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_campaign_abuse_risk(
  p_campaign_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  risk_level TEXT,
  action TEXT,
  should_block BOOLEAN,
  requires_manual_review BOOLEAN,
  monitoring_severity TEXT,
  reasons TEXT[],
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_as_of TIMESTAMPTZ := COALESCE(p_as_of, now());

  v_audience_total INTEGER := 0;
  v_inactive_count INTEGER := 0;
  v_inactive_pct NUMERIC := 0;

  v_import_24h_total INTEGER := 0;

  v_avg_daily_sent NUMERIC := 0;
  v_max_daily_sent INTEGER := 0;
  v_days_with_sends INTEGER := 0;

  v_recent_sent INTEGER := 0;
  v_recent_complaints INTEGER := 0;
  v_prior_sent INTEGER := 0;
  v_prior_complaints INTEGER := 0;
  v_recent_complaint_rate NUMERIC := 0;
  v_prior_complaint_rate NUMERIC := 0;

  v_bounce_cluster_domain_count INTEGER := 0;
  v_bounce_cluster_max_domain TEXT := NULL;
  v_bounce_cluster_max_hard_bounces INTEGER := 0;

  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_risk_level TEXT := 'low';
  v_action TEXT := 'allow';
  v_should_block BOOLEAN := false;
  v_requires_manual_review BOOLEAN := false;
  v_monitoring_severity TEXT := 'normal';
BEGIN
  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
  END IF;

  SELECT
    COALESCE(h.audience_total, 0),
    COALESCE(h.inactive_count, 0),
    COALESCE(h.inactive_pct, 0)
  INTO
    v_audience_total,
    v_inactive_count,
    v_inactive_pct
  FROM public.campaign_hygiene_reports h
  WHERE h.campaign_id = p_campaign_id
  ORDER BY h.created_at DESC
  LIMIT 1;

  SELECT COALESCE(SUM(e.contact_count), 0)::INTEGER
  INTO v_import_24h_total
  FROM public.email_governance_contact_import_events e
  WHERE e.tenant_id = v_tenant_id
    AND e.occurred_at >= v_as_of - INTERVAL '24 hours'
    AND e.occurred_at <= v_as_of;

  IF v_import_24h_total > 50000 THEN
    v_reasons := array_append(v_reasons, format('import_spike_24h=%s', v_import_24h_total));
  END IF;

  WITH daily_sent AS (
    SELECT
      date_trunc('day', COALESCE(e.event_ts_provider, e.ingested_at)) AS sent_day,
      COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER AS sent_count
    FROM public.email_governance_email_events e
    WHERE e.tenant_id = v_tenant_id
      AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_as_of - INTERVAL '14 days'
      AND COALESCE(e.event_ts_provider, e.ingested_at) < v_as_of
    GROUP BY 1
  )
  SELECT
    COALESCE(AVG(d.sent_count), 0),
    COALESCE(MAX(d.sent_count), 0),
    COUNT(*)::INTEGER
  INTO
    v_avg_daily_sent,
    v_max_daily_sent,
    v_days_with_sends
  FROM daily_sent d;

  IF v_audience_total >= 5000
     AND v_avg_daily_sent >= 500
     AND v_audience_total > (v_avg_daily_sent * 3) THEN
    v_reasons := array_append(v_reasons, format('volume_spike_3x_14d_avg=%s_vs_%.2f', v_audience_total, v_avg_daily_sent));
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_recent_sent,
    v_recent_complaints
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = v_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_as_of - INTERVAL '1 hour'
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_as_of;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_prior_sent,
    v_prior_complaints
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = v_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_as_of - INTERVAL '25 hours'
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_as_of - INTERVAL '1 hour';

  v_recent_complaint_rate := v_recent_complaints::NUMERIC / GREATEST(v_recent_sent, 1);
  v_prior_complaint_rate := v_prior_complaints::NUMERIC / GREATEST(v_prior_sent, 1);

  IF v_recent_sent >= 200
     AND v_prior_sent >= 500
     AND v_prior_complaint_rate > 0
     AND v_recent_complaint_rate >= v_prior_complaint_rate * 3
     AND v_recent_complaint_rate >= 0.001 THEN
    v_reasons := array_append(v_reasons, format('complaint_spike_anomaly=%.4f_vs_%.4f', v_recent_complaint_rate, v_prior_complaint_rate));
  END IF;

  WITH recent_domain_rates AS (
    SELECT
      lower(split_part(e.email, '@', 2)) AS recipient_domain,
      COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER AS sent_count,
      COUNT(*) FILTER (
        WHERE e.event_type = 'bounced'
          AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
      )::INTEGER AS hard_bounce_count
    FROM public.email_governance_email_events e
    WHERE e.tenant_id = v_tenant_id
      AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_as_of - INTERVAL '6 hours'
      AND COALESCE(e.event_ts_provider, e.ingested_at) < v_as_of
      AND position('@' in COALESCE(e.email, '')) > 0
    GROUP BY 1
  ), suspicious_domains AS (
    SELECT
      r.recipient_domain,
      r.sent_count,
      r.hard_bounce_count,
      (r.hard_bounce_count::NUMERIC / GREATEST(r.sent_count, 1)) AS hard_bounce_rate
    FROM recent_domain_rates r
    WHERE r.sent_count >= 100
      AND r.hard_bounce_count >= 20
      AND (r.hard_bounce_count::NUMERIC / GREATEST(r.sent_count, 1)) >= 0.10
  )
  SELECT
    COUNT(*)::INTEGER,
    (
      SELECT s.recipient_domain
      FROM suspicious_domains s
      ORDER BY s.hard_bounce_count DESC, s.recipient_domain
      LIMIT 1
    ),
    COALESCE(
      (
        SELECT s.hard_bounce_count
        FROM suspicious_domains s
        ORDER BY s.hard_bounce_count DESC, s.recipient_domain
        LIMIT 1
      ),
      0
    )
  INTO
    v_bounce_cluster_domain_count,
    v_bounce_cluster_max_domain,
    v_bounce_cluster_max_hard_bounces
  FROM suspicious_domains;

  IF v_bounce_cluster_domain_count >= 2 THEN
    v_reasons := array_append(v_reasons, format('repeated_bounce_cluster_patterns=%s_domains', v_bounce_cluster_domain_count));
  ELSIF v_bounce_cluster_domain_count = 1 THEN
    v_reasons := array_append(v_reasons, format('bounce_cluster_pattern=%s', COALESCE(v_bounce_cluster_max_domain, 'unknown')));
  END IF;

  IF v_audience_total >= 5000 AND v_inactive_pct > 50 THEN
    v_reasons := array_append(v_reasons, format('cold_recipients_ratio=%.3f', v_inactive_pct));
  END IF;

  IF v_import_24h_total > 50000
     AND v_audience_total >= 5000
     AND v_inactive_pct > 50 THEN
    v_reasons := array_append(v_reasons, 'purchased_list_behavior_indicator');
  END IF;

  v_should_block := cardinality(v_reasons) > 0;
  v_requires_manual_review := v_should_block;

  IF v_should_block THEN
    v_action := 'block_and_review';
    v_monitoring_severity := 'critical';

    IF EXISTS (
      SELECT 1
      FROM unnest(v_reasons) AS r(reason)
      WHERE r.reason ILIKE '%purchased_list%'
         OR r.reason ILIKE 'import_spike_24h%'
         OR r.reason ILIKE '%complaint_spike_anomaly%'
    ) THEN
      v_risk_level := 'critical';
    ELSE
      v_risk_level := 'high';
    END IF;
  END IF;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  risk_level := v_risk_level;
  action := v_action;
  should_block := v_should_block;
  requires_manual_review := v_requires_manual_review;
  monitoring_severity := v_monitoring_severity;
  reasons := v_reasons;
  details := jsonb_build_object(
    'as_of', v_as_of,
    'signals', jsonb_build_object(
      'import_24h_total', v_import_24h_total,
      'audience_total', v_audience_total,
      'inactive_count', v_inactive_count,
      'inactive_pct', v_inactive_pct,
      'avg_daily_sent_14d', v_avg_daily_sent,
      'max_daily_sent_14d', v_max_daily_sent,
      'days_with_sends_14d', v_days_with_sends,
      'recent_sent_1h', v_recent_sent,
      'recent_complaints_1h', v_recent_complaints,
      'recent_complaint_rate_1h', v_recent_complaint_rate,
      'prior_sent_24h', v_prior_sent,
      'prior_complaints_24h', v_prior_complaints,
      'prior_complaint_rate_24h', v_prior_complaint_rate,
      'bounce_cluster_domain_count_6h', v_bounce_cluster_domain_count,
      'bounce_cluster_top_domain', v_bounce_cluster_max_domain,
      'bounce_cluster_top_hard_bounces', v_bounce_cluster_max_hard_bounces
    ),
    'thresholds', jsonb_build_object(
      'import_spike_24h_contacts', 50000,
      'volume_spike_multiplier', 3,
      'volume_spike_min_audience', 5000,
      'volume_spike_min_avg_daily_sent', 500,
      'cold_inactive_pct', 50,
      'cold_min_audience', 5000,
      'complaint_spike_multiplier', 3,
      'complaint_recent_window', '1 hour',
      'complaint_prior_window', '24 hours',
      'bounce_cluster_window', '6 hours',
      'bounce_cluster_min_domains_for_repeated', 2,
      'bounce_cluster_min_sent_per_domain', 100,
      'bounce_cluster_min_hard_bounces_per_domain', 20,
      'bounce_cluster_min_hard_bounce_rate', 0.10
    )
  );

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
BEGIN
  SELECT *
  INTO v_eval
  FROM public.evaluate_campaign_abuse_risk(p_campaign_id, p_as_of)
  LIMIT 1;

  IF v_eval.campaign_id IS NULL THEN
    RAISE EXCEPTION 'Failed to evaluate abuse risk for campaign %', p_campaign_id;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.record_contact_import_event(UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_contact_import_event(UUID, TEXT, INTEGER, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION public.evaluate_campaign_abuse_risk(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_abuse_risk(UUID, TIMESTAMPTZ) TO service_role;

GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_abuse_under_review(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_abuse_under_review(UUID, TEXT, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';
