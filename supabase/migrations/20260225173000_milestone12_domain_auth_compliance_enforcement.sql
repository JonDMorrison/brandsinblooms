-- Milestone 12: Domain Authentication & Compliance Enforcement
-- Enforce authenticated domains for high-volume sends (>50k),
-- while allowing low-volume sends with explicit compliance warnings.

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

  RETURN jsonb_build_object(
    'allowed', true,
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
    'warnings', to_jsonb(v_warnings),
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

NOTIFY pgrst, 'reload schema';
