-- Milestone 7: Batch Sending Controller
-- Objective:
-- - Hard cap campaign job batch size at 5,000 in app layer.
-- - Enforce 60-120s delay between queued jobs via available_at gating.
-- - Evaluate campaign safety after each batch and auto-pause if thresholds are exceeded.

ALTER TABLE public.email_send_jobs
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_email_send_jobs_claimable_available
  ON public.email_send_jobs (status, available_at, created_at)
  WHERE status IN ('pending', 'in_progress');

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
  claimed_ids UUID[];
BEGIN
  WITH claimable AS (
    SELECT j.id
    FROM public.email_send_jobs j
    JOIN public.crm_campaigns c ON c.id = j.campaign_id
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    WHERE p.action IN ('allow', 'throttle')
      AND j.available_at <= NOW()
      AND (
        j.status = 'pending'
        OR (
          j.status = 'in_progress'
          AND (j.claimed_at IS NULL OR j.claimed_at < (NOW() - make_interval(mins => stale_after_minutes)))
        )
      )
    ORDER BY j.available_at ASC, j.created_at ASC, j.batch_index ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'in_progress',
      claimed_at = NOW(),
      claimed_by = worker_id,
      claim_token = p_claim_token,
      attempts = j.attempts + 1,
      updated_at = NOW()
    WHERE j.id IN (SELECT claimable.id FROM claimable)
    RETURNING j.id
  )
  SELECT ARRAY_AGG(claimed.id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT unnest(COALESCE(claimed_ids, ARRAY[]::UUID[])) AS id;
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
BEGIN
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

GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
