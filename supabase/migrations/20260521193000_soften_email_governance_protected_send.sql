-- Soften email governance into Protected Send mode
--
-- Product goal:
-- Avoid surprising users with hard campaign blocks for reputation tiers that can be
-- handled safely through pacing, recipient caps, and clear UX. Truly unsafe states
-- still pause sending, but the 60-74 reputation band now becomes Protected Send.

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
    -- Previously this tier returned action='restrict', which caused a hard block.
    -- Product decision: treat this as Protected Send instead. The campaign can
    -- send, but more gradually and with a recipient cap.
    tier := 'restricted';
    action := 'throttle';
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

GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO service_role;
