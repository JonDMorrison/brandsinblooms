-- Admin and tenant RPC lockdown (security audit part A).
--
-- See docs/security/rpc-audit.md for the full audit of SECURITY DEFINER
-- functions in schema public that anon/authenticated can EXECUTE.
--
-- 1. admin_reset_sync_usage_for_month, admin_resync_tenant_budget and
--    admin_backfill_subscription_budgets had no caller check at all, so any
--    signed-in user could reset usage counters or rewrite budgets for any
--    tenant. They now require a master admin as their first statement. No app
--    or edge-function caller exists, so EXECUTE stays with authenticated (for
--    a master admin's own session) and service_role only.
-- 2. admin_delete_user used a hard-coded email allowlist; it now uses
--    public.is_master_admin(auth.uid()).
-- 3. tenant_id-taking SECURITY DEFINER RPCs that never checked the caller now
--    call public.assert_tenant_access(tenant) first. The guard only applies to
--    API callers (JWT role anon/authenticated): a member of the tenant or a
--    master admin passes; service_role and direct database sessions (cron,
--    internal) are unaffected. A NULL tenant (which several of these treat as
--    "all tenants") is master-admin/service only.
--
-- Signatures, return types, defaults, grants and bodies are otherwise
-- unchanged (bodies taken from pg_get_functiondef on production).

-- ---------------------------------------------------------------
-- 0. Shared tenant guard
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_tenant_access(p_tenant_id uuid)
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

  IF auth.uid() IS NOT NULL
     AND coalesce(public.is_master_admin(auth.uid()), false) THEN
    RETURN;
  END IF;

  IF p_tenant_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.users AS app_user
       WHERE app_user.id = auth.uid()
         AND app_user.tenant_id = p_tenant_id
     ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Access denied for this tenant' USING ERRCODE = '42501';
END;
$function$;

COMMENT ON FUNCTION public.assert_tenant_access(uuid) IS
  'Raises 42501 unless the API caller belongs to the tenant or is a master admin. service_role and non-API sessions pass. Called from SECURITY DEFINER RPCs.';

-- SECURITY INVOKER helper: only the definer functions (owner postgres) call it.
REVOKE ALL ON FUNCTION public.assert_tenant_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_tenant_access(uuid) TO service_role;

-- ---------------------------------------------------------------
-- 1. Master-admin guards on the budget/usage admin RPCs
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_reset_sync_usage_for_month(p_tenant_id uuid, p_month date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date, p_reset_value integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date);
  v_before_value INTEGER;
  v_after_value INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);

  SELECT sync_jobs_used
  INTO v_before_value
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  UPDATE public.org_usage_counters
  SET sync_jobs_used = GREATEST(COALESCE(p_reset_value, 0), 0),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT sync_jobs_used
  INTO v_after_value
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'month', v_month,
    'before', COALESCE(v_before_value, 0),
    'after', COALESCE(v_after_value, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_resync_tenant_budget(p_tenant_id uuid, p_month date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date, p_plan text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_before_budget JSONB;
  v_after_budget JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;
  SELECT to_jsonb(oub)
  INTO v_before_budget
  FROM public.org_usage_budgets oub
  WHERE oub.tenant_id = p_tenant_id
    AND oub.month = COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date);

  v_after_budget := public.sync_subscription_to_org_budget(p_tenant_id, p_month, p_plan);

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'month', COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date),
    'before_budget', v_before_budget,
    'after_budget', v_after_budget
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_backfill_subscription_budgets(p_month date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results JSONB := '[]'::jsonb;
  v_record RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;
  FOR v_record IN
    WITH ranked_subscriptions AS (
      SELECT
        u.tenant_id,
        COALESCE(
          NULLIF(lower(trim(s.tier)), ''),
          CASE
            WHEN s.plan::text IN ('seed', 'sprout', 'bloom', 'thrive') THEN s.plan::text
            ELSE NULL
          END
        ) AS effective_plan,
        ROW_NUMBER() OVER (
          PARTITION BY u.tenant_id
          ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
        ) AS row_number
      FROM public.subscriptions s
      JOIN public.users u ON u.id = s.user_id
      WHERE u.tenant_id IS NOT NULL
        AND s.deleted_at IS NULL
        AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
    )
    SELECT tenant_id, effective_plan
    FROM ranked_subscriptions
    WHERE row_number = 1
      AND effective_plan IN ('seed', 'sprout', 'bloom', 'thrive')
  LOOP
    v_results := v_results || jsonb_build_array(
      public.sync_subscription_to_org_budget(v_record.tenant_id, p_month, v_record.effective_plan)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'month', COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date),
    'tenants_updated', jsonb_array_length(v_results),
    'results', v_results
  );
