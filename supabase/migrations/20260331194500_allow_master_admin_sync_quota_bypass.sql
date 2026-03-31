CREATE OR REPLACE FUNCTION public.can_run_sync(p_org_id UUID, p_provider pos_provider)
RETURNS JSONB
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

CREATE OR REPLACE FUNCTION public.enqueue_pos_sync_job(
  p_tenant_id UUID,
  p_provider pos_provider,
  p_sync_type pos_sync_type DEFAULT 'full',
  p_estimated_rows INTEGER DEFAULT 0,
  p_triggered_by TEXT DEFAULT NULL
)
RETURNS JSONB
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

NOTIFY pgrst, 'reload schema';