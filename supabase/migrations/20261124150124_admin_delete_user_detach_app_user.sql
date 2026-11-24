-- Self-service account deletion (delete-account / delete-user-hard edge
-- functions) failed for every normally signed-up user: public.users rows are
-- created with created_by_user_id pointing at their own auth user (NO ACTION)
-- and have no FK to auth.users, so the final DELETE FROM auth.users hit
-- users_created_by_user_id_fkey. This detaches other users' references and
-- removes the user's own public.users row first.
--
-- Business data a user owns (crm_customers, crm_campaigns, crm_segments,
-- audit logs, ...) is deliberately NOT deleted: if any exists, the auth delete
-- fails with a foreign-key error rather than removing a business's records.
-- What should happen to that data is a separate product decision.
--
-- Applied to production 2026-11-24 (version 20261124150124). Verified by
-- deleting the two throwaway A2 test users through this function: both
-- returned true and 0 rows remained in auth.users / identities / sessions /
-- public.users / company_profiles / subscriptions / teams / token_usage.

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

  DELETE FROM public.content_tasks WHERE user_id = target_user_id;
  DELETE FROM public.campaigns WHERE user_id = target_user_id;

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

  UPDATE public.users SET created_by_user_id = NULL
   WHERE created_by_user_id = target_user_id AND id <> target_user_id;
  UPDATE public.content_tasks SET assigned_user_id = NULL
   WHERE assigned_user_id = target_user_id;
  DELETE FROM public.users WHERE id = target_user_id;

  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN TRUE;
END;
$function$;
