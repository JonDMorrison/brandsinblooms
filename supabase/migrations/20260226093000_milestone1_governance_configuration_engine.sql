-- Milestone 1: Governance Configuration Engine (Global Threshold Layer)
-- Centralizes governance thresholds and windows in system_config.

-- 1) Ensure global config row exists
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_config'
      AND policyname = 'Allow read access to system_config'
  ) THEN
    CREATE POLICY "Allow read access to system_config"
      ON public.system_config
      FOR SELECT
      USING (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_governance_default_config()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'windows', jsonb_build_object(
      'hard_stop_window', '24 hours',
      'warning_window', '24 hours',
      'tenant_snapshot_24h', '24 hours',
      'tenant_snapshot_30d', '30 days',
      'warning_trend_recent', '30 minutes',
      'warning_trend_prior', '120 minutes'
    ),
    'hard_stop_thresholds', jsonb_build_object(
      'hard_bounce_rate', 0.05,
      'complaint_rate', 0.002,
      'spam_rate', 0.003,
      'failed_delivery_rate', 0.08,
      'rejected_rate', 0.10,
      'reputation_score_cutoff', 60
    ),
    'warning_thresholds', jsonb_build_object(
      'hard_bounce_rate', 0.03,
      'soft_bounce_rate', 0.05,
      'complaint_rate', 0.001,
      'trend_multiplier', 2,
      'trend_prior_min_sent', 100
    ),
    'reputation_tiers', jsonb_build_object(
      'healthy_min', 90,
      'warning_min', 75,
      'risk_min', 60,
      'normal', jsonb_build_object(
        'recipient_cap', NULL,
        'job_batch_size', 50,
        'send_pacing_multiplier', 1
      ),
      'throttled', jsonb_build_object(
        'recipient_cap', 10000,
        'job_batch_size', 25,
        'send_pacing_multiplier', 2
      ),
      'restricted', jsonb_build_object(
        'recipient_cap', 2000,
        'job_batch_size', 10,
        'send_pacing_multiplier', 4
      ),
      'critical', jsonb_build_object(
        'recipient_cap', 0,
        'job_batch_size', 10,
        'send_pacing_multiplier', 4
      )
    ),
    'batch', jsonb_build_object(
      'max_batch_size', 5000,
      'delay_min_seconds', 60,
      'delay_max_seconds', 120
    ),
    'warmup', jsonb_build_object(
      'base_caps', jsonb_build_array(200, 500, 1000, 3000, 5000),
      'scaling_factor', 1.2,
      'max_daily_cap', 50000,
      'min_healthy_cap_floor', 5000
    ),
    'list_hygiene', jsonb_build_object(
      'invalid_block_threshold_pct', 5,
      'inactive_warning_threshold_pct', 10,
      'bounce_warning_threshold_pct', 2,
      'inactive_days', 90
    ),
    'compliance', jsonb_build_object(
      'high_volume_threshold', 50000,
      'spam_score_threshold', 5
    )
  );
$$;

INSERT INTO public.system_config (key, value, description)
VALUES (
  'email_governance_config',
  public.email_governance_default_config(),
  'Global threshold/window configuration for email governance engine'
)
ON CONFLICT (key) DO NOTHING;

