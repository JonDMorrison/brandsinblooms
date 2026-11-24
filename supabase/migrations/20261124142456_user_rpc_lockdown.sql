-- User-id RPC lockdown (security audit part A2).
--
-- Follow-up to 20261124140925_admin_rpc_lockdown. See docs/security/rpc-audit.md.
--
-- 1. public.assert_user_access(uuid): new shared guard for SECURITY DEFINER
--    RPCs that act on a user id. Like assert_tenant_access it only checks API
--    callers (JWT role anon/authenticated): the user themself or a master admin
--    passes. service_role and sessions with no JWT (pg_cron, internal) pass.
-- 2. Self-service RPCs now call assert_user_access first:
--    spend_tokens (called from useTokens and ParallelContentGenerator with the
--    signed-in user's id; API callers other than master admins may no longer
--    pass a negative amount, which credited tokens), soft_delete_user_data,
--    enable_crm_for_user.
-- 3. Privileged RPCs with no client caller: refill_tokens and
--    restore_user_data now require a master admin for API callers, and
--    EXECUTE is revoked from authenticated, anon and PUBLIC (service_role
--    keeps it).
-- 4. admin_delete_user: service_role (and non-API sessions) may now call it so
--    the delete-account and delete-user-hard edge functions work again. Both
--    authenticate the requester themselves (delete-account: own account only;
--    delete-user-hard: admin email allowlist). API callers still need a master
--    admin.
-- 5. get_recipient_email_delivery_timeline: no caller in the repo; it returns
--    recipient personal data for any tenant id. EXECUTE revoked from
--    authenticated, anon and PUBLIC (service_role keeps it).
--
-- Signatures, return types, defaults, function attributes and bodies are
-- otherwise unchanged (bodies taken from pg_get_functiondef on production).

