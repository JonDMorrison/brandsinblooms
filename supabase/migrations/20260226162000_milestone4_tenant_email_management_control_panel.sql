-- Milestone 4: Tenant Email Management Control Panel (Super Admin)
-- Adds admin-only tenant email control RPCs and control-state persistence.

CREATE TABLE IF NOT EXISTS public.email_governance_tenant_control_state (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  manual_reputation_score INTEGER CHECK (manual_reputation_score BETWEEN 0 AND 100),
  is_reputation_frozen BOOLEAN NOT NULL DEFAULT false,
  forgive_bounce_before TIMESTAMPTZ,
  forgive_complaint_before TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_governance_tenant_control_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can read tenant control state'
  ) THEN
    CREATE POLICY "Master admins can read tenant control state"
      ON public.email_governance_tenant_control_state
      FOR SELECT
      TO authenticated
      USING (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can insert tenant control state'
  ) THEN
    CREATE POLICY "Master admins can insert tenant control state"
      ON public.email_governance_tenant_control_state
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can update tenant control state'
  ) THEN
    CREATE POLICY "Master admins can update tenant control state"
      ON public.email_governance_tenant_control_state
      FOR UPDATE
      TO authenticated
      USING (public.is_master_admin(auth.uid()))
      WITH CHECK (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can delete tenant control state'
  ) THEN
    CREATE POLICY "Master admins can delete tenant control state"
      ON public.email_governance_tenant_control_state
      FOR DELETE
      TO authenticated
      USING (public.is_master_admin(auth.uid()));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_email_governance_tenant_reputation_snapshot(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  window_key TEXT,
  snapshot_id UUID,
  sent_count INTEGER,
  delivered_count INTEGER,
  bounced_count INTEGER,
  complained_count INTEGER,
  opened_count INTEGER,
  clicked_count INTEGER,
  unsubscribed_count INTEGER,
  bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  open_rate NUMERIC,
  click_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TEXT;
  v_start TIMESTAMPTZ;
  v_sent INTEGER;
  v_delivered INTEGER;
  v_bounced INTEGER;
  v_complained INTEGER;
  v_opened INTEGER;
  v_clicked INTEGER;
  v_unsubscribed INTEGER;
  v_open_base NUMERIC;
  v_snapshot_id UUID;
  v_forgive_bounce_before TIMESTAMPTZ;
  v_forgive_complaint_before TIMESTAMPTZ;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT s.forgive_bounce_before, s.forgive_complaint_before
  INTO v_forgive_bounce_before, v_forgive_complaint_before
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  FOREACH v_window IN ARRAY ARRAY['24h', '30d']
  LOOP
    v_start := CASE
      WHEN v_window = '24h' THEN p_as_of - INTERVAL '24 hours'
      ELSE p_as_of - INTERVAL '30 days'
    END;

    SELECT
      COUNT(*) FILTER (WHERE event_type = 'sent')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'delivered')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'bounced')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'complained')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'opened')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'clicked')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'unsubscribed')::INTEGER
    INTO
      v_sent,
      v_delivered,
      v_bounced,
      v_complained,
      v_opened,
      v_clicked,
      v_unsubscribed
    FROM public.email_governance_email_events e
    WHERE e.tenant_id = p_tenant_id
      AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_start
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= p_as_of
      AND NOT (
        e.event_type = 'bounced'
        AND v_forgive_bounce_before IS NOT NULL
        AND COALESCE(e.event_ts_provider, e.ingested_at) <= v_forgive_bounce_before
      )
      AND NOT (
        e.event_type = 'complained'
        AND v_forgive_complaint_before IS NOT NULL
        AND COALESCE(e.event_ts_provider, e.ingested_at) <= v_forgive_complaint_before
      );

    v_sent := COALESCE(v_sent, 0);
    v_delivered := COALESCE(v_delivered, 0);
    v_bounced := COALESCE(v_bounced, 0);
    v_complained := COALESCE(v_complained, 0);
    v_opened := COALESCE(v_opened, 0);
    v_clicked := COALESCE(v_clicked, 0);
    v_unsubscribed := COALESCE(v_unsubscribed, 0);

    v_open_base := GREATEST(v_delivered, v_sent, 1);

    INSERT INTO public.email_governance_tenant_reputation_snapshots (
      tenant_id,
      window_key,
      as_of,
      sent_count,
      delivered_count,
      bounced_count,
      complained_count,
      opened_count,
      clicked_count,
      unsubscribed_count,
      bounce_rate,
      complaint_rate,
      open_rate,
      click_rate,
      source,
      computed_at
    ) VALUES (
      p_tenant_id,
      v_window,
      p_as_of,
      v_sent,
      v_delivered,
      v_bounced,
      v_complained,
      v_opened,
      v_clicked,
      v_unsubscribed,
      (v_bounced::NUMERIC / GREATEST(v_sent, 1)),
      (v_complained::NUMERIC / GREATEST(v_sent, 1)),
      (v_opened::NUMERIC / v_open_base),
      (v_clicked::NUMERIC / v_open_base),
      'sql_function',
      now()
    )
    ON CONFLICT (tenant_id, window_key, as_of)
    DO UPDATE SET
      sent_count = EXCLUDED.sent_count,
      delivered_count = EXCLUDED.delivered_count,
      bounced_count = EXCLUDED.bounced_count,
      complained_count = EXCLUDED.complained_count,
      opened_count = EXCLUDED.opened_count,
      clicked_count = EXCLUDED.clicked_count,
      unsubscribed_count = EXCLUDED.unsubscribed_count,
      bounce_rate = EXCLUDED.bounce_rate,
      complaint_rate = EXCLUDED.complaint_rate,
      open_rate = EXCLUDED.open_rate,
      click_rate = EXCLUDED.click_rate,
      source = EXCLUDED.source,
      computed_at = EXCLUDED.computed_at
    RETURNING id INTO v_snapshot_id;

    window_key := v_window;
    snapshot_id := v_snapshot_id;
    sent_count := v_sent;
    delivered_count := v_delivered;
    bounced_count := v_bounced;
    complained_count := v_complained;
    opened_count := v_opened;
    clicked_count := v_clicked;
    unsubscribed_count := v_unsubscribed;
    bounce_rate := (v_bounced::NUMERIC / GREATEST(v_sent, 1));
    complaint_rate := (v_complained::NUMERIC / GREATEST(v_sent, 1));
    open_rate := (v_opened::NUMERIC / v_open_base);
    click_rate := (v_clicked::NUMERIC / v_open_base);

    RETURN NEXT;
  END LOOP;
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
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT s.manual_reputation_score, s.is_reputation_frozen
  INTO v_manual_reputation_score, v_is_reputation_frozen
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  IF COALESCE(v_is_reputation_frozen, false) AND v_manual_reputation_score IS NULL THEN
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

  IF v_manual_reputation_score IS NOT NULL THEN
    v_score := v_manual_reputation_score;
    v_status := CASE
      WHEN v_score >= 90 THEN 'healthy'
      WHEN v_score >= 75 THEN 'warning'
      WHEN v_score >= 60 THEN 'risk'
      ELSE 'critical'
    END;

    v_inputs := jsonb_build_object(
      'as_of', p_as_of,
      'source', 'manual_override'
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

  v_penalty_total :=
    COALESCE(v_penalty_bounce, 0) +
    COALESCE(v_penalty_complaint, 0) +
    COALESCE(v_penalty_spamtrap, 0) +
    COALESCE(v_penalty_suppressed, 0) +
    COALESCE(v_penalty_unsub_spike, 0);

  v_score := LEAST(100, GREATEST(0, ROUND(100 - v_penalty_total)::INTEGER));

  v_status := CASE
    WHEN v_score >= 90 THEN 'healthy'
    WHEN v_score >= 75 THEN 'warning'
    WHEN v_score >= 60 THEN 'risk'
    ELSE 'critical'
  END;

  v_inputs := jsonb_build_object(
    'as_of', p_as_of,
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
DECLARE
  v_actor UUID := auth.uid();
  v_status TEXT;
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

  v_status := CASE
    WHEN p_score >= 90 THEN 'healthy'
    WHEN p_score >= 75 THEN 'warning'
    WHEN p_score >= 60 THEN 'risk'
    ELSE 'critical'
  END;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    manual_reputation_score,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    p_score,
    now(),
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), 'manual_reputation_set')
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    manual_reputation_score = EXCLUDED.manual_reputation_score,
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
    'tenant_reputation_score_set',
    jsonb_build_object(
      'score', p_score,
      'status', v_status,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_reputation_set')
    )
  );

  RETURN v_result;
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
DECLARE
  v_actor UUID := auth.uid();
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
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    NULL,
    now(),
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_reset')
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    manual_reputation_score = NULL,
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
    'tenant_reputation_score_reset',
    jsonb_build_object(
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'reputation_reset')
    )
  );

  RETURN v_result;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.admin_set_tenant_send_cap(
  p_tenant_id UUID,
  p_cap INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_existing JSONB := '{}'::jsonb;
  v_updated JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_cap IS NOT NULL AND p_cap < 0 THEN
    RAISE EXCEPTION 'p_cap must be null or >= 0';
  END IF;

  SELECT overrides INTO v_existing
  FROM public.tenant_email_governance_overrides
  WHERE tenant_id = p_tenant_id;

  v_existing := COALESCE(v_existing, '{}'::jsonb);

  v_updated := v_existing;
  v_updated := jsonb_set(v_updated, ARRAY['reputation_tiers','normal','recipient_cap'], to_jsonb(p_cap), true);
  v_updated := jsonb_set(v_updated, ARRAY['reputation_tiers','throttled','recipient_cap'], to_jsonb(p_cap), true);
  v_updated := jsonb_set(v_updated, ARRAY['reputation_tiers','restricted','recipient_cap'], to_jsonb(p_cap), true);
  v_updated := jsonb_set(v_updated, ARRAY['reputation_tiers','critical','recipient_cap'], to_jsonb(p_cap), true);

  INSERT INTO public.tenant_email_governance_overrides (
    tenant_id,
    overrides,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    v_updated,
    now(),
    v_actor,
    COALESCE(NULLIF(btrim(p_reason), ''), CASE WHEN p_cap IS NULL THEN 'enable_unlimited_sending' ELSE 'apply_send_cap' END)
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    overrides = EXCLUDED.overrides,
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
    CASE WHEN p_cap IS NULL THEN 'tenant_unlimited_sending_enabled' ELSE 'tenant_send_cap_applied' END,
    jsonb_build_object(
      'cap', p_cap,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), CASE WHEN p_cap IS NULL THEN 'enable_unlimited_sending' ELSE 'apply_send_cap' END),
      'old_overrides', v_existing,
      'new_overrides', v_updated
    )
  );

  RETURN v_updated;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.admin_get_tenant_email_management_panel(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_reputation_score(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_tenant_reputation_score(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_freeze_tenant_reputation_score(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_send_cap(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pause_tenant_email_campaigns(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resume_tenant_email_campaigns(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_suppression_list(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_forgive_tenant_bounce_history(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_forgive_tenant_complaint_history(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
