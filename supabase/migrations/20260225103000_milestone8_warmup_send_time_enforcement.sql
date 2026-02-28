-- Milestone 8: Warmup System (send-time enforcement)
-- Implements domain warmup caps at claim-time so all send paths are enforced centrally.
-- Policy:
-- Day 1: 200, Day 2: 500, Day 3: 1000, Day 4: 3000, Day 5: 5000
-- Day 6+: +20% per healthy day, capped at 50,000/day
-- Advancement requires last-24h bounce < 2% and complaint < 0.1%

CREATE OR REPLACE FUNCTION public.get_warmup_daily_cap_by_stage(
  p_stage INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_stage INTEGER := GREATEST(COALESCE(p_stage, 1), 1);
  v_scaled NUMERIC;
BEGIN
  IF v_stage = 1 THEN
    RETURN 200;
  ELSIF v_stage = 2 THEN
    RETURN 500;
  ELSIF v_stage = 3 THEN
    RETURN 1000;
  ELSIF v_stage = 4 THEN
    RETURN 3000;
  ELSIF v_stage = 5 THEN
    RETURN 5000;
  END IF;

  v_scaled := 5000::NUMERIC * POWER(1.2::NUMERIC, (v_stage - 6)::NUMERIC);
  RETURN LEAST(50000, GREATEST(5000, CEIL(v_scaled)::INTEGER));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_domain_warmup_daily_cap(
  p_domain_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage INTEGER;
BEGIN
  SELECT GREATEST(COALESCE(d.warmup_stage, 1), 1)
  INTO v_stage
  FROM public.email_domains d
  WHERE d.id = p_domain_id;

  IF v_stage IS NULL THEN
    RETURN 5000;
  END IF;

  RETURN public.get_warmup_daily_cap_by_stage(v_stage);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_domain_warmup_reserved_today(
  p_domain_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_reserved INTEGER := 0;
BEGIN
  v_day_start := date_trunc('day', p_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_day_end := v_day_start + INTERVAL '1 day';

  SELECT COALESCE(SUM(
    GREATEST(
      COALESCE(cardinality(j.recipient_message_ids), 0),
      COALESCE(jsonb_array_length(j.recipient_emails), 0)
    )
  ), 0)::INTEGER
  INTO v_reserved
  FROM public.email_send_jobs j
  WHERE j.domain_id = p_domain_id
    AND j.claimed_at >= v_day_start
    AND j.claimed_at < v_day_end
    AND j.status IN ('in_progress', 'completed', 'failed');

  RETURN GREATEST(COALESCE(v_reserved, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_advance_domain_warmup(
  p_domain_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
  previous_stage INTEGER,
  current_stage INTEGER,
  advanced BOOLEAN,
  sent_count_24h INTEGER,
  bounce_rate_24h NUMERIC,
  complaint_rate_24h NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain RECORD;
  v_sent_24h INTEGER := 0;
  v_bounced_24h INTEGER := 0;
  v_complained_24h INTEGER := 0;
  v_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;
  v_eligible BOOLEAN := FALSE;
  v_new_stage INTEGER;
BEGIN
  SELECT
    d.id,
    d.tenant_id,
    d.status,
    GREATEST(COALESCE(d.warmup_stage, 1), 1) AS warmup_stage,
    d.last_stage_updated_at,
    COALESCE(d.healthy_days_counter, 0) AS healthy_days_counter
  INTO v_domain
  FROM public.email_domains d
  WHERE d.id = p_domain_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  previous_stage := v_domain.warmup_stage;
  current_stage := v_domain.warmup_stage;
  advanced := FALSE;

  IF v_domain.status <> 'warming_up' THEN
    sent_count_24h := 0;
    bounce_rate_24h := 0;
    complaint_rate_24h := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_domain.last_stage_updated_at IS NOT NULL
     AND p_now < (v_domain.last_stage_updated_at + INTERVAL '24 hours') THEN
    sent_count_24h := 0;
    bounce_rate_24h := 0;
    complaint_rate_24h := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'bounced')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO v_sent_24h, v_bounced_24h, v_complained_24h
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = v_domain.tenant_id
    AND e.domain_id = v_domain.id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= (p_now - INTERVAL '24 hours')
    AND COALESCE(e.event_ts_provider, e.ingested_at) <= p_now;

  v_sent_24h := COALESCE(v_sent_24h, 0);
  v_bounced_24h := COALESCE(v_bounced_24h, 0);
  v_complained_24h := COALESCE(v_complained_24h, 0);

  v_bounce_rate := v_bounced_24h::NUMERIC / GREATEST(v_sent_24h, 1);
  v_complaint_rate := v_complained_24h::NUMERIC / GREATEST(v_sent_24h, 1);

  v_eligible := v_sent_24h > 0
    AND v_bounce_rate < 0.02
    AND v_complaint_rate < 0.001;

  v_new_stage := v_domain.warmup_stage;
  IF v_eligible THEN
    v_new_stage := v_domain.warmup_stage + 1;
  END IF;

  UPDATE public.email_domains d
  SET
    warmup_stage = v_new_stage,
    daily_limit = public.get_warmup_daily_cap_by_stage(v_new_stage),
    healthy_days_counter = CASE
      WHEN v_eligible THEN d.healthy_days_counter + 1
      ELSE 0
    END,
    last_stage_updated_at = p_now,
    updated_at = p_now
  WHERE d.id = v_domain.id;

  current_stage := v_new_stage;
  advanced := v_eligible;
  sent_count_24h := v_sent_24h;
  bounce_rate_24h := v_bounce_rate;
  complaint_rate_24h := v_complaint_rate;

  RETURN NEXT;
END;
$$;

-- Normalize base warmup stage rules to Milestone 8 policy.
INSERT INTO public.warmup_stage_rules (stage, daily_limit, required_healthy_days)
VALUES
  (1, 200, 1),
  (2, 500, 1),
  (3, 1000, 1),
  (4, 3000, 1),
  (5, 5000, 1),
  (6, 5000, 1)
ON CONFLICT (stage) DO UPDATE
SET
  daily_limit = EXCLUDED.daily_limit,
  required_healthy_days = EXCLUDED.required_healthy_days;

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
      p.action AS reputation_action
    FROM public.email_send_jobs j
    JOIN public.crm_campaigns c ON c.id = j.campaign_id
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    WHERE p.action IN ('allow', 'throttle')
      AND j.available_at <= v_now
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

    -- Warmup enforcement applies only when a concrete domain is selected.
    IF v_candidate.domain_id IS NOT NULL THEN
      SELECT
        d.status,
        GREATEST(COALESCE(d.warmup_stage, 1), 1)
      INTO v_domain_status, v_domain_stage
      FROM public.email_domains d
      WHERE d.id = v_candidate.domain_id
        AND d.tenant_id = v_candidate.tenant_id
      FOR UPDATE;

      -- Domain vanished/mismatched tenant; do not claim this job.
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      IF v_domain_status = 'warming_up' THEN
        -- Advance at most once per 24h when health is good.
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
          -- Split the job so only the remaining-capacity subset is claimed now.
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

          -- Keep current row as the claimable subset.
          UPDATE public.email_send_jobs j
          SET
            recipient_message_ids = v_claimable_message_ids,
            recipient_emails = v_claimable_recipient_emails,
            updated_at = v_now
          WHERE j.id = v_candidate.id;

          -- Insert remainder as a new pending job.
          -- Lock campaign row first to serialize batch_index allocation.
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
      v_claimed_count := v_claimed_count + 1;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_warmup_daily_cap_by_stage(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_warmup_daily_cap_by_stage(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_domain_warmup_daily_cap(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_warmup_daily_cap(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_domain_warmup_reserved_today(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_warmup_reserved_today(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_advance_domain_warmup(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_advance_domain_warmup(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
