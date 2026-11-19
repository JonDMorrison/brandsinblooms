-- Central-login milestone 59, identity group (CRM): sessions, sign-in policy, link lifecycle and admin identity.
-- Applies after the other milestone-59 packs (20261116080000 .. 20261116080250). Every function replaced here copies
-- the definition the local CRM database served on 2026-11-16 (pg_get_functiondef) plus the change named beside it.
--
--  1. crm-r2-F20         The Data API refuses a token whose Auth session has ended (pre-request, CMS 42-D6 pattern).
--  2. crm-r2-F199/F21/F198  A BloomSuite-linked account signs in through BloomSuite ID only: the access-token hook
--                        (POS 58-D2 pattern) refuses any non-OAuth token for it, except while a previous-link record
--                        stands. config.toml's [auth.hook.custom_access_token] turns it on; hosted enablement is an
--                        owner go-live step.
--  3. crm-r2-F197/F198/F201/F21  Link lifecycle: ending a user's sessions also voids its issued sign-in codes; the
--                        first-link step runs where Auth links the identity; a deletion notice clears the first-link
--                        marker; the link refusal and the notice apply are serialized per account.
--  4. crm-r2-F15         Impersonation never targets another administrator (or a BloomSuite-only account).
--  5. crm-r2-F200        Master admin needs a confirmed address; is_super_admin and the inline allow-list copies use it.
--  6. crm-r2-F122        The compiled-in super-admin addresses act only while they are also master admins.
--  7. crm-r2-F22         A per-account budget for the CRM's signed calls to BloomSuite ID.
--  8. crm-r2-F194        set_principal_role by address names the live account's principal, or refuses as ambiguous.
--  9. crm-r2-F195        Deleting a CRM account ends its Bloom Support principal, staff API keys and refresh tokens.
-- 10. crm-r2-F196        A CRM user row follows its account's address; a stale row gives its address up.

-- ---------- 1. crm-r2-F20: the Data API refuses ended sessions ----------
-- PostgREST runs this before every /rest/v1 request. An authenticated token whose session_id has no auth.sessions
-- row for its user gets 401 (PT401). Anonymous and service-role requests, and tokens without a session id, pass.
CREATE OR REPLACE FUNCTION public.require_live_auth_session()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_claims jsonb;
  v_session text;
  v_user text;
BEGIN
  v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF v_claims IS NULL OR coalesce(v_claims->>'role', '') <> 'authenticated' THEN
    RETURN;
  END IF;
  v_session := nullif(v_claims->>'session_id', '');
  IF v_session IS NULL THEN
    RETURN;
  END IF;
  v_user := coalesce(v_claims->>'sub', '');
  IF v_session !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_user !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = v_session::uuid AND s.user_id = v_user::uuid) THEN
    RAISE EXCEPTION 'This session has ended. Sign in again.'
      USING ERRCODE = 'PT401', HINT = 'session_ended';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.require_live_auth_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_live_auth_session() TO anon, authenticated, service_role;

-- No pre-request is set on the local role (checked 2026-11-16); the hosted role has none in the owner's schema export.
-- The go-live runbook reads pg_roles.rolconfig for authenticator first and chains an existing one instead.
ALTER ROLE authenticator SET pgrst.db_pre_request TO 'public.require_live_auth_session';
NOTIFY pgrst, 'reload config';

-- ---------- 2. crm-r2-F199, F21, F198: BloomSuite-only sign-in for linked accounts ----------
-- Auth calls this for every access token it issues (sign-in, code exchange, verify, refresh). A token whose amr has
-- no OAuth entry, for an account holding a custom:bloomsuite identity, is refused (403) unless the account has a
-- previous-link record (a deletion notice unlinked it; its own email sign-in stays while an owner reviews a new link).
-- Emailed links and codes, recovery, a password set from them, a pre-link password and an older session's refresh
-- are all refused; a BloomSuite sign-in and its refreshes carry amr oauth and pass. Owner decision: impersonation of
-- a linked account (a magic-link session) is refused too.
-- Runs as supabase_auth_admin with Supabase's documented hook grants (no SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.crm_custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  v_user uuid := (event->>'user_id')::uuid;
BEGIN
  IF NOT (coalesce(event->'claims'->'amr', '[]'::jsonb) @> '[{"method": "oauth"}]'::jsonb)
     AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = v_user AND i.provider = 'custom:bloomsuite')
     AND NOT EXISTS (SELECT 1 FROM bloomsuite_private.previous_links p WHERE p.user_id = v_user) THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This CRM account signs in through BloomSuite ID. Use Continue with BloomSuite.'
    ));
  END IF;
  RETURN event;
END $$;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE ALL ON FUNCTION public.crm_custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_custom_access_token_hook(jsonb) TO supabase_auth_admin;
-- The hook reads the previous-link records (auth.identities already belongs to supabase_auth_admin).
GRANT USAGE ON SCHEMA bloomsuite_private TO supabase_auth_admin;
GRANT SELECT ON bloomsuite_private.previous_links TO supabase_auth_admin;
DROP POLICY IF EXISTS "Auth reads previous links for the access-token hook" ON bloomsuite_private.previous_links;
CREATE POLICY "Auth reads previous links for the access-token hook" ON bloomsuite_private.previous_links
  FOR SELECT TO supabase_auth_admin USING (true);

