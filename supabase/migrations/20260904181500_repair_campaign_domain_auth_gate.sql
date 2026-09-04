-- Repair the campaign-domain authentication gate introduced by
-- 20260903221030_require_authenticated_campaign_domains.sql.
--
-- That wrapper assumed the legacy quota function returned
-- compliance.authenticated_for_scale. The function that was actually renamed in
-- production is an older quota implementation that has no compliance object at
-- all, so every otherwise-allowed operational domain was converted into
-- domain_authentication_incomplete. This stranded campaigns in `sending` before
-- any recipient queue could be created.
--
-- Treat Resend's verified provider state plus verified DKIM, SPF and return-path
-- as the core authentication requirement for ordinary campaign sending. DMARC
-- remains strongly recommended and is surfaced as a warning; for genuinely
-- high-volume sends (> 50,000 recipients) it remains a hard requirement.

CREATE OR REPLACE FUNCTION public.check_send_quota(
  p_tenant_id uuid,
  p_domain_id uuid,
  p_recipient_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_domain public.email_domains%ROWTYPE;
  v_actor_id uuid := auth.uid();
  v_jwt_role text := COALESCE(
    current_setting('request.jwt.claim.role', true),
    ''
  );
  v_provider_verified boolean := false;
  v_spf_ok boolean := false;
  v_dkim_ok boolean := false;
  v_return_path_ok boolean := false;
  v_dmarc_ok boolean := false;
  v_core_authenticated boolean := false;
  v_high_volume boolean := COALESCE(p_recipient_count, 0) > 50000;
  v_compliance jsonb;
  v_warnings jsonb;
BEGIN
  IF v_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = v_actor_id
      AND app_user.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant access denied' USING ERRCODE = '42501';
  END IF;

  IF v_actor_id IS NULL AND v_jwt_role <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_result := public.check_send_quota_with_legacy_domain_policy(
    p_tenant_id,
    p_domain_id,
    p_recipient_count
  );

  -- Preserve hard failures from the existing quota/domain policy.
  IF NOT COALESCE((v_result ->> 'allowed')::boolean, false) THEN
    RETURN v_result;
  END IF;

  IF p_domain_id IS NULL THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'sender_domain_required',
      'message', 'Campaign sending requires a configured verified sending domain.'
    );
  END IF;

  SELECT *
  INTO v_domain
  FROM public.email_domains AS d
  WHERE d.id = p_domain_id
    AND d.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_found',
      'message', 'Sending domain not found.'
    );
  END IF;

  v_provider_verified :=
    v_domain.status IN ('active', 'warming_up')
    AND v_domain.verified_at IS NOT NULL
    AND lower(COALESCE(v_domain.resend_status ->> 'status', '')) = 'verified';
  v_spf_ok := COALESCE((v_domain.resend_status ->> 'spf_verified')::boolean, false);
  v_dkim_ok := COALESCE((v_domain.resend_status ->> 'dkim_verified')::boolean, false);
  v_return_path_ok := COALESCE((v_domain.resend_status ->> 'return_path_verified')::boolean, false);
  v_dmarc_ok := COALESCE((v_domain.resend_status ->> 'dmarc_verified')::boolean, false);
  v_core_authenticated :=
    v_provider_verified AND v_spf_ok AND v_dkim_ok AND v_return_path_ok;

  v_compliance := COALESCE(v_result -> 'compliance', '{}'::jsonb) ||
    jsonb_build_object(
      'high_volume', v_high_volume,
      'authenticated_for_scale', v_core_authenticated AND (NOT v_high_volume OR v_dmarc_ok),
      'provider_verified', v_provider_verified,
      'spf_ok', v_spf_ok,
      'dkim_ok', v_dkim_ok,
      'return_path_ok', v_return_path_ok,
      'dmarc_ok', v_dmarc_ok,
      'ownership_ok', v_provider_verified
    );

  v_result := v_result || jsonb_build_object(
    'compliance', v_compliance,
    'sender', COALESCE(v_result -> 'sender', '{}'::jsonb) || jsonb_build_object(
      'from_name', COALESCE(
        NULLIF(v_result -> 'sender' ->> 'from_name', ''),
        v_domain.default_from_name
      ),
      'from_email', COALESCE(
        NULLIF(v_result -> 'sender' ->> 'from_email', ''),
        v_domain.default_from_email,
        'mail@' || v_domain.domain
      )
    )
  );

  IF NOT v_core_authenticated THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'domain_authentication_incomplete',
      'message', 'Campaign sending requires a provider-verified domain with verified SPF, DKIM, and return-path records.'
    );
  END IF;

  IF v_high_volume AND NOT v_dmarc_ok THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'dmarc_required_for_high_volume',
      'message', 'High-volume campaign sending requires a verified DMARC policy (p=none minimum).'
    );
  END IF;

  IF NOT v_dmarc_ok THEN
    v_warnings := COALESCE(v_result -> 'warnings', '[]'::jsonb);
    IF jsonb_typeof(v_warnings) <> 'array' THEN
      v_warnings := '[]'::jsonb;
    END IF;
    v_result := v_result || jsonb_build_object(
      'warnings', v_warnings || jsonb_build_array(
        'DMARC is not yet verified. Sending is allowed at normal volume, but adding DMARC is strongly recommended for deliverability and spoofing protection.'
      )
    );
  END IF;

  RETURN v_result || jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.check_send_quota(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_send_quota(uuid, uuid, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.check_send_quota(uuid, uuid, integer) IS
  'Applies quota/domain policy, requires provider-verified SPF/DKIM/return-path for normal sends, and additionally requires DMARC for sends over 50,000 recipients.';
