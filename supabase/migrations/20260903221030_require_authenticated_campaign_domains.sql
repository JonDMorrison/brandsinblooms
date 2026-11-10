-- Campaign sends must never proceed on an operational-looking domain when
-- authentication evidence is incomplete. Keep the existing quota and
-- governance implementation behind a service-only function, then fail closed
-- for every campaign size when SPF, DKIM, return-path, DMARC, or ownership is
-- missing.

DO $$
BEGIN
  IF to_regprocedure(
    'public.check_send_quota_with_legacy_domain_policy(uuid,uuid,integer)'
  ) IS NULL THEN
    ALTER FUNCTION public.check_send_quota(uuid, uuid, integer)
      RENAME TO check_send_quota_with_legacy_domain_policy;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_send_quota_with_legacy_domain_policy(
  uuid, uuid, integer
) FROM PUBLIC, anon, authenticated;

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
  v_authenticated boolean;
  v_actor_id uuid := auth.uid();
  v_jwt_role text := COALESCE(
    current_setting('request.jwt.claim.role', true),
    ''
  );
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

  v_authenticated := COALESCE(
    (v_result -> 'compliance' ->> 'authenticated_for_scale')::boolean,
    false
  );

  IF COALESCE((v_result ->> 'allowed')::boolean, false)
     AND NOT v_authenticated THEN
    RETURN v_result || jsonb_build_object(
      'allowed', false,
      'reason', 'domain_authentication_incomplete',
      'message',
        'Campaign sending requires verified SPF, DKIM, return-path, DMARC (p=none minimum), and domain ownership.'
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.check_send_quota(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_send_quota(uuid, uuid, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.check_send_quota(uuid, uuid, integer) IS
  'Applies quota and governance rules and blocks every marketing campaign until complete domain authentication is verified.';
