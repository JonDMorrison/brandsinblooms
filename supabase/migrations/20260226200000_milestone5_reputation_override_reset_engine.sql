-- Milestone 5: Reputation Override & Reset Engine
-- Adds manual precedence modes, optional override expiration, and penalty disable controls.

ALTER TABLE public.email_governance_tenant_control_state
  ADD COLUMN IF NOT EXISTS reputation_override_mode TEXT,
  ADD COLUMN IF NOT EXISTS reputation_override_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reputation_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS penalties_disabled_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalties_disabled_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_override_mode_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_override_mode_check
      CHECK (
        reputation_override_mode IS NULL
        OR reputation_override_mode IN ('final', 'temporary')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_override_expiration_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_override_expiration_check
      CHECK (
        reputation_override_mode <> 'temporary'
        OR reputation_override_expires_at IS NOT NULL
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_email_governance_tenant_reputation_score(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_24h RECORD;
  v_snapshot_30d RECORD;
  v_sent_24h INTEGER := 0;
  v_sent_30d INTEGER := 0;
  v_bounce_rate_24h NUMERIC := 0;
  v_complaint_rate_24h NUMERIC := 0;
  v_unsub_rate_24h NUMERIC := 0;
  v_unsub_rate_30d NUMERIC := 0;
  v_spamtrap_hits_24h INTEGER := 0;
  v_spamtrap_hits_30d INTEGER := 0;
  v_suppressed_attempts_24h INTEGER := 0;
  v_suppressed_attempts_30d INTEGER := 0;
  v_bounce_pct NUMERIC := 0;
  v_complaint_pct NUMERIC := 0;
  v_unsub_spike_pct NUMERIC := 0;
  v_penalty_bounce NUMERIC := 0;
  v_penalty_complaint NUMERIC := 0;
  v_penalty_spamtrap NUMERIC := 0;
  v_penalty_suppressed NUMERIC := 0;
  v_penalty_unsub_spike NUMERIC := 0;
  v_penalty_total NUMERIC := 0;
  v_score INTEGER := 100;
  v_status TEXT := 'healthy';
  v_inputs JSONB;
  v_penalties JSONB;
  v_manual_reputation_score INTEGER;
  v_is_reputation_frozen BOOLEAN := false;
  v_existing_score INTEGER;
  v_existing_status TEXT;
  v_existing_inputs JSONB;
  v_existing_penalties JSONB;
  v_existing_as_of TIMESTAMPTZ;
  v_override_mode TEXT;
  v_override_expires_at TIMESTAMPTZ;
  v_penalties_disabled_until TIMESTAMPTZ;
  v_override_active BOOLEAN := false;
  v_penalties_disabled_active BOOLEAN := false;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT
    s.manual_reputation_score,
    s.is_reputation_frozen,
    s.reputation_override_mode,
    s.reputation_override_expires_at,
    s.penalties_disabled_until
  INTO
    v_manual_reputation_score,
    v_is_reputation_frozen,
    v_override_mode,
    v_override_expires_at,
    v_penalties_disabled_until
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  IF v_manual_reputation_score IS NOT NULL AND v_override_mode IS NULL THEN
    v_override_mode := 'final';
  END IF;

  v_override_active := (
    v_manual_reputation_score IS NOT NULL
    AND (
      v_override_mode = 'final'
      OR (
        v_override_mode = 'temporary'
        AND v_override_expires_at IS NOT NULL
        AND p_as_of < v_override_expires_at
      )
    )
  );

  v_penalties_disabled_active := (
    (v_penalties_disabled_until IS NULL OR p_as_of < v_penalties_disabled_until)
    AND NOT v_override_active
    AND NOT COALESCE(v_is_reputation_frozen, false)
  );

  IF COALESCE(v_is_reputation_frozen, false) AND NOT v_override_active THEN
    SELECT r.score, r.status, r.inputs, r.penalties, r.as_of
    INTO v_existing_score, v_existing_status, v_existing_inputs, v_existing_penalties, v_existing_as_of
    FROM public.email_governance_tenant_reputation_scores r
    WHERE r.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_existing_score IS NOT NULL THEN
      RETURN jsonb_build_object(
        'tenant_id', p_tenant_id,
        'score', v_existing_score,
        'status', v_existing_status,
        'as_of', COALESCE(v_existing_as_of, p_as_of),
        'inputs', COALESCE(v_existing_inputs, '{}'::jsonb),
        'penalties', COALESCE(v_existing_penalties, '{}'::jsonb),
        'frozen', true
      );
    END IF;
  END IF;

  IF v_override_active THEN
    v_score := v_manual_reputation_score;
    v_status := CASE
      WHEN v_score >= 90 THEN 'healthy'
      WHEN v_score >= 75 THEN 'warning'
      WHEN v_score >= 60 THEN 'risk'
      ELSE 'critical'
    END;

    v_inputs := jsonb_build_object(
      'as_of', p_as_of,
      'source', CASE
        WHEN v_override_mode = 'temporary' THEN 'manual_override_temporary'
        ELSE 'manual_override_final'
      END,
      'override_mode', v_override_mode,
      'override_expires_at', v_override_expires_at
    );
    v_penalties := jsonb_build_object('total', 0);

    INSERT INTO public.email_governance_tenant_reputation_scores (
      tenant_id,
      score,
      status,
      as_of,
      inputs,
      penalties,
      computed_at,
      updated_at
    ) VALUES (
      p_tenant_id,
      v_score,
      v_status,
      p_as_of,
      v_inputs,
      v_penalties,
      now(),
      now()
    )
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      score = EXCLUDED.score,
      status = EXCLUDED.status,
      as_of = EXCLUDED.as_of,
      inputs = EXCLUDED.inputs,
      penalties = EXCLUDED.penalties,
      computed_at = EXCLUDED.computed_at,
      updated_at = now();

    INSERT INTO public.email_governance_tenant_reputation_score_history (
      tenant_id,
      score,
      status,
      as_of,
      inputs,
      penalties,
      computed_at
    ) VALUES (
      p_tenant_id,
      v_score,
      v_status,
      p_as_of,
      v_inputs,
      v_penalties,
      now()
    )
    ON CONFLICT (tenant_id, as_of)
    DO UPDATE SET
      score = EXCLUDED.score,
      status = EXCLUDED.status,
      inputs = EXCLUDED.inputs,
      penalties = EXCLUDED.penalties,
      computed_at = EXCLUDED.computed_at;

    RETURN jsonb_build_object(
      'tenant_id', p_tenant_id,
      'score', v_score,
      'status', v_status,
      'as_of', p_as_of,
      'inputs', v_inputs,
      'penalties', v_penalties,
      'manual', true
    );
  END IF;

  PERFORM public.refresh_email_governance_tenant_reputation_snapshot(p_tenant_id, p_as_of);

  SELECT * INTO v_snapshot_24h
  FROM public.email_governance_tenant_reputation_snapshots s
  WHERE s.tenant_id = p_tenant_id
    AND s.window_key = '24h'
    AND s.as_of <= p_as_of
  ORDER BY s.as_of DESC
  LIMIT 1;

  SELECT * INTO v_snapshot_30d
  FROM public.email_governance_tenant_reputation_snapshots s
  WHERE s.tenant_id = p_tenant_id
    AND s.window_key = '30d'
    AND s.as_of <= p_as_of
  ORDER BY s.as_of DESC
  LIMIT 1;

  v_sent_24h := COALESCE(v_snapshot_24h.sent_count, 0);
  v_sent_30d := COALESCE(v_snapshot_30d.sent_count, 0);

  v_bounce_rate_24h := COALESCE(v_snapshot_24h.bounce_rate, 0);
  v_complaint_rate_24h := COALESCE(v_snapshot_24h.complaint_rate, 0);

  v_unsub_rate_24h := COALESCE(v_snapshot_24h.unsubscribed_count, 0)::NUMERIC / GREATEST(v_sent_24h, 1);
  v_unsub_rate_30d := COALESCE(v_snapshot_30d.unsubscribed_count, 0)::NUMERIC / GREATEST(v_sent_30d, 1);

  SELECT COUNT(*)::INTEGER INTO v_spamtrap_hits_24h
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.is_spam_trap = true
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= (p_as_of - INTERVAL '24 hours')
    AND COALESCE(e.event_ts_provider, e.ingested_at) <= p_as_of;

  SELECT COUNT(*)::INTEGER INTO v_spamtrap_hits_30d
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.is_spam_trap = true
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= (p_as_of - INTERVAL '30 days')
    AND COALESCE(e.event_ts_provider, e.ingested_at) <= p_as_of;

  SELECT COUNT(*)::INTEGER INTO v_suppressed_attempts_24h
  FROM public.email_send_skips s
  WHERE s.tenant_id = p_tenant_id
    AND s.reason IN ('unsubscribed', 'bounced', 'complained', 'globally_blocked', 'suppressed')
    AND s.created_at >= (p_as_of - INTERVAL '24 hours')
    AND s.created_at <= p_as_of;

  SELECT COUNT(*)::INTEGER INTO v_suppressed_attempts_30d
  FROM public.email_send_skips s
  WHERE s.tenant_id = p_tenant_id
    AND s.reason IN ('unsubscribed', 'bounced', 'complained', 'globally_blocked', 'suppressed')
    AND s.created_at >= (p_as_of - INTERVAL '30 days')
    AND s.created_at <= p_as_of;

  v_bounce_pct := v_bounce_rate_24h * 100;
  v_complaint_pct := v_complaint_rate_24h * 100;

  v_penalty_bounce := GREATEST(v_bounce_pct, 0) * 2;
  v_penalty_complaint := GREATEST(v_complaint_pct, 0) * 50;
  v_penalty_spamtrap := CASE WHEN v_spamtrap_hits_30d > 0 THEN 25 ELSE 0 END;
  v_penalty_suppressed := GREATEST(v_suppressed_attempts_24h, 0) * 10;

  v_unsub_spike_pct := GREATEST((v_unsub_rate_24h - v_unsub_rate_30d) * 100, 0);
  v_penalty_unsub_spike := v_unsub_spike_pct * 2.5;

  IF v_penalties_disabled_active THEN
    v_penalty_bounce := 0;
    v_penalty_complaint := 0;
    v_penalty_spamtrap := 0;
    v_penalty_suppressed := 0;
    v_penalty_unsub_spike := 0;
    v_penalty_total := 0;
    v_score := 100;
  ELSE
    v_penalty_total :=
      COALESCE(v_penalty_bounce, 0) +
      COALESCE(v_penalty_complaint, 0) +
      COALESCE(v_penalty_spamtrap, 0) +
      COALESCE(v_penalty_suppressed, 0) +
      COALESCE(v_penalty_unsub_spike, 0);

    v_score := LEAST(100, GREATEST(0, ROUND(100 - v_penalty_total)::INTEGER));
  END IF;

  v_status := CASE
    WHEN v_score >= 90 THEN 'healthy'
    WHEN v_score >= 75 THEN 'warning'
    WHEN v_score >= 60 THEN 'risk'
    ELSE 'critical'
  END;

  v_inputs := jsonb_build_object(
    'as_of', p_as_of,
    'source', CASE
      WHEN v_penalties_disabled_active THEN 'automation_penalties_disabled'
      ELSE 'automation'
    END,
    'penalties_disabled_active', v_penalties_disabled_active,
    'penalties_disabled_until', v_penalties_disabled_until,
    'window_24h', jsonb_build_object(
      'sent_count', v_sent_24h,
      'bounce_rate', v_bounce_rate_24h,
      'complaint_rate', v_complaint_rate_24h,
      'unsub_rate', v_unsub_rate_24h,
      'spamtrap_hits', v_spamtrap_hits_24h,
      'suppressed_send_attempts', v_suppressed_attempts_24h
    ),
    'window_30d', jsonb_build_object(
      'sent_count', v_sent_30d,
      'unsub_rate', v_unsub_rate_30d,
      'spamtrap_hits', v_spamtrap_hits_30d,
      'suppressed_send_attempts', v_suppressed_attempts_30d
    )
  );

  v_penalties := jsonb_build_object(
    'bounce', ROUND(v_penalty_bounce, 4),
    'complaint', ROUND(v_penalty_complaint, 4),
    'spam_trap', ROUND(v_penalty_spamtrap, 4),
    'suppressed_send_attempts', ROUND(v_penalty_suppressed, 4),
    'unsubscribe_spike', ROUND(v_penalty_unsub_spike, 4),
    'unsubscribe_spike_pct', ROUND(v_unsub_spike_pct, 4),
    'total', ROUND(v_penalty_total, 4)
  );

  INSERT INTO public.email_governance_tenant_reputation_scores (
    tenant_id,
    score,
    status,
    as_of,
    inputs,
    penalties,
    computed_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    v_score,
    v_status,
    p_as_of,
    v_inputs,
    v_penalties,
    now(),
    now()
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    status = EXCLUDED.status,
    as_of = EXCLUDED.as_of,
    inputs = EXCLUDED.inputs,
    penalties = EXCLUDED.penalties,
    computed_at = EXCLUDED.computed_at,
    updated_at = now();

  INSERT INTO public.email_governance_tenant_reputation_score_history (
    tenant_id,
    score,
    status,
    as_of,
    inputs,
    penalties,
    computed_at
  ) VALUES (
    p_tenant_id,
    v_score,
    v_status,
    p_as_of,
    v_inputs,
    v_penalties,
    now()
  )
  ON CONFLICT (tenant_id, as_of)
  DO UPDATE SET
    score = EXCLUDED.score,
    status = EXCLUDED.status,
    inputs = EXCLUDED.inputs,
    penalties = EXCLUDED.penalties,
    computed_at = EXCLUDED.computed_at;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'score', v_score,
    'status', v_status,
    'as_of', p_as_of,
    'inputs', v_inputs,
    'penalties', v_penalties
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

  v_send_limits := jsonb_build_object(
    'recipient_cap', v_policy.recipient_cap,
    'job_batch_size', v_policy.job_batch_size,
    'send_pacing_multiplier', v_policy.send_pacing_multiplier,
    'reputation_tier', v_tier,
    'reputation_action', v_action,
    'is_unlimited', (v_policy.recipient_cap IS NULL)
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

CREATE OR REPLACE FUNCTION public.admin_set_tenant_reputation_score(
  p_tenant_id UUID,
  p_score INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_set_tenant_reputation_override(
    p_tenant_id,
    p_score,
    'final',
    NULL,
    COALESCE(NULLIF(btrim(p_reason), ''), 'manual_reputation_set')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_tenant_reputation_score(
  p_tenant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_set_tenant_reputation_override(
    p_tenant_id,
    100,
    'final',
    NULL,
    COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_reset_to_100')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_reputation_override(UUID, INTEGER, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_tenant_reputation_penalties(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_enable_tenant_reputation_penalties(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_reputation_score(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_tenant_reputation_score(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_email_management_panel(UUID, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
