-- Milestone 9: Absolute Hard Stop Enforcement Engine
-- Trigger Conditions (rolling 24h):
-- - Hard Bounce >= 5%
-- - Complaint >= 0.2%
-- - Spam trap >= 0.3%
-- - Failed Delivery >= 8%
-- - Rejected >= 10%
-- - Reputation score < 60

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS email_under_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_under_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_under_review_reason TEXT,
  ADD COLUMN IF NOT EXISTS email_under_review_details JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.email_governance_tenant_enforcement_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('hard_stop')),
  source TEXT NOT NULL DEFAULT 'system',
  trigger_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  trigger_reason TEXT,
  trigger_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_tenant_enforcement_tenant_time
  ON public.email_governance_tenant_enforcement_actions (tenant_id, triggered_at DESC);

CREATE TABLE IF NOT EXISTS public.email_governance_tenant_hard_stop_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enforcement_action_id UUID NOT NULL REFERENCES public.email_governance_tenant_enforcement_actions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  claim_token UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enforcement_action_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_hard_stop_notif_claimable
  ON public.email_governance_tenant_hard_stop_notifications (status, created_at)
  WHERE status IN ('pending', 'in_progress');

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

  IF v_complaint_rate >= 0.002 THEN
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

CREATE OR REPLACE FUNCTION public.enqueue_tenant_hard_stop_notifications(
  p_action_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action RECORD;
  v_tenant_name TEXT;
  v_subject TEXT;
  v_body TEXT;
  v_inserted INTEGER := 0;
BEGIN
  SELECT a.*
  INTO v_action
  FROM public.email_governance_tenant_enforcement_actions a
  WHERE a.id = p_action_id;

  IF v_action.id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT t.name
  INTO v_tenant_name
  FROM public.tenants t
  WHERE t.id = v_action.tenant_id;

  v_subject := format('[Action Required] Sending paused: tenant %s is under review', COALESCE(v_tenant_name, v_action.tenant_id::text));
  v_body := format(
    'Your tenant has been placed under review and all active campaigns were paused automatically.%s%s%s%s%s',
    E'\n\nReason:',
    COALESCE(v_action.trigger_reason, 'Deliverability hard-stop thresholds exceeded.'),
    E'\n\nTriggered at: ',
    to_char(v_action.triggered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC',
    E'\n\nPlease review list hygiene, sender reputation, and recent sending practices before resuming campaigns.'
  );

  WITH admin_users AS (
    SELECT u.id, u.email
    FROM public.users u
    WHERE u.tenant_id = v_action.tenant_id
      AND u.email IS NOT NULL
      AND btrim(u.email) <> ''
      AND COALESCE(u.role, '') = 'admin'
  ), recipients AS (
    SELECT au.id, au.email FROM admin_users au
    UNION ALL
    SELECT u.id, u.email
    FROM public.users u
    WHERE u.tenant_id = v_action.tenant_id
      AND u.email IS NOT NULL
      AND btrim(u.email) <> ''
      AND NOT EXISTS (SELECT 1 FROM admin_users)
  ), inserted AS (
    INSERT INTO public.email_governance_tenant_hard_stop_notifications (
      enforcement_action_id,
      tenant_id,
      recipient_user_id,
      recipient_email,
      subject,
      body_text,
      status
    )
    SELECT
      v_action.id,
      v_action.tenant_id,
      r.id,
      r.email,
      v_subject,
      v_body,
      'pending'
    FROM recipients r
    ON CONFLICT (enforcement_action_id, recipient_email) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_inserted FROM inserted;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_tenant_hard_stop(
  p_tenant_id UUID,
  p_trigger_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_trigger_details JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'system'
)
RETURNS TABLE (
  enforced BOOLEAN,
  action_id UUID,
  campaigns_paused INTEGER,
  jobs_paused INTEGER,
  notifications_queued INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_action_id UUID;
  v_campaigns_paused INTEGER := 0;
  v_jobs_paused INTEGER := 0;
  v_notifications_queued INTEGER := 0;
  v_is_under_review BOOLEAN := false;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_reason := COALESCE(
    array_to_string(p_trigger_reasons, ', '),
    'Deliverability hard-stop thresholds exceeded'
  );

  SELECT t.email_under_review
  INTO v_is_under_review
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;

  IF NOT COALESCE(v_is_under_review, false) THEN
    UPDATE public.tenants t
    SET
      email_under_review = true,
      email_under_review_at = now(),
      email_under_review_reason = v_reason,
      email_under_review_details = COALESCE(p_trigger_details, '{}'::jsonb),
      updated_at = now()
    WHERE t.id = p_tenant_id;
  END IF;

  INSERT INTO public.email_governance_tenant_enforcement_actions (
    tenant_id,
    action_type,
    source,
    trigger_reasons,
    trigger_reason,
    trigger_details,
    triggered_at
  )
  VALUES (
    p_tenant_id,
    'hard_stop',
    COALESCE(NULLIF(p_source, ''), 'system'),
    COALESCE(p_trigger_reasons, ARRAY[]::TEXT[]),
    v_reason,
    COALESCE(p_trigger_details, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_action_id;

  WITH paused_campaigns AS (
    UPDATE public.crm_campaigns c
    SET
      status = 'paused',
      send_blocked_reason = 'tenant_hard_stop_under_review',
      send_error = format('Campaign paused by tenant hard-stop enforcement: %s', v_reason),
      send_started_at = NULL,
      sending_started_at = NULL,
      claim_token = NULL,
      updated_at = now()
    WHERE c.tenant_id = p_tenant_id
      AND c.status IN ('draft', 'scheduled', 'queued', 'partially_queued', 'sending', 'paused')
    RETURNING c.id
  )
  SELECT COUNT(*)::INTEGER INTO v_campaigns_paused FROM paused_campaigns;

  WITH paused_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = format('Paused by tenant hard-stop enforcement: %s', v_reason),
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    FROM public.crm_campaigns c
    WHERE c.id = j.campaign_id
      AND c.tenant_id = p_tenant_id
      AND j.status IN ('pending', 'in_progress')
    RETURNING j.id
  )
  SELECT COUNT(*)::INTEGER INTO v_jobs_paused FROM paused_jobs;

  v_notifications_queued := public.enqueue_tenant_hard_stop_notifications(v_action_id);

  enforced := true;
  action_id := v_action_id;
  campaigns_paused := COALESCE(v_campaigns_paused, 0);
  jobs_paused := COALESCE(v_jobs_paused, 0);
  notifications_queued := COALESCE(v_notifications_queued, 0);
  reason := v_reason;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_enforce_tenant_hard_stop(
  p_tenant_id UUID,
  p_source TEXT DEFAULT 'system',
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  triggered BOOLEAN,
  enforced BOOLEAN,
  action_id UUID,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval RECORD;
  v_enforce RECORD;
BEGIN
  SELECT * INTO v_eval
  FROM public.evaluate_tenant_hard_stop(p_tenant_id, p_as_of);

  IF COALESCE(v_eval.should_enforce, false) THEN
    SELECT * INTO v_enforce
    FROM public.enforce_tenant_hard_stop(
      p_tenant_id,
      COALESCE(v_eval.trigger_reasons, ARRAY[]::TEXT[]),
      jsonb_build_object(
        'window_start', v_eval.window_start,
        'window_end', v_eval.window_end,
        'sent_count', v_eval.sent_count,
        'hard_bounce_count', v_eval.hard_bounce_count,
        'complaint_count', v_eval.complaint_count,
        'spam_count', v_eval.spam_count,
        'failed_count', v_eval.failed_count,
        'rejected_count', v_eval.rejected_count,
        'reputation_score', v_eval.reputation_score,
        'bounce_rate', v_eval.bounce_rate,
        'complaint_rate', v_eval.complaint_rate,
        'spam_rate', v_eval.spam_rate,
        'failed_delivery_rate', v_eval.failed_delivery_rate,
        'rejected_rate', v_eval.rejected_rate
      ),
      p_source
    );

    triggered := true;
    enforced := COALESCE(v_enforce.enforced, false);
    action_id := v_enforce.action_id;
    reason := COALESCE(v_enforce.reason, array_to_string(v_eval.trigger_reasons, ', '));
    RETURN NEXT;
    RETURN;
  END IF;

  triggered := false;
  enforced := false;
  action_id := NULL;
  reason := NULL;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_tenant_hard_stop_notifications(
  p_limit INTEGER DEFAULT 20,
  p_worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  p_stale_after_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  enforcement_action_id UUID,
  tenant_id UUID,
  recipient_email TEXT,
  subject TEXT,
  body_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT n.id
    FROM public.email_governance_tenant_hard_stop_notifications n
    WHERE (
      n.status = 'pending'
      OR (
        n.status = 'in_progress'
        AND (n.claimed_at IS NULL OR n.claimed_at < (now() - make_interval(mins => p_stale_after_minutes)))
      )
    )
    ORDER BY n.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.email_governance_tenant_hard_stop_notifications n
    SET
      status = 'in_progress',
      claimed_at = now(),
      claimed_by = p_worker_id,
      claim_token = p_claim_token,
      attempts = n.attempts + 1,
      updated_at = now()
    WHERE n.id IN (SELECT c.id FROM claimable c)
    RETURNING n.id, n.enforcement_action_id, n.tenant_id, n.recipient_email, n.subject, n.body_text
  )
  SELECT c.id, c.enforcement_action_id, c.tenant_id, c.recipient_email, c.subject, c.body_text
  FROM claimed c;
END;
$$;

-- Override policy to block all campaign sending while tenant is under review.
CREATE OR REPLACE FUNCTION public.get_tenant_reputation_policy(
  p_tenant_id UUID
)
RETURNS TABLE (
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
  v_score INTEGER := 100;
  v_under_review BOOLEAN := false;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT s.score
  INTO v_score
  FROM public.email_governance_tenant_reputation_scores s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;

  SELECT t.email_under_review
  INTO v_under_review
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  v_score := COALESCE(v_score, 100);
  v_under_review := COALESCE(v_under_review, false);

  tenant_id := p_tenant_id;
  score := v_score;

  IF v_under_review THEN
    tier := 'critical';
    action := 'pause';
    recipient_cap := 0;
    job_batch_size := 10;
    send_pacing_multiplier := 4;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_score >= 90 THEN
    tier := 'normal';
    action := 'allow';
    recipient_cap := NULL;
    job_batch_size := 50;
    send_pacing_multiplier := 1;
  ELSIF v_score >= 75 THEN
    tier := 'throttled';
    action := 'throttle';
    recipient_cap := 10000;
    job_batch_size := 25;
    send_pacing_multiplier := 2;
  ELSIF v_score >= 60 THEN
    tier := 'restricted';
    action := 'restrict';
    recipient_cap := 2000;
    job_batch_size := 10;
    send_pacing_multiplier := 4;
  ELSE
    tier := 'critical';
    action := 'pause';
    recipient_cap := 0;
    job_batch_size := 10;
    send_pacing_multiplier := 4;
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_campaign_sending(p_campaign_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  current_status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st TEXT;
  v_tenant_id UUID;
  v_under_review BOOLEAN := false;
  v_policy RECORD;
  v_reason TEXT;
BEGIN
  SELECT c.status, c.tenant_id
  INTO st, v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF st IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;

  SELECT t.email_under_review
  INTO v_under_review
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF COALESCE(v_under_review, false) THEN
    v_reason := 'Campaign blocked: tenant is under review due to deliverability hard-stop enforcement.';
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'tenant_hard_stop_under_review',
      v_reason
    );
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, v_reason;
    RETURN;
  END IF;

  SELECT * INTO v_policy
  FROM public.get_campaign_reputation_policy(p_campaign_id);

  IF v_policy.action = 'pause' THEN
    v_reason := format('Campaign auto-paused: reputation score %s is below 60.', v_policy.score);
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'reputation_critical_autopause',
      v_reason
    );
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, v_reason;
    RETURN;
  END IF;

  IF v_policy.action = 'restrict' THEN
    v_reason := format('Campaign blocked: reputation score %s is in restricted tier (60-74).', v_policy.score);

    UPDATE public.crm_campaigns
    SET
      send_blocked_reason = 'reputation_restricted',
      send_error = v_reason,
      updated_at = now()
    WHERE id = p_campaign_id;

    RETURN QUERY SELECT FALSE, st, v_reason;
    RETURN;
  END IF;

  IF st IN ('sent') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign already sent'::TEXT;
    RETURN;
  END IF;

  IF st IN ('failed') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign previously failed - reset to draft first'::TEXT;
    RETURN;
  END IF;

  IF st IN ('draft', 'scheduled', 'queued', 'partially_queued') THEN
    UPDATE public.crm_campaigns
    SET
      status = 'sending',
      send_started_at = COALESCE(send_started_at, NOW()),
      send_error = NULL,
      send_blocked_reason = NULL
    WHERE id = p_campaign_id;

    RETURN QUERY SELECT TRUE, 'sending'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF st = 'sending' THEN
    RETURN QUERY SELECT TRUE, st, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, st, 'Campaign cannot be sent from status: ' || st;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size INT DEFAULT 10)
RETURNS SETOF public.crm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids UUID[];
  v_campaign RECORD;
BEGIN
  FOR v_campaign IN
    SELECT c.id
    FROM public.crm_campaigns c
    JOIN public.tenants t ON t.id = c.tenant_id
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      AND t.email_under_review = true
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.system_pause_email_campaign_sending(
      v_campaign.id,
      'tenant_hard_stop_under_review',
      'Campaign auto-paused: tenant is under review due to hard-stop enforcement.'
    );
  END LOOP;

  FOR v_campaign IN
    SELECT c.id
    FROM public.crm_campaigns c
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      AND p.action = 'pause'
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.system_pause_email_campaign_sending(
      v_campaign.id,
      'reputation_critical_autopause',
      'Campaign auto-paused due to critical tenant reputation score (<60).'
    );
  END LOOP;

  WITH claimable AS (
    SELECT c.id
    FROM public.crm_campaigns c
    JOIN public.tenants t ON t.id = c.tenant_id
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      AND t.email_under_review = false
      AND p.action IN ('allow', 'throttle')
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_started_at = NOW(),
      send_error = NULL,
      send_blocked_reason = NULL
    WHERE c.id IN (SELECT id FROM claimable)
    RETURNING c.id
  )
  SELECT ARRAY_AGG(id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT *
  FROM public.crm_campaigns
  WHERE id = ANY(COALESCE(claimed_ids, ARRAY[]::UUID[]));
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

GRANT EXECUTE ON FUNCTION public.evaluate_tenant_hard_stop(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_tenant_hard_stop(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_tenant_hard_stop_notifications(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_tenant_hard_stop(UUID, TEXT[], JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_hard_stop(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_tenant_hard_stop_notifications(INTEGER, TEXT, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_campaign_batch_safety(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
