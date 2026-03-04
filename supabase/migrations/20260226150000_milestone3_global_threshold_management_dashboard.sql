-- Milestone 3: Threshold Management Dashboard (Global Controls)
-- Harden global config validation and enrich internal audit logging for global saves.

CREATE OR REPLACE FUNCTION public.validate_email_governance_config(
  p_config JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_paths TEXT[][] := ARRAY[
    ARRAY['hard_stop_thresholds','hard_bounce_rate'],
    ARRAY['hard_stop_thresholds','complaint_rate'],
    ARRAY['hard_stop_thresholds','spam_rate'],
    ARRAY['hard_stop_thresholds','failed_delivery_rate'],
    ARRAY['hard_stop_thresholds','rejected_rate'],
    ARRAY['hard_stop_thresholds','reputation_score_cutoff'],
    ARRAY['warning_thresholds','hard_bounce_rate'],
    ARRAY['warning_thresholds','soft_bounce_rate'],
    ARRAY['warning_thresholds','complaint_rate'],
    ARRAY['warning_thresholds','trend_multiplier'],
    ARRAY['warning_thresholds','trend_prior_min_sent'],
    ARRAY['reputation_tiers','healthy_min'],
    ARRAY['reputation_tiers','warning_min'],
    ARRAY['reputation_tiers','risk_min'],
    ARRAY['batch','max_batch_size'],
    ARRAY['batch','delay_min_seconds'],
    ARRAY['batch','delay_max_seconds'],
    ARRAY['warmup','base_caps'],
    ARRAY['warmup','scaling_factor'],
    ARRAY['warmup','max_daily_cap'],
    ARRAY['warmup','min_healthy_cap_floor'],
    ARRAY['compliance','high_volume_threshold'],
    ARRAY['compliance','spam_score_threshold']
  ];
  v_rate_paths TEXT[][] := ARRAY[
    ARRAY['hard_stop_thresholds','hard_bounce_rate'],
    ARRAY['hard_stop_thresholds','complaint_rate'],
    ARRAY['hard_stop_thresholds','spam_rate'],
    ARRAY['hard_stop_thresholds','failed_delivery_rate'],
    ARRAY['hard_stop_thresholds','rejected_rate'],
    ARRAY['warning_thresholds','hard_bounce_rate'],
    ARRAY['warning_thresholds','soft_bounce_rate'],
    ARRAY['warning_thresholds','complaint_rate']
  ];
  v_positive_int_paths TEXT[][] := ARRAY[
    ARRAY['warning_thresholds','trend_prior_min_sent'],
    ARRAY['batch','max_batch_size'],
    ARRAY['batch','delay_min_seconds'],
    ARRAY['batch','delay_max_seconds'],
    ARRAY['compliance','high_volume_threshold'],
    ARRAY['compliance','spam_score_threshold'],
    ARRAY['warmup','max_daily_cap']
  ];
  v_reputation_tier_keys TEXT[] := ARRAY['normal', 'throttled', 'restricted', 'critical'];
  v_tier_key TEXT;
  v_path TEXT[];
  v_rate NUMERIC;
  v_num NUMERIC;
  v_int INTEGER;
  v_caps JSONB;
  v_caps_len INTEGER;
  v_idx INTEGER;
BEGIN
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Config must be a JSON object';
  END IF;

  FOREACH v_path SLICE 1 IN ARRAY v_required_paths
  LOOP
    IF p_config #> v_path IS NULL THEN
      RAISE EXCEPTION 'Missing required config path: %', array_to_string(v_path, '.');
    END IF;
  END LOOP;

  FOREACH v_path SLICE 1 IN ARRAY v_rate_paths
  LOOP
    BEGIN
      v_rate := (p_config #>> v_path)::NUMERIC;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Config path % must be numeric', array_to_string(v_path, '.');
    END;

    IF v_rate < 0 OR v_rate > 1 THEN
      RAISE EXCEPTION 'Config path % must be between 0 and 1', array_to_string(v_path, '.');
    END IF;
  END LOOP;

  FOREACH v_path SLICE 1 IN ARRAY v_positive_int_paths
  LOOP
    BEGIN
      v_int := (p_config #>> v_path)::INTEGER;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Config path % must be an integer', array_to_string(v_path, '.');
    END;

    IF v_int <= 0 THEN
      RAISE EXCEPTION 'Config path % must be > 0', array_to_string(v_path, '.');
    END IF;
  END LOOP;

  BEGIN
    v_num := (p_config #>> '{warning_thresholds,trend_multiplier}')::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'warning_thresholds.trend_multiplier must be numeric';
  END;

  IF v_num <= 0 THEN
    RAISE EXCEPTION 'warning_thresholds.trend_multiplier must be > 0';
  END IF;

  BEGIN
    v_num := (p_config #>> '{hard_stop_thresholds,reputation_score_cutoff}')::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'hard_stop_thresholds.reputation_score_cutoff must be numeric';
  END;

  IF v_num < 0 OR v_num > 100 THEN
    RAISE EXCEPTION 'hard_stop_thresholds.reputation_score_cutoff must be between 0 and 100';
  END IF;

  BEGIN
    v_int := (p_config #>> '{reputation_tiers,healthy_min}')::INTEGER;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'reputation_tiers.healthy_min must be an integer';
  END;
  IF v_int < 0 OR v_int > 100 THEN
    RAISE EXCEPTION 'reputation_tiers.healthy_min must be between 0 and 100';
  END IF;

  BEGIN
    v_int := (p_config #>> '{reputation_tiers,warning_min}')::INTEGER;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'reputation_tiers.warning_min must be an integer';
  END;
  IF v_int < 0 OR v_int > 100 THEN
    RAISE EXCEPTION 'reputation_tiers.warning_min must be between 0 and 100';
  END IF;

  BEGIN
    v_int := (p_config #>> '{reputation_tiers,risk_min}')::INTEGER;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'reputation_tiers.risk_min must be an integer';
  END;
  IF v_int < 0 OR v_int > 100 THEN
    RAISE EXCEPTION 'reputation_tiers.risk_min must be between 0 and 100';
  END IF;

  IF (p_config #>> '{reputation_tiers,healthy_min}')::INTEGER <= (p_config #>> '{reputation_tiers,warning_min}')::INTEGER THEN
    RAISE EXCEPTION 'reputation_tiers.healthy_min must be > warning_min';
  END IF;

  IF (p_config #>> '{reputation_tiers,warning_min}')::INTEGER <= (p_config #>> '{reputation_tiers,risk_min}')::INTEGER THEN
    RAISE EXCEPTION 'reputation_tiers.warning_min must be > risk_min';
  END IF;

  IF (p_config #>> '{batch,delay_min_seconds}')::INTEGER > (p_config #>> '{batch,delay_max_seconds}')::INTEGER THEN
    RAISE EXCEPTION 'batch.delay_min_seconds must be <= batch.delay_max_seconds';
  END IF;

  FOREACH v_tier_key IN ARRAY v_reputation_tier_keys
  LOOP
    IF p_config #> ARRAY['reputation_tiers', v_tier_key] IS NULL THEN
      RAISE EXCEPTION 'Missing required config path: reputation_tiers.%', v_tier_key;
    END IF;

    IF p_config #> ARRAY['reputation_tiers', v_tier_key, 'recipient_cap'] IS NULL THEN
      RAISE EXCEPTION 'Missing required config path: reputation_tiers.%.recipient_cap', v_tier_key;
    END IF;

    IF (p_config #> ARRAY['reputation_tiers', v_tier_key, 'recipient_cap']) <> 'null'::jsonb THEN
      BEGIN
        v_int := (p_config #>> ARRAY['reputation_tiers', v_tier_key, 'recipient_cap'])::INTEGER;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE EXCEPTION 'reputation_tiers.%.recipient_cap must be integer or null', v_tier_key;
      END;

      IF v_int < 0 THEN
        RAISE EXCEPTION 'reputation_tiers.%.recipient_cap must be >= 0', v_tier_key;
      END IF;
    END IF;

    BEGIN
      v_int := (p_config #>> ARRAY['reputation_tiers', v_tier_key, 'job_batch_size'])::INTEGER;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'reputation_tiers.%.job_batch_size must be an integer', v_tier_key;
    END;

    IF v_int <= 0 THEN
      RAISE EXCEPTION 'reputation_tiers.%.job_batch_size must be > 0', v_tier_key;
    END IF;

    BEGIN
      v_num := (p_config #>> ARRAY['reputation_tiers', v_tier_key, 'send_pacing_multiplier'])::NUMERIC;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'reputation_tiers.%.send_pacing_multiplier must be numeric', v_tier_key;
    END;

    IF v_num <= 0 THEN
      RAISE EXCEPTION 'reputation_tiers.%.send_pacing_multiplier must be > 0', v_tier_key;
    END IF;
  END LOOP;

  v_caps := p_config #> ARRAY['warmup','base_caps'];
  IF jsonb_typeof(v_caps) <> 'array' THEN
    RAISE EXCEPTION 'warmup.base_caps must be an array';
  END IF;

  v_caps_len := COALESCE(jsonb_array_length(v_caps), 0);
  IF v_caps_len = 0 THEN
    RAISE EXCEPTION 'warmup.base_caps must contain at least one value';
  END IF;

  FOR v_idx IN 0..v_caps_len - 1 LOOP
    BEGIN
      v_int := (v_caps ->> v_idx)::INTEGER;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'warmup.base_caps[%] must be an integer', v_idx;
    END;

    IF v_int <= 0 THEN
      RAISE EXCEPTION 'warmup.base_caps[%] must be > 0', v_idx;
    END IF;
  END LOOP;

  BEGIN
    v_num := (p_config #>> '{warmup,scaling_factor}')::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'warmup.scaling_factor must be numeric';
  END;

  IF v_num <= 0 THEN
    RAISE EXCEPTION 'warmup.scaling_factor must be > 0';
  END IF;

  BEGIN
    v_int := (p_config #>> '{warmup,min_healthy_cap_floor}')::INTEGER;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'warmup.min_healthy_cap_floor must be an integer';
  END;

  IF v_int < 0 THEN
    RAISE EXCEPTION 'warmup.min_healthy_cap_floor must be >= 0';
  END IF;

  IF (p_config #>> '{warmup,min_healthy_cap_floor}')::INTEGER > (p_config #>> '{warmup,max_daily_cap}')::INTEGER THEN
    RAISE EXCEPTION 'warmup.min_healthy_cap_floor must be <= warmup.max_daily_cap';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_email_governance_config(
  p_config JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_new JSONB;
  v_old JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  PERFORM public.validate_email_governance_config(p_config);

  SELECT value INTO v_old
  FROM public.system_config
  WHERE key = 'email_governance_config';

  UPDATE public.system_config
  SET
    value = p_config,
    updated_at = now(),
    description = COALESCE(description, 'Global threshold/window configuration for email governance engine')
  WHERE key = 'email_governance_config';

  IF NOT FOUND THEN
    INSERT INTO public.system_config (key, value, description, updated_at)
    VALUES (
      'email_governance_config',
      p_config,
      'Global threshold/window configuration for email governance engine',
      now()
    );
  END IF;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    NULL,
    'email_governance_config_updated',
    jsonb_build_object(
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_update'),
      'updated_at', now(),
      'version', COALESCE((p_config->>'version')::INTEGER, 1),
      'old_config', COALESCE(v_old, public.email_governance_default_config()),
      'new_config', p_config
    )
  );

  SELECT value INTO v_new
  FROM public.system_config
  WHERE key = 'email_governance_config';

  RETURN v_new;
END;
$$;

NOTIFY pgrst, 'reload schema';
