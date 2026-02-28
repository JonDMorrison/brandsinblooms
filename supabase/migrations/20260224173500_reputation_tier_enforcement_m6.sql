-- Milestone 6: Reputation Tier Enforcement
-- Campaign-level operational controls tied to tenant reputation score.
-- Tiers:
-- 90-100 Normal
-- 75-89 Throttled
-- 60-74 Restricted
-- <60 Auto-pause

-- 1) Expand campaign status constraint to match runtime states used by sending pipeline.
ALTER TABLE public.crm_campaigns
  DROP CONSTRAINT IF EXISTS crm_campaigns_status_check;

ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_status_check
  CHECK (status IN (
    'draft',
    'scheduled',
    'queued',
    'partially_queued',
    'sending',
    'paused',
    'sent',
    'sent_with_errors',
    'failed'
  ));

-- 2) Canonical policy RPCs.
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
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT s.score
  INTO v_score
  FROM public.email_governance_tenant_reputation_scores s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;

  v_score := COALESCE(v_score, 100);

  tenant_id := p_tenant_id;
  score := v_score;

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
BEGIN
  SELECT c.tenant_id INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
  END IF;

  SELECT * INTO v_policy
  FROM public.get_tenant_reputation_policy(v_tenant_id);

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  score := v_policy.score;
  tier := v_policy.tier;
  action := v_policy.action;
  recipient_cap := v_policy.recipient_cap;
  job_batch_size := v_policy.job_batch_size;
  send_pacing_multiplier := v_policy.send_pacing_multiplier;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO service_role;

-- 3) Gate send start by policy (campaign-level, no bypass).
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
  v_policy RECORD;
  v_reason TEXT;
BEGIN
  SELECT status INTO st
  FROM public.crm_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF st IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
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

-- 4) Enforce policy in scheduled claims.
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
  -- Auto-pause critical campaigns that are due.
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
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
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

-- 5) Enforce policy in job claim path (prevents restricted/critical from being processed).
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
      AND (
        j.status = 'pending'
        OR (
          j.status = 'in_progress'
          AND (j.claimed_at IS NULL OR j.claimed_at < (NOW() - make_interval(mins => stale_after_minutes)))
        )
      )
    ORDER BY j.created_at ASC, j.batch_index ASC
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

GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