-- ---------- 3. crm-r2-F197, F198, F201, F21: link lifecycle ----------
-- F197: the user form also deletes the sign-in codes Auth already issued for that user (auth.flow_state), so a code
-- handed out before a deletion notice or a revoke-all can't open a new session afterwards. Covers the notice apply,
-- bloomsuite_end_sessions(p_user_id) and bloomsuite_end_sessions_for_gateway_user.
CREATE OR REPLACE FUNCTION bloomsuite_private.end_sessions(p_session_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  targets uuid[];
  removed integer;
BEGIN
  IF (p_session_id IS NULL) = (p_user_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one of session id or user id is required' USING ERRCODE = '22023';
  END IF;
  -- Auth owns these tables. Fail closed if its schema is unavailable.
  IF p_user_id IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.flow_state WHERE user_id = $1' USING p_user_id;
  END IF;
  SELECT array_agg(s.id) INTO targets
  FROM auth.sessions s
  WHERE s.id = p_session_id OR s.user_id = p_user_id;
  IF targets IS NULL THEN
    RETURN 0;
  END IF;
  EXECUTE 'DELETE FROM auth.refresh_tokens WHERE session_id = ANY($1)' USING targets;
  EXECUTE 'DELETE FROM auth.sessions WHERE id = ANY($1)' USING targets;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $function$;

-- F21: the first-link step can now run at the link itself, before any session exists, so the session to keep may
-- be null (null = "made at the link"; then every existing session ends). The Data API entry point still requires one.
ALTER TABLE bloomsuite_private.first_links ALTER COLUMN kept_session_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION bloomsuite_private.complete_first_link(p_user_id uuid, p_keep_session_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  targets uuid[];
  removed integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user id is required' USING ERRCODE = '22023';
  END IF;
  -- The marker goes in first, so two reports racing for the same account run the step only once.
  INSERT INTO bloomsuite_private.first_links (user_id, kept_session_id)
  VALUES (p_user_id, p_keep_session_id)
  ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  -- Auth owns these tables. Fail closed if its schema is unavailable. Only an account with a password gets a
  -- new one (Auth's admin password update would end the BloomSuite session too, so it isn't used).
  EXECUTE 'UPDATE auth.users SET encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(32), ''hex''), extensions.gen_salt(''bf''))
    WHERE id = $1 AND coalesce(encrypted_password, '''') <> ''''' USING p_user_id;
  SELECT array_agg(s.id) INTO targets
  FROM auth.sessions s
  WHERE s.user_id = p_user_id AND s.id IS DISTINCT FROM p_keep_session_id;
  IF targets IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE session_id = ANY($1)' USING targets;
    EXECUTE 'DELETE FROM auth.sessions WHERE id = ANY($1)' USING targets;
    GET DIAGNOSTICS removed = ROW_COUNT;
  END IF;
  UPDATE bloomsuite_private.first_links SET other_sessions_ended = removed WHERE user_id = p_user_id;
  RETURN removed;
END $function$;

CREATE OR REPLACE FUNCTION public.bloomsuite_complete_first_link(p_user_id uuid, p_keep_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_user_id IS NULL OR p_keep_session_id IS NULL THEN
    RAISE EXCEPTION 'A user id and the session to keep are required' USING ERRCODE = '22023';
  END IF;
  RETURN bloomsuite_private.complete_first_link(p_user_id, p_keep_session_id);
END $$;

-- F21: the step runs in the same transaction as Auth's link (CMS 19-D2): a pre-link password is retired and every
-- existing session ends even if no browser session report follows. bloomsuite-session-report stays the fallback.
CREATE OR REPLACE FUNCTION bloomsuite_private.first_link_on_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.provider = 'custom:bloomsuite' THEN
    PERFORM bloomsuite_private.complete_first_link(NEW.user_id, NULL);
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION bloomsuite_private.first_link_on_identity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS bloomsuite_first_link_on_identity ON auth.identities;
CREATE TRIGGER bloomsuite_first_link_on_identity
  AFTER INSERT ON auth.identities
  FOR EACH ROW
  WHEN (NEW.provider = 'custom:bloomsuite')
  EXECUTE FUNCTION bloomsuite_private.first_link_on_identity();

-- F201: the link refusal takes the account's link lock before it reads previous_links; the notice apply takes the
-- same lock before it writes, so a link made while a notice is applied is either refused or removed by the apply.
CREATE OR REPLACE FUNCTION bloomsuite_private.refuse_previously_linked()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.provider = 'custom:bloomsuite' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('bloomsuite_link:' || NEW.user_id::text, 0));
    IF EXISTS (SELECT 1 FROM bloomsuite_private.previous_links p WHERE p.user_id = NEW.user_id) THEN
      RAISE LOG 'bloomsuite: refused a new BloomSuite ID link for previously linked CRM user %', NEW.user_id;
      RAISE EXCEPTION 'This CRM account was linked to a deleted BloomSuite ID account'
        USING ERRCODE = '42501', HINT = 'bloomsuite_previously_linked';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- F201 lock (above); F198: the first-link marker goes with the link, so a later owner-approved re-link to a new
-- BloomSuite ID account runs the first-link step again (credentials made while unlinked end at the re-link).
CREATE OR REPLACE FUNCTION public.bloomsuite_apply_deletion_notice(p_gateway_user_id uuid, p_notice_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := bloomsuite_private.linked_user(p_gateway_user_id);
  v_sessions integer := 0;
  v_identities integer := 0;
BEGIN
  IF p_gateway_user_id IS NULL THEN
    RAISE EXCEPTION 'A BloomSuite ID user is required' USING ERRCODE = '22023';
  END IF;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'sessions_ended', 0, 'identities_removed', 0);
  END IF;
  -- Serialized with Auth's link step for this account (refuse_previously_linked takes the same lock).
  PERFORM pg_advisory_xact_lock(hashtextextended('bloomsuite_link:' || v_user::text, 0));
  -- The record goes in first, so a sign-in racing with this notice can't re-link the account.
  INSERT INTO bloomsuite_private.previous_links (user_id, gateway_user_id, notice_id)
  VALUES (v_user, p_gateway_user_id, p_notice_id)
  ON CONFLICT (user_id) DO UPDATE
    SET gateway_user_id = EXCLUDED.gateway_user_id, notice_id = EXCLUDED.notice_id, recorded_at = clock_timestamp();
  v_sessions := bloomsuite_private.end_sessions(NULL, v_user);
  -- Auth owns this table. Fail closed if its schema is unavailable.
  EXECUTE 'DELETE FROM auth.identities WHERE user_id = $1 AND provider = ''custom:bloomsuite''' USING v_user;
  GET DIAGNOSTICS v_identities = ROW_COUNT;
  DELETE FROM bloomsuite_private.first_links WHERE user_id = v_user;
  RETURN jsonb_build_object('linked', true, 'sessions_ended', v_sessions, 'identities_removed', v_identities);
END $function$;

-- ---------- 4. crm-r2-F15: impersonation never targets another administrator ----------
-- Start refuses (42501, mapped to 403 by admin-impersonate-user) a target that is a master admin or whose address is
-- on the allow-list at all (an unconfirmed one would be confirmed by the magic link), and, by owner decision, a
-- BloomSuite-only account (the access-token hook refuses its magic-link session anyway). Redeem no longer honours an
-- older grant for such a target.
CREATE OR REPLACE FUNCTION public.admin_impersonation_start(p_admin_user_id uuid, p_target_user_id uuid, p_nonce_hash text, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  IF public.is_master_admin(p_target_user_id) OR EXISTS (
    SELECT 1 FROM auth.users u JOIN public.app_admin_emails a ON lower(a.email) = lower(u.email)
    WHERE u.id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'Impersonating another administrator is not allowed'
      USING ERRCODE = '42501', HINT = 'impersonation_target_admin';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = p_target_user_id AND i.provider = 'custom:bloomsuite')
     AND NOT EXISTS (SELECT 1 FROM bloomsuite_private.previous_links p WHERE p.user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'This account signs in through BloomSuite ID only'
      USING ERRCODE = '42501', HINT = 'impersonation_target_bloomsuite';
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
END $function$;

CREATE OR REPLACE FUNCTION public.admin_impersonation_redeem(p_grant_id uuid, p_admin_user_id uuid, p_nonce_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    AND NOT public.is_master_admin(g.target_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM auth.users u JOIN public.app_admin_emails a ON lower(a.email) = lower(u.email)
      WHERE u.id = g.target_user_id
    )
    AND NOT (
      EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = g.target_user_id AND i.provider = 'custom:bloomsuite')
      AND NOT EXISTS (SELECT 1 FROM bloomsuite_private.previous_links p WHERE p.user_id = g.target_user_id)
    )
  RETURNING g.target_user_id INTO v_target;
  RETURN v_target;
END $function$;

-- ---------- 5. crm-r2-F200: master admin needs a confirmed address ----------
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

  -- Only a confirmed address counts (crm-r2-F200): an unconfirmed account carrying an allow-listed address is not
  -- a master admin.
  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = _user_id
    AND u.email_confirmed_at IS NOT NULL;

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

-- Super admin is master admin (it read the same allow-list without the confirmation check).
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN public.is_master_admin(user_id);
END;
$function$;

-- The three admin RPCs that copied the allow-list check inline now call is_master_admin (gate line only).
CREATE OR REPLACE FUNCTION public.admin_list_tenants(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(tenant_id uuid, primary_contact_user_id uuid, company_name text, website text, city text, region text, country text, onboarding_completed_at timestamp with time zone, tenant_created_at timestamp with time zone, primary_contact_email text, primary_contact_name text, primary_contact_last_login timestamp with time zone, plan text, subscription_status text, trial_start timestamp with time zone, trial_end timestamp with time zone, current_period_end timestamp with time zone, last_activity_at timestamp with time zone, is_trialing boolean, is_paid_active boolean, trial_not_expired boolean, is_active boolean, health_score integer, onboarding_steps_done integer, onboarding_steps_total integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  RETURN QUERY
  SELECT
    v.tenant_id::uuid,
    v.primary_contact_user_id::uuid,
    v.company_name::text,
    v.website::text,
    v.city::text,
    v.region::text,
    v.country::text,
    v.onboarding_completed_at::timestamptz,
    v.tenant_created_at::timestamptz,
    v.primary_contact_email::text,
    v.primary_contact_name::text,
    v.primary_contact_last_login::timestamptz,
    v.plan::text,
    v.subscription_status::text,
    v.trial_start::timestamptz,
    v.trial_end::timestamptz,
    v.current_period_end::timestamptz,
    v.last_activity_at::timestamptz,
    v.is_trialing::boolean,
    v.is_paid_active::boolean,
    v.trial_not_expired::boolean,
    v.is_active::boolean,
    v.health_score::int,
    v.onboarding_steps_done::int,
    v.onboarding_steps_total::int
  FROM public.admin_tenant_overview v
  WHERE (
      p_status IS NULL OR
      (p_status = 'trialing' AND v.is_trialing) OR
      (p_status = 'active' AND v.is_paid_active) OR
      (p_status = 'canceled' AND NOT v.is_active)
    )
    AND (
      p_search IS NULL
      OR v.company_name ILIKE '%' || p_search || '%'
      OR v.primary_contact_email ILIKE '%' || p_search || '%'
      OR v.website ILIKE '%' || p_search || '%'
    )
  ORDER BY v.last_activity_at DESC NULLS LAST, v.tenant_created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_stats()
 RETURNS TABLE(total_tenants bigint, active_trials bigint, paid_active bigint, inactive_tenants bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_tenants,
    COUNT(*) FILTER (WHERE is_trialing)::bigint as active_trials,
    COUNT(*) FILTER (WHERE is_paid_active)::bigint as paid_active,
    COUNT(*) FILTER (WHERE NOT is_active)::bigint as inactive_tenants
  FROM public.admin_tenant_overview v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_change_tenant_plan(p_tenant_id uuid, p_plan text, p_end_date date, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_rows_updated int;
  v_previous_plan text;
  v_tenant_name text;
  v_primary_email text;
BEGIN
  -- 1. Authorize: caller must be authenticated and in app_admin_emails
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  SELECT lower(u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  -- 2. Validate inputs
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_plan IS NULL OR btrim(p_plan) = '' THEN
    RAISE EXCEPTION 'plan is required';
  END IF;

  IF p_plan NOT IN ('free_trial', 'seed', 'sprout', 'bloom', 'thrive', 'expired') THEN
    RAISE EXCEPTION 'invalid plan: %', p_plan;
  END IF;

  IF p_end_date IS NULL THEN
    RAISE EXCEPTION 'end_date is required';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required';
  END IF;

  -- 3. Gather context for audit log
  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

  SELECT s.plan::text INTO v_previous_plan
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  SELECT u.email INTO v_primary_email
  FROM public.users u
  WHERE u.tenant_id = p_tenant_id
  ORDER BY u.created_at ASC
  LIMIT 1;

  -- 4. Update every subscription for every user in the tenant
  UPDATE public.subscriptions
  SET
    plan = p_plan::public.subscription_plan,
    tier = p_plan,
    end_date = p_end_date,
    crm_enabled = (p_plan NOT IN ('free_trial', 'expired')),
    deleted_at = NULL,
    updated_at = now()
  WHERE user_id IN (
    SELECT id FROM public.users WHERE tenant_id = p_tenant_id
  );

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- 5. If the tenant has a user but no subscription row, create one so the
  --    admin's intent is honored even for broken / pre-existing accounts.
  IF v_rows_updated = 0 THEN
    INSERT INTO public.subscriptions (user_id, plan, tier, start_date, end_date, crm_enabled)
    SELECT
      u.id,
      p_plan::public.subscription_plan,
      p_plan,
      CURRENT_DATE,
      p_end_date,
      (p_plan NOT IN ('free_trial', 'expired'))
    FROM public.users u
    WHERE u.tenant_id = p_tenant_id
      AND NOT EXISTS (
        SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
      );

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  END IF;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'No users found for tenant %. Nothing updated.', p_tenant_id;
  END IF;

  -- 6. Audit log
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    auth.uid(),
    p_tenant_id,
    'change_plan',
    jsonb_build_object(
      'previous_plan', v_previous_plan,
      'new_plan', p_plan,
      'end_date', p_end_date,
      'reason', btrim(p_reason),
      'tenant_name', v_tenant_name,
      'contact_email', v_primary_email,
      'rows_updated', v_rows_updated
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'rows_updated', v_rows_updated,
    'previous_plan', v_previous_plan,
    'new_plan', p_plan
  );
END;
$function$;

-- ---------- 6. crm-r2-F122: compiled-in super-admin addresses also need the allow-list ----------
-- Gate made conjunctive: <the existing literal-address check> AND is_master_admin(auth.uid()). The literals stay
-- (is_master_admin alone would widen these RPCs, hard delete included, to every allow-listed admin).
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow super admins to call this function
  IF NOT (EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) AND public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Super admin required.';
  END IF;

  -- Delete from all related tables in the correct order (respecting foreign key constraints)
  -- Delete content_tasks BEFORE campaigns (since content_tasks references campaigns)
  DELETE FROM public.content_tasks WHERE user_id = target_user_id;
  DELETE FROM public.campaigns WHERE user_id = target_user_id;
  
  -- Delete other related records
  DELETE FROM public.token_usage WHERE user_id = target_user_id;
  DELETE FROM public.content_templates WHERE user_id = target_user_id;
  DELETE FROM public.content_assets WHERE user_id = target_user_id;
  DELETE FROM public.social_connections WHERE user_id = target_user_id;
  DELETE FROM public.analytics_settings WHERE user_id = target_user_id;
  DELETE FROM public.team_members WHERE user_id = target_user_id;
  DELETE FROM public.teams WHERE owner_id = target_user_id;
  DELETE FROM public.subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.company_profiles WHERE user_id = target_user_id;
  DELETE FROM public.onboarding_responses WHERE user_id = target_user_id;
  DELETE FROM public.trial_expiration_emails WHERE user_id = target_user_id;
  
  -- Finally delete from auth.users (this will cascade to other auth tables)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_user_data()
 RETURNS TABLE(user_id uuid, email character varying, created_at timestamp with time zone, company_name text, company_overview text, location_info text, tokens_balance integer, onboarding_completed_at timestamp with time zone, subscription_plan text, subscription_status text, subscription_end_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow super admins to call this function
  IF NOT (EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) AND public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Super admin required.';
  END IF;

  RETURN QUERY
  SELECT 
    cp.user_id,
    au.email,
    cp.created_at,
    cp.company_name,
    cp.company_overview,
    cp.location_info,
    cp.tokens_balance,
    cp.onboarding_completed_at,
    s.plan::TEXT as subscription_plan,
    CASE 
      WHEN s.end_date > CURRENT_DATE THEN 'active'
      ELSE 'expired'
    END as subscription_status,
    s.end_date as subscription_end_date
  FROM public.company_profiles cp
  LEFT JOIN auth.users au ON au.id = cp.user_id
  LEFT JOIN public.subscriptions s ON s.user_id = cp.user_id
  ORDER BY cp.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_duplicate_accounts(keep_user_id uuid, merge_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow super admins to call this function
  IF NOT (EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) AND public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Super admin required.';
  END IF;

  -- Verify both users exist and have same email
  IF NOT EXISTS (
    SELECT 1 FROM auth.users au1 
    JOIN auth.users au2 ON au1.email = au2.email
    WHERE au1.id = keep_user_id AND au2.id = merge_user_id
  ) THEN
    RAISE EXCEPTION 'Users must exist and have the same email address.';
  END IF;

  -- Merge data from various tables (preserve the account we're keeping)
  -- Update campaigns
  UPDATE public.campaigns SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update content_tasks
  UPDATE public.content_tasks SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update content_templates
  UPDATE public.content_templates SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update content_assets
  UPDATE public.content_assets SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update social_connections
  UPDATE public.social_connections SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update analytics_settings
  UPDATE public.analytics_settings SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update subscriptions (keep the better plan)
  UPDATE public.subscriptions SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update token_usage
  UPDATE public.token_usage SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Merge company profiles (keep most complete one, but preserve tokens)
  UPDATE public.company_profiles 
  SET 
    company_name = COALESCE(cp1.company_name, cp2.company_name),
    company_overview = COALESCE(cp1.company_overview, cp2.company_overview),
    location_info = COALESCE(cp1.location_info, cp2.location_info),
    brand_voice = COALESCE(cp1.brand_voice, cp2.brand_voice),
    target_audience = COALESCE(cp1.target_audience, cp2.target_audience),
    tokens_balance = GREATEST(cp1.tokens_balance, cp2.tokens_balance),
    onboarding_completed_at = COALESCE(cp1.onboarding_completed_at, cp2.onboarding_completed_at)
  FROM public.company_profiles cp1
  LEFT JOIN public.company_profiles cp2 ON cp2.user_id = merge_user_id
  WHERE cp1.user_id = keep_user_id AND public.company_profiles.user_id = keep_user_id;
  
  -- Delete the duplicate profile
  DELETE FROM public.company_profiles WHERE user_id = merge_user_id;
  
  -- Log the merge operation
  INSERT INTO public.token_usage (
    user_id, 
    action_type, 
    tokens_consumed, 
    tokens_remaining,
    metadata
  ) VALUES (
    keep_user_id,
    'account_merge',
    0,
    (SELECT tokens_balance FROM public.company_profiles WHERE user_id = keep_user_id),
    jsonb_build_object('merged_user_id', merge_user_id, 'merged_at', now())
  );
  
  -- Finally delete the duplicate user from auth
  DELETE FROM auth.users WHERE id = merge_user_id;
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_duplicate_merge_suggestions()
 RETURNS TABLE(email character varying, accounts jsonb, suggested_keep_user_id uuid, suggestion_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow super admins to call this function
  IF NOT (EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) AND public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Super admin required.';
  END IF;

  RETURN QUERY
  WITH duplicate_emails AS (
    SELECT au.email, COUNT(*) as account_count
    FROM auth.users au
    JOIN public.company_profiles cp ON cp.user_id = au.id
    GROUP BY au.email
    HAVING COUNT(*) > 1
  ),
  account_details AS (
    SELECT 
      au.email,
      au.id as user_id,
      cp.created_at,
      cp.onboarding_completed_at,
      cp.tokens_balance,
      cp.company_name,
      COALESCE(ct.content_count, 0) as content_count,
      COALESCE(cam.campaign_count, 0) as campaign_count
    FROM auth.users au
    JOIN public.company_profiles cp ON cp.user_id = au.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as content_count 
      FROM public.content_tasks 
      GROUP BY user_id
    ) ct ON ct.user_id = au.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as campaign_count 
      FROM public.campaigns 
      GROUP BY user_id
    ) cam ON cam.user_id = au.id
    WHERE au.email IN (SELECT email FROM duplicate_emails)
  )
  SELECT 
    ad.email::character varying(255),
    jsonb_agg(
      jsonb_build_object(
        'user_id', ad.user_id,
        'created_at', ad.created_at,
        'onboarding_completed_at', ad.onboarding_completed_at,
        'tokens_balance', ad.tokens_balance,
        'company_name', ad.company_name,
        'content_count', ad.content_count,
        'campaign_count', ad.campaign_count
      ) ORDER BY ad.created_at DESC
    ) as accounts,
    (array_agg(ad.user_id ORDER BY 
      CASE WHEN ad.onboarding_completed_at IS NOT NULL THEN 1 ELSE 2 END,
      ad.content_count DESC,
      ad.campaign_count DESC,
      ad.tokens_balance DESC,
      ad.created_at DESC
    ))[1] as suggested_keep_user_id,
    CASE 
      WHEN MAX(CASE WHEN ad.onboarding_completed_at IS NOT NULL THEN 1 ELSE 0 END) = 1 
      THEN 'Most complete profile with onboarding completed'
      WHEN MAX(ad.content_count) > 0 
      THEN 'Account with most content'
      WHEN MAX(ad.campaign_count) > 0 
      THEN 'Account with most campaigns'
      ELSE 'Newest account'
    END as suggestion_reason
  FROM account_details ad
  GROUP BY ad.email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_master_admin_account(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow super admins to call this function
  IF NOT (EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) AND public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Super admin required.';
  END IF;

  -- Only allow resetting your own account or other super admin accounts
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = target_user_id
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) THEN
    RAISE EXCEPTION 'Can only reset super admin accounts.';
  END IF;

  -- Delete all content and data for the account
  DELETE FROM public.content_tasks WHERE user_id = target_user_id;
  DELETE FROM public.campaigns WHERE user_id = target_user_id;
  DELETE FROM public.token_usage WHERE user_id = target_user_id;
  DELETE FROM public.content_templates WHERE user_id = target_user_id;
  DELETE FROM public.content_assets WHERE user_id = target_user_id;
  DELETE FROM public.social_connections WHERE user_id = target_user_id;
  DELETE FROM public.analytics_settings WHERE user_id = target_user_id;
  DELETE FROM public.social_posts WHERE user_id = target_user_id;
  DELETE FROM public.onboarding_responses WHERE user_id = target_user_id;

  -- Reset company profile to initial state
  UPDATE public.company_profiles 
  SET 
    company_name = NULL,
    company_overview = NULL,
    brand_voice = NULL,
    tone_of_writing = NULL,
    target_audience = NULL,
    ideal_customer = NULL,
    unique_selling_points = NULL,
    company_values = NULL,
    seasonal_focus = NULL,
    specializations = NULL,
    location_info = NULL,
    tokens_balance = 100,
    tokens_reset_at = now() + INTERVAL '1 month',
    first_content_generated = false,
    onboarding_completed_at = NULL,
    first_welcome_dismissed = false,
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Reset subscription to trial if needed
  UPDATE public.subscriptions 
  SET 
    plan = 'free_trial',
    start_date = CURRENT_DATE,
    end_date = CURRENT_DATE + INTERVAL '7 days',
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Log the reset action
  INSERT INTO public.token_usage (
    user_id, 
    action_type, 
    tokens_consumed, 
    tokens_remaining,
    metadata
  ) VALUES (
    target_user_id,
    'admin_reset',
    0,
    100,
    jsonb_build_object('reset_by', auth.uid(), 'reset_at', now())
  );

  RETURN TRUE;
END;
$function$;

-- ---------- 7. crm-r2-F22: a per-account budget for signed calls to BloomSuite ID ----------
CREATE TABLE IF NOT EXISTS bloomsuite_private.signed_call_budget (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT clock_timestamp(),
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);
ALTER TABLE bloomsuite_private.signed_call_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloomsuite_private.signed_call_budget FROM PUBLIC, anon, authenticated;

-- Spends one call from (user, bucket) in a fixed window; true while the window's count is within the limit.
-- bloomsuite-session-report (bucket "<event>:<session id>") and bloomsuite-my-apps (bucket "my-apps") call it before
-- signing anything and answer 429 when it is false. A user's windows older than a day are dropped as it goes.
CREATE OR REPLACE FUNCTION public.bloomsuite_consume_call_budget(p_user_id uuid, p_bucket text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_used integer;
BEGIN
  IF p_user_id IS NULL OR coalesce(length(p_bucket), 0) NOT BETWEEN 1 AND 120
     OR coalesce(p_limit, 0) < 1 OR coalesce(p_window_seconds, 0) NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'A user, a bucket, a limit and a window of up to a day are required' USING ERRCODE = '22023';
  END IF;
  DELETE FROM bloomsuite_private.signed_call_budget b
  WHERE b.user_id = p_user_id AND b.bucket <> p_bucket AND b.window_start < v_now - interval '1 day';
  INSERT INTO bloomsuite_private.signed_call_budget AS b (user_id, bucket, window_start, used)
  VALUES (p_user_id, p_bucket, v_now, 1)
  ON CONFLICT (user_id, bucket) DO UPDATE
    SET used = CASE WHEN b.window_start <= v_now - make_interval(secs => p_window_seconds) THEN 1 ELSE b.used + 1 END,
        window_start = CASE WHEN b.window_start <= v_now - make_interval(secs => p_window_seconds) THEN v_now ELSE b.window_start END
  RETURNING b.used INTO v_used;
  RETURN v_used <= p_limit;
END $$;
REVOKE ALL ON FUNCTION public.bloomsuite_consume_call_budget(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_consume_call_budget(uuid, text, integer, integer) TO service_role;

-- ---------- 8. crm-r2-F194: set_principal_role by address names the live account's principal ----------
-- The address is resolved through auth.users (the address an account signs in with now) to that account's active
-- user principal (alias binding or canonical binding); a stale or orphaned principal that still carries the address
-- is never chosen, and more than one candidate is refused as ambiguous. By principal_id: unchanged.
CREATE OR REPLACE FUNCTION bloom_support.set_principal_role(p_actor uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE pr bloom_support.principals; v_role text := p->>'role'; v_matches integer; v_principal uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'admin.roles');
  IF v_role IS NOT NULL AND v_role NOT IN ('platform_admin','platform_operator','support','client') THEN RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023'; END IF;
  IF p->>'principal_id' IS NOT NULL THEN SELECT * INTO pr FROM bloom_support.principals WHERE id = (p->>'principal_id')::uuid;
  ELSE
    SELECT count(DISTINCT c.id), (array_agg(DISTINCT c.id))[1] INTO v_matches, v_principal
    FROM auth.users u
    JOIN bloom_support.principals c
      ON c.kind = 'user' AND c.active
     AND (c.auth_user_id = u.id
          OR c.id IN (SELECT a.principal_id FROM bloom_support.principal_auth_identities a WHERE a.auth_user_id = u.id))
    WHERE lower(u.email) = lower(p->>'email');
    IF v_matches > 1 THEN
      RAISE EXCEPTION 'ambiguous: more than one principal carries that address; choose the principal' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO pr FROM bloom_support.principals WHERE id = v_principal;
  END IF;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'not_found: principal (they must sign in to BloomSuite once first)' USING ERRCODE = 'P0002'; END IF;
  IF pr.kind <> 'user' AND v_role IN ('platform_admin','platform_operator','support') THEN
    RAISE EXCEPTION 'invalid: staff roles require a BloomSuite sign-in identity' USING ERRCODE = '22023';
  END IF;
  IF pr.id = p_actor AND v_role IS DISTINCT FROM 'platform_admin' AND v_role IS NOT NULL THEN
    RAISE EXCEPTION 'invalid: you cannot remove your own administrator role' USING ERRCODE = '22023';
  END IF;
  UPDATE bloom_support.principals SET role = coalesce(v_role, role),
    grants = CASE WHEN p ? 'grants' THEN ARRAY(SELECT jsonb_array_elements_text(p->'grants')) ELSE grants END,
    active = coalesce((p->>'active')::boolean, active), updated_at = now()
  WHERE id = pr.id RETURNING * INTO pr;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'principal.role_changed', jsonb_build_object('principal_id', pr.id, 'role', pr.role, 'grants', pr.grants, 'active', pr.active));
  RETURN jsonb_build_object('id', pr.id, 'email', pr.email, 'role', pr.role, 'grants', pr.grants, 'active', pr.active);
END $function$;

-- ---------- 9. crm-r2-F195: a deleted CRM account's Bloom Support access ends with it ----------
-- Before Auth deletes the account (alias rows still present): its user principal is deactivated and its staff API
-- keys and OAuth refresh tokens are revoked, unless another live CRM account still signs in to the same principal.
-- authenticate_api_key and has_permission already require an active principal.
CREATE OR REPLACE FUNCTION bloom_support.end_deleted_crm_account_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_principals uuid[];
BEGIN
  SELECT array_agg(pr.id) INTO v_principals
  FROM bloom_support.principals pr
  WHERE pr.kind = 'user'
    AND (pr.auth_user_id = OLD.id
         OR pr.id IN (SELECT a.principal_id FROM bloom_support.principal_auth_identities a WHERE a.auth_user_id = OLD.id))
    AND NOT EXISTS (
      SELECT 1 FROM bloom_support.principal_auth_identities a JOIN auth.users u ON u.id = a.auth_user_id
      WHERE a.principal_id = pr.id AND a.auth_user_id <> OLD.id
    )
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pr.auth_user_id AND u.id <> OLD.id);
  IF v_principals IS NULL THEN
    RETURN OLD;
  END IF;
  UPDATE bloom_support.principals SET active = false, updated_at = now() WHERE id = ANY (v_principals) AND active;
  UPDATE bloom_support.api_keys SET revoked_at = now() WHERE principal_id = ANY (v_principals) AND revoked_at IS NULL;
  UPDATE bloom_support.oauth_refresh_tokens SET revoked_at = now() WHERE principal_id = ANY (v_principals) AND revoked_at IS NULL;
  PERFORM bloom_support.log(NULL, NULL, NULL, 'principal.deactivated_account_deleted',
    jsonb_build_object('auth_user_id', OLD.id, 'principal_ids', to_jsonb(v_principals)));
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION bloom_support.end_deleted_crm_account_access() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS bloom_support_end_deleted_account_access ON auth.users;
CREATE TRIGGER bloom_support_end_deleted_account_access
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION bloom_support.end_deleted_crm_account_access();

-- ---------- 10. crm-r2-F196: CRM user rows follow their account's address ----------
-- Frees p_email for p_for_user: false when a live account (an auth user with that same address) holds it on its
-- CRM row. Otherwise every other CRM row holding it gives it up: a row whose account now signs in with another
-- address takes that address (when no other row holds it), and a row with no live account gets a per-row placeholder
-- that can never be delivered. Rows keep their id, tenant and data.
CREATE OR REPLACE FUNCTION public.release_stale_crm_user_email(p_email text, p_for_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  holder record;
BEGIN
  IF p_email IS NULL THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users u JOIN auth.users au ON au.id = u.id
    WHERE lower(u.email) = lower(p_email) AND u.id IS DISTINCT FROM p_for_user AND lower(au.email) = lower(u.email)
  ) THEN
    RETURN false;
  END IF;
  FOR holder IN
    SELECT u.id, au.email AS auth_email
    FROM public.users u LEFT JOIN auth.users au ON au.id = u.id
    WHERE lower(u.email) = lower(p_email) AND u.id IS DISTINCT FROM p_for_user
    FOR UPDATE OF u
  LOOP
    UPDATE public.users
    SET email = CASE
      WHEN holder.auth_email IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.users o WHERE lower(o.email) = lower(holder.auth_email) AND o.id <> holder.id
      ) THEN holder.auth_email
      ELSE 'released+' || holder.id::text || '@users.invalid'
    END
    WHERE id = holder.id;
  END LOOP;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.release_stale_crm_user_email(text, uuid) FROM PUBLIC, anon, authenticated;

-- An account's address change (confirmed in Auth) is copied to its CRM row.
CREATE OR REPLACE FUNCTION public.sync_crm_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.email IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.id) THEN
    RETURN NULL;
  END IF;
  IF NOT public.release_stale_crm_user_email(NEW.email, NEW.id) THEN
    RAISE LOG 'sync_crm_user_email: CRM user % keeps its old address: a live account holds the new one', NEW.id;
    RETURN NULL;
  END IF;
  UPDATE public.users SET email = NEW.email WHERE id = NEW.id AND email IS DISTINCT FROM NEW.email;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_crm_user_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_crm_user_email();

-- Sign-up: a stale row gives the address up instead of refusing (and disclosing) it; a live account's address is
-- still refused (R-15: no takeover; the new row is always the new account's own).
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tenant_name text;
  v_user_name text;
  v_slug text;
  v_existing_id uuid;
BEGIN
  -- An email that already belongs to another live CRM account is never taken over (R-15). A row whose account is
  -- gone or now signs in with another address gives the address up first (crm-r2-F196).
  IF NEW.email IS NOT NULL AND NOT public.release_stale_crm_user_email(NEW.email, NEW.id) THEN
    SELECT u.id INTO v_existing_id
    FROM public.users u
    WHERE lower(u.email) = lower(NEW.email) AND u.id <> NEW.id
    LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RAISE LOG 'handle_new_user_signup: refused new auth user %: its email belongs to CRM user %', NEW.id, v_existing_id;
      RAISE EXCEPTION 'This email already belongs to a CRM account'
        USING ERRCODE = '23505', HINT = 'crm_email_already_registered';
    END IF;
  END IF;

  v_user_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NEW.email
  );

  v_tenant_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'company_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'business_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'Organization'
  );

  BEGIN
    v_slug := lower(regexp_replace(
      COALESCE(NEW.email, NEW.id::text),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(NEW.id::text, 1, 8);

    INSERT INTO public.tenants (name, slug, is_active)
    VALUES (v_tenant_name, v_slug, true)
    RETURNING id INTO v_tenant_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user_signup: tenant creation failed for % (%): %',
      NEW.email, NEW.id, SQLERRM;
    v_tenant_id := NULL;
  END;

  -- The row is always this auth user's own: no email upsert, so no existing row or tenant is touched.
  INSERT INTO public.users (
    id,
    name,
    email,
    role,
    tenant_id,
    created_by_user_id
  ) VALUES (
    NEW.id,
    v_user_name,
    NEW.email,
    'admin',
    v_tenant_id,
    NEW.id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
