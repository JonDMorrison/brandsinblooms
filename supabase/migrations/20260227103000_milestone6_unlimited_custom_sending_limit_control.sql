ALTER TABLE public.email_governance_tenant_control_state
  ADD COLUMN IF NOT EXISTS send_limit_monthly INTEGER,
  ADD COLUMN IF NOT EXISTS send_limit_daily INTEGER,
  ADD COLUMN IF NOT EXISTS send_limit_hourly INTEGER,
  ADD COLUMN IF NOT EXISTS unlimited_sending_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_restriction_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_restriction_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emergency_restriction_reason TEXT,
  ADD COLUMN IF NOT EXISTS boost_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_monthly INTEGER,
  ADD COLUMN IF NOT EXISTS boost_daily INTEGER,
  ADD COLUMN IF NOT EXISTS boost_hourly INTEGER,
  ADD COLUMN IF NOT EXISTS boost_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_send_limit_monthly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_send_limit_monthly_nonneg
      CHECK (send_limit_monthly IS NULL OR send_limit_monthly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_send_limit_daily_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_send_limit_daily_nonneg
      CHECK (send_limit_daily IS NULL OR send_limit_daily >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_send_limit_hourly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_send_limit_hourly_nonneg
      CHECK (send_limit_hourly IS NULL OR send_limit_hourly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_monthly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_monthly_nonneg
      CHECK (boost_monthly IS NULL OR boost_monthly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_daily_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_daily_nonneg
      CHECK (boost_daily IS NULL OR boost_daily >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_hourly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_hourly_nonneg
      CHECK (boost_hourly IS NULL OR boost_hourly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_requires_until'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_requires_until
      CHECK (
        (
          boost_monthly IS NULL
          AND boost_daily IS NULL
          AND boost_hourly IS NULL
          AND boost_until IS NULL
        )
        OR boost_until IS NOT NULL
      );
  END IF;
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

  SELECT t.email_under_review
  INTO v_under_review
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

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
  v_unlimited BOOLEAN := false;
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

  SELECT COALESCE(s.unlimited_sending_enabled, false)
  INTO v_unlimited
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = v_tenant_id;

  v_is_throttled := COALESCE(v_is_throttled, false);
  v_unlimited := COALESCE(v_unlimited, false);

  v_effective_batch_size := COALESCE(v_policy.job_batch_size, public.email_gov_eff_int(v_tenant_id, ARRAY['reputation_tiers','normal','job_batch_size']));
  v_effective_pacing := COALESCE(v_policy.send_pacing_multiplier, public.email_gov_eff_num(v_tenant_id, ARRAY['reputation_tiers','normal','send_pacing_multiplier']));

  IF v_is_throttled AND NOT v_unlimited THEN
    v_effective_batch_size := GREATEST(1, FLOOR(v_effective_batch_size * 0.5)::INTEGER);
    v_effective_pacing := GREATEST(v_effective_pacing, public.email_gov_eff_num(v_tenant_id, ARRAY['reputation_tiers','throttled','send_pacing_multiplier']));
  END IF;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  score := v_policy.score;

  IF v_unlimited THEN
    tier := 'normal';
    action := 'allow';
    recipient_cap := NULL;
    send_pacing_multiplier := 1;
  ELSIF v_is_throttled AND v_policy.action = 'allow' THEN
    tier := 'throttled';
    action := 'throttle';
    recipient_cap := v_policy.recipient_cap;
    send_pacing_multiplier := v_effective_pacing;
  ELSE
    tier := v_policy.tier;
    action := v_policy.action;
    recipient_cap := v_policy.recipient_cap;
    send_pacing_multiplier := v_effective_pacing;
  END IF;

  job_batch_size := v_effective_batch_size;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_send_quota(
  p_tenant_id uuid,
  p_domain_id uuid DEFAULT NULL,
  p_recipient_count integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain record;
  v_tenant record;
  v_from_email text;
  v_from_name text;
  v_is_high_volume boolean := COALESCE(p_recipient_count, 0) > 50000;
  v_spf_ok boolean := false;
  v_dkim_ok boolean := false;
  v_return_path_ok boolean := false;
  v_dmarc_ok boolean := false;
  v_domain_verification_ok boolean := false;
  v_ownership_ok boolean := false;
  v_failures text[] := ARRAY[]::text[];
  v_warnings text[] := ARRAY[]::text[];

  v_control record;
  v_subscription record;
  v_boost_active boolean := false;
  v_emergency_active boolean := false;
  v_limit_monthly integer;
  v_limit_daily integer;
  v_limit_hourly integer;
  v_monthly_used integer := 0;
  v_daily_used integer := 0;
  v_hourly_used integer := 0;
  v_window_month_start timestamptz := date_trunc('month', now());
  v_window_day_start timestamptz := date_trunc('day', now());
  v_window_hour_start timestamptz := date_trunc('hour', now());
  v_event_ts timestamptz;
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'tenant_not_found',
      'message', 'Tenant not found'
    );
  END IF;

  v_from_name := COALESCE(v_tenant.fallback_from_name, 'BloomSuite');

  IF p_domain_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'sender_domain_required',
      'message', 'Campaign sending requires an explicit sending domain.'
    );
  END IF;

  SELECT * INTO v_domain
  FROM email_domains
  WHERE id = p_domain_id AND tenant_id = p_tenant_id;

  IF v_domain IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_found',
      'message', 'Sending domain not found'
    );
  END IF;

  IF COALESCE(v_domain.investigation_mode, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_under_investigation',
      'message', 'Sending domain is under investigation. Sending is halted until recovery is completed.',
      'domain', jsonb_build_object(
        'id', v_domain.id,
        'domain', v_domain.domain,
        'status', v_domain.status,
        'investigation_mode', true,
        'investigation_mode_at', v_domain.investigation_mode_at,
        'investigation_mode_reason', v_domain.investigation_mode_reason
      )
    );
  END IF;

  IF v_domain.status NOT IN ('active', 'warming_up') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_operational',
      'message', 'Sending domain is not operational'
    );
  END IF;

  v_from_email := COALESCE(v_domain.default_from_email, 'mail@' || v_domain.domain);
  v_from_name := COALESCE(v_domain.default_from_name, v_from_name);

  WITH latest_checks AS (
    SELECT DISTINCT ON (check_name) check_name, ok
    FROM email_dns_checks
    WHERE email_domain_id = v_domain.id
      AND check_name IN ('spf', 'dkim', 'return_path', 'dmarc', 'domain_verification')
    ORDER BY check_name, checked_at DESC
  )
  SELECT
    COALESCE(MAX(CASE WHEN check_name = 'spf' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'dkim' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'return_path' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'dmarc' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'domain_verification' THEN ok::int END), 0) = 1
  INTO
    v_spf_ok,
    v_dkim_ok,
    v_return_path_ok,
    v_dmarc_ok,
    v_domain_verification_ok
  FROM latest_checks;

  v_ownership_ok := COALESCE(v_domain_verification_ok, false) OR v_domain.verified_at IS NOT NULL;

  IF NOT v_spf_ok THEN
    v_failures := array_append(v_failures, 'SPF is not verified');
  END IF;

  IF NOT v_dkim_ok THEN
    v_failures := array_append(v_failures, 'DKIM is not verified');
  END IF;

  IF NOT v_return_path_ok THEN
    v_failures := array_append(v_failures, 'Return-path DNS is not verified');
  END IF;

  IF NOT v_dmarc_ok THEN
    v_failures := array_append(v_failures, 'DMARC is missing or does not meet p=none minimum');
  END IF;

  IF NOT v_ownership_ok THEN
    v_failures := array_append(v_failures, 'Domain ownership is not verified');
  END IF;

  IF array_length(v_failures, 1) IS NOT NULL THEN
    IF v_is_high_volume THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'domain_not_compliant_for_scale',
        'message', 'High-volume sending requires SPF, DKIM, DMARC (p=none minimum), and domain ownership verification.',
        'domain', jsonb_build_object(
          'id', v_domain.id,
          'domain', v_domain.domain,
          'status', v_domain.status
        ),
        'sender', jsonb_build_object(
          'from_name', v_from_name,
          'from_email', v_from_email
        ),
        'requested', p_recipient_count,
        'high_volume_threshold', 50000,
        'compliance', jsonb_build_object(
          'high_volume', true,
          'authenticated_for_scale', false,
          'spf_ok', v_spf_ok,
          'dkim_ok', v_dkim_ok,
          'return_path_ok', v_return_path_ok,
          'dmarc_ok', v_dmarc_ok,
          'ownership_verified', v_ownership_ok,
          'failures', to_jsonb(v_failures),
          'warnings', to_jsonb(v_warnings)
        )
      );
    END IF;

    v_warnings := array_append(v_warnings, 'Domain authentication is incomplete. Low-volume sending is allowed, but high-volume sending is blocked until SPF, DKIM, DMARC, and ownership are verified.');
    v_warnings := v_warnings || v_failures;
  END IF;

  SELECT
    COALESCE(s.unlimited_sending_enabled, false) AS unlimited_sending_enabled,
    COALESCE(s.emergency_restriction_enabled, false) AS emergency_restriction_enabled,
    s.emergency_restriction_until,
    s.send_limit_monthly,
    s.send_limit_daily,
    s.send_limit_hourly,
    s.boost_until,
    s.boost_monthly,
    s.boost_daily,
    s.boost_hourly
  INTO v_control
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  v_boost_active := (
    v_control.boost_until IS NOT NULL
    AND now() < v_control.boost_until
  );

  v_emergency_active := (
    COALESCE(v_control.emergency_restriction_enabled, false)
    AND (
      v_control.emergency_restriction_until IS NULL
      OR now() < v_control.emergency_restriction_until
    )
  );

  IF v_emergency_active THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'emergency_restriction',
      'message', 'Emergency restriction mode is active for this tenant.'
    );
  END IF;

  IF NOT COALESCE(v_control.unlimited_sending_enabled, false) THEN
    SELECT s.*
    INTO v_subscription
    FROM public.subscriptions s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.tenant_id = p_tenant_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_boost_active AND v_control.boost_monthly IS NOT NULL THEN
      v_limit_monthly := v_control.boost_monthly;
    ELSIF v_control.send_limit_monthly IS NOT NULL THEN
      v_limit_monthly := v_control.send_limit_monthly;
    ELSIF v_subscription.email_quota IS NOT NULL AND v_subscription.email_quota >= 0 THEN
      v_limit_monthly := v_subscription.email_quota;
    ELSE
      v_limit_monthly := NULL;
    END IF;

    IF v_boost_active AND v_control.boost_daily IS NOT NULL THEN
      v_limit_daily := v_control.boost_daily;
    ELSE
      v_limit_daily := v_control.send_limit_daily;
    END IF;

    IF v_boost_active AND v_control.boost_hourly IS NOT NULL THEN
      v_limit_hourly := v_control.boost_hourly;
    ELSE
      v_limit_hourly := v_control.send_limit_hourly;
    END IF;

    SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_monthly_used
    FROM public.email_messages m
    WHERE m.tenant_id = p_tenant_id
      AND m.status = 'sent'
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= v_window_month_start
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < now();

    SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_daily_used
    FROM public.email_messages m
    WHERE m.tenant_id = p_tenant_id
      AND m.status = 'sent'
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= v_window_day_start
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < now();

    SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_hourly_used
    FROM public.email_messages m
    WHERE m.tenant_id = p_tenant_id
      AND m.status = 'sent'
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= v_window_hour_start
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < now();

    IF v_limit_monthly IS NOT NULL AND (v_monthly_used + p_recipient_count) > v_limit_monthly THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'monthly_limit_exceeded',
        'message', format('Monthly sending limit (%s) would be exceeded. Used: %s, Requested: %s', v_limit_monthly, v_monthly_used, p_recipient_count),
        'current_usage', v_monthly_used,
        'limit', v_limit_monthly,
        'window', 'month'
      );
    END IF;

    IF v_limit_daily IS NOT NULL AND (v_daily_used + p_recipient_count) > v_limit_daily THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'daily_limit_exceeded',
        'message', format('Daily sending limit (%s) would be exceeded. Used: %s, Requested: %s', v_limit_daily, v_daily_used, p_recipient_count),
        'current_usage', v_daily_used,
        'limit', v_limit_daily,
        'window', 'day'
      );
    END IF;

    IF v_limit_hourly IS NOT NULL AND (v_hourly_used + p_recipient_count) > v_limit_hourly THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'hourly_limit_exceeded',
        'message', format('Hourly sending limit (%s) would be exceeded. Used: %s, Requested: %s', v_limit_hourly, v_hourly_used, p_recipient_count),
        'current_usage', v_hourly_used,
        'limit', v_limit_hourly,
        'window', 'hour'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'domain', jsonb_build_object(
      'id', v_domain.id,
      'domain', v_domain.domain,
      'status', v_domain.status,
      'investigation_mode', COALESCE(v_domain.investigation_mode, false)
    ),
    'sender', jsonb_build_object(
      'from_name', v_from_name,
      'from_email', v_from_email
    ),
    'requested', p_recipient_count,
    'high_volume_threshold', 50000,
    'warnings', to_jsonb(v_warnings),
    'limits', jsonb_build_object(
      'unlimited_mode', COALESCE(v_control.unlimited_sending_enabled, false),
      'boost_active', v_boost_active,
      'monthly_limit', v_limit_monthly,
      'daily_limit', v_limit_daily,
      'hourly_limit', v_limit_hourly,
      'monthly_used', v_monthly_used,
      'daily_used', v_daily_used,
      'hourly_used', v_hourly_used
    ),
    'compliance', jsonb_build_object(
      'high_volume', v_is_high_volume,
      'authenticated_for_scale', array_length(v_failures, 1) IS NULL,
      'spf_ok', v_spf_ok,
      'dkim_ok', v_dkim_ok,
      'return_path_ok', v_return_path_ok,
      'dmarc_ok', v_dmarc_ok,
      'ownership_verified', v_ownership_ok,
      'failures', to_jsonb(v_failures),
      'warnings', to_jsonb(v_warnings)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_sending_limits(
  p_tenant_id UUID,
  p_monthly INTEGER DEFAULT NULL,
  p_daily INTEGER DEFAULT NULL,
  p_hourly INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_sending_limits_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_monthly IS NOT NULL AND p_monthly < 0 THEN
    RAISE EXCEPTION 'p_monthly must be >= 0 or null';
  END IF;

  IF p_daily IS NOT NULL AND p_daily < 0 THEN
    RAISE EXCEPTION 'p_daily must be >= 0 or null';
  END IF;

  IF p_hourly IS NOT NULL AND p_hourly < 0 THEN
    RAISE EXCEPTION 'p_hourly must be >= 0 or null';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    send_limit_monthly,
    send_limit_daily,
    send_limit_hourly,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    p_monthly,
    p_daily,
    p_hourly,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    send_limit_monthly = EXCLUDED.send_limit_monthly,
    send_limit_daily = EXCLUDED.send_limit_daily,
    send_limit_hourly = EXCLUDED.send_limit_hourly,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_sending_limits_updated',
    jsonb_build_object(
      'monthly_limit', p_monthly,
      'daily_limit', p_daily,
      'hourly_limit', p_hourly,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'monthly_limit', p_monthly,
    'daily_limit', p_daily,
    'hourly_limit', p_hourly
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_unlimited_sending(
  p_tenant_id UUID,
  p_enabled BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_enabled BOOLEAN := COALESCE(p_enabled, false);
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_unlimited_sending_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    unlimited_sending_enabled,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    v_enabled,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    unlimited_sending_enabled = EXCLUDED.unlimited_sending_enabled,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    CASE WHEN v_enabled THEN 'tenant_unlimited_sending_enabled' ELSE 'tenant_unlimited_sending_disabled' END,
    jsonb_build_object(
      'enabled', v_enabled,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'unlimited_sending_enabled', v_enabled
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_emergency_restriction(
  p_tenant_id UUID,
  p_enabled BOOLEAN,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_enabled BOOLEAN := COALESCE(p_enabled, false);
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_emergency_restriction_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF v_enabled AND p_until IS NOT NULL AND p_until <= now() THEN
    RAISE EXCEPTION 'p_until must be in the future when provided';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    emergency_restriction_enabled,
    emergency_restriction_until,
    emergency_restriction_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    v_enabled,
    CASE WHEN v_enabled THEN p_until ELSE NULL END,
    CASE WHEN v_enabled THEN v_reason ELSE NULL END,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    emergency_restriction_enabled = EXCLUDED.emergency_restriction_enabled,
    emergency_restriction_until = EXCLUDED.emergency_restriction_until,
    emergency_restriction_reason = EXCLUDED.emergency_restriction_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    CASE WHEN v_enabled THEN 'tenant_emergency_restriction_enabled' ELSE 'tenant_emergency_restriction_disabled' END,
    jsonb_build_object(
      'enabled', v_enabled,
      'until', CASE WHEN v_enabled THEN p_until ELSE NULL END,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'emergency_restriction_enabled', v_enabled,
    'emergency_restriction_until', CASE WHEN v_enabled THEN p_until ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_temporary_boost(
  p_tenant_id UUID,
  p_monthly INTEGER DEFAULT NULL,
  p_daily INTEGER DEFAULT NULL,
  p_hourly INTEGER DEFAULT NULL,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_temporary_boost_set');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_until IS NULL OR p_until <= now() THEN
    RAISE EXCEPTION 'p_until must be in the future';
  END IF;

  IF p_monthly IS NULL AND p_daily IS NULL AND p_hourly IS NULL THEN
    RAISE EXCEPTION 'At least one boost limit is required';
  END IF;

  IF p_monthly IS NOT NULL AND p_monthly < 0 THEN
    RAISE EXCEPTION 'p_monthly must be >= 0 or null';
  END IF;

  IF p_daily IS NOT NULL AND p_daily < 0 THEN
    RAISE EXCEPTION 'p_daily must be >= 0 or null';
  END IF;

  IF p_hourly IS NOT NULL AND p_hourly < 0 THEN
    RAISE EXCEPTION 'p_hourly must be >= 0 or null';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    boost_until,
    boost_monthly,
    boost_daily,
    boost_hourly,
    boost_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    p_until,
    p_monthly,
    p_daily,
    p_hourly,
    v_reason,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    boost_until = EXCLUDED.boost_until,
    boost_monthly = EXCLUDED.boost_monthly,
    boost_daily = EXCLUDED.boost_daily,
    boost_hourly = EXCLUDED.boost_hourly,
    boost_reason = EXCLUDED.boost_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_temporary_boost_set',
    jsonb_build_object(
      'monthly_limit', p_monthly,
      'daily_limit', p_daily,
      'hourly_limit', p_hourly,
      'until', p_until,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'boost_until', p_until,
    'boost_monthly', p_monthly,
    'boost_daily', p_daily,
    'boost_hourly', p_hourly
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_tenant_temporary_boost(
  p_tenant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'tenant_temporary_boost_cleared');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    boost_until,
    boost_monthly,
    boost_daily,
    boost_hourly,
    boost_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    v_actor,
    v_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    boost_until = NULL,
    boost_monthly = NULL,
    boost_daily = NULL,
    boost_hourly = NULL,
    boost_reason = NULL,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_temporary_boost_cleared',
    jsonb_build_object('reason', v_reason)
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'boost_cleared', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_tenant_email_management_panel(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_24_start TIMESTAMPTZ := COALESCE(p_as_of, now()) - INTERVAL '24 hours';
  v_30_start TIMESTAMPTZ := COALESCE(p_as_of, now()) - INTERVAL '30 days';
  v_company_name TEXT;

  v_sent_24h INTEGER := 0;
  v_delivered_24h INTEGER := 0;
  v_hard_bounce_24h INTEGER := 0;
  v_soft_bounce_24h INTEGER := 0;
  v_complaint_24h INTEGER := 0;
  v_unsub_24h INTEGER := 0;
  v_failed_24h INTEGER := 0;

  v_sent_30d INTEGER := 0;
  v_delivered_30d INTEGER := 0;
  v_hard_bounce_30d INTEGER := 0;
  v_soft_bounce_30d INTEGER := 0;
  v_complaint_30d INTEGER := 0;
  v_unsub_30d INTEGER := 0;
  v_failed_30d INTEGER := 0;

  v_policy RECORD;
  v_score INTEGER := 100;
  v_tier TEXT := 'normal';
  v_action TEXT := 'allow';
  v_reputation_state JSONB := '{}'::jsonb;
  v_thresholds JSONB := '{}'::jsonb;
  v_send_limits JSONB := '{}'::jsonb;
  v_tenant_state JSONB := '{}'::jsonb;
  v_overrides JSONB := '{}'::jsonb;

  v_control RECORD;
  v_subscription RECORD;
  v_boost_active BOOLEAN := false;
  v_emergency_active BOOLEAN := false;
  v_effective_monthly_limit INTEGER;
  v_effective_daily_limit INTEGER;
  v_effective_hourly_limit INTEGER;
  v_monthly_used INTEGER := 0;
  v_daily_used INTEGER := 0;
  v_hourly_used INTEGER := 0;
  v_sending_limit_state JSONB := '{}'::jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  PERFORM public.refresh_email_governance_tenant_reputation_score(p_tenant_id, v_window_end);

  SELECT t.company_name
  INTO v_company_name
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

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
    v_sent_24h,
    v_delivered_24h,
    v_hard_bounce_24h,
    v_soft_bounce_24h,
    v_complaint_24h,
    v_unsub_24h
  FROM public.email_governance_email_events e
  LEFT JOIN public.email_governance_tenant_control_state s
    ON s.tenant_id = e.tenant_id
  WHERE e.tenant_id = p_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_24_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end
    AND NOT (
      e.event_type = 'bounced'
      AND s.forgive_bounce_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_bounce_before
    )
    AND NOT (
      e.event_type = 'complained'
      AND s.forgive_complaint_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_complaint_before
    );

  SELECT COUNT(*)::INTEGER
  INTO v_failed_24h
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'failed'
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) >= v_24_start
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

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
    v_sent_30d,
    v_delivered_30d,
    v_hard_bounce_30d,
    v_soft_bounce_30d,
    v_complaint_30d,
    v_unsub_30d
  FROM public.email_governance_email_events e
  LEFT JOIN public.email_governance_tenant_control_state s
    ON s.tenant_id = e.tenant_id
  WHERE e.tenant_id = p_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_30_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end
    AND NOT (
      e.event_type = 'bounced'
      AND s.forgive_bounce_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_bounce_before
    )
    AND NOT (
      e.event_type = 'complained'
      AND s.forgive_complaint_before IS NOT NULL
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= s.forgive_complaint_before
    );

  SELECT COUNT(*)::INTEGER
  INTO v_failed_30d
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'failed'
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) >= v_30_start
    AND COALESCE(m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  SELECT * INTO v_policy
  FROM public.get_tenant_reputation_policy(p_tenant_id);

  SELECT r.score
  INTO v_score
  FROM public.email_governance_tenant_reputation_scores r
  WHERE r.tenant_id = p_tenant_id
  LIMIT 1;

  v_score := COALESCE(v_score, COALESCE(v_policy.score, 100));
  v_tier := COALESCE(v_policy.tier, 'normal');
  v_action := COALESCE(v_policy.action, 'allow');

  SELECT public.get_tenant_email_governance_overrides(p_tenant_id)
  INTO v_overrides;

  SELECT jsonb_build_object(
    'email_under_review', COALESCE(t.email_under_review, false),
    'email_under_review_at', t.email_under_review_at,
    'email_under_review_reason', t.email_under_review_reason,
    'email_under_review_details', t.email_under_review_details
  )
  INTO v_tenant_state
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  SELECT jsonb_build_object(
    'manual_reputation_score', s.manual_reputation_score,
    'is_reputation_frozen', COALESCE(s.is_reputation_frozen, false),
    'reputation_override_mode', COALESCE(s.reputation_override_mode, CASE WHEN s.manual_reputation_score IS NOT NULL THEN 'final' ELSE NULL END),
    'reputation_override_expires_at', s.reputation_override_expires_at,
    'reputation_override_reason', s.reputation_override_reason,
    'reputation_override_active', (
      s.manual_reputation_score IS NOT NULL
      AND (
        COALESCE(s.reputation_override_mode, 'final') = 'final'
        OR (
          s.reputation_override_mode = 'temporary'
          AND s.reputation_override_expires_at IS NOT NULL
          AND v_window_end < s.reputation_override_expires_at
        )
      )
    ),
    'penalties_disabled_until', s.penalties_disabled_until,
    'penalties_disabled_reason', s.penalties_disabled_reason,
    'penalties_disabled_active', (
      NOT COALESCE(s.is_reputation_frozen, false)
      AND (
        s.penalties_disabled_until IS NULL
        OR v_window_end < s.penalties_disabled_until
      )
    ),
    'forgive_bounce_before', s.forgive_bounce_before,
    'forgive_complaint_before', s.forgive_complaint_before,
    'updated_at', s.updated_at,
    'updated_reason', s.updated_reason
  )
  INTO v_reputation_state
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  v_reputation_state := COALESCE(v_reputation_state, jsonb_build_object(
    'manual_reputation_score', NULL,
    'is_reputation_frozen', false,
    'reputation_override_mode', NULL,
    'reputation_override_expires_at', NULL,
    'reputation_override_reason', NULL,
    'reputation_override_active', false,
    'penalties_disabled_until', NULL,
    'penalties_disabled_reason', NULL,
    'penalties_disabled_active', false,
    'forgive_bounce_before', NULL,
    'forgive_complaint_before', NULL,
    'updated_at', NULL,
    'updated_reason', NULL
  ));

  v_thresholds := jsonb_build_object(
    'hard_bounce_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','hard_bounce_rate'])
    ),
    'soft_bounce_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['warning_thresholds','soft_bounce_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['warning_thresholds','soft_bounce_rate'])
    ),
    'complaint_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','complaint_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','complaint_rate'])
    ),
    'spam_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','spam_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','spam_rate'])
    ),
    'delivery_failure_rate', jsonb_build_object(
      'value', public.email_gov_eff_num(p_tenant_id, ARRAY['hard_stop_thresholds','failed_delivery_rate']),
      'source', public.email_gov_eff_source(p_tenant_id, ARRAY['hard_stop_thresholds','failed_delivery_rate'])
    )
  );

  SELECT
    COALESCE(s.unlimited_sending_enabled, false) AS unlimited_sending_enabled,
    COALESCE(s.emergency_restriction_enabled, false) AS emergency_restriction_enabled,
    s.emergency_restriction_until,
    s.emergency_restriction_reason,
    s.send_limit_monthly,
    s.send_limit_daily,
    s.send_limit_hourly,
    s.boost_until,
    s.boost_monthly,
    s.boost_daily,
    s.boost_hourly,
    s.boost_reason
  INTO v_control
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = p_tenant_id;

  SELECT s.*
  INTO v_subscription
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  v_boost_active := (
    v_control.boost_until IS NOT NULL
    AND v_window_end < v_control.boost_until
  );

  v_emergency_active := (
    COALESCE(v_control.emergency_restriction_enabled, false)
    AND (
      v_control.emergency_restriction_until IS NULL
      OR v_window_end < v_control.emergency_restriction_until
    )
  );

  IF v_boost_active AND v_control.boost_monthly IS NOT NULL THEN
    v_effective_monthly_limit := v_control.boost_monthly;
  ELSIF v_control.send_limit_monthly IS NOT NULL THEN
    v_effective_monthly_limit := v_control.send_limit_monthly;
  ELSIF v_subscription.email_quota IS NOT NULL AND v_subscription.email_quota >= 0 THEN
    v_effective_monthly_limit := v_subscription.email_quota;
  ELSE
    v_effective_monthly_limit := NULL;
  END IF;

  IF v_boost_active AND v_control.boost_daily IS NOT NULL THEN
    v_effective_daily_limit := v_control.boost_daily;
  ELSE
    v_effective_daily_limit := v_control.send_limit_daily;
  END IF;

  IF v_boost_active AND v_control.boost_hourly IS NOT NULL THEN
    v_effective_hourly_limit := v_control.boost_hourly;
  ELSE
    v_effective_hourly_limit := v_control.send_limit_hourly;
  END IF;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_monthly_used
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'sent'
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= date_trunc('month', v_window_end)
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_daily_used
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'sent'
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= date_trunc('day', v_window_end)
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_hourly_used
  FROM public.email_messages m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'sent'
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= date_trunc('hour', v_window_end)
    AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < v_window_end;

  v_sending_limit_state := jsonb_build_object(
    'unlimited_sending_enabled', COALESCE(v_control.unlimited_sending_enabled, false),
    'emergency_restriction_enabled', COALESCE(v_control.emergency_restriction_enabled, false),
    'emergency_restriction_until', v_control.emergency_restriction_until,
    'emergency_restriction_reason', v_control.emergency_restriction_reason,
    'emergency_restriction_active', v_emergency_active,
    'base_monthly_limit', v_control.send_limit_monthly,
    'base_daily_limit', v_control.send_limit_daily,
    'base_hourly_limit', v_control.send_limit_hourly,
    'boost_until', v_control.boost_until,
    'boost_monthly', v_control.boost_monthly,
    'boost_daily', v_control.boost_daily,
    'boost_hourly', v_control.boost_hourly,
    'boost_reason', v_control.boost_reason,
    'boost_active', v_boost_active,
    'effective_monthly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_monthly_limit
    END,
    'effective_daily_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_daily_limit
    END,
    'effective_hourly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_hourly_limit
    END,
    'monthly_used', v_monthly_used,
    'daily_used', v_daily_used,
    'hourly_used', v_hourly_used
  );

  v_send_limits := jsonb_build_object(
    'recipient_cap', v_policy.recipient_cap,
    'job_batch_size', v_policy.job_batch_size,
    'send_pacing_multiplier', v_policy.send_pacing_multiplier,
    'reputation_tier', v_tier,
    'reputation_action', v_action,
    'is_unlimited', COALESCE(v_control.unlimited_sending_enabled, false),
    'monthly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_monthly_limit
    END,
    'daily_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_daily_limit
    END,
    'hourly_limit', CASE
      WHEN COALESCE(v_control.unlimited_sending_enabled, false) THEN NULL
      ELSE v_effective_hourly_limit
    END
  );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'company_name', v_company_name,
    'as_of', v_window_end,
    'reputation_score', v_score,
    'current_reputation_tier', v_tier,
    'reputation_action', v_action,
    'tenant_state', COALESCE(v_tenant_state, '{}'::jsonb),
    'reputation_state', v_reputation_state,
    'sending_limit_state', v_sending_limit_state,
    'metrics_24h', jsonb_build_object(
      'sent', COALESCE(v_sent_24h, 0),
      'delivered', COALESCE(v_delivered_24h, 0),
      'hard_bounce_count', COALESCE(v_hard_bounce_24h, 0),
      'soft_bounce_count', COALESCE(v_soft_bounce_24h, 0),
      'complaint_count', COALESCE(v_complaint_24h, 0),
      'unsubscribe_count', COALESCE(v_unsub_24h, 0),
      'failed_count', COALESCE(v_failed_24h, 0),
      'hard_bounce_rate', COALESCE(v_hard_bounce_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'soft_bounce_rate', COALESCE(v_soft_bounce_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'complaint_rate', COALESCE(v_complaint_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'unsubscribe_rate', COALESCE(v_unsub_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1),
      'delivery_failure_rate', COALESCE(v_failed_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0) + COALESCE(v_failed_24h, 0), 1)
    ),
    'metrics_30d', jsonb_build_object(
      'sent', COALESCE(v_sent_30d, 0),
      'delivered', COALESCE(v_delivered_30d, 0),
      'hard_bounce_count', COALESCE(v_hard_bounce_30d, 0),
      'soft_bounce_count', COALESCE(v_soft_bounce_30d, 0),
      'complaint_count', COALESCE(v_complaint_30d, 0),
      'unsubscribe_count', COALESCE(v_unsub_30d, 0),
      'failed_count', COALESCE(v_failed_30d, 0),
      'hard_bounce_rate', COALESCE(v_hard_bounce_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'soft_bounce_rate', COALESCE(v_soft_bounce_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'complaint_rate', COALESCE(v_complaint_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'unsubscribe_rate', COALESCE(v_unsub_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1),
      'delivery_failure_rate', COALESCE(v_failed_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0) + COALESCE(v_failed_30d, 0), 1)
    ),
    'current_thresholds_effective', v_thresholds,
    'current_send_limits', v_send_limits,
    'tenant_overrides', COALESCE(v_overrides, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_tier_limits RECORD;
  v_email_limit INTEGER;
  v_sms_limit INTEGER;
  v_email_percent NUMERIC;
  v_sms_percent NUMERIC;
  v_tenant_id UUID;
  v_control RECORD;
  v_boost_active BOOLEAN := false;
  v_effective_monthly_limit INTEGER;
  v_email_used INTEGER := 0;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.users
  WHERE id = p_user_id;

  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No subscription found');
  END IF;

  IF v_subscription.tier IS NOT NULL THEN
    SELECT * INTO v_tier_limits FROM tier_limits WHERE tier = v_subscription.tier;
    v_email_limit := v_tier_limits.email_limit;
    v_sms_limit := v_tier_limits.sms_limit;
  ELSE
    v_email_limit := COALESCE(v_subscription.email_quota, 10000);
    v_sms_limit := COALESCE(v_subscription.sms_quota, 1000);
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    SELECT
      COALESCE(s.unlimited_sending_enabled, false) AS unlimited_sending_enabled,
      s.send_limit_monthly,
      s.boost_until,
      s.boost_monthly
    INTO v_control
    FROM public.email_governance_tenant_control_state s
    WHERE s.tenant_id = v_tenant_id;

    v_boost_active := (
      v_control.boost_until IS NOT NULL
      AND now() < v_control.boost_until
    );

    IF COALESCE(v_control.unlimited_sending_enabled, false) THEN
      v_effective_monthly_limit := -1;
    ELSIF v_boost_active AND v_control.boost_monthly IS NOT NULL THEN
      v_effective_monthly_limit := v_control.boost_monthly;
    ELSIF v_control.send_limit_monthly IS NOT NULL THEN
      v_effective_monthly_limit := v_control.send_limit_monthly;
    ELSE
      v_effective_monthly_limit := v_email_limit;
    END IF;

    v_email_limit := v_effective_monthly_limit;

    SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_email_used
    FROM public.email_messages m
    WHERE m.tenant_id = v_tenant_id
      AND m.status = 'sent'
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) >= date_trunc('month', now())
      AND COALESCE(m.sent_at, m.last_attempt_at, m.updated_at, m.created_at) < now();
  ELSE
    v_email_used := COALESCE(v_subscription.email_usage, 0);
  END IF;

  IF v_email_limit > 0 THEN
    v_email_percent := ROUND((v_email_used::NUMERIC / v_email_limit) * 100, 1);
  ELSE
    v_email_percent := 0;
  END IF;

  IF v_sms_limit > 0 THEN
    v_sms_percent := ROUND((COALESCE(v_subscription.sms_usage, 0)::NUMERIC / v_sms_limit) * 100, 1);
  ELSE
    v_sms_percent := 0;
  END IF;

  RETURN jsonb_build_object(
    'tier', COALESCE(v_subscription.tier, 'legacy'),
    'is_founding_customer', COALESCE(v_subscription.is_founding_customer, false),
    'email', jsonb_build_object(
      'used', v_email_used,
      'limit', v_email_limit,
      'remaining', CASE
        WHEN v_email_limit = -1 THEN 0
        ELSE GREATEST(0, v_email_limit - v_email_used)
      END,
      'percent', v_email_percent,
      'unlimited', v_email_limit = -1,
      'overage_this_month', COALESCE(v_subscription.overage_emails_this_month, 0),
      'overage_rate', COALESCE(v_tier_limits.email_overage_rate, 0.002)
    ),
    'sms', jsonb_build_object(
      'used', COALESCE(v_subscription.sms_usage, 0),
      'limit', v_sms_limit,
      'remaining', GREATEST(0, v_sms_limit - COALESCE(v_subscription.sms_usage, 0)),
      'percent', v_sms_percent,
      'unlimited', v_sms_limit = -1,
      'overage_this_month', COALESCE(v_subscription.overage_sms_this_month, 0),
      'overage_rate', COALESCE(v_tier_limits.sms_overage_rate, 0.03)
    ),
    'billing_interval', v_subscription.billing_interval,
    'end_date', v_subscription.end_date,
    'plan', v_subscription.plan
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_send_quota(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_send_quota(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_reputation_policy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_stats(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_sending_limits(UUID, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_unlimited_sending(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_emergency_restriction(UUID, BOOLEAN, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_temporary_boost(UUID, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_tenant_temporary_boost(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_email_management_panel(UUID, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
