-- Milestone 2: Per-Tenant Threshold Override System
-- Adds optional tenant-level governance overrides for master admins.

CREATE TABLE IF NOT EXISTS public.tenant_email_governance_overrides (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_email_governance_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_email_governance_overrides'
      AND policyname = 'Master admins can read tenant governance overrides'
  ) THEN
    CREATE POLICY "Master admins can read tenant governance overrides"
      ON public.tenant_email_governance_overrides
      FOR SELECT
      TO authenticated
      USING (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_email_governance_overrides'
      AND policyname = 'Master admins can upsert tenant governance overrides'
  ) THEN
    CREATE POLICY "Master admins can upsert tenant governance overrides"
      ON public.tenant_email_governance_overrides
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_email_governance_overrides'
      AND policyname = 'Master admins can update tenant governance overrides'
  ) THEN
    CREATE POLICY "Master admins can update tenant governance overrides"
      ON public.tenant_email_governance_overrides
      FOR UPDATE
      TO authenticated
      USING (public.is_master_admin(auth.uid()))
      WITH CHECK (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_email_governance_overrides'
      AND policyname = 'Master admins can delete tenant governance overrides'
  ) THEN
    CREATE POLICY "Master admins can delete tenant governance overrides"
      ON public.tenant_email_governance_overrides
      FOR DELETE
      TO authenticated
      USING (public.is_master_admin(auth.uid()));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_tenant_email_governance_overrides(
  p_overrides JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obj JSONB := COALESCE(p_overrides, '{}'::jsonb);
  v_unknown_top JSONB;
  v_unknown_hard_stop JSONB;
  v_unknown_reputation JSONB;
  v_unknown_batch JSONB;
  v_unknown_tier JSONB;
  v_rate NUMERIC;
  v_score NUMERIC;
  v_cap NUMERIC;
  v_batch NUMERIC;
  v_pacing NUMERIC;
  v_tier TEXT;
BEGIN
  IF jsonb_typeof(v_obj) <> 'object' THEN
    RAISE EXCEPTION 'Overrides payload must be a JSON object';
  END IF;

  v_unknown_top := v_obj - ARRAY['hard_stop_thresholds', 'reputation_tiers', 'batch'];
  IF v_unknown_top <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Unsupported top-level override keys: %', v_unknown_top;
  END IF;

  IF v_obj ? 'hard_stop_thresholds' THEN
    IF jsonb_typeof(v_obj->'hard_stop_thresholds') <> 'object' THEN
      RAISE EXCEPTION 'hard_stop_thresholds must be an object';
    END IF;

    v_unknown_hard_stop := (v_obj->'hard_stop_thresholds') - ARRAY['hard_bounce_rate', 'complaint_rate', 'spam_rate'];
    IF v_unknown_hard_stop <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Unsupported hard_stop_thresholds keys: %', v_unknown_hard_stop;
    END IF;

    IF (v_obj->'hard_stop_thresholds') ? 'hard_bounce_rate' THEN
      BEGIN
        v_rate := ((v_obj->'hard_stop_thresholds'->>'hard_bounce_rate'))::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'hard_stop_thresholds.hard_bounce_rate must be numeric';
      END;

      IF v_rate < 0 OR v_rate > 1 THEN
        RAISE EXCEPTION 'hard_stop_thresholds.hard_bounce_rate must be between 0 and 1';
      END IF;
    END IF;

    IF (v_obj->'hard_stop_thresholds') ? 'complaint_rate' THEN
      BEGIN
        v_rate := ((v_obj->'hard_stop_thresholds'->>'complaint_rate'))::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'hard_stop_thresholds.complaint_rate must be numeric';
      END;

      IF v_rate < 0 OR v_rate > 1 THEN
        RAISE EXCEPTION 'hard_stop_thresholds.complaint_rate must be between 0 and 1';
      END IF;
    END IF;

    IF (v_obj->'hard_stop_thresholds') ? 'spam_rate' THEN
      BEGIN
        v_rate := ((v_obj->'hard_stop_thresholds'->>'spam_rate'))::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'hard_stop_thresholds.spam_rate must be numeric';
      END;

      IF v_rate < 0 OR v_rate > 1 THEN
        RAISE EXCEPTION 'hard_stop_thresholds.spam_rate must be between 0 and 1';
      END IF;
    END IF;
  END IF;

  IF v_obj ? 'reputation_tiers' THEN
    IF jsonb_typeof(v_obj->'reputation_tiers') <> 'object' THEN
      RAISE EXCEPTION 'reputation_tiers must be an object';
    END IF;

    v_unknown_reputation := (v_obj->'reputation_tiers') - ARRAY['healthy_min', 'warning_min', 'risk_min', 'throttled', 'restricted', 'critical'];
    IF v_unknown_reputation <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Unsupported reputation_tiers keys: %', v_unknown_reputation;
    END IF;

    IF (v_obj->'reputation_tiers') ? 'healthy_min' THEN
      BEGIN
        v_score := ((v_obj->'reputation_tiers'->>'healthy_min'))::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'reputation_tiers.healthy_min must be numeric';
      END;

      IF v_score < 0 OR v_score > 100 THEN
        RAISE EXCEPTION 'reputation_tiers.healthy_min must be between 0 and 100';
      END IF;
    END IF;

    IF (v_obj->'reputation_tiers') ? 'warning_min' THEN
      BEGIN
        v_score := ((v_obj->'reputation_tiers'->>'warning_min'))::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'reputation_tiers.warning_min must be numeric';
      END;

      IF v_score < 0 OR v_score > 100 THEN
        RAISE EXCEPTION 'reputation_tiers.warning_min must be between 0 and 100';
      END IF;
    END IF;

    IF (v_obj->'reputation_tiers') ? 'risk_min' THEN
      BEGIN
        v_score := ((v_obj->'reputation_tiers'->>'risk_min'))::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'reputation_tiers.risk_min must be numeric';
      END;

      IF v_score < 0 OR v_score > 100 THEN
        RAISE EXCEPTION 'reputation_tiers.risk_min must be between 0 and 100';
      END IF;
    END IF;

    FOREACH v_tier IN ARRAY ARRAY['throttled', 'restricted', 'critical']
    LOOP
      IF (v_obj->'reputation_tiers') ? v_tier THEN
        IF jsonb_typeof(v_obj->'reputation_tiers'->v_tier) <> 'object' THEN
          RAISE EXCEPTION 'reputation_tiers.% must be an object', v_tier;
        END IF;

        v_unknown_tier := (v_obj->'reputation_tiers'->v_tier) - ARRAY['recipient_cap', 'job_batch_size', 'send_pacing_multiplier'];
        IF v_unknown_tier <> '{}'::jsonb THEN
          RAISE EXCEPTION 'Unsupported reputation_tiers.% keys: %', v_tier, v_unknown_tier;
        END IF;

        IF (v_obj->'reputation_tiers'->v_tier) ? 'recipient_cap'
          AND jsonb_typeof(v_obj->'reputation_tiers'->v_tier->'recipient_cap') <> 'null' THEN
          BEGIN
            v_cap := ((v_obj->'reputation_tiers'->v_tier->>'recipient_cap'))::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'reputation_tiers.%.recipient_cap must be numeric or null', v_tier;
          END;

          IF v_cap < 0 OR floor(v_cap) <> v_cap THEN
            RAISE EXCEPTION 'reputation_tiers.%.recipient_cap must be a non-negative integer', v_tier;
          END IF;
        END IF;

        IF (v_obj->'reputation_tiers'->v_tier) ? 'job_batch_size' THEN
          BEGIN
            v_batch := ((v_obj->'reputation_tiers'->v_tier->>'job_batch_size'))::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'reputation_tiers.%.job_batch_size must be numeric', v_tier;
          END;

          IF v_batch <= 0 OR floor(v_batch) <> v_batch THEN
            RAISE EXCEPTION 'reputation_tiers.%.job_batch_size must be a positive integer', v_tier;
          END IF;
        END IF;

        IF (v_obj->'reputation_tiers'->v_tier) ? 'send_pacing_multiplier' THEN
          BEGIN
            v_pacing := ((v_obj->'reputation_tiers'->v_tier->>'send_pacing_multiplier'))::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'reputation_tiers.%.send_pacing_multiplier must be numeric', v_tier;
          END;

          IF v_pacing <= 0 THEN
            RAISE EXCEPTION 'reputation_tiers.%.send_pacing_multiplier must be > 0', v_tier;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_obj ? 'batch' THEN
    IF jsonb_typeof(v_obj->'batch') <> 'object' THEN
      RAISE EXCEPTION 'batch must be an object';
    END IF;

    v_unknown_batch := (v_obj->'batch') - ARRAY['max_batch_size'];
    IF v_unknown_batch <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Unsupported batch keys: %', v_unknown_batch;
    END IF;

    IF (v_obj->'batch') ? 'max_batch_size' THEN
      BEGIN
        v_batch := ((v_obj->'batch'->>'max_batch_size'))::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'batch.max_batch_size must be numeric';
      END;

      IF v_batch <= 0 OR floor(v_batch) <> v_batch THEN
        RAISE EXCEPTION 'batch.max_batch_size must be a positive integer';
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_email_governance_overrides(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overrides JSONB;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT o.overrides
  INTO v_overrides
  FROM public.tenant_email_governance_overrides o
  WHERE o.tenant_id = p_tenant_id;

  RETURN COALESCE(v_overrides, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_eff_value(
  p_tenant_id UUID,
  p_path TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overrides JSONB;
  v_val JSONB;
BEGIN
  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'Config path is required';
  END IF;

  v_overrides := public.get_tenant_email_governance_overrides(p_tenant_id);
  v_val := v_overrides #> p_path;

  IF v_val IS NOT NULL THEN
    RETURN v_val;
  END IF;

  RETURN public.email_gov_cfg_value(p_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_eff_num(
  p_tenant_id UUID,
  p_path TEXT[]
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val JSONB;
  v_num NUMERIC;
BEGIN
  v_val := public.email_gov_eff_value(p_tenant_id, p_path);

  BEGIN
    v_num := (v_val #>> '{}')::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Effective governance config path % is not numeric', array_to_string(p_path, '.');
  END;

  RETURN v_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_eff_int(
  p_tenant_id UUID,
  p_path TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN ROUND(public.email_gov_eff_num(p_tenant_id, p_path))::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_eff_source(
  p_tenant_id UUID,
  p_path TEXT[]
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overrides JSONB;
BEGIN
  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'Config path is required';
  END IF;

  v_overrides := public.get_tenant_email_governance_overrides(p_tenant_id);

  IF (v_overrides #> p_path) IS NOT NULL THEN
    RETURN 'tenant';
  END IF;

  RETURN 'global';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_tenant_email_governance_overrides(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  RETURN public.get_tenant_email_governance_overrides(p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_email_governance_overrides(
  p_tenant_id UUID,
  p_overrides JSONB,
  p_reason TEXT DEFAULT 'manual_update'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_old JSONB;
  v_new JSONB;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'manual_update');
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  PERFORM 1
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  SELECT overrides
  INTO v_old
  FROM public.tenant_email_governance_overrides
  WHERE tenant_id = p_tenant_id;

  PERFORM public.validate_tenant_email_governance_overrides(COALESCE(p_overrides, '{}'::jsonb));

  INSERT INTO public.tenant_email_governance_overrides (
    tenant_id,
    overrides,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_overrides, '{}'::jsonb),
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET overrides = EXCLUDED.overrides,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by,
      updated_reason = EXCLUDED.updated_reason;

  SELECT overrides
  INTO v_new
  FROM public.tenant_email_governance_overrides
  WHERE tenant_id = p_tenant_id;

  PERFORM public.log_admin_action(
    'tenant_governance_overrides_updated',
    p_tenant_id,
    NULL,
    jsonb_build_object(
      'reason', v_reason,
      'old_overrides', COALESCE(v_old, '{}'::jsonb),
      'new_overrides', COALESCE(v_new, '{}'::jsonb)
    )
  );

  RETURN COALESCE(v_new, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_email_governance_effective_runtime_config(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'batch', jsonb_build_object(
      'max_batch_size', public.email_gov_eff_int(p_tenant_id, ARRAY['batch','max_batch_size']),
      'delay_min_seconds', public.email_gov_cfg_int(ARRAY['batch','delay_min_seconds']),
      'delay_max_seconds', public.email_gov_cfg_int(ARRAY['batch','delay_max_seconds'])
    ),
    'compliance', jsonb_build_object(
      'high_volume_threshold', public.email_gov_cfg_int(ARRAY['compliance','high_volume_threshold']),
      'spam_score_threshold', public.email_gov_cfg_num(ARRAY['compliance','spam_score_threshold'])
    ),
    'list_hygiene', jsonb_build_object(
      'invalid_block_threshold_pct', public.email_gov_cfg_num(ARRAY['list_hygiene','invalid_block_threshold_pct']),
      'inactive_warning_threshold_pct', public.email_gov_cfg_num(ARRAY['list_hygiene','inactive_warning_threshold_pct']),
      'bounce_warning_threshold_pct', public.email_gov_cfg_num(ARRAY['list_hygiene','bounce_warning_threshold_pct']),
      'inactive_days', public.email_gov_cfg_int(ARRAY['list_hygiene','inactive_days'])
    )
  );
END;
$$;

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
    recipient_cap := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','critical','recipient_cap']);
    job_batch_size := public.email_gov_eff_int(p_tenant_id, ARRAY['reputation_tiers','critical','job_batch_size']);
    send_pacing_multiplier := public.email_gov_eff_num(p_tenant_id, ARRAY['reputation_tiers','critical','send_pacing_multiplier']);
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
  v_effective_batch_size := COALESCE(v_policy.job_batch_size, public.email_gov_eff_int(v_tenant_id, ARRAY['reputation_tiers','normal','job_batch_size']));
  v_effective_pacing := COALESCE(v_policy.send_pacing_multiplier, public.email_gov_eff_num(v_tenant_id, ARRAY['reputation_tiers','normal','send_pacing_multiplier']));

  IF v_is_throttled THEN
    v_effective_batch_size := GREATEST(1, FLOOR(v_effective_batch_size * 0.5)::INTEGER);
    v_effective_pacing := GREATEST(v_effective_pacing, public.email_gov_eff_num(v_tenant_id, ARRAY['reputation_tiers','throttled','send_pacing_multiplier']));
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
  v_window_size INTERVAL := public.email_gov_cfg_interval(ARRAY['windows','hard_stop_window']);
  v_window_start TIMESTAMPTZ := v_window_end - v_window_size;

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

  v_hard_bounce_threshold NUMERIC := public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate']);
  v_complaint_threshold NUMERIC := public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','complaint_rate']);
  v_spam_threshold NUMERIC := public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','spam_rate']);
  v_failed_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','failed_delivery_rate']);
  v_rejected_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','rejected_rate']);
  v_reputation_cutoff INTEGER := public.email_gov_cfg_int(ARRAY['hard_stop_thresholds','reputation_score_cutoff']);

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

  IF v_bounce_rate >= v_hard_bounce_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('hard_bounce_rate=%.4f', v_bounce_rate));
  END IF;

  IF v_complaint_rate >= v_complaint_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('complaint_rate=%.4f', v_complaint_rate));
  END IF;

  IF v_spam_rate >= v_spam_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('spam_rate=%.4f', v_spam_rate));
  END IF;

  IF v_failed_delivery_rate >= v_failed_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('failed_delivery_rate=%.4f', v_failed_delivery_rate));
  END IF;

  IF v_rejected_rate >= v_rejected_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('rejected_rate=%.4f', v_rejected_rate));
  END IF;

  IF v_reputation_score < v_reputation_cutoff THEN
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

CREATE OR REPLACE FUNCTION public.get_campaign_governance_visibility(
  p_campaign_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  sent_count INTEGER,
  delivered_count INTEGER,
  hard_bounce_count INTEGER,
  soft_bounce_count INTEGER,
  complaint_count INTEGER,
  unsubscribed_count INTEGER,
  failed_count INTEGER,
  delivery_rate NUMERIC,
  hard_bounce_rate NUMERIC,
  soft_bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  unsubscribe_rate NUMERIC,
  failed_delivery_rate NUMERIC,
  risk_indicator TEXT,
  threshold_exceeded TEXT[],
  threshold_details JSONB,
  reputation_score INTEGER,
  reputation_tier TEXT,
  reputation_action TEXT,
  policy_recipient_cap INTEGER,
  policy_job_batch_size INTEGER,
  policy_send_pacing_multiplier NUMERIC,
  is_throttled BOOLEAN,
  throttle_reasons TEXT[],
  reputation_impact TEXT
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
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_window_start TIMESTAMPTZ := v_window_end - public.email_gov_cfg_interval(ARRAY['windows','hard_stop_window']);

  v_sent_count INTEGER := 0;
  v_delivered_count INTEGER := 0;
  v_hard_bounce_count INTEGER := 0;
  v_soft_bounce_count INTEGER := 0;
  v_complaint_count INTEGER := 0;
  v_unsubscribed_count INTEGER := 0;
  v_failed_count INTEGER := 0;

  v_delivery_rate NUMERIC := 0;
  v_hard_bounce_rate NUMERIC := 0;
  v_soft_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;
  v_unsubscribe_rate NUMERIC := 0;
  v_failed_delivery_rate NUMERIC := 0;

  v_warning_eval RECORD;
  v_policy RECORD;
  v_throttle RECORD;

  v_threshold_exceeded TEXT[] := ARRAY[]::TEXT[];
  v_threshold_details JSONB := '{}'::jsonb;
  v_risk_indicator TEXT := 'green';
  v_reputation_impact TEXT := 'normal';

  v_hard_stop_hard_bounce_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','hard_bounce_rate']);
  v_hard_stop_complaint_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','complaint_rate']);
  v_hard_stop_failed_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','failed_delivery_rate']);
  v_warning_hard_bounce_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['warning_thresholds','hard_bounce_rate']);
  v_warning_soft_bounce_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['warning_thresholds','soft_bounce_rate']);
  v_warning_complaint_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['warning_thresholds','complaint_rate']);
BEGIN
  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

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

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'delivered')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'unsubscribed')::INTEGER
  INTO
    v_sent_count,
    v_delivered_count,
    v_hard_bounce_count,
    v_soft_bounce_count,
    v_complaint_count,
    v_unsubscribed_count
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_window_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  SELECT COUNT(*)::INTEGER
  INTO v_failed_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.status = 'failed'
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) >= v_window_start
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  v_sent_count := COALESCE(v_sent_count, 0);
  v_delivered_count := COALESCE(v_delivered_count, 0);
  v_hard_bounce_count := COALESCE(v_hard_bounce_count, 0);
  v_soft_bounce_count := COALESCE(v_soft_bounce_count, 0);
  v_complaint_count := COALESCE(v_complaint_count, 0);
  v_unsubscribed_count := COALESCE(v_unsubscribed_count, 0);
  v_failed_count := COALESCE(v_failed_count, 0);

  v_delivery_rate := v_delivered_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_hard_bounce_rate := v_hard_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_soft_bounce_rate := v_soft_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_complaint_rate := v_complaint_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_unsubscribe_rate := v_unsubscribed_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_failed_delivery_rate := v_failed_count::NUMERIC / GREATEST(v_sent_count + v_failed_count, 1);

  SELECT *
  INTO v_warning_eval
  FROM public.evaluate_campaign_warning_thresholds(p_campaign_id, v_window_end);

  SELECT *
  INTO v_policy
  FROM public.get_campaign_reputation_policy(p_campaign_id);

  SELECT ts.is_throttled, ts.trigger_reasons
  INTO v_throttle
  FROM public.email_governance_campaign_throttle_states ts
  WHERE ts.campaign_id = p_campaign_id;

  IF v_hard_bounce_rate >= v_hard_stop_hard_bounce_threshold THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('hard_bounce_rate=%.4f (threshold=%.4f)', v_hard_bounce_rate, v_hard_stop_hard_bounce_threshold));
  END IF;

  IF v_complaint_rate >= v_hard_stop_complaint_threshold THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('complaint_rate=%.4f (threshold=%.4f)', v_complaint_rate, v_hard_stop_complaint_threshold));
  END IF;

  IF v_failed_delivery_rate >= v_hard_stop_failed_threshold THEN
    v_threshold_exceeded := array_append(v_threshold_exceeded, format('failed_delivery_rate=%.4f (threshold=%.4f)', v_failed_delivery_rate, v_hard_stop_failed_threshold));
  END IF;

  IF cardinality(v_threshold_exceeded) > 0 THEN
    v_risk_indicator := 'red';
  ELSIF COALESCE(v_warning_eval.should_throttle, false) THEN
    v_risk_indicator := 'yellow';
  ELSE
    v_risk_indicator := 'green';
  END IF;

  v_threshold_details := jsonb_build_object(
    'warning_thresholds', jsonb_build_object(
      'hard_bounce_rate', v_warning_hard_bounce_threshold,
      'soft_bounce_rate', v_warning_soft_bounce_threshold,
      'complaint_rate', v_warning_complaint_threshold
    ),
    'hard_stop_thresholds', jsonb_build_object(
      'hard_bounce_rate', v_hard_stop_hard_bounce_threshold,
      'complaint_rate', v_hard_stop_complaint_threshold,
      'failed_delivery_rate', v_hard_stop_failed_threshold
    ),
    'warning_triggered', COALESCE(v_warning_eval.should_throttle, false),
    'warning_reasons', COALESCE(v_warning_eval.trigger_reasons, ARRAY[]::TEXT[]),
    'hard_stop_reasons', v_threshold_exceeded
  );

  IF COALESCE(v_policy.action, 'allow') <> 'allow' AND COALESCE(v_throttle.is_throttled, false) THEN
    v_reputation_impact := 'policy_and_throttle';
  ELSIF COALESCE(v_policy.action, 'allow') <> 'allow' THEN
    v_reputation_impact := 'policy_only';
  ELSIF COALESCE(v_throttle.is_throttled, false) THEN
    v_reputation_impact := 'throttle_only';
  ELSE
    v_reputation_impact := 'none';
  END IF;

  campaign_id := p_campaign_id;
  tenant_id := v_effective_tenant_id;
  sent_count := v_sent_count;
  delivered_count := v_delivered_count;
  hard_bounce_count := v_hard_bounce_count;
  soft_bounce_count := v_soft_bounce_count;
  complaint_count := v_complaint_count;
  unsubscribed_count := v_unsubscribed_count;
  failed_count := v_failed_count;
  delivery_rate := v_delivery_rate;
  hard_bounce_rate := v_hard_bounce_rate;
  soft_bounce_rate := v_soft_bounce_rate;
  complaint_rate := v_complaint_rate;
  unsubscribe_rate := v_unsubscribe_rate;
  failed_delivery_rate := v_failed_delivery_rate;
  risk_indicator := v_risk_indicator;
  threshold_exceeded := COALESCE(v_threshold_exceeded, ARRAY[]::TEXT[]);
  threshold_details := COALESCE(v_threshold_details, '{}'::jsonb);
  reputation_score := COALESCE(v_policy.score, 100);
  reputation_tier := COALESCE(v_policy.tier, 'normal');
  reputation_action := COALESCE(v_policy.action, 'allow');
  policy_recipient_cap := v_policy.recipient_cap;
  policy_job_batch_size := COALESCE(v_policy.job_batch_size, 50);
  policy_send_pacing_multiplier := COALESCE(v_policy.send_pacing_multiplier, 1);
  is_throttled := COALESCE(v_throttle.is_throttled, false);
  throttle_reasons := COALESCE(v_throttle.trigger_reasons, ARRAY[]::TEXT[]);
  reputation_impact := v_reputation_impact;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_tenant_email_governance_overrides(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_tenant_email_governance_overrides(JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_tenant_email_governance_overrides(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_email_governance_overrides(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.email_gov_eff_value(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_value(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_num(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_num(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_int(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_int(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_source(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_source(UUID, TEXT[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_get_tenant_email_governance_overrides(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_email_governance_overrides(UUID, JSONB, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_email_governance_effective_runtime_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_governance_effective_runtime_config(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
