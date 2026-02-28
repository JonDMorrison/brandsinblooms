-- Forward-only repair migration: ensure governance-config RPCs exist.
--
-- Why: the remote DB can be missing RPCs even when earlier migration versions are
-- marked as applied (e.g., an old migration was edited after apply, or applied in a
-- different environment). This migration safely reintroduces the expected objects.

-- 1) System config table + baseline row (idempotent)
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master admins can read system_config" ON public.system_config;
CREATE POLICY "Master admins can read system_config"
  ON public.system_config
  FOR SELECT
  TO authenticated
  USING (public.is_master_admin(auth.uid()));

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

-- 2) Admin-facing governance config RPCs (used by /admin/governance-config)
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

-- Keep global config getter locked down (matches hardening intent).
REVOKE EXECUTE ON FUNCTION public.get_email_governance_config() FROM authenticated;

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

CREATE OR REPLACE FUNCTION public.admin_apply_email_governance_profile(
  p_profile TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_profile TEXT := lower(COALESCE(NULLIF(btrim(p_profile), ''), ''));
  v_cfg JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF v_profile NOT IN ('strict', 'relaxed') THEN
    RAISE EXCEPTION 'Unsupported profile. Expected strict|relaxed.';
  END IF;

  IF v_profile = 'relaxed' THEN
    v_cfg := public.email_governance_default_config();
  ELSE
    v_cfg := public.get_email_governance_config();

    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,hard_bounce_rate}', to_jsonb(0.04::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,complaint_rate}', to_jsonb(0.0015::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,spam_rate}', to_jsonb(0.0025::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,failed_delivery_rate}', to_jsonb(0.06::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{hard_stop_thresholds,rejected_rate}', to_jsonb(0.08::numeric), true);

    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,hard_bounce_rate}', to_jsonb(0.02::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,soft_bounce_rate}', to_jsonb(0.04::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,complaint_rate}', to_jsonb(0.0007::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,trend_multiplier}', to_jsonb(2::numeric), true);
    v_cfg := jsonb_set(v_cfg, '{warning_thresholds,trend_prior_min_sent}', to_jsonb(100::integer), true);
  END IF;

  RETURN public.admin_set_email_governance_config(
    v_cfg,
    COALESCE(NULLIF(btrim(p_reason), ''), format('apply_%s_profile', v_profile))
  );
END;
$$;

-- 3) Grants and schema reload
GRANT EXECUTE ON FUNCTION public.admin_get_email_governance_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_email_governance_config(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_email_governance_profile(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
