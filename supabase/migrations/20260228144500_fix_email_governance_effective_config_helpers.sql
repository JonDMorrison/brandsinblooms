-- Repair migration: restore governance config getters and effective-config helpers.
-- These are required by public.get_tenant_reputation_policy and the tenant email management panel.

-- 1) Global config storage (safe if already present)
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

-- 2) Tenant overrides (safe if already present)
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

-- 3) Effective-config helpers
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
  v_actor UUID := auth.uid();
  v_request_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'Config path is required';
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
      RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;
  END IF;

  v_overrides := public.get_tenant_email_governance_overrides(p_tenant_id);

  IF (v_overrides #> p_path) IS NOT NULL THEN
    RETURN 'tenant';
  END IF;

  RETURN 'global';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_email_governance_overrides(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_value(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_num(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_int(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_gov_eff_source(UUID, TEXT[]) TO service_role;

-- Historically these helpers are intentionally NOT callable by normal authenticated users.
REVOKE EXECUTE ON FUNCTION public.get_tenant_email_governance_overrides(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_value(UUID, TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_num(UUID, TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_int(UUID, TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_gov_eff_source(UUID, TEXT[]) FROM authenticated;

NOTIFY pgrst, 'reload schema';