-- 2) Typed config getters
CREATE OR REPLACE FUNCTION public.get_email_governance_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg JSONB;
BEGIN
  SELECT value INTO v_cfg
  FROM public.system_config
  WHERE key = 'email_governance_config';

  IF v_cfg IS NULL OR jsonb_typeof(v_cfg) <> 'object' THEN
    RETURN public.email_governance_default_config();
  END IF;

  RETURN v_cfg;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_cfg_value(p_path TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg JSONB;
  v_val JSONB;
BEGIN
  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'Config path is required';
  END IF;

  v_cfg := public.get_email_governance_config();
  v_val := v_cfg #> p_path;

  IF v_val IS NULL THEN
    RAISE EXCEPTION 'Missing governance config at path: %', array_to_string(p_path, '.');
  END IF;

  RETURN v_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_cfg_num(p_path TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val JSONB;
  v_num NUMERIC;
BEGIN
  v_val := public.email_gov_cfg_value(p_path);

  BEGIN
    v_num := (v_val #>> '{}')::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Governance config path % is not numeric', array_to_string(p_path, '.');
  END;

  RETURN v_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_cfg_int(p_path TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num NUMERIC;
BEGIN
  v_num := public.email_gov_cfg_num(p_path);
  RETURN ROUND(v_num)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_cfg_interval(p_path TEXT[])
RETURNS INTERVAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val JSONB;
  v_txt TEXT;
BEGIN
  v_val := public.email_gov_cfg_value(p_path);
  v_txt := v_val #>> '{}';

  IF v_txt IS NULL OR btrim(v_txt) = '' THEN
    RAISE EXCEPTION 'Governance config path % is empty interval text', array_to_string(p_path, '.');
  END IF;

  RETURN v_txt::INTERVAL;
END;
$$;

-- 3) Admin read/write RPCs
CREATE OR REPLACE FUNCTION public.admin_get_email_governance_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  RETURN public.get_email_governance_config();
END;
$$;

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
    ARRAY['batch','max_batch_size'],
    ARRAY['batch','delay_min_seconds'],
    ARRAY['batch','delay_max_seconds'],
    ARRAY['compliance','high_volume_threshold'],
    ARRAY['compliance','spam_score_threshold']
  ];
  v_path TEXT[];
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

  IF (p_config #>> '{batch,delay_min_seconds}')::INTEGER > (p_config #>> '{batch,delay_max_seconds}')::INTEGER THEN
    RAISE EXCEPTION 'batch.delay_min_seconds must be <= batch.delay_max_seconds';
  END IF;

  IF (p_config #>> '{reputation_tiers,healthy_min}')::INTEGER <= (p_config #>> '{reputation_tiers,warning_min}')::INTEGER THEN
    RAISE EXCEPTION 'reputation_tiers.healthy_min must be > warning_min';
  END IF;

  IF (p_config #>> '{reputation_tiers,warning_min}')::INTEGER <= (p_config #>> '{reputation_tiers,risk_min}')::INTEGER THEN
    RAISE EXCEPTION 'reputation_tiers.warning_min must be > risk_min';
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
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  PERFORM public.validate_email_governance_config(p_config);

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
      'version', COALESCE((p_config->>'version')::INTEGER, 1)
    )
  );

  SELECT value INTO v_new
  FROM public.system_config
  WHERE key = 'email_governance_config';

  RETURN v_new;
END;
$$;

-- 4) Refactor core threshold-driven governance functions to runtime config

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

  v_healthy_min := public.email_gov_cfg_int(ARRAY['reputation_tiers','healthy_min']);
  v_warning_min := public.email_gov_cfg_int(ARRAY['reputation_tiers','warning_min']);
  v_risk_min := public.email_gov_cfg_int(ARRAY['reputation_tiers','risk_min']);

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
    recipient_cap := public.email_gov_cfg_int(ARRAY['reputation_tiers','critical','recipient_cap']);
    job_batch_size := public.email_gov_cfg_int(ARRAY['reputation_tiers','critical','job_batch_size']);
    send_pacing_multiplier := public.email_gov_cfg_num(ARRAY['reputation_tiers','critical','send_pacing_multiplier']);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_score >= v_healthy_min THEN
    tier := 'normal';
    action := 'allow';
    recipient_cap := NULLIF(public.email_gov_cfg_int(ARRAY['reputation_tiers','normal','recipient_cap']), 0);
    job_batch_size := public.email_gov_cfg_int(ARRAY['reputation_tiers','normal','job_batch_size']);
    send_pacing_multiplier := public.email_gov_cfg_num(ARRAY['reputation_tiers','normal','send_pacing_multiplier']);
  ELSIF v_score >= v_warning_min THEN
    tier := 'throttled';
    action := 'throttle';
    recipient_cap := public.email_gov_cfg_int(ARRAY['reputation_tiers','throttled','recipient_cap']);
    job_batch_size := public.email_gov_cfg_int(ARRAY['reputation_tiers','throttled','job_batch_size']);
    send_pacing_multiplier := public.email_gov_cfg_num(ARRAY['reputation_tiers','throttled','send_pacing_multiplier']);
  ELSIF v_score >= v_risk_min THEN
    tier := 'restricted';
    action := 'restrict';
    recipient_cap := public.email_gov_cfg_int(ARRAY['reputation_tiers','restricted','recipient_cap']);
    job_batch_size := public.email_gov_cfg_int(ARRAY['reputation_tiers','restricted','job_batch_size']);
    send_pacing_multiplier := public.email_gov_cfg_num(ARRAY['reputation_tiers','restricted','send_pacing_multiplier']);
  ELSE
    tier := 'critical';
    action := 'pause';
    recipient_cap := public.email_gov_cfg_int(ARRAY['reputation_tiers','critical','recipient_cap']);
    job_batch_size := public.email_gov_cfg_int(ARRAY['reputation_tiers','critical','job_batch_size']);
    send_pacing_multiplier := public.email_gov_cfg_num(ARRAY['reputation_tiers','critical','send_pacing_multiplier']);
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
  v_effective_batch_size := COALESCE(v_policy.job_batch_size, public.email_gov_cfg_int(ARRAY['reputation_tiers','normal','job_batch_size']));
  v_effective_pacing := COALESCE(v_policy.send_pacing_multiplier, public.email_gov_cfg_num(ARRAY['reputation_tiers','normal','send_pacing_multiplier']));

  IF v_is_throttled THEN
    v_effective_batch_size := GREATEST(1, FLOOR(v_effective_batch_size * 0.5)::INTEGER);
    v_effective_pacing := GREATEST(v_effective_pacing, public.email_gov_cfg_num(ARRAY['reputation_tiers','throttled','send_pacing_multiplier']));
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

  v_hard_bounce_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','hard_bounce_rate']);
  v_complaint_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','complaint_rate']);
  v_spam_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['hard_stop_thresholds','spam_rate']);
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

CREATE OR REPLACE FUNCTION public.evaluate_campaign_warning_thresholds(
  p_campaign_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  sent_count INTEGER,
  hard_bounce_count INTEGER,
  soft_bounce_count INTEGER,
  complaint_count INTEGER,
  hard_bounce_rate NUMERIC,
  soft_bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  trend_triggered BOOLEAN,
  should_throttle BOOLEAN,
  trigger_reasons TEXT[],
  trigger_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_window_size INTERVAL := public.email_gov_cfg_interval(ARRAY['windows','warning_window']);
  v_window_start TIMESTAMPTZ := v_window_end - v_window_size;

  v_recent_window INTERVAL := public.email_gov_cfg_interval(ARRAY['windows','warning_trend_recent']);
  v_prior_window INTERVAL := public.email_gov_cfg_interval(ARRAY['windows','warning_trend_prior']);
  v_recent_start TIMESTAMPTZ;
  v_prior_start TIMESTAMPTZ;
  v_prior_end TIMESTAMPTZ;

  v_sent_count INTEGER := 0;
  v_hard_bounce_count INTEGER := 0;
  v_soft_bounce_count INTEGER := 0;
  v_complaint_count INTEGER := 0;

  v_hard_bounce_rate NUMERIC := 0;
  v_soft_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;

  v_recent_sent INTEGER := 0;
  v_recent_hard_bounce INTEGER := 0;
  v_recent_soft_bounce INTEGER := 0;
  v_recent_complaint INTEGER := 0;

  v_prior_sent INTEGER := 0;
  v_prior_hard_bounce INTEGER := 0;
  v_prior_soft_bounce INTEGER := 0;
  v_prior_complaint INTEGER := 0;

  v_recent_hard_bounce_rate NUMERIC := 0;
  v_recent_soft_bounce_rate NUMERIC := 0;
  v_recent_complaint_rate NUMERIC := 0;

  v_prior_hard_bounce_rate NUMERIC := 0;
  v_prior_soft_bounce_rate NUMERIC := 0;
  v_prior_complaint_rate NUMERIC := 0;

  v_hard_bounce_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['warning_thresholds','hard_bounce_rate']);
  v_soft_bounce_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['warning_thresholds','soft_bounce_rate']);
  v_complaint_threshold NUMERIC := public.email_gov_cfg_num(ARRAY['warning_thresholds','complaint_rate']);
  v_trend_multiplier NUMERIC := public.email_gov_cfg_num(ARRAY['warning_thresholds','trend_multiplier']);
  v_trend_prior_min_sent INTEGER := public.email_gov_cfg_int(ARRAY['warning_thresholds','trend_prior_min_sent']);

  v_trend_triggered BOOLEAN := false;
  v_should_throttle BOOLEAN := false;
  v_trigger_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

  v_recent_start := v_window_end - v_recent_window;
  v_prior_start := v_recent_start - v_prior_window;
  v_prior_end := v_recent_start;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_sent_count,
    v_hard_bounce_count,
    v_soft_bounce_count,
    v_complaint_count
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_window_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  v_sent_count := COALESCE(v_sent_count, 0);
  v_hard_bounce_count := COALESCE(v_hard_bounce_count, 0);
  v_soft_bounce_count := COALESCE(v_soft_bounce_count, 0);
  v_complaint_count := COALESCE(v_complaint_count, 0);

  v_hard_bounce_rate := v_hard_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_soft_bounce_rate := v_soft_bounce_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_complaint_rate := v_complaint_count::NUMERIC / GREATEST(v_sent_count, 1);

  IF v_hard_bounce_rate >= v_hard_bounce_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('hard_bounce_rate=%.4f', v_hard_bounce_rate));
  END IF;

  IF v_complaint_rate >= v_complaint_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('complaint_rate=%.4f', v_complaint_rate));
  END IF;

  IF v_soft_bounce_rate >= v_soft_bounce_threshold THEN
    v_trigger_reasons := array_append(v_trigger_reasons, format('soft_bounce_rate=%.4f', v_soft_bounce_rate));
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_recent_sent,
    v_recent_hard_bounce,
    v_recent_soft_bounce,
    v_recent_complaint
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_recent_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'soft'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO
    v_prior_sent,
    v_prior_hard_bounce,
    v_prior_soft_bounce,
    v_prior_complaint
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_prior_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_prior_end;

  v_recent_sent := COALESCE(v_recent_sent, 0);
  v_recent_hard_bounce := COALESCE(v_recent_hard_bounce, 0);
  v_recent_soft_bounce := COALESCE(v_recent_soft_bounce, 0);
  v_recent_complaint := COALESCE(v_recent_complaint, 0);

  v_prior_sent := COALESCE(v_prior_sent, 0);
  v_prior_hard_bounce := COALESCE(v_prior_hard_bounce, 0);
  v_prior_soft_bounce := COALESCE(v_prior_soft_bounce, 0);
  v_prior_complaint := COALESCE(v_prior_complaint, 0);

  v_recent_hard_bounce_rate := v_recent_hard_bounce::NUMERIC / GREATEST(v_recent_sent, 1);
  v_recent_soft_bounce_rate := v_recent_soft_bounce::NUMERIC / GREATEST(v_recent_sent, 1);
  v_recent_complaint_rate := v_recent_complaint::NUMERIC / GREATEST(v_recent_sent, 1);

  v_prior_hard_bounce_rate := v_prior_hard_bounce::NUMERIC / GREATEST(v_prior_sent, 1);
  v_prior_soft_bounce_rate := v_prior_soft_bounce::NUMERIC / GREATEST(v_prior_sent, 1);
  v_prior_complaint_rate := v_prior_complaint::NUMERIC / GREATEST(v_prior_sent, 1);

  IF v_prior_sent >= v_trend_prior_min_sent AND (
       (v_prior_hard_bounce_rate > 0 AND v_recent_hard_bounce_rate >= v_prior_hard_bounce_rate * v_trend_multiplier)
    OR (v_prior_soft_bounce_rate > 0 AND v_recent_soft_bounce_rate >= v_prior_soft_bounce_rate * v_trend_multiplier)
    OR (v_prior_complaint_rate > 0 AND v_recent_complaint_rate >= v_prior_complaint_rate * v_trend_multiplier)
  ) THEN
    v_trend_triggered := true;
    v_trigger_reasons := array_append(v_trigger_reasons, format('rapid_negative_trend=%sx', v_trend_multiplier));
  END IF;

  v_should_throttle := cardinality(v_trigger_reasons) > 0;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  window_start := v_window_start;
  window_end := v_window_end;
  sent_count := v_sent_count;
  hard_bounce_count := v_hard_bounce_count;
  soft_bounce_count := v_soft_bounce_count;
  complaint_count := v_complaint_count;
  hard_bounce_rate := v_hard_bounce_rate;
  soft_bounce_rate := v_soft_bounce_rate;
  complaint_rate := v_complaint_rate;
  trend_triggered := v_trend_triggered;
  should_throttle := v_should_throttle;
  trigger_reasons := v_trigger_reasons;
  trigger_details := jsonb_build_object(
    'hard_bounce_rate', v_hard_bounce_rate,
    'soft_bounce_rate', v_soft_bounce_rate,
    'complaint_rate', v_complaint_rate,
    'thresholds', jsonb_build_object(
      'hard_bounce_rate', v_hard_bounce_threshold,
      'soft_bounce_rate', v_soft_bounce_threshold,
      'complaint_rate', v_complaint_threshold,
      'trend_multiplier', v_trend_multiplier,
      'trend_prior_min_sent', v_trend_prior_min_sent
    ),
    'trend', jsonb_build_object(
      'recent_window', v_recent_window,
      'prior_window', v_prior_window,
      'recent_sent', v_recent_sent,
      'prior_sent', v_prior_sent,
      'recent_hard_bounce_rate', v_recent_hard_bounce_rate,
      'prior_hard_bounce_rate', v_prior_hard_bounce_rate,
      'recent_soft_bounce_rate', v_recent_soft_bounce_rate,
      'prior_soft_bounce_rate', v_prior_soft_bounce_rate,
      'recent_complaint_rate', v_recent_complaint_rate,
      'prior_complaint_rate', v_prior_complaint_rate,
      'triggered', v_trend_triggered
    )
  );

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_governance_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_governance_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_value(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_value(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_num(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_num(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_int(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_int(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_interval(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gov_cfg_interval(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_email_governance_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_email_governance_config(JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';