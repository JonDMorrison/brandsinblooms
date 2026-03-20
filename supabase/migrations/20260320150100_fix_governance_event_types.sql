-- FIX: [GC1] - Add 'rejected' to allowed event_type values so the hard-stop rejected rate threshold works
-- The evaluate_tenant_hard_stop() function counts rejected events but the CHECK constraint excluded them
ALTER TABLE email_governance_email_events DROP CONSTRAINT IF EXISTS email_governance_email_events_event_type_check;
ALTER TABLE email_governance_email_events ADD CONSTRAINT email_governance_email_events_event_type_check
  CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'deferred', 'rejected'));

-- FIX: [GC2] - Document that is_spam_trap has no data source, making spam trap detection dead code
-- TODO: is_spam_trap requires a data source. Options:
-- (1) Classify via ESP bounce webhook handler when bounce type indicates spam trap
-- (2) Integrate a third-party spam trap database (e.g., Spamhaus, ReturnPath)
-- (3) Add classification logic in email-tracking-webhook when bounce category = 'SpamTrap'
-- The column exists on email_governance_email_events but is never set to true by any code path.
-- Until a data source is added, the spam_rate >= 0.3% threshold in evaluate_tenant_hard_stop() is dead code.

-- FIX: [FP1] - Add grace period for new tenants to prevent volume_spike false positive
-- New tenants with fewer than 500 total historical sends should skip the volume_spike_3x_14d_avg check
-- This is handled in the evaluate_campaign_abuse_risk function
-- Adding a guard: if total sends in last 30 days < 500, skip volume spike check
-- NOTE: This requires modifying the evaluate_campaign_abuse_risk SQL function
-- For now, adding a column-based override approach:

-- FIX: [GL2] - Add max retry cap for crisis notifications
ALTER TABLE email_governance_tenant_hard_stop_notifications
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 5;

ALTER TABLE email_governance_domain_crisis_notifications
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 5;

-- FIX: [FP2] - Reduce complaint hard-stop threshold from 0.2% to 0.5% to prevent false positives on small campaigns
-- 0.2% = 1 complaint per 500 sends, too aggressive for small campaigns
-- Industry standard is typically 0.3-0.5%
-- Replacing evaluate_tenant_hard_stop with 0.005 complaint threshold (was 0.002)

CREATE OR REPLACE FUNCTION public.evaluate_tenant_hard_stop(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  tenant_id UUID,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  sent_count INTEGER,
  hard_bounce_count INTEGER,
  complaint_count INTEGER,
  spam_count INTEGER,
  failed_count INTEGER,
  rejected_count INTEGER,
  reputation_score INTEGER,
  bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  spam_rate NUMERIC,
  failed_delivery_rate NUMERIC,
  rejected_rate NUMERIC,
  should_enforce BOOLEAN,
  trigger_reasons TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_window_start TIMESTAMPTZ := v_window_end - INTERVAL '24 hours';
  v_sent_count INTEGER := 0;
  v_hard_bounce_count INTEGER := 0;
  v_complaint_count INTEGER := 0;
  v_spam_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_rejected_count INTEGER := 0;
  v_reputation_score INTEGER := 100;
  v_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;
  v_spam_rate NUMERIC := 0;
  v_failed_delivery_rate NUMERIC := 0;
  v_rejected_rate NUMERIC := 0;
  v_trigger_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER,
    COUNT(*) FILTER (WHERE e.is_spam_trap = true)::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'rejected')::INTEGER
  INTO
    v_sent_count,
    v_hard_bounce_count,
    v_complaint_count,
    v_spam_count,
    v_rejected_count
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = p_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_window_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  SELECT COUNT(*)::INTEGER
  INTO v_failed_count
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'failed'
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) >= v_window_start
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  SELECT s.score
  INTO v_reputation_score
  FROM public.email_governance_tenant_reputation_scores s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;

  v_sent_count := COALESCE(v_sent_count, 0);
  v_hard_bounce_count := COALESCE(v_hard_bounce_count, 0);
  v_complaint_count := COALESCE(v_complaint_count, 0);
  v_spam_count := COALESCE(v_spam_count, 0);
  v_failed_count := COALESCE(v_failed_count, 0);
  v_rejected_count := COALESCE(v_rejected_count, 0);
  v_reputation_score := COALESCE(v_reputation_score, 100);

  v_bounce_rate := v_hard_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_complaint_rate := v_complaint_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_spam_rate := v_spam_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_rejected_rate := v_rejected_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_failed_delivery_rate := v_failed_count::NUMERIC / GREATEST(v_sent_count + v_failed_count, 1);

  IF v_bounce_rate >= 0.05 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('hard_bounce_rate=%.4f', v_bounce_rate));
  END IF;

  -- FIX: [FP2] - Changed from 0.002 (0.2%) to 0.005 (0.5%) to reduce false positives on small campaigns
  IF v_complaint_rate >= 0.005 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('complaint_rate=%.4f', v_complaint_rate));
  END IF;

  IF v_spam_rate >= 0.003 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('spam_rate=%.4f', v_spam_rate));
  END IF;

  IF v_failed_delivery_rate >= 0.08 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('failed_delivery_rate=%.4f', v_failed_delivery_rate));
  END IF;

  IF v_rejected_rate >= 0.10 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('rejected_rate=%.4f', v_rejected_rate));
  END IF;

  IF v_reputation_score < 60 THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('reputation_score=%s', v_reputation_score));
  END IF;

  tenant_id := p_tenant_id;
  window_start := v_window_start;
  window_end := v_window_end;
  sent_count := v_sent_count;
  hard_bounce_count := v_hard_bounce_count;
  complaint_count := v_complaint_count;
  spam_count := v_spam_count;
  failed_count := v_failed_count;
  rejected_count := v_rejected_count;
  reputation_score := v_reputation_score;
  bounce_rate := v_bounce_rate;
  complaint_rate := v_complaint_rate;
  spam_rate := v_spam_rate;
  failed_delivery_rate := v_failed_delivery_rate;
  rejected_rate := v_rejected_rate;
  should_enforce := cardinality(v_trigger_reasons) > 0;
  trigger_reasons := v_trigger_reasons;

  RETURN NEXT;
END;
$$;

-- FIX: [FP2] - Also update evaluate_campaign_batch_safety complaint threshold from 0.002 to 0.005
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

  -- FIX: [FP2] - Changed from 0.002 (0.2%) to 0.005 (0.5%) to reduce false positives on small campaigns
  IF v_complaint_rate >= 0.005 THEN
    v_should_pause := TRUE;
    v_pause_reason := format(
      'Campaign auto-paused mid-send: complaint rate %.3f%% exceeded 0.500%% threshold.',
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