END;
$function$;


-- ---------------------------------------------------------------
-- 2. admin_delete_user: master-admin check instead of an email allowlist
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow master admins to call this function
  IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
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
-- 3. Tenant guards on tenant_id-taking SECURITY DEFINER RPCs
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_nameless_customers(p_tenant_id uuid, p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count int;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  WITH to_delete AS (
    SELECT id 
    FROM crm_customers 
    WHERE tenant_id = p_tenant_id
      AND (first_name IS NULL OR TRIM(first_name) = '')
      AND (last_name IS NULL OR TRIM(last_name) = '')
    LIMIT p_limit
  )
  DELETE FROM crm_customers 
  WHERE id IN (SELECT id FROM to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_phone_duplicates(p_tenant_id uuid, p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count int;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  WITH phone_ranked AS (
    SELECT id, phone,
      ROW_NUMBER() OVER (
        PARTITION BY REGEXP_REPLACE(phone, '\D', '', 'g') 
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
      ) as rn
    FROM crm_customers 
    WHERE tenant_id = p_tenant_id
      AND phone IS NOT NULL 
      AND TRIM(phone) != ''
  ),
  to_delete AS (
    SELECT id FROM phone_ranked WHERE rn > 1 LIMIT p_limit
  )
  DELETE FROM crm_customers 
  WHERE id IN (SELECT id FROM to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_pos_sync_job(p_tenant_id uuid, p_provider pos_provider, p_sync_type pos_sync_type DEFAULT 'full'::pos_sync_type, p_estimated_rows integer DEFAULT 0, p_triggered_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
  v_gate JSONB;
  v_existing_job public.pos_sync_jobs_v2;
  v_job public.pos_sync_jobs_v2;
  v_is_master_admin BOOLEAN := COALESCE(public.is_master_admin(auth.uid()), false);
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);

  SELECT * INTO v_budget
  FROM public.org_usage_budgets
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT * INTO v_counter
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT *
  INTO v_existing_job
  FROM public.pos_sync_jobs_v2
  WHERE tenant_id = p_tenant_id
    AND provider = p_provider
    AND sync_type = COALESCE(p_sync_type, 'full')
    AND status IN ('pending', 'in_progress', 'delayed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_existing_job.id,
      'jobId', v_existing_job.id,
      'job_id', v_existing_job.id,
      'status', 'queued',
      'reason', 'already_queued',
      'message', 'A sync job is already queued for this tenant and sync type.',
      'success', true,
      'plan', v_budget.plan,
      'current', v_counter.sync_jobs_used,
      'max', v_budget.max_sync_jobs
    );
  END IF;

  v_gate := public.can_run_sync(p_tenant_id, p_provider);
  IF COALESCE((v_gate->>'allow')::boolean, false) = false THEN
    RETURN jsonb_build_object(
      'id', NULL,
      'jobId', NULL,
      'job_id', NULL,
      'status', 'denied',
      'reason', v_gate->>'reason',
      'message', COALESCE(v_gate->>'message', 'Sync could not be queued.'),
      'success', false,
      'plan', COALESCE(v_gate->>'plan', v_budget.plan),
      'current', COALESCE((v_gate->>'current')::integer, v_counter.sync_jobs_used),
      'max', COALESCE((v_gate->>'max')::integer, v_budget.max_sync_jobs)
    );
  END IF;

  INSERT INTO public.pos_sync_jobs_v2 (
    tenant_id,
    provider,
    sync_type,
    status,
    estimated_rows,
    triggered_by,
    scheduled_at,
    progress_message,
    batch_size,
    max_retries,
    created_at,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_provider,
    COALESCE(p_sync_type, 'full'),
    'pending',
    COALESCE(p_estimated_rows, 0),
    COALESCE(p_triggered_by, 'manual'),
    now(),
    'Queued - waiting to start',
    100,
    3,
    now(),
    now()
  )
  RETURNING * INTO v_job;

  IF NOT v_is_master_admin THEN
    UPDATE public.org_usage_counters
    SET sync_jobs_used = sync_jobs_used + 1,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND month = v_month;
  END IF;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'jobId', v_job.id,
    'job_id', v_job.id,
    'status', 'queued',
    'reason', 'queued',
    'message', 'Sync job queued successfully.',
    'success', true,
    'plan', v_budget.plan,
    'current', CASE
      WHEN v_is_master_admin THEN v_counter.sync_jobs_used
      ELSE v_counter.sync_jobs_used + 1
    END,
    'max', v_budget.max_sync_jobs
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_run_sync(p_org_id uuid, p_provider pos_provider)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
  v_max_concurrent INTEGER;
  v_current_active INTEGER;
  v_is_master_admin BOOLEAN := COALESCE(public.is_master_admin(auth.uid()), false);
BEGIN
  PERFORM public.assert_tenant_access(p_org_id);
  PERFORM public.ensure_org_usage_initialized(p_org_id);

  SELECT * INTO v_budget
  FROM public.org_usage_budgets
  WHERE tenant_id = p_org_id
    AND month = v_month;

  SELECT * INTO v_counter
  FROM public.org_usage_counters
  WHERE tenant_id = p_org_id
    AND month = v_month;

  SELECT COALESCE(pd.max_concurrent_jobs, 1)
  INTO v_max_concurrent
  FROM public.plan_definitions pd
  WHERE pd.plan = v_budget.plan;

  SELECT COUNT(*)
  INTO v_current_active
  FROM public.pos_sync_jobs_v2
  WHERE tenant_id = p_org_id
    AND provider = p_provider
    AND status = 'in_progress'
    AND started_at > now() - INTERVAL '30 minutes';

  IF NOT v_is_master_admin
     AND v_budget.max_sync_jobs >= 0
     AND (v_counter.sync_jobs_used + 1) > v_budget.max_sync_jobs THEN
    RETURN jsonb_build_object(
      'allow', false,
      'status', 'denied',
      'reason', 'monthly_limit_reached',
      'current', v_counter.sync_jobs_used,
      'max', v_budget.max_sync_jobs,
      'plan', v_budget.plan,
      'message', 'Monthly usage limit reached. Please upgrade your plan.'
    );
  END IF;

  IF v_max_concurrent >= 0
     AND v_current_active >= v_max_concurrent THEN
    RETURN jsonb_build_object(
      'allow', false,
      'status', 'denied',
      'reason', 'concurrent_limit_reached',
      'current', v_current_active,
      'max', v_max_concurrent,
      'plan', v_budget.plan,
      'message', 'Concurrent sync limit reached. Please wait for the active sync to finish.'
    );
  END IF;

  RETURN jsonb_build_object(
    'allow', true,
    'status', 'allow',
    'current', v_current_active,
    'max', v_max_concurrent,
    'plan', v_budget.plan,
    'message', 'Sync can be queued.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_run_sync(p_tenant_id uuid, p_estimated_rows integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);

  SELECT * INTO v_budget
  FROM public.org_usage_budgets
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT * INTO v_counter
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  IF v_budget.max_sync_jobs >= 0
     AND (v_counter.sync_jobs_used + 1) > v_budget.max_sync_jobs THEN
    RETURN 'deny';
  END IF;

  RETURN 'allow';
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_run_automation(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  -- Ensure initialized
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  
  -- Get budget and counter
  SELECT * INTO v_budget FROM public.org_usage_budgets WHERE tenant_id = p_tenant_id AND month = v_month;
  SELECT * INTO v_counter FROM public.org_usage_counters WHERE tenant_id = p_tenant_id AND month = v_month;
  
  -- Check limit
  IF v_counter.automation_runs_used >= v_budget.max_automation_runs THEN
    RETURN 'deny';
  END IF;
  
  RETURN 'allow';
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_send_sms(p_tenant_id uuid, p_count integer DEFAULT 1)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_month DATE := date_trunc('month', CURRENT_DATE)::date; v_budget RECORD; v_counter RECORD;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  SELECT * INTO v_budget FROM public.org_usage_budgets WHERE tenant_id = p_tenant_id AND month = v_month;
  SELECT * INTO v_counter FROM public.org_usage_counters WHERE tenant_id = p_tenant_id AND month = v_month;
  IF (v_counter.sms_sends_used + p_count) > v_budget.max_sms_sends THEN RETURN 'deny'; END IF;
  RETURN 'allow';
END; $function$;

CREATE OR REPLACE FUNCTION public.check_sms_quota(p_tenant_id uuid, p_estimated_units integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_quota int;
  v_usage int;
  v_remaining int;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  -- Find user for this tenant
  SELECT id INTO v_user_id
  FROM users
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'No user found for tenant',
      'quota', 0,
      'usage', 0,
      'remaining', 0,
      'estimatedUnits', p_estimated_units
    );
  END IF;
  
  -- Get quota and usage
  SELECT 
    COALESCE(sms_quota, 0),
    COALESCE(sms_usage, 0)
  INTO v_quota, v_usage
  FROM subscriptions
  WHERE user_id = v_user_id;
  
  IF v_quota IS NULL THEN
    v_quota := 0;
    v_usage := 0;
  END IF;
  
  v_remaining := v_quota - v_usage;
  
  RETURN jsonb_build_object(
    'allowed', v_remaining >= p_estimated_units,
    'quota', v_quota,
    'usage', v_usage,
    'remaining', v_remaining,
    'estimatedUnits', p_estimated_units
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_remaining_budget(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_month DATE := date_trunc('month', CURRENT_DATE)::date; v_budget RECORD; v_counter RECORD;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  SELECT * INTO v_budget FROM public.org_usage_budgets WHERE tenant_id = p_tenant_id AND month = v_month;
  SELECT * INTO v_counter FROM public.org_usage_counters WHERE tenant_id = p_tenant_id AND month = v_month;
  RETURN jsonb_build_object(
    'month', v_month, 'plan', v_budget.plan,
    'email_sends', jsonb_build_object('used', v_counter.email_sends_used, 'max', v_budget.max_email_sends, 'remaining', v_budget.max_email_sends - v_counter.email_sends_used),
    'sms_sends', jsonb_build_object('used', v_counter.sms_sends_used, 'max', v_budget.max_sms_sends, 'remaining', v_budget.max_sms_sends - v_counter.sms_sends_used),
    'sync_jobs', jsonb_build_object('used', v_counter.sync_jobs_used, 'max', v_budget.max_sync_jobs),
    'automation_runs', jsonb_build_object('used', v_counter.automation_runs_used, 'max', v_budget.max_automation_runs)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  next_number INTEGER;
  ticket_number TEXT;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(support_tickets.ticket_number FROM 'TKT-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM support_tickets
  WHERE support_tickets.tenant_id = p_tenant_id;
  
  ticket_number := 'TKT-' || LPAD(next_number::text, 6, '0');
  RETURN ticket_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_domain_email_stats_30d(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(domain_id uuid, domain_name text, tenant_id uuid, verification_status text, warmup_stage integer, daily_limit integer, daily_used integer, emails_sent_30d bigint, emails_delivered_30d bigint, emails_opened_30d bigint, emails_clicked_30d bigint, emails_bounced_30d bigint, emails_complained_30d bigint, open_rate_30d numeric, click_rate_30d numeric, bounce_rate_30d numeric, complaint_rate_30d numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  RETURN QUERY
  SELECT 
    s.domain_id,
    s.domain_name,
    s.tenant_id,
    s.verification_status,
    s.warmup_stage,
    s.daily_limit,
    s.daily_used,
    s.emails_sent_30d,
    s.emails_delivered_30d,
    s.emails_opened_30d,
    s.emails_clicked_30d,
    s.emails_bounced_30d,
    s.emails_complained_30d,
    s.open_rate_30d,
    s.click_rate_30d,
    s.bounce_rate_30d,
    s.complaint_rate_30d
  FROM email_domain_stats_30d s
  WHERE p_tenant_id IS NULL OR s.tenant_id = p_tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_content_intent_stats(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stats JSONB;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  SELECT jsonb_build_object(
    'total_customers', COUNT(*),
    'avg_intent_score', ROUND(AVG(intent_score), 2),
    'intent_level_breakdown', jsonb_build_object(
      'high', COUNT(*) FILTER (WHERE intent_level = 'high'),
      'medium', COUNT(*) FILTER (WHERE intent_level = 'medium'),
      'low', COUNT(*) FILTER (WHERE intent_level = 'low'),
      'unknown', COUNT(*) FILTER (WHERE intent_level = 'unknown')
    ),
    'avg_engagement_depth_score', ROUND(AVG(engagement_depth_score), 2),
    'avg_click_pattern_consistency', ROUND(AVG(click_pattern_consistency_score), 2),
    'avg_message_relevance_score', ROUND(AVG(message_relevance_score), 2),
    'content_type_performance', jsonb_build_object(
      'story_avg_engagement', ROUND(AVG(story_engagement_rate), 2),
      'offer_avg_engagement', ROUND(AVG(offer_engagement_rate), 2)
    ),
    'edu_vs_promo_preference', jsonb_build_object(
      'educational_preferred', COUNT(*) FILTER (WHERE content_preference = 'educational'),
      'promotional_preferred', COUNT(*) FILTER (WHERE content_preference = 'promotional'),
      'balanced', COUNT(*) FILTER (WHERE content_preference = 'balanced')
    ),
    'avg_cta_click_rate', ROUND(AVG(cta_click_rate), 2),
    'avg_brand_story_open_rate', ROUND(AVG(brand_story_open_rate), 2)
  ) INTO v_stats
  FROM customer_content_intent_metrics
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_stats;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_lifecycle_stats(p_tenant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  SELECT json_build_object(
    'lifecycle_stage_breakdown', json_build_object(
      'new', COUNT(*) FILTER (WHERE lifecycle_stage = 'new'),
      'engaged', COUNT(*) FILTER (WHERE lifecycle_stage = 'engaged'),
      'active_buyer', COUNT(*) FILTER (WHERE lifecycle_stage = 'active_buyer'),
      'loyal', COUNT(*) FILTER (WHERE lifecycle_stage = 'loyal'),
      'at_risk', COUNT(*) FILTER (WHERE lifecycle_stage = 'at_risk'),
      'dormant', COUNT(*) FILTER (WHERE lifecycle_stage = 'dormant'),
      'churned', COUNT(*) FILTER (WHERE lifecycle_stage = 'churned')
    ),
    'avg_days_since_signup', COALESCE(AVG(days_since_signup), 0),
    'avg_days_since_last_purchase', COALESCE(AVG(days_since_last_purchase), 0),
    'avg_days_since_last_engagement', COALESCE(AVG(days_since_last_engagement), 0),
    'avg_days_since_last_automation', COALESCE(AVG(days_since_last_automation), 0),
    'overall_churn_rate', CASE 
      WHEN COUNT(*) > 0 
      THEN (COUNT(*) FILTER (WHERE is_churned)::NUMERIC / COUNT(*)) * 100 
      ELSE 0 END,
    'overall_reactivation_success_rate', COALESCE(AVG(reactivation_success_rate), 0),
    'avg_time_to_churn_days', AVG(time_to_churn_days),
    'avg_time_to_reactivation_days', AVG(time_to_reactivation_days),
    'at_risk_customer_count', COUNT(*) FILTER (WHERE lifecycle_stage = 'at_risk'),
    'customers_churned_last_30d', COUNT(*) FILTER (WHERE churned_at > NOW() - INTERVAL '30 days'),
    'customers_reactivated_last_30d', COUNT(*) FILTER (WHERE reactivated_at > NOW() - INTERVAL '30 days')
  ) INTO v_result
  FROM customer_lifecycle_metrics
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_risk_stats(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  SELECT jsonb_build_object(
    'total_customers', COUNT(*),
    'risk_level_breakdown', jsonb_build_object(
      'minimal', COUNT(*) FILTER (WHERE risk_level = 'minimal'),
      'low', COUNT(*) FILTER (WHERE risk_level = 'low'),
      'moderate', COUNT(*) FILTER (WHERE risk_level = 'moderate'),
      'high', COUNT(*) FILTER (WHERE risk_level = 'high'),
      'critical', COUNT(*) FILTER (WHERE risk_level = 'critical')
    ),
    'avg_overall_risk_score', ROUND(AVG(overall_risk_score)::NUMERIC, 1),
    'rapid_opt_out_count', COUNT(*) FILTER (WHERE is_rapid_opt_out = TRUE),
    'avg_ignore_streak', ROUND(AVG(current_ignore_streak)::NUMERIC, 1),
    'coupon_dependent_count', COUNT(*) FILTER (WHERE is_coupon_dependent = TRUE),
    'long_term_dormant_count', COUNT(*) FILTER (WHERE is_long_term_dormant = TRUE),
    'hard_bounce_count', COUNT(*) FILTER (WHERE total_hard_bounces > 0),
    'suppressed_count', COUNT(*) FILTER (WHERE should_suppress = TRUE),
    'risk_trend_distribution', jsonb_build_object(
      'improving', COUNT(*) FILTER (WHERE risk_trend = 'improving'),
      'stable', COUNT(*) FILTER (WHERE risk_trend = 'stable'),
      'worsening', COUNT(*) FILTER (WHERE risk_trend = 'worsening')
    )
  ) INTO v_result
  FROM customer_risk_signals
  WHERE tenant_id = p_tenant_id;
  
  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_all_content_intent_metrics(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer RECORD;
  v_count INTEGER := 0;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  FOR v_customer IN 
    SELECT id FROM crm_customers WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_content_intent_metrics(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_all_cross_channel_metrics(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_customer RECORD;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  FOR v_customer IN
    SELECT DISTINCT c.id, c.tenant_id
    FROM public.crm_customers c
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  LOOP
    -- Ensure record exists
    INSERT INTO public.customer_cross_channel_metrics (customer_id, tenant_id)
    VALUES (v_customer.id, v_customer.tenant_id)
    ON CONFLICT (customer_id) DO NOTHING;
    
    -- Recalculate scores
    PERFORM public.recalculate_cross_channel_scores(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_all_lifecycle_metrics(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_count INTEGER := 0;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  FOR v_customer_id IN 
    SELECT id FROM crm_customers WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_lifecycle_metrics(v_customer_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_all_loyalty_metrics(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_count INTEGER := 0;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  FOR v_customer_id IN 
    SELECT customer_id FROM customer_loyalty_metrics WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_loyalty_metrics(v_customer_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_all_post_purchase_metrics(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer RECORD;
  v_count INTEGER := 0;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  FOR v_customer IN 
    SELECT id FROM crm_customers 
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  LOOP
    PERFORM recalculate_post_purchase_metrics(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_all_risk_signals(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_count INTEGER := 0;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  FOR v_customer_id IN
    SELECT id FROM crm_customers WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_risk_signals(v_customer_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_customer_rollups(p_tenant_id uuid, p_pos_source text DEFAULT 'vmx'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE updated_count integer;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  UPDATE crm_customers c
  SET total_spent = s.total_spent,
      last_visit_date = s.last_visit,
      updated_at = now()
  FROM (
    SELECT external_customer_id,
           SUM(COALESCE(subtotal,0) + COALESCE(tax,0)) AS total_spent,
           MAX(post_date) AS last_visit
    FROM pos_receipts
    WHERE tenant_id = p_tenant_id
      AND external_customer_id IS NOT NULL
    GROUP BY external_customer_id
  ) s
  WHERE c.tenant_id = p_tenant_id
    AND c.pos_source = p_pos_source
    AND c.external_id = s.external_customer_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END; $function$;

CREATE OR REPLACE FUNCTION public.record_contact_import_event(p_tenant_id uuid, p_source text, p_contact_count integer, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(tenant_id uuid, source text, contact_count integer, rolling_24h_total integer, occurred_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_rolling_24h_total INTEGER := 0;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF COALESCE(p_contact_count, 0) <= 0 THEN
    RAISE EXCEPTION 'p_contact_count must be > 0';
  END IF;

  INSERT INTO public.email_governance_contact_import_events (
    tenant_id,
    source,
    contact_count,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    COALESCE(NULLIF(trim(p_source), ''), 'unknown'),
    p_contact_count,
    COALESCE(p_metadata, '{}'::jsonb),
    v_now
  );

  SELECT COALESCE(SUM(e.contact_count), 0)::INTEGER
  INTO v_rolling_24h_total
  FROM public.email_governance_contact_import_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.occurred_at >= v_now - INTERVAL '24 hours'
    AND e.occurred_at <= v_now;

  tenant_id := p_tenant_id;
  source := COALESCE(NULLIF(trim(p_source), ''), 'unknown');
  contact_count := p_contact_count;
  rolling_24h_total := v_rolling_24h_total;
  occurred_at := v_now;

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_global_image_usage(p_image_id uuid, p_tenant_id uuid, p_user_id uuid, p_context text, p_campaign_id uuid DEFAULT NULL::uuid, p_block_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_new_tenant BOOLEAN;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  -- Check if this is first use by this tenant
  SELECT NOT EXISTS (
    SELECT 1 FROM public.image_tenant_usage 
    WHERE image_id = p_image_id AND tenant_id = p_tenant_id
  ) INTO v_is_new_tenant;
  
  -- Update global image counters
  UPDATE public.global_image_gallery
  SET 
    total_usage_count = total_usage_count + 1,
    unique_tenant_count = CASE 
      WHEN v_is_new_tenant THEN unique_tenant_count + 1 
      ELSE unique_tenant_count 
    END,
    last_used_at = now(),
    updated_at = now()
  WHERE id = p_image_id;
  
  -- Insert or update tenant usage record
  INSERT INTO public.image_tenant_usage (
    image_id, tenant_id, user_id, used_in_context,
    campaign_id, block_id, usage_count, last_used_at
  )
  VALUES (
    p_image_id, p_tenant_id, p_user_id, p_context,
    p_campaign_id, p_block_id, 1, now()
  )
  ON CONFLICT (image_id, tenant_id, block_id)
  DO UPDATE SET
    usage_count = image_tenant_usage.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
END;
$function$;

-- These two were LANGUAGE sql; they become plpgsql so the guard can run
-- first. Signature, return type and query are unchanged.

CREATE OR REPLACE FUNCTION public.get_active_sync_job_count(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  RETURN (
    SELECT COUNT(*)::integer FROM public.pos_sync_jobs_v2 WHERE tenant_id = p_tenant_id AND status IN ('pending', 'in_progress', 'delayed')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_email_consent_stats(p_tenant_id uuid)
 RETURNS TABLE(total_customers bigint, opted_in_count bigint, opted_out_count bigint, unknown_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  RETURN QUERY
  SELECT
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE crm_customers.email_opt_in = true) as opted_in_count,
    COUNT(*) FILTER (WHERE crm_customers.email_opt_in = false) as opted_out_count,
    COUNT(*) FILTER (WHERE crm_customers.email_opt_in IS NULL AND crm_customers.email IS NOT NULL) as unknown_count
  FROM crm_customers
  WHERE crm_customers.tenant_id = p_tenant_id
    AND crm_customers.email IS NOT NULL;
END;
$function$;

-- ---------------------------------------------------------------
-- 4. Grants for the three budget admin RPCs (no anon/PUBLIC access)
-- ---------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.admin_reset_sync_usage_for_month(uuid, date, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resync_tenant_budget(uuid, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_backfill_subscription_budgets(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_sync_usage_for_month(uuid, date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_resync_tenant_budget(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_backfill_subscription_budgets(date) TO authenticated, service_role;
