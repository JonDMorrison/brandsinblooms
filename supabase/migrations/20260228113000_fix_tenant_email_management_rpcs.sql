-- Repair migration: recreate tenant email management RPCs.
--
-- Some environments ended up missing these SECURITY DEFINER admin RPCs,
-- causing PostgREST schema-cache errors when loading:
--   /admin/tenants/:tenantId/email

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


CREATE OR REPLACE FUNCTION public.admin_list_tenant_campaigns(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT 'all',
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_page INTEGER := GREATEST(COALESCE(p_page, 0), 0);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_offset INTEGER := v_page * v_page_size;
  v_count INTEGER := 0;
  v_data JSONB := '[]'::jsonb;
  v_search TEXT := NULLIF(lower(btrim(COALESCE(p_search, ''))), '');
  v_status TEXT := lower(COALESCE(p_status_filter, 'all'));
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH base AS (
    SELECT
      c.id,
      c.name,
      c.subject_line,
      c.status,
      c.scheduled_at,
      c.send_started_at,
      c.sent_at,
      c.updated_at,
      c.created_at,
      COALESCE(i.admin_paused, false) AS admin_paused,
      COALESCE(i.force_stopped, false) AS force_stopped,
      COALESCE(i.autopause_override_enabled, false) AS autopause_override_enabled,
      COALESCE(i.autopause_override_precedence, 'automation_allowed') AS autopause_override_precedence
    FROM public.crm_campaigns c
    LEFT JOIN public.email_governance_campaign_intervention_state i
      ON i.campaign_id = c.id
    WHERE c.tenant_id = p_tenant_id
      AND (
        v_search IS NULL
        OR lower(c.name) LIKE '%' || v_search || '%'
        OR lower(COALESCE(c.subject_line, '')) LIKE '%' || v_search || '%'
        OR c.id::text ILIKE '%' || v_search || '%'
      )
      AND (
        v_status = 'all'
        OR lower(c.status) = v_status
      )
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM base;

  WITH base AS (
    SELECT
      c.id,
      c.name,
      c.subject_line,
      c.status,
      c.scheduled_at,
      c.send_started_at,
      c.sent_at,
      c.updated_at,
      c.created_at,
      COALESCE(i.admin_paused, false) AS admin_paused,
      COALESCE(i.force_stopped, false) AS force_stopped,
      COALESCE(i.autopause_override_enabled, false) AS autopause_override_enabled,
      COALESCE(i.autopause_override_precedence, 'automation_allowed') AS autopause_override_precedence
    FROM public.crm_campaigns c
    LEFT JOIN public.email_governance_campaign_intervention_state i
      ON i.campaign_id = c.id
    WHERE c.tenant_id = p_tenant_id
      AND (
        v_search IS NULL
        OR lower(c.name) LIKE '%' || v_search || '%'
        OR lower(COALESCE(c.subject_line, '')) LIKE '%' || v_search || '%'
        OR c.id::text ILIKE '%' || v_search || '%'
      )
      AND (
        v_status = 'all'
        OR lower(c.status) = v_status
      )
    ORDER BY c.updated_at DESC, c.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'subject_line', subject_line,
        'status', status,
        'scheduled_at', scheduled_at,
        'send_started_at', send_started_at,
        'sent_at', sent_at,
        'updated_at', updated_at,
        'created_at', created_at,
        'admin_paused', admin_paused,
        'force_stopped', force_stopped,
        'autopause_override_enabled', autopause_override_enabled,
        'autopause_override_precedence', autopause_override_precedence
      )
    ),
    '[]'::jsonb
  )
  INTO v_data
  FROM base;

  RETURN jsonb_build_object(
    'data', v_data,
    'count', v_count,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.admin_get_tenant_email_management_panel(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_24_start TIMESTAMPTZ := COALESCE(p_as_of, now()) - INTERVAL '24 hours';
  v_30_start TIMESTAMPTZ := COALESCE(p_as_of, now()) - INTERVAL '30 days';
  v_company_name TEXT;

  v_sent_24h INTEGER := 0;
  v_delivered_24h INTEGER := 0;
  v_hard_bounce_24h INTEGER := 0;
  v_soft_bounce_24h INTEGER := 0;
  v_complaint_24h INTEGER := 0;
  v_unsub_24h INTEGER := 0;
  v_failed_24h INTEGER := 0;

  v_sent_30d INTEGER := 0;
  v_delivered_30d INTEGER := 0;
  v_hard_bounce_30d INTEGER := 0;
  v_soft_bounce_30d INTEGER := 0;
  v_complaint_30d INTEGER := 0;
  v_unsub_30d INTEGER := 0;
  v_failed_30d INTEGER := 0;

  v_policy RECORD;
  v_score INTEGER := 100;
  v_tier TEXT := 'normal';
  v_action TEXT := 'allow';
  v_reputation_state JSONB := '{}'::jsonb;
  v_thresholds JSONB := '{}'::jsonb;
  v_send_limits JSONB := '{}'::jsonb;
  v_tenant_state JSONB := '{}'::jsonb;
  v_overrides JSONB := '{}'::jsonb;

  v_control RECORD;
  v_subscription RECORD;
  v_boost_active BOOLEAN := false;
  v_emergency_active BOOLEAN := false;
  v_effective_monthly_limit INTEGER;
  v_effective_daily_limit INTEGER;
  v_effective_hourly_limit INTEGER;
  v_monthly_used INTEGER := 0;
  v_daily_used INTEGER := 0;
  v_hourly_used INTEGER := 0;
  v_sending_limit_state JSONB := '{}'::jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  PERFORM public.refresh_email_governance_tenant_reputation_score(p_tenant_id, v_window_end);

  SELECT t.company_name
  INTO v_company_name
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

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
    v_sent_24h,
    v_delivered_24h,
    v_hard_bounce_24h,
    v_soft_bounce_24h,
    v_complaint_24h,
    v_unsub_24h
  FROM public.email_governance_email_events e
  LEFT JOIN public.email_governance_tenant_control_state s
    ON s.tenant_id = e.tenant_id
  WHERE e.tenant_id = p_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_24_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end
    AND NOT (
      e.event_type = 'bounced'
      AND s.forgive_bounce_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_bounce_before
    )
    AND NOT (
      e.event_type = 'complained'
      AND s.forgive_complaint_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_complaint_before
    );

  SELECT COUNT(*)::INTEGER
  INTO v_failed_24h
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'failed'
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) >= v_24_start
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

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
    v_sent_30d,
    v_delivered_30d,
    v_hard_bounce_30d,
    v_soft_bounce_30d,
    v_complaint_30d,
    v_unsub_30d
  FROM public.email_governance_email_events e
  LEFT JOIN public.email_governance_tenant_control_state s
    ON s.tenant_id = e.tenant_id
  WHERE e.tenant_id = p_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_30_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end
    AND NOT (
      e.event_type = 'bounced'
      AND s.forgive_bounce_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_bounce_before
    )
    AND NOT (
      e.event_type = 'complained'
      AND s.forgive_complaint_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_complaint_before
    );

  SELECT COUNT(*)::INTEGER
  INTO v_failed_30d
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'failed'
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) >= v_30_start
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  SELECT * INTO v_policy
  FROM public.get_tenant_reputation_policy(p_tenant_id);

  SELECT r.score
  INTO v_score
  FROM public.email_governance_tenant_reputation_scores r
  WHERE r.tenant_id = p_tenant_id
  LIMIT 1;

  v_score := COALESCE(v_score, COALESCE(v_policy.score, 100));
  v_tier := COALESCE(v_policy.tier, 'normal');
  v_action := COALESCE(v_policy.action, 'allow');

  SELECT public.get_tenant_email_governance_overrides(p_tenant_id)
  INTO v_overrides;

  SELECT jsonb_build_object(
    'email_under_review', COALESCE(t.email_under_review, false),
    'email_under_review_at', t.email_under_review_at,
    'email_under_review_reason', t.email_under_review_reason,
    'email_under_review_details', t.email_under_review_details
  )
  INTO v_tenant_state
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  SELECT jsonb_build_object(
    'manual_reputation_score', s.manual_reputation_score,
    'is_reputation_frozen', COALESCE(s.is_reputation_frozen, false),
    'reputation_override_mode', COALESCE(s.reputation_override_mode, CASE WHEN s.manual_reputation_score IS NOT NULL THEN 'final' ELSE NULL END),
    'reputation_override_expires_at', s.reputation_override_expires_at,
    'reputation_override_reason', s.reputation_override_reason,
    'reputation_override_active', (
      s.manual_reputation_score IS NOT NULL
      AND (
        COALESCE(s.reputation_override_mode, 'final') = 'final'
        OR (
          s.reputation_override_mode = 'temporary'
          AND s.reputation_override_expires_at IS NOT NULL
          AND v_window_end < s.reputation_override_expires_at
        )
      )
    ),
    'penalties_disabled_until', s.penalties_disabled_until,
    'penalties_disabled_reason', s.penalties_disabled_reason,
    'penalties_disabled_active', (
      NOT COALESCE(s.is_reputation_frozen, false)
      AND (
        s.penalties_disabled_until IS NULL
        OR v_window_end < s.penalties_disabled_until
      )
    ),
    'forgive_bounce_before', s.forgive_bounce_before,
    'forgive_complaint_before', s.forgive_complaint_before,
    'updated_at', s.updated_at,
    'updated_reason', s.updated_reason
  )
  INTO v_reputation_state
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  v_reputation_state := COALESCE(v_reputation_state, jsonb_build_object(
    'manual_reputation_score', NULL,
    'is_reputation_frozen', false,
    'reputation_override_mode', NULL,
    'reputation_override_expires_at', NULL,
    'reputation_override_reason', NULL,
    'reputation_override_active', false,
    'penalties_disabled_until', NULL,
    'penalties_disabled_reason', NULL,
    'penalties_disabled_active', false,
    'forgive_bounce_before', NULL,
    'forgive_complaint_before', NULL,
    'updated_at', NULL,
    'updated_reason', NULL
  ));

  v_thresholds := jsonb_build_object(
    'hard_bounce_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate'])
    ),
    'soft_bounce_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['warning_thresholds','soft_bounce_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['warning_thresholds','soft_bounce_rate'])
    ),
    'complaint_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','complaint_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','complaint_rate'])
    ),
    'spam_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','spam_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','spam_rate'])
    ),
    'delivery_failure_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','failed_delivery_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','failed_delivery_rate'])
    )
  );

  SELECT
    COALESCE(s.unlimited_sending_enabled, false) AS unlimited_sending_enabled,
    COALESCE(s.emergency_restriction_enabled, false) AS emergency_restriction_enabled,
    s.emergency_restriction_until,
    s.emergency_restriction_reason,
    s.send_limit_monthly,
    s.send_limit_daily,
    s.send_limit_hourly,
    s.boost_until,
    s.boost_monthly,
    s.boost_daily,
    s.boost_hourly,
    s.boost_reason
  INTO v_control
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  SELECT s.*
  INTO v_subscription
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  v_boost_active := (
    v_control.boost_until IS NOT NULL
    AND v_window_end < v_control.boost_until
  );

  v_emergency_active := (
    COALESCE(v_control.emergency_restriction_enabled, false)
    AND (
      v_control.emergency_restriction_until IS NULL
      OR v_window_end < v_control.emergency_restriction_until
    )
  );

  IF v_boost_active AND v_control.boost_monthly IS NOT NULL THEN
    v_effective_monthly_limit := v_control.boost_monthly;
  ELSIF v_control.send_limit_monthly IS NOT NULL THEN
    v_effective_monthly_limit := v_control.send_limit_monthly;
  ELSIF v_subscription.email_quota IS NOT NULL AND v_subscription.email_quota >= 0 THEN
    v_effective_monthly_limit := v_subscription.email_quota;
  ELSE
    v_effective_monthly_limit := NULL;
  END IF;

  IF v_boost_active AND v_control.boost_daily IS NOT NULL THEN
    v_effective_daily_limit := v_control.boost_daily;
  ELSE
    v_effective_daily_limit := v_control.send_limit_daily;
  END IF;

  IF v_boost_active AND v_control.boost_hourly IS NOT NULL THEN
    v_effective_hourly_limit := v_control.boost_hourly;
  ELSE
    v_effective_hourly_limit := v_control.send_limit_hourly;
  END IF;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_monthly_used
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'sent'
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= date_trunc('month', v_window_end)
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_daily_used
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'sent'
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= date_trunc('day', v_window_end)
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_hourly_used
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'sent'
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= date_trunc('hour', v_window_end)
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  v_sending_limit_state := jsonb_build_object(
    'unlimited_sending_enabled', COALESCE(v_control.unlimited_sending_enabled, false),
    'emergency_restriction_enabled', COALESCE(v_control.emergency_restriction_enabled, false),
    'emergency_restriction_until', v_control.emergency_restriction_until,
    'emergency_restriction_reason', v_control.emergency_restriction_reason,
    'emergency_restriction_active', v_emergency_active,
    'base_monthly_limit', v_control.send_limit_monthly,
    'base_daily_limit', v_control.send_limit_daily,
    'base_hourly_limit', v_control.send_limit_hourly,
    'boost_until', v_control.boost_until,
    'boost_monthly', v_control.boost_monthly,
    'boost_daily', v_control.boost_daily,
    'boost_hourly', v_control.boost_hourly,
    'boost_reason', v_control.boost_reason,
    'boost_active', v_boost_active,
    'effective_monthly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_monthly_limit
    END,
    'effective_daily_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_daily_limit
    END,
    'effective_hourly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_hourly_limit
    END,
    'monthly_used', v_monthly_used,
    'daily_used', v_daily_used,
    'hourly_used', v_hourly_used
  );

  v_send_limits := jsonb_build_object(
    'recipient_cap', v_policy.recipient_cap,
    'job_batch_size', v_policy.job_batch_size,
    'send_pacing_multiplier', v_policy.send_pacing_multiplier,
    'reputation_tier', v_tier,
    'reputation_action', v_action,
    'is_unlimited', COALESCE(v_control.unlimited_sending_enabled, false),
    'monthly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_monthly_limit
    END,
    'daily_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_daily_limit
    END,
    'hourly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_hourly_limit
    END
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'company_name', v_company_name,
    'as_of', v_window_end,
    'reputation_score', v_score,
    'current_reputation_tier', v_tier,
    'reputation_action', v_action,
    'tenant_state', COALESCE(v_tenant_state, '{}'::jsonb),
    'reputation_state', v_reputation_state,
    'sending_limit_state', v_sending_limit_state,
    'metrics_24h', jsonb_build_object(
      'sent', COALESCE(v_sent_24h, 0),
      'delivered', COALESCE(v_delivered_24h, 0),
      'hard_bounce_count', COALESCE(v_hard_bounce_24h, 0),
      'soft_bounce_count', COALESCE(v_soft_bounce_24h, 0),
      'complaint_count', COALESCE(v_complaint_24h, 0),
      'unsubscribe_count', COALESCE(v_unsub_24h, 0),
      'failed_count', COALESCE(v_failed_24h, 0),
      'hard_bounce_rate', COALESCE(v_hard_bounce_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'soft_bounce_rate', COALESCE(v_soft_bounce_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'complaint_rate', COALESCE(v_complaint_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'unsubscribe_rate', COALESCE(v_unsub_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'delivery_failure_rate', COALESCE(v_failed_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0) + COALESCE(v_failed_24h, 0), 1)
    ),
    'metrics_30d', jsonb_build_object(
      'sent', COALESCE(v_sent_30d, 0),
      'delivered', COALESCE(v_delivered_30d, 0),
      'hard_bounce_count', COALESCE(v_hard_bounce_30d, 0),
      'soft_bounce_count', COALESCE(v_soft_bounce_30d, 0),
      'complaint_count', COALESCE(v_complaint_30d, 0),
      'unsubscribe_count', COALESCE(v_unsub_30d, 0),
      'failed_count', COALESCE(v_failed_30d, 0),
      'hard_bounce_rate', COALESCE(v_hard_bounce_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'soft_bounce_rate', COALESCE(v_soft_bounce_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'complaint_rate', COALESCE(v_complaint_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'unsubscribe_rate', COALESCE(v_unsub_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'delivery_failure_rate', COALESCE(v_failed_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0) + COALESCE(v_failed_30d, 0), 1)
    ),
    'current_thresholds_effective', v_thresholds,
    'current_send_limits', v_send_limits,
    'tenant_overrides', COALESCE(v_overrides, '{}'::jsonb)
  );
END;
$$;


GRANT EXECUTE ON FUNCTION public.admin_list_tenant_suppressions(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_tenant_campaigns(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_email_management_panel(UUID, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