-- ---------------------------------------------------------------
-- 0. Shared user guard
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_user_access(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
BEGIN
  -- Only PostgREST API callers are checked. service_role and sessions with no
  -- JWT (pg_cron, migrations, internal jobs) keep their existing access.
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() = p_user_id THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL
     AND coalesce(public.is_master_admin(auth.uid()), false) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Access denied for this user' USING ERRCODE = '42501';
END;
$function$;

COMMENT ON FUNCTION public.assert_user_access(uuid) IS
  'Raises 42501 unless the API caller is that user or a master admin. service_role and non-API sessions pass. Called from SECURITY DEFINER RPCs.';

-- SECURITY INVOKER helper: only the definer functions (owner postgres) call it.
REVOKE ALL ON FUNCTION public.assert_user_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_user_access(uuid) TO service_role;

-- ---------------------------------------------------------------
-- 1. Self-service RPCs: the user themself, a master admin, or service
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.spend_tokens(p_user_id uuid, p_tokens integer, p_action_type text DEFAULT 'generation'::text, p_content_type text DEFAULT NULL::text, p_campaign_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_balance INTEGER;
  profile_id UUID;
BEGIN
  PERFORM public.assert_user_access(p_user_id);
  -- A negative spend credits tokens; only master admins and service may do that.
  IF coalesce(p_tokens, 0) < 0
     AND coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND NOT coalesce(public.is_master_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Token amount must not be negative' USING ERRCODE = '22023';
  END IF;
  -- Get user's company profile and current token balance
  SELECT id, tokens_balance INTO profile_id, current_balance
  FROM public.company_profiles
  WHERE user_id = p_user_id;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No company profile found for user';
  END IF;

  -- Check if user has enough tokens (allow negative for overage)
  IF current_balance < p_tokens AND current_balance >= 0 THEN
    -- User will go into overage, but allow it
    NULL;
  END IF;

  -- Deduct tokens
  UPDATE public.company_profiles
  SET tokens_balance = tokens_balance - p_tokens
  WHERE id = profile_id;

  -- Log the usage
  INSERT INTO public.token_usage (
    user_id,
    action_type,
    tokens_consumed,
    tokens_remaining,
    content_type,
    campaign_id
  ) VALUES (
    p_user_id,
    p_action_type,
    p_tokens,
    current_balance - p_tokens,
    p_content_type,
    p_campaign_id
  );

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_user_data(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deletion_time TIMESTAMP WITH TIME ZONE := now();
BEGIN
  PERFORM public.assert_user_access(target_user_id);
  -- Soft delete user data across all tables
  UPDATE public.company_profiles
  SET deleted_at = deletion_time
  WHERE user_id = target_user_id AND deleted_at IS NULL;

  UPDATE public.social_connections
  SET deleted_at = deletion_time
  WHERE user_id = target_user_id AND deleted_at IS NULL;

  UPDATE public.content_tasks
  SET deleted_at = deletion_time
  WHERE user_id = target_user_id AND deleted_at IS NULL;

  UPDATE public.campaigns
  SET deleted_at = deletion_time
  WHERE user_id = target_user_id AND deleted_at IS NULL;

  UPDATE public.subscriptions
  SET deleted_at = deletion_time
  WHERE user_id = target_user_id AND deleted_at IS NULL;

  UPDATE public.social_posts
  SET deleted_at = deletion_time
  WHERE user_id = target_user_id AND deleted_at IS NULL;

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enable_crm_for_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public.assert_user_access(target_user_id);
  -- Update the company profile to enable CRM
  UPDATE public.company_profiles
  SET feature_flags = jsonb_set(
    COALESCE(feature_flags, '{}'::jsonb),
    '{crm_enabled}',
    'true'::jsonb
  ),
  updated_at = now()
  WHERE user_id = target_user_id;

  RETURN TRUE;
END;
$function$;

-- ---------------------------------------------------------------
-- 2. Privileged RPCs: master admin (API) or service/internal only
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refill_tokens(p_user_id uuid, p_tokens integer DEFAULT 100)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  profile_id UUID;
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND NOT coalesce(public.is_master_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.' USING ERRCODE = '42501';
  END IF;
  -- Get user's company profile
  SELECT id INTO profile_id
  FROM public.company_profiles
  WHERE user_id = p_user_id;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No company profile found for user';
  END IF;

  -- Reset tokens and update reset date
  UPDATE public.company_profiles
  SET
    tokens_balance = p_tokens,
    tokens_reset_at = now() + INTERVAL '1 month'
  WHERE id = profile_id;

  -- Log the refill
  INSERT INTO public.token_usage (
    user_id,
    action_type,
    tokens_consumed,
    tokens_remaining
  ) VALUES (
    p_user_id,
    'refill',
    p_tokens,
    p_tokens
  );

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_user_data(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND NOT coalesce(public.is_master_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.' USING ERRCODE = '42501';
  END IF;
  -- Restore user data by clearing deleted_at timestamps
  UPDATE public.company_profiles
  SET deleted_at = NULL
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;

  UPDATE public.social_connections
  SET deleted_at = NULL
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;

  UPDATE public.content_tasks
  SET deleted_at = NULL
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;

  UPDATE public.campaigns
  SET deleted_at = NULL
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;

  UPDATE public.subscriptions
  SET deleted_at = NULL
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;

  UPDATE public.social_posts
  SET deleted_at = NULL
  WHERE user_id = target_user_id AND deleted_at IS NOT NULL;

  RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.refill_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_user_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refill_tokens(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_user_data(uuid) TO service_role;

-- ---------------------------------------------------------------
-- 3. admin_delete_user: master admin (API) or service_role/internal
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- API callers must be master admins. service_role (the delete-account and
  -- delete-user-hard edge functions, which authenticate the requester
  -- themselves) and non-API sessions are allowed.
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND NOT coalesce(public.is_master_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.' USING ERRCODE = '42501';
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

-- ---------------------------------------------------------------
-- 4. get_recipient_email_delivery_timeline: service_role only
-- ---------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_recipient_email_delivery_timeline(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recipient_email_delivery_timeline(uuid, text, uuid, integer) TO service_role;
