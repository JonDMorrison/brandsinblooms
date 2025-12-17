-- =====================================================
-- GLOBAL CONCURRENCY LIMITER FOR POS SYNC JOBS
-- Limits parallel jobs to 4 across all tenants
-- =====================================================

-- 1. Create system_config table for platform-wide settings
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to system_config" ON public.system_config
  FOR SELECT USING (true);

-- Insert default configuration values
INSERT INTO public.system_config (key, value, description) VALUES 
  ('max_global_concurrent_sync_jobs', '4', 'Maximum number of POS sync jobs that can run in parallel across all tenants'),
  ('sync_job_timeout_minutes', '30', 'Maximum minutes a job can be in_progress before considered stale')
ON CONFLICT (key) DO NOTHING;

-- 2. Create helper function to get global in-progress count
CREATE OR REPLACE FUNCTION public.get_global_in_progress_count()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer 
  FROM public.pos_sync_jobs_v2 
  WHERE status = 'in_progress'
    AND started_at > now() - INTERVAL '30 minutes';
$$;

-- 3. Update claim_next_pos_sync_job with global concurrency limit
CREATE OR REPLACE FUNCTION public.claim_next_pos_sync_job(p_provider pos_provider DEFAULT NULL)
RETURNS pos_sync_jobs_v2
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.pos_sync_jobs_v2;
  v_max_global INTEGER;
  v_current_in_progress INTEGER;
BEGIN
  -- Get global concurrency limit from config
  SELECT (value#>>'{}')::integer INTO v_max_global
  FROM public.system_config 
  WHERE key = 'max_global_concurrent_sync_jobs';
  
  -- Default to 4 if not configured
  v_max_global := COALESCE(v_max_global, 4);
  
  -- Count current in-progress jobs globally (exclude stale jobs older than 30 min)
  SELECT COUNT(*) INTO v_current_in_progress
  FROM public.pos_sync_jobs_v2 
  WHERE status = 'in_progress'
    AND started_at > now() - INTERVAL '30 minutes';
  
  -- If at global limit, don't claim any job
  IF v_current_in_progress >= v_max_global THEN
    RAISE NOTICE 'Global concurrency limit reached: %/% jobs in progress', v_current_in_progress, v_max_global;
    RETURN NULL;
  END IF;
  
  -- Get and lock next available job (SKIP LOCKED prevents deadlocks)
  SELECT * INTO v_job
  FROM public.pos_sync_jobs_v2
  WHERE status IN ('pending', 'delayed')
    AND (p_provider IS NULL OR provider = p_provider)
    AND scheduled_at <= now()
    AND (next_retry_at IS NULL OR next_retry_at <= now())
  ORDER BY scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Mark as in_progress
  UPDATE public.pos_sync_jobs_v2
  SET status = 'in_progress', 
      started_at = now(), 
      updated_at = now(), 
      attempts = attempts + 1
  WHERE id = v_job.id;
  
  -- Return updated job
  v_job.status := 'in_progress';
  v_job.started_at := now();
  
  RETURN v_job;
END;
$function$;

-- 4. Fix can_run_sync to use pos_sync_jobs_v2 instead of pos_sync_jobs
CREATE OR REPLACE FUNCTION public.can_run_sync(p_org_id uuid, p_provider pos_provider)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_concurrent INTEGER;
  v_current_active INTEGER;
  v_result jsonb;
BEGIN
  -- Get plan limit for concurrent syncs (default 2)
  SELECT COALESCE(
    (SELECT (pd.limits->>'max_concurrent_syncs')::integer 
     FROM org_usage_budgets oub
     JOIN plan_definitions pd ON pd.plan_key = oub.plan_key
     WHERE oub.org_id = p_org_id),
    2
  ) INTO v_max_concurrent;
  
  -- Count active syncs for this org using pos_sync_jobs_v2 (FIXED: was using pos_sync_jobs)
  SELECT COUNT(*) INTO v_current_active
  FROM public.pos_sync_jobs_v2
  WHERE tenant_id = p_org_id
    AND provider = p_provider
    AND status = 'in_progress';
  
  -- Check if can run
  IF v_current_active >= v_max_concurrent THEN
    v_result := jsonb_build_object(
      'allow', false,
      'reason', 'concurrent_limit_reached',
      'current', v_current_active,
      'max', v_max_concurrent
    );
  ELSE
    v_result := jsonb_build_object(
      'allow', true,
      'current', v_current_active,
      'max', v_max_concurrent
    );
  END IF;
  
  RETURN v_result;
END;
$function$;

-- 5. Create cleanup function for stale jobs (prevents queue blocking)
CREATE OR REPLACE FUNCTION public.cleanup_stale_sync_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_timeout_minutes INTEGER;
  v_cleaned_count INTEGER;
BEGIN
  -- Get timeout from config
  SELECT (value#>>'{}')::integer INTO v_timeout_minutes
  FROM public.system_config 
  WHERE key = 'sync_job_timeout_minutes';
  
  v_timeout_minutes := COALESCE(v_timeout_minutes, 30);
  
  -- Mark stale jobs as failed
  WITH stale_jobs AS (
    UPDATE public.pos_sync_jobs_v2
    SET status = 'failed',
        last_error = 'Job timed out after ' || v_timeout_minutes || ' minutes',
        updated_at = now()
    WHERE status = 'in_progress'
      AND started_at < now() - (v_timeout_minutes || ' minutes')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cleaned_count FROM stale_jobs;
  
  IF v_cleaned_count > 0 THEN
    RAISE NOTICE 'Cleaned up % stale sync jobs', v_cleaned_count;
  END IF;
  
  RETURN v_cleaned_count;
END;
$function$;

-- 6. Create function to get queue status for monitoring
CREATE OR REPLACE FUNCTION public.get_sync_queue_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_global INTEGER;
  v_in_progress INTEGER;
  v_pending INTEGER;
  v_delayed INTEGER;
  v_failed_today INTEGER;
  v_completed_today INTEGER;
BEGIN
  -- Get config
  SELECT (value#>>'{}')::integer INTO v_max_global
  FROM public.system_config 
  WHERE key = 'max_global_concurrent_sync_jobs';
  v_max_global := COALESCE(v_max_global, 4);
  
  -- Count by status
  SELECT COUNT(*) INTO v_in_progress
  FROM public.pos_sync_jobs_v2 
  WHERE status = 'in_progress'
    AND started_at > now() - INTERVAL '30 minutes';
    
  SELECT COUNT(*) INTO v_pending
  FROM public.pos_sync_jobs_v2 
  WHERE status = 'pending';
  
  SELECT COUNT(*) INTO v_delayed
  FROM public.pos_sync_jobs_v2 
  WHERE status = 'delayed';
  
  SELECT COUNT(*) INTO v_failed_today
  FROM public.pos_sync_jobs_v2 
  WHERE status = 'failed'
    AND updated_at > now() - INTERVAL '24 hours';
    
  SELECT COUNT(*) INTO v_completed_today
  FROM public.pos_sync_jobs_v2 
  WHERE status = 'completed'
    AND updated_at > now() - INTERVAL '24 hours';
  
  RETURN jsonb_build_object(
    'max_concurrent', v_max_global,
    'in_progress', v_in_progress,
    'slots_available', GREATEST(0, v_max_global - v_in_progress),
    'pending', v_pending,
    'delayed', v_delayed,
    'failed_24h', v_failed_today,
    'completed_24h', v_completed_today,
    'queue_full', v_in_progress >= v_max_global
  );
END;
$function$;