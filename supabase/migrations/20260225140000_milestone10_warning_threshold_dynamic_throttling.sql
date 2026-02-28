-- Milestone 10: Warning Threshold & Dynamic Throttling
-- Objective: apply early-stage campaign throttling before hard-stop conditions.
-- Trigger conditions (rolling 24h per campaign):
-- - Hard bounce >= 3%
-- - Complaint >= 0.1%
-- - Soft bounce >= 5%
-- - Rapid negative trend: recent 30m rate >= 2x prior 2h rate (requires prior sent >= 100)
-- Behavior:
-- - Reduce batch size by 50%
-- - Increase delay between batches (2x pacing)
-- - Dynamic auto-revert when metrics improve
-- - Log throttle activation/clear events
-- - Do not fully pause campaign as part of warning throttling

CREATE TABLE IF NOT EXISTS public.email_governance_campaign_throttle_states (
  campaign_id UUID PRIMARY KEY REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_throttled BOOLEAN NOT NULL DEFAULT false,
  trigger_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  trigger_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  throttled_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  next_claimable_at TIMESTAMPTZ,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_throttle_tenant
  ON public.email_governance_campaign_throttle_states (tenant_id);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_throttle_claimable
  ON public.email_governance_campaign_throttle_states (is_throttled, next_claimable_at)
  WHERE is_throttled = true;

CREATE TABLE IF NOT EXISTS public.email_governance_campaign_throttle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('activated', 'cleared', 'updated')),
  source TEXT NOT NULL DEFAULT 'system',
  reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_throttle_events_campaign_time
  ON public.email_governance_campaign_throttle_events (campaign_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.evaluate_campaign_warning_thresholds(
  p_campaign_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  sent_count INTEGER,
  hard_bounce_count INTEGER,
  soft_bounce_count INTEGER,
  complaint_count INTEGER,
  hard_bounce_rate NUMERIC,
  soft_bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  trend_triggered BOOLEAN,
  should_throttle BOOLEAN,
  trigger_reasons TEXT[],
  trigger_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_window_start TIMESTAMPTZ := v_window_end - INTERVAL '24 hours';

  v_sent_count INTEGER := 0;
  v_hard_bounce_count INTEGER := 0;
  v_soft_bounce_count INTEGER := 0;
  v_complaint_count INTEGER := 0;

  v_hard_bounce_rate NUMERIC := 0;
  v_soft_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;

  v_recent_start TIMESTAMPTZ := v_window_end - INTERVAL '30 minutes';
  v_prior_start TIMESTAMPTZ := v_window_end - INTERVAL '150 minutes';
  v_prior_end TIMESTAMPTZ := v_recent_start;

  v_recent_sent INTEGER := 0;
  v_recent_hard_bounce INTEGER := 0;
  v_recent_soft_bounce INTEGER := 0;
  v_recent_complaint INTEGER := 0;

  v_prior_sent INTEGER := 0;
  v_prior_hard_bounce INTEGER := 0;
  v_prior_soft_bounce INTEGER := 0;
  v_prior_complaint INTEGER := 0;

  v_recent_hard_bounce_rate NUMERIC := 0;
  v_recent_soft_bounce_rate NUMERIC := 0;
  v_recent_complaint_rate NUMERIC := 0;

  v_prior_hard_bounce_rate NUMERIC := 0;
  v_prior_soft_bounce_rate NUMERIC := 0;
  v_prior_complaint_rate NUMERIC := 0;

  v_trend_triggered BOOLEAN := false;
  v_should_throttle BOOLEAN := false;
  v_trigger_reasons TEXT[] := ARRAY[]::TEXT[];
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
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_sent_count,
    v_hard_bounce_count,
    v_soft_bounce_count,
    v_complaint_count
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_window_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  v_sent_count := COALESCE(v_sent_count, 0);
  v_hard_bounce_count := COALESCE(v_hard_bounce_count, 0);
  v_soft_bounce_count := COALESCE(v_soft_bounce_count, 0);
  v_complaint_count := COALESCE(v_complaint_count, 0);

  v_hard_bounce_rate := v_hard_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_soft_bounce_rate := v_soft_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_complaint_rate := v_complaint_count::NUMERIC / GREATEST(v_sent_count, 1);

  IF v_hard_bounce_rate >= 0.03 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('hard_bounce_rate=%.4f', v_hard_bounce_rate));
  END IF;

  IF v_complaint_rate >= 0.001 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('complaint_rate=%.4f', v_complaint_rate));
  END IF;

  IF v_soft_bounce_rate >= 0.05 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('soft_bounce_rate=%.4f', v_soft_bounce_rate));
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_recent_sent,
    v_recent_hard_bounce,
    v_recent_soft_bounce,
    v_recent_complaint
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_recent_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_prior_sent,
    v_prior_hard_bounce,
    v_prior_soft_bounce,
    v_prior_complaint
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_prior_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_prior_end;

  v_recent_sent := COALESCE(v_recent_sent, 0);
  v_recent_hard_bounce := COALESCE(v_recent_hard_bounce, 0);
  v_recent_soft_bounce := COALESCE(v_recent_soft_bounce, 0);
  v_recent_complaint := COALESCE(v_recent_complaint, 0);

  v_prior_sent := COALESCE(v_prior_sent, 0);
  v_prior_hard_bounce := COALESCE(v_prior_hard_bounce, 0);
  v_prior_soft_bounce := COALESCE(v_prior_soft_bounce, 0);
  v_prior_complaint := COALESCE(v_prior_complaint, 0);

  v_recent_hard_bounce_rate := v_recent_hard_bounce::NUMERIC / GREATEST(v_recent_sent, 1);
  v_recent_soft_bounce_rate := v_recent_soft_bounce::NUMERIC / GREATEST(v_recent_sent, 1);
  v_recent_complaint_rate := v_recent_complaint::NUMERIC / GREATEST(v_recent_sent, 1);

  v_prior_hard_bounce_rate := v_prior_hard_bounce::NUMERIC / GREATEST(v_prior_sent, 1);
  v_prior_soft_bounce_rate := v_prior_soft_bounce::NUMERIC / GREATEST(v_prior_sent, 1);
  v_prior_complaint_rate := v_prior_complaint::NUMERIC / GREATEST(v_prior_sent, 1);

  IF v_prior_sent >= 100 AND (
       (v_prior_hard_bounce_rate > 0 AND v_recent_hard_bounce_rate >= v_prior_hard_bounce_rate * 2)
    OR (v_prior_soft_bounce_rate > 0 AND v_recent_soft_bounce_rate >= v_prior_soft_bounce_rate * 2)
    OR (v_prior_complaint_rate > 0 AND v_recent_complaint_rate >= v_prior_complaint_rate * 2)
  ) THEN
    v_trend_triggered := true;
    v_trigger_reasons := array_append(v_trigger_reasons, 'rapid_negative_trend=2x');
  END IF;

  v_should_throttle := cardinality(v_trigger_reasons) > 0;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  window_start := v_window_start;
  window_end := v_window_end;
  sent_count := v_sent_count;
  hard_bounce_count := v_hard_bounce_count;
  soft_bounce_count := v_soft_bounce_count;
  complaint_count := v_complaint_count;
  hard_bounce_rate := v_hard_bounce_rate;
  soft_bounce_rate := v_soft_bounce_rate;
  complaint_rate := v_complaint_rate;
  trend_triggered := v_trend_triggered;
  should_throttle := v_should_throttle;
  trigger_reasons := v_trigger_reasons;
  trigger_details := jsonb_build_object(
    'hard_bounce_rate', v_hard_bounce_rate,
    'soft_bounce_rate', v_soft_bounce_rate,
    'complaint_rate', v_complaint_rate,
    'thresholds', jsonb_build_object(
      'hard_bounce_rate', 0.03,
      'soft_bounce_rate', 0.05,
      'complaint_rate', 0.001,
      'trend_multiplier', 2,
      'trend_prior_min_sent', 100
    ),
    'trend', jsonb_build_object(
      'recent_window_minutes', 30,
      'prior_window_minutes', 120,
      'recent_sent', v_recent_sent,
      'prior_sent', v_prior_sent,
      'recent_hard_bounce_rate', v_recent_hard_bounce_rate,
      'prior_hard_bounce_rate', v_prior_hard_bounce_rate,
      'recent_soft_bounce_rate', v_recent_soft_bounce_rate,
      'prior_soft_bounce_rate', v_prior_soft_bounce_rate,
      'recent_complaint_rate', v_recent_complaint_rate,
      'prior_complaint_rate', v_prior_complaint_rate,
      'triggered', v_trend_triggered
    )
  );

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_update_campaign_throttle_state(
  p_campaign_id UUID,
  p_source TEXT DEFAULT 'system',
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  throttled BOOLEAN,
  changed BOOLEAN,
  reasons TEXT[],
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval RECORD;
  v_existing RECORD;
  v_changed BOOLEAN := false;
BEGIN
  SELECT * INTO v_eval
  FROM public.evaluate_campaign_warning_thresholds(p_campaign_id, p_as_of);

  SELECT *
  INTO v_existing
  FROM public.email_governance_campaign_throttle_states s
  WHERE s.campaign_id = p_campaign_id
  FOR UPDATE;

  IF COALESCE(v_eval.should_throttle, false) THEN
    IF v_existing.campaign_id IS NULL THEN
      INSERT INTO public.email_governance_campaign_throttle_states (
        campaign_id,
        tenant_id,
        is_throttled,
        trigger_reasons,
        trigger_details,
        throttled_at,
        cleared_at,
        last_evaluated_at,
        updated_at
      ) VALUES (
        p_campaign_id,
        v_eval.tenant_id,
        true,
        COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
        COALESCE(v_eval.trigger_details, '{}'::jsonb),
        now(),
        NULL,
        COALESCE(p_as_of, now()),
        now()
      );
      v_changed := true;

      INSERT INTO public.email_governance_campaign_throttle_events (
        campaign_id,
        tenant_id,
        event_type,
        source,
        reasons,
        details
      ) VALUES (
        p_campaign_id,
        v_eval.tenant_id,
        'activated',
        COALESCE(NULLIF(p_source, ''), 'system'),
        COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
        COALESCE(v_eval.trigger_details, '{}'::jsonb)
      );
    ELSIF COALESCE(v_existing.is_throttled, false) = false THEN
      UPDATE public.email_governance_campaign_throttle_states s
      SET
        is_throttled = true,
        trigger_reasons = COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
        trigger_details = COALESCE(v_eval.trigger_details, '{}'::jsonb),
        throttled_at = now(),
        cleared_at = NULL,
        last_evaluated_at = COALESCE(p_as_of, now()),
        updated_at = now()
      WHERE s.campaign_id = p_campaign_id;
      v_changed := true;

      INSERT INTO public.email_governance_campaign_throttle_events (
        campaign_id,
        tenant_id,
        event_type,
        source,
        reasons,
        details
      ) VALUES (
        p_campaign_id,
        v_eval.tenant_id,
        'activated',
        COALESCE(NULLIF(p_source, ''), 'system'),
        COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
        COALESCE(v_eval.trigger_details, '{}'::jsonb)
      );
    ELSE
      UPDATE public.email_governance_campaign_throttle_states s
      SET
        trigger_reasons = COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
        trigger_details = COALESCE(v_eval.trigger_details, '{}'::jsonb),
        last_evaluated_at = COALESCE(p_as_of, now()),
        updated_at = now()
      WHERE s.campaign_id = p_campaign_id;
    END IF;
  ELSE
    IF v_existing.campaign_id IS NULL THEN
      INSERT INTO public.email_governance_campaign_throttle_states (
        campaign_id,
        tenant_id,
        is_throttled,
        trigger_reasons,
        trigger_details,
        throttled_at,
        cleared_at,
        next_claimable_at,
        last_evaluated_at,
        updated_at
      ) VALUES (
        p_campaign_id,
        v_eval.tenant_id,
        false,
        ARRAY[]::TEXT[],
        COALESCE(v_eval.trigger_details, '{}'::jsonb),
        NULL,
        now(),
        NULL,
        COALESCE(p_as_of, now()),
        now()
      );
    ELSIF COALESCE(v_existing.is_throttled, false) = true THEN
      UPDATE public.email_governance_campaign_throttle_states s
      SET
        is_throttled = false,
        trigger_reasons = ARRAY[]::TEXT[],
        trigger_details = COALESCE(v_eval.trigger_details, '{}'::jsonb),
        cleared_at = now(),
        next_claimable_at = NULL,
        last_evaluated_at = COALESCE(p_as_of, now()),
        updated_at = now()
      WHERE s.campaign_id = p_campaign_id;
      v_changed := true;

      INSERT INTO public.email_governance_campaign_throttle_events (
        campaign_id,
        tenant_id,
        event_type,
        source,
        reasons,
        details
      ) VALUES (
        p_campaign_id,
        v_eval.tenant_id,
        'cleared',
        COALESCE(NULLIF(p_source, ''), 'system'),
        ARRAY[]::TEXT[],
        COALESCE(v_eval.trigger_details, '{}'::jsonb)
      );
    ELSE
      UPDATE public.email_governance_campaign_throttle_states s
      SET
        trigger_reasons = ARRAY[]::TEXT[],
        trigger_details = COALESCE(v_eval.trigger_details, '{}'::jsonb),
        last_evaluated_at = COALESCE(p_as_of, now()),
        updated_at = now()
      WHERE s.campaign_id = p_campaign_id;
    END IF;
  END IF;

  campaign_id := p_campaign_id;
  throttled := COALESCE(v_eval.should_throttle, false);
  changed := v_changed;
  reasons := COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]);
  details := COALESCE(v_eval.trigger_details, '{}'::jsonb);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_reputation_policy(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  score INTEGER,
  tier TEXT,
  action TEXT,
  recipient_cap INTEGER,
  job_batch_size INTEGER,
  send_pacing_multiplier NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_policy RECORD;
  v_is_throttled BOOLEAN := false;
  v_effective_batch_size INTEGER;
  v_effective_pacing NUMERIC;
BEGIN
  SELECT c.tenant_id INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
  END IF;

  SELECT * INTO v_policy
  FROM public.get_tenant_reputation_policy(v_tenant_id);

  SELECT s.is_throttled
  INTO v_is_throttled
  FROM public.email_governance_campaign_throttle_states s
  WHERE s.campaign_id = p_campaign_id;

  v_is_throttled := COALESCE(v_is_throttled, false);
  v_effective_batch_size := COALESCE(v_policy.job_batch_size, 50);
  v_effective_pacing := COALESCE(v_policy.send_pacing_multiplier, 1);

  IF v_is_throttled THEN
    v_effective_batch_size := GREATEST(1, FLOOR(v_effective_batch_size * 0.5)::INTEGER);
    v_effective_pacing := GREATEST(v_effective_pacing, 2);
  END IF;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  score := v_policy.score;

  IF v_is_throttled AND v_policy.action = 'allow' THEN
    tier := 'throttled';
    action := 'throttle';
  ELSE
    tier := v_policy.tier;
    action := v_policy.action;
  END IF;

  recipient_cap := v_policy.recipient_cap;
  job_batch_size := v_effective_batch_size;
  send_pacing_multiplier := v_effective_pacing;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_send_job_ids(
  batch_size INT DEFAULT 10,
  worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  stale_after_minutes INT DEFAULT 10
)
RETURNS TABLE (
  id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate RECORD;
  v_claimed_count INTEGER := 0;
  v_target_count INTEGER := GREATEST(COALESCE(batch_size, 10), 1);
  v_now TIMESTAMPTZ := now();

  v_domain_status TEXT;
  v_domain_stage INTEGER;
  v_cap INTEGER;
  v_reserved INTEGER;
  v_remaining INTEGER;
  v_job_size INTEGER;

  v_claimable_message_ids UUID[];
  v_remaining_message_ids UUID[];
  v_claimable_recipient_emails JSONB;
  v_remaining_recipient_emails JSONB;
  v_new_batch_index INTEGER;

  v_effective_message_ids UUID[];
  v_effective_recipient_emails JSONB;
  v_effective_available_at TIMESTAMPTZ;
  v_throttle_claimable_count INTEGER;
  v_throttle_delay_seconds INTEGER;
BEGIN
  FOR v_candidate IN
    SELECT
      j.id,
      j.campaign_id,
      j.tenant_id,
      j.domain_id,
      j.status,
      j.claimed_at,
      j.batch_index,
      j.recipient_message_ids,
      j.recipient_emails,
      j.available_at,
      j.created_at,
      j.attempts,
      p.action AS reputation_action,
      COALESCE(ts.is_throttled, false) AS is_throttled,
      ts.next_claimable_at
    FROM public.email_send_jobs j
    JOIN public.crm_campaigns c ON c.id = j.campaign_id
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    LEFT JOIN public.email_governance_campaign_throttle_states ts ON ts.campaign_id = j.campaign_id
    WHERE p.action IN ('allow', 'throttle')
      AND j.available_at <= v_now
      AND (
        COALESCE(ts.is_throttled, false) = false
        OR COALESCE(ts.next_claimable_at, '-infinity'::timestamptz) <= v_now
      )
      AND (
        j.status = 'pending'
        OR (
          j.status = 'in_progress'
          AND (j.claimed_at IS NULL OR j.claimed_at < (v_now - make_interval(mins => stale_after_minutes)))
        )
      )
    ORDER BY j.available_at ASC, j.created_at ASC, j.batch_index ASC
    LIMIT (v_target_count * 20)
    FOR UPDATE OF j SKIP LOCKED
  LOOP
    EXIT WHEN v_claimed_count >= v_target_count;

    IF v_candidate.domain_id IS NOT NULL THEN
      SELECT
        d.status,
        GREATEST(COALESCE(d.warmup_stage, 1), 1)
      INTO v_domain_status, v_domain_stage
      FROM public.email_domains d
      WHERE d.id = v_candidate.domain_id
        AND d.tenant_id = v_candidate.tenant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      IF v_domain_status = 'warming_up' THEN
        PERFORM 1 FROM public.maybe_advance_domain_warmup(v_candidate.domain_id, v_now);

        v_cap := public.get_domain_warmup_daily_cap(v_candidate.domain_id, v_now);
        v_reserved := public.get_domain_warmup_reserved_today(v_candidate.domain_id, v_now);

        v_job_size := GREATEST(
          COALESCE(cardinality(v_candidate.recipient_message_ids), 0),
          COALESCE(jsonb_array_length(v_candidate.recipient_emails), 0)
        );

        IF v_job_size <= 0 THEN
          CONTINUE;
        END IF;

        v_remaining := GREATEST(v_cap - v_reserved, 0);

        IF v_remaining <= 0 THEN
          CONTINUE;
        END IF;

        IF v_job_size > v_remaining THEN
          IF COALESCE(cardinality(v_candidate.recipient_message_ids), 0) > 0 THEN
            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_claimable_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_candidate.recipient_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord <= v_remaining
            ) t;

            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_remaining_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_candidate.recipient_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord > v_remaining
            ) t;
          ELSE
            v_claimable_message_ids := ARRAY[]::UUID[];
            v_remaining_message_ids := ARRAY[]::UUID[];
          END IF;

          IF COALESCE(jsonb_array_length(v_candidate.recipient_emails), 0) > 0 THEN
            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_claimable_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_candidate.recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord <= v_remaining
            ) t;

            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_remaining_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_candidate.recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord > v_remaining
            ) t;
          ELSE
            v_claimable_recipient_emails := '[]'::jsonb;
            v_remaining_recipient_emails := '[]'::jsonb;
          END IF;

          IF COALESCE(cardinality(v_claimable_message_ids), 0) = 0
             AND COALESCE(jsonb_array_length(v_claimable_recipient_emails), 0) = 0 THEN
            CONTINUE;
          END IF;

          UPDATE public.email_send_jobs j
          SET
            recipient_message_ids = v_claimable_message_ids,
            recipient_emails = v_claimable_recipient_emails,
            updated_at = v_now
          WHERE j.id = v_candidate.id;

          PERFORM 1
          FROM public.crm_campaigns c
          WHERE c.id = v_candidate.campaign_id
          FOR UPDATE;

          SELECT COALESCE(MAX(j.batch_index), -1) + 1
          INTO v_new_batch_index
          FROM public.email_send_jobs j
          WHERE j.campaign_id = v_candidate.campaign_id;

          INSERT INTO public.email_send_jobs (
            campaign_id,
            tenant_id,
            domain_id,
            status,
            error_message,
            recipient_emails,
            batch_index,
            created_at,
            updated_at,
            attempts,
            emails_sent,
            emails_failed,
            recipient_message_ids,
            available_at
          ) VALUES (
            v_candidate.campaign_id,
            v_candidate.tenant_id,
            v_candidate.domain_id,
            'pending',
            NULL,
            v_remaining_recipient_emails,
            v_new_batch_index,
            v_now,
            v_now,
            0,
            0,
            0,
            v_remaining_message_ids,
            v_candidate.available_at
          );
        END IF;
      END IF;
    END IF;

    IF COALESCE(v_candidate.is_throttled, false) THEN
      SELECT
        j.recipient_message_ids,
        j.recipient_emails,
        j.available_at
      INTO
        v_effective_message_ids,
        v_effective_recipient_emails,
        v_effective_available_at
      FROM public.email_send_jobs j
      WHERE j.id = v_candidate.id
      FOR UPDATE;

      v_job_size := GREATEST(
        COALESCE(cardinality(v_effective_message_ids), 0),
        COALESCE(jsonb_array_length(v_effective_recipient_emails), 0)
      );

      IF v_job_size > 1 THEN
        v_throttle_claimable_count := GREATEST(1, FLOOR(v_job_size * 0.5)::INTEGER);

        IF v_throttle_claimable_count < v_job_size THEN
          IF COALESCE(cardinality(v_effective_message_ids), 0) > 0 THEN
            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_claimable_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_effective_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord <= v_throttle_claimable_count
            ) t;

            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_remaining_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_effective_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord > v_throttle_claimable_count
            ) t;
          ELSE
            v_claimable_message_ids := ARRAY[]::UUID[];
            v_remaining_message_ids := ARRAY[]::UUID[];
          END IF;

          IF COALESCE(jsonb_array_length(v_effective_recipient_emails), 0) > 0 THEN
            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_claimable_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_effective_recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord <= v_throttle_claimable_count
            ) t;

            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_remaining_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_effective_recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord > v_throttle_claimable_count
            ) t;
          ELSE
            v_claimable_recipient_emails := '[]'::jsonb;
            v_remaining_recipient_emails := '[]'::jsonb;
          END IF;

          IF COALESCE(cardinality(v_claimable_message_ids), 0) = 0
             AND COALESCE(jsonb_array_length(v_claimable_recipient_emails), 0) = 0 THEN
            CONTINUE;
          END IF;

          UPDATE public.email_send_jobs j
          SET
            recipient_message_ids = v_claimable_message_ids,
            recipient_emails = v_claimable_recipient_emails,
            updated_at = v_now
          WHERE j.id = v_candidate.id;

          PERFORM 1
          FROM public.crm_campaigns c
          WHERE c.id = v_candidate.campaign_id
          FOR UPDATE;

          SELECT COALESCE(MAX(j.batch_index), -1) + 1
          INTO v_new_batch_index
          FROM public.email_send_jobs j
          WHERE j.campaign_id = v_candidate.campaign_id;

          INSERT INTO public.email_send_jobs (
            campaign_id,
            tenant_id,
            domain_id,
            status,
            error_message,
            recipient_emails,
            batch_index,
            created_at,
            updated_at,
            attempts,
            emails_sent,
            emails_failed,
            recipient_message_ids,
            available_at
          ) VALUES (
            v_candidate.campaign_id,
            v_candidate.tenant_id,
            v_candidate.domain_id,
            'pending',
            NULL,
            v_remaining_recipient_emails,
            v_new_batch_index,
            v_now,
            v_now,
            0,
            0,
            0,
            v_remaining_message_ids,
            COALESCE(v_effective_available_at, v_now)
          );
        END IF;
      END IF;
    END IF;

    UPDATE public.email_send_jobs j
    SET
      status = 'in_progress',
      claimed_at = v_now,
      claimed_by = worker_id,
      claim_token = p_claim_token,
      attempts = j.attempts + 1,
      updated_at = v_now
    WHERE j.id = v_candidate.id
    RETURNING j.id INTO id;

    IF FOUND THEN
      IF COALESCE(v_candidate.is_throttled, false) THEN
        v_throttle_delay_seconds := (120 + FLOOR(random() * 121))::INTEGER;

        INSERT INTO public.email_governance_campaign_throttle_states (
          campaign_id,
          tenant_id,
          is_throttled,
          trigger_reasons,
          trigger_details,
          throttled_at,
          next_claimable_at,
          last_evaluated_at,
          updated_at
        )
        VALUES (
          v_candidate.campaign_id,
          v_candidate.tenant_id,
          true,
          ARRAY[]::TEXT[],
          '{}'::jsonb,
          v_now,
          v_now + make_interval(secs => v_throttle_delay_seconds),
          v_now,
          v_now
        )
        ON CONFLICT (campaign_id) DO UPDATE
        SET
          next_claimable_at = EXCLUDED.next_claimable_at,
          updated_at = v_now;
      END IF;

      v_claimed_count := v_claimed_count + 1;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

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
BEGIN
  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

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

  IF v_complaint_rate >= 0.002 THEN
    v_should_pause := TRUE;
    v_pause_reason := format(
      'Campaign auto-paused mid-send: complaint rate %.3f%% exceeded 0.200%% threshold.',
      v_complaint_rate * 100
    );
  ELSIF v_bounce_rate >= 0.05 THEN
    v_should_pause := TRUE;
    v_pause_reason := format(
      'Campaign auto-paused mid-send: hard bounce rate %.2f%% exceeded 5.00%% threshold.',
      v_bounce_rate * 100
    );
  ELSIF v_failed_delivery_rate >= 0.08 THEN
    v_should_pause := TRUE;
    v_pause_reason := format(
      'Campaign auto-paused mid-send: failed delivery rate %.2f%% exceeded 8.00%% threshold.',
      v_failed_delivery_rate * 100
    );
  END IF;

  IF v_should_pause THEN
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'batch_safety_threshold_exceeded',
      v_pause_reason
    );
  END IF;

  IF v_tenant_id IS NOT NULL THEN
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
  should_pause := v_should_pause;
  pause_reason := v_pause_reason;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_delivery_status(p_campaign_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  scheduled_at TIMESTAMPTZ,
  send_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  send_error TEXT,
  send_blocked_reason TEXT,
  is_throttled BOOLEAN,
  throttle_reasons TEXT[],
  throttled_at TIMESTAMPTZ,
  throttle_last_evaluated_at TIMESTAMPTZ
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
BEGIN
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

  RETURN QUERY
  SELECT
    c.id,
    c.status,
    c.scheduled_at,
    c.send_started_at,
    c.sent_at,
    c.updated_at,
    c.send_error,
    c.send_blocked_reason,
    COALESCE(ts.is_throttled, false) AS is_throttled,
    COALESCE(ts.trigger_reasons, ARRAY[]::TEXT[]) AS throttle_reasons,
    ts.throttled_at,
    ts.last_evaluated_at AS throttle_last_evaluated_at
  FROM public.crm_campaigns c
  LEFT JOIN public.email_governance_campaign_throttle_states ts
    ON ts.campaign_id = c.id
  WHERE c.id = p_campaign_id;
END;
$$;

GRANT SELECT ON public.email_governance_campaign_throttle_states TO service_role;
GRANT SELECT ON public.email_governance_campaign_throttle_events TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_warning_thresholds(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_warning_thresholds(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_update_campaign_throttle_state(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_update_campaign_throttle_state(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_delivery_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_delivery_status(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
