-- Milestone 3: Remove email-domain warmup & throttling semantics
-- Keep schema for compatibility, but stop exposing warmup stages/limits via RPC.

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

  -- If no domain specified, pick an operational one for the tenant.
  IF p_domain_id IS NULL THEN
    SELECT * INTO v_domain
    FROM email_domains
    WHERE tenant_id = p_tenant_id
      AND status IN ('active', 'warming_up')
      AND manual_pause = false
    ORDER BY is_entri_managed DESC, created_at DESC
    LIMIT 1;

    IF v_domain IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'no_operational_domain',
        'message', 'No operational sending domain configured'
      );
    END IF;

    p_domain_id := v_domain.id;
  END IF;

  IF v_domain IS NULL THEN
    SELECT * INTO v_domain
    FROM email_domains
    WHERE id = p_domain_id AND tenant_id = p_tenant_id;
  END IF;

  IF v_domain IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_found',
      'message', 'Sending domain not found'
    );
  END IF;

  IF v_domain.manual_pause OR v_domain.status NOT IN ('active', 'warming_up') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_operational',
      'message', 'Sending domain is not operational'
    );
  END IF;

  v_from_email := COALESCE(v_domain.default_from_email, 'mail@' || v_domain.domain);
  v_from_name := COALESCE(v_domain.default_from_name, v_from_name);

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
    'requested', p_recipient_count
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
