-- Forward-only repair migration.
-- Prevents misconfigured/legacy policies from returning recipient_cap=0 for allow/normal,
-- which would otherwise truncate the audience to 0 and make campaign sends fail.

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
    RETURN;
  END IF;

  -- Default policy.
  v_policy := ROW(
    v_tenant_id,
    100,
    'normal',
    'allow',
    NULL::INTEGER,
    50,
    1::NUMERIC
  );

  BEGIN
    SELECT * INTO v_policy
    FROM public.get_tenant_reputation_policy(v_tenant_id);
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  BEGIN
    SELECT COALESCE(s.is_throttled, false)
    INTO v_is_throttled
    FROM public.email_governance_campaign_throttle_states s
    WHERE s.campaign_id = p_campaign_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_is_throttled := false;
  END;

  v_effective_batch_size := COALESCE(v_policy.job_batch_size, 50);
  v_effective_pacing := COALESCE(v_policy.send_pacing_multiplier, 1);

  IF COALESCE(v_is_throttled, false) THEN
    v_effective_batch_size := GREATEST(1, FLOOR(v_effective_batch_size * 0.5)::INTEGER);
    v_effective_pacing := GREATEST(v_effective_pacing, 2);
  END IF;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  score := COALESCE(v_policy.score, 100);
  tier := COALESCE(NULLIF(v_policy.tier, ''), 'normal');
  action := COALESCE(NULLIF(v_policy.action, ''), 'allow');

  -- Treat 0/negative caps as "no cap" when action is allow.
  IF action = 'allow' THEN
    recipient_cap := NULLIF(v_policy.recipient_cap, 0);
    IF recipient_cap IS NOT NULL AND recipient_cap < 0 THEN
      recipient_cap := NULL;
    END IF;
  ELSE
    recipient_cap := v_policy.recipient_cap;
  END IF;

  -- If throttled and policy says allow, present tier/action as throttled.
  IF COALESCE(v_is_throttled, false) AND action = 'allow' THEN
    tier := 'throttled';
    action := 'throttle';
  END IF;

  job_batch_size := v_effective_batch_size;
  send_pacing_multiplier := v_effective_pacing;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
