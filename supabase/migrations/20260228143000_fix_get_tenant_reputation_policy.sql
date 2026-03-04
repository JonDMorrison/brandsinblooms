-- Repair migration: restore missing public.get_tenant_reputation_policy(uuid)

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
  v_unlimited BOOLEAN := false;
  v_healthy_min INTEGER;
  v_warning_min INTEGER;
  v_risk_min INTEGER;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_healthy_min := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','healthy_min']);
  v_warning_min := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','warning_min']);
  v_risk_min := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','risk_min']);

  SELECT s.score
  INTO v_score
  FROM public.email_governance_tenant_reputation_scores s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;

  -- Tenant state fields vary across environments; read via json to avoid hard dependency.
  SELECT
    CASE
      WHEN tj ? 'email_under_review' THEN
        CASE jsonb_typeof(tj->'email_under_review')
          WHEN 'boolean' THEN (tj->>'email_under_review')::boolean
          WHEN 'string' THEN lower(COALESCE(tj->>'email_under_review','')) IN ('true','t','1','yes')
          WHEN 'number' THEN (tj->>'email_under_review')::numeric <> 0
          ELSE false
        END
      ELSE false
    END
  INTO v_under_review
  FROM (
    SELECT to_jsonb(t) AS tj
    FROM public.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1
  ) s;

  SELECT COALESCE(s.unlimited_sending_enabled, false)
  INTO v_unlimited
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  v_score := COALESCE(v_score, 100);
  v_under_review := COALESCE(v_under_review, false);
  v_unlimited := COALESCE(v_unlimited, false);

  tenant_id := p_tenant_id;
  score := v_score;

  IF v_under_review THEN
    tier := 'critical';
    action := 'pause';
    recipient_cap := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','critical','recipient_cap']);
    job_batch_size := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','critical','job_batch_size']);
    send_pacing_multiplier := public.email_gov_eff_num(p_tenant_id, ARRAY['reputation_tiers','critical','send_pacing_multiplier']);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_unlimited THEN
    tier := 'normal';
    action := 'allow';
    recipient_cap := NULL;
    job_batch_size := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','normal','job_batch_size']);
    send_pacing_multiplier := 1;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_score >= v_healthy_min THEN
    tier := 'normal';
    action := 'allow';
    recipient_cap := NULLIF(public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','normal','recipient_cap']), 0);
    job_batch_size := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','normal','job_batch_size']);
    send_pacing_multiplier := public.email_gov_eff_num(p_tenant_id, ARRAY['reputation_tiers','normal','send_pacing_multiplier']);
  ELSIF v_score >= v_warning_min THEN
    tier := 'throttled';
    action := 'throttle';
    recipient_cap := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','throttled','recipient_cap']);
    job_batch_size := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','throttled','job_batch_size']);
    send_pacing_multiplier := public.email_gov_eff_num(p_tenant_id, ARRAY['reputation_tiers','throttled','send_pacing_multiplier']);
  ELSIF v_score >= v_risk_min THEN
    tier := 'restricted';
    action := 'restrict';
    recipient_cap := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','restricted','recipient_cap']);
    job_batch_size := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','restricted','job_batch_size']);
    send_pacing_multiplier := public.email_gov_eff_num(p_tenant_id, ARRAY['reputation_tiers','restricted','send_pacing_multiplier']);
  ELSE
    tier := 'critical';
    action := 'pause';
    recipient_cap := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','critical','recipient_cap']);
    job_batch_size := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','critical','job_batch_size']);
    send_pacing_multiplier := public.email_gov_eff_num(p_tenant_id, ARRAY['reputation_tiers','critical','send_pacing_multiplier']);
  END IF;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
