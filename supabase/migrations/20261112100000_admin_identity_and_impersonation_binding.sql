-- Admin identity and impersonation binding (central-login milestone 46; findings crm-r1-F07, F11, F29, F33).
--
-- 1. Impersonation is a two-step grant (F07, F11). admin-impersonate-user first records the audit row and a
--    short-lived grant in one transaction (no audit row, no grant), and returns only a grant id and a one-time
--    nonce. The magic-link token is minted later, when the SAME master admin redeems the grant from the new tab
--    with their own session; a callback address opened in any other browser can't be redeemed.
-- 2. The admin trial and tenant RPCs authorize from the confirmed identity, is_master_admin(auth.uid()), never
--    from the JWT email claim (F29).
-- 3. Master admin follows the app_admin_emails allowlist only: the legacy user_roles 'master_admin' rows no longer
--    grant it, and no one can add or remove 'master_admin' rows through the Data API (F33).

-- ---------- 1. Impersonation grants ----------
CREATE TABLE IF NOT EXISTS public.admin_impersonation_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_log_id uuid NOT NULL REFERENCES public.admin_audit_log(id) ON DELETE CASCADE,
  nonce_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz
);
ALTER TABLE public.admin_impersonation_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_impersonation_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_impersonation_grants TO service_role;

-- Records the audit row and the grant together. The target's tenant comes from its own users row, never from the
-- request. Returns the grant id.
CREATE OR REPLACE FUNCTION public.admin_impersonation_start(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_nonce_hash text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_audit_id uuid;
  v_grant_id uuid;
BEGIN
  IF p_admin_user_id IS NULL OR p_target_user_id IS NULL OR coalesce(length(p_nonce_hash), 0) < 32 THEN
    RAISE EXCEPTION 'An admin, a target and a nonce are required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_master_admin(p_admin_user_id) THEN
    RAISE EXCEPTION 'Master admin required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.admin_audit_log (admin_user_id, target_tenant_id, target_user_id, action_type, action_details)
  VALUES (
    p_admin_user_id,
    (SELECT u.tenant_id FROM public.users u WHERE u.id = p_target_user_id),
    p_target_user_id,
    'impersonate_user',
    coalesce(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_audit_id;

  INSERT INTO public.admin_impersonation_grants (admin_user_id, target_user_id, audit_log_id, nonce_hash, expires_at)
  VALUES (p_admin_user_id, p_target_user_id, v_audit_id, p_nonce_hash, now() + interval '2 minutes')
  RETURNING id INTO v_grant_id;

  RETURN v_grant_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_impersonation_start(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_impersonation_start(uuid, uuid, text, jsonb) TO service_role;

-- Redeems a grant once, only for the admin who started it, while it is fresh and while that admin is still a
-- master admin. Returns the target user id, or null when the grant can't be redeemed.
CREATE OR REPLACE FUNCTION public.admin_impersonation_redeem(
  p_grant_id uuid,
  p_admin_user_id uuid,
  p_nonce_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_target uuid;
BEGIN
  IF p_grant_id IS NULL OR p_admin_user_id IS NULL OR p_nonce_hash IS NULL
     OR NOT public.is_master_admin(p_admin_user_id) THEN
    RETURN NULL;
  END IF;
  UPDATE public.admin_impersonation_grants g
  SET redeemed_at = now()
  WHERE g.id = p_grant_id
    AND g.admin_user_id = p_admin_user_id
    AND g.nonce_hash = p_nonce_hash
    AND g.redeemed_at IS NULL
    AND g.expires_at > now()
  RETURNING g.target_user_id INTO v_target;
  RETURN v_target;
END $$;
REVOKE ALL ON FUNCTION public.admin_impersonation_redeem(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_impersonation_redeem(uuid, uuid, text) TO service_role;

-- ---------- 2. Admin RPCs authorize from the confirmed identity (F29) ----------
CREATE OR REPLACE FUNCTION public.admin_extend_trial(p_tenant_id uuid, p_days integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Extend the trial for all users in the tenant
  UPDATE subscriptions
  SET
    end_date = end_date + (p_days || ' days')::interval,
    updated_at = now()
  WHERE user_id IN (
    SELECT id FROM users WHERE tenant_id = p_tenant_id
  )
  AND plan = 'free_trial';
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_extend_trial_by_email(p_email text, p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  target_user_id uuid;
  old_end_date date;
  new_end_date date;
BEGIN
  -- Check admin authorization (the caller's confirmed identity, never the token's email claim)
  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Find the user
  SELECT au.id INTO target_user_id
  FROM auth.users au
  WHERE au.email = p_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_email;
  END IF;

  -- Get current end date and extend it
  SELECT end_date INTO old_end_date
  FROM subscriptions
  WHERE user_id = target_user_id
  AND plan = 'free_trial';

  IF old_end_date IS NULL THEN
    RAISE EXCEPTION 'No active trial found for user: %', p_email;
  END IF;

  -- Extend the trial
  UPDATE subscriptions
  SET
    end_date = end_date + (p_days || ' days')::interval,
    updated_at = now()
  WHERE user_id = target_user_id
  AND plan = 'free_trial'
  RETURNING end_date INTO new_end_date;

  RETURN jsonb_build_object(
    'success', true,
    'email', p_email,
    'old_end_date', old_end_date,
    'new_end_date', new_end_date,
    'days_extended', p_days
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_tenant_active(p_tenant_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE tenants
  SET
    archived_at = CASE WHEN p_active THEN NULL ELSE now() END,
    updated_at = now()
  WHERE id = p_tenant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_extend_trial(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_extend_trial_by_email(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_tenant_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial_by_email(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_toggle_tenant_active(uuid, boolean) TO authenticated, service_role;

-- ---------- 3. Master admin follows the allowlist (F33) ----------
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = _user_id;

  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  -- The app_admin_emails allowlist is the only source of master admin; legacy user_roles rows grant nothing.
  RETURN EXISTS (
    SELECT 1
    FROM public.app_admin_emails a
    WHERE lower(a.email) = v_email
  );
END;
$function$;

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    -- Master admins may still manage other roles, but no one adds or removes 'master_admin' rows through the API.
    DROP POLICY IF EXISTS "Master admins can insert roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Master admins can delete roles" ON public.user_roles;
    CREATE POLICY "Master admins can insert roles" ON public.user_roles
      FOR INSERT TO authenticated
      WITH CHECK (public.is_master_admin(auth.uid()) AND role::text <> 'master_admin');
    CREATE POLICY "Master admins can delete roles" ON public.user_roles
      FOR DELETE TO authenticated
      USING (public.is_master_admin(auth.uid()) AND role::text <> 'master_admin');
    REVOKE ALL ON public.user_roles FROM anon;
  END IF;
END $$;
