-- M2: queue scaling, progress tracking, and self-healing support for large campaigns.

ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS total_recipients integer,
  ADD COLUMN IF NOT EXISTS total_batches integer,
  ADD COLUMN IF NOT EXISTS messages_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_failed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_skipped integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queue_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_completion_at timestamptz,
  ADD COLUMN IF NOT EXISTS stall_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.crm_campaigns.total_recipients IS
  'Resolved recipient denominator used for queue progress and ETA calculations.';
COMMENT ON COLUMN public.crm_campaigns.total_batches IS
  'Total send-job batches scheduled for the campaign queue.';
COMMENT ON COLUMN public.crm_campaigns.messages_sent IS
  'Running count of successfully sent campaign messages.';
COMMENT ON COLUMN public.crm_campaigns.messages_failed IS
  'Running count of campaign messages that failed permanently.';
COMMENT ON COLUMN public.crm_campaigns.messages_skipped IS
  'Running count of campaign recipients skipped during queueing.';
COMMENT ON COLUMN public.crm_campaigns.queue_started_at IS
  'Timestamp when the queue builder began inserting messages/jobs.';
COMMENT ON COLUMN public.crm_campaigns.queue_completed_at IS
  'Timestamp when all queue messages/jobs were created successfully.';
COMMENT ON COLUMN public.crm_campaigns.send_completed_at IS
  'Timestamp when campaign delivery finalized.';
COMMENT ON COLUMN public.crm_campaigns.worker_heartbeat_at IS
  'Timestamp of the most recent worker progress heartbeat.';
COMMENT ON COLUMN public.crm_campaigns.estimated_completion_at IS
  'Moving ETA derived from current observed send throughput.';
COMMENT ON COLUMN public.crm_campaigns.stall_count IS
  'Count of automated stall recoveries detected by campaign_health_check.';

CREATE TABLE IF NOT EXISTS public.campaign_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_health_events_campaign_created_at
  ON public.campaign_health_events (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_health_events_event_type_created_at
  ON public.campaign_health_events (event_type, created_at DESC);

ALTER TABLE public.campaign_health_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.campaign_health_events FROM anon, authenticated;
GRANT ALL ON TABLE public.campaign_health_events TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_crm_campaigns_pipeline_columns_service_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.queued_at IS NOT NULL
      OR NEW.total_recipients IS NOT NULL
      OR NEW.total_batches IS NOT NULL
      OR COALESCE(NEW.messages_sent, 0) <> 0
      OR COALESCE(NEW.messages_failed, 0) <> 0
      OR COALESCE(NEW.messages_skipped, 0) <> 0
      OR NEW.queue_started_at IS NOT NULL
      OR NEW.queue_completed_at IS NOT NULL
      OR NEW.send_started_at IS NOT NULL
      OR NEW.send_completed_at IS NOT NULL
      OR NEW.sent_at IS NOT NULL
      OR NEW.worker_heartbeat_at IS NOT NULL
      OR NEW.estimated_completion_at IS NOT NULL
      OR COALESCE(NEW.stall_count, 0) <> 0 THEN
      RAISE EXCEPTION 'Campaign pipeline progress columns are managed by the send pipeline';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.queued_at IS DISTINCT FROM OLD.queued_at
    OR NEW.total_recipients IS DISTINCT FROM OLD.total_recipients
    OR NEW.total_batches IS DISTINCT FROM OLD.total_batches
    OR NEW.messages_sent IS DISTINCT FROM OLD.messages_sent
    OR NEW.messages_failed IS DISTINCT FROM OLD.messages_failed
    OR NEW.messages_skipped IS DISTINCT FROM OLD.messages_skipped
    OR NEW.queue_started_at IS DISTINCT FROM OLD.queue_started_at
    OR NEW.queue_completed_at IS DISTINCT FROM OLD.queue_completed_at
    OR NEW.send_started_at IS DISTINCT FROM OLD.send_started_at
    OR NEW.send_completed_at IS DISTINCT FROM OLD.send_completed_at
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.worker_heartbeat_at IS DISTINCT FROM OLD.worker_heartbeat_at
    OR NEW.estimated_completion_at IS DISTINCT FROM OLD.estimated_completion_at
    OR NEW.stall_count IS DISTINCT FROM OLD.stall_count THEN
    RAISE EXCEPTION 'Campaign pipeline progress columns are managed by the send pipeline';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_campaigns_enforce_queued_at_service_role
ON public.crm_campaigns;

CREATE TRIGGER crm_campaigns_enforce_queued_at_service_role
BEFORE INSERT OR UPDATE ON public.crm_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.enforce_crm_campaigns_pipeline_columns_service_role();

CREATE OR REPLACE FUNCTION public.record_campaign_send_progress(
  p_campaign_id uuid,
  p_sent_delta integer DEFAULT 0,
  p_failed_delta integer DEFAULT 0,
  p_skipped_delta integer DEFAULT 0,
  p_worker_heartbeat_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  messages_sent integer,
  messages_failed integer,
  messages_skipped integer,
  total_recipients integer,
  estimated_completion_at timestamptz,
  worker_heartbeat_at timestamptz,
  send_started_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.crm_campaigns%ROWTYPE;
  v_now timestamptz := COALESCE(p_worker_heartbeat_at, now());
  v_processed_total integer;
  v_remaining integer;
  v_elapsed_seconds numeric;
  v_rate_per_second numeric;
  v_estimated timestamptz;
  v_send_started_at timestamptz;
BEGIN
  SELECT *
  INTO v_row
  FROM public.crm_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_send_started_at := COALESCE(v_row.send_started_at, v_now);

  messages_sent := COALESCE(v_row.messages_sent, 0) + GREATEST(COALESCE(p_sent_delta, 0), 0);
  messages_failed := COALESCE(v_row.messages_failed, 0) + GREATEST(COALESCE(p_failed_delta, 0), 0);
  messages_skipped := COALESCE(v_row.messages_skipped, 0) + GREATEST(COALESCE(p_skipped_delta, 0), 0);
  total_recipients := v_row.total_recipients;

  IF total_recipients IS NOT NULL THEN
    v_processed_total := messages_sent + messages_failed + messages_skipped;
    v_remaining := GREATEST(total_recipients - v_processed_total, 0);
    v_elapsed_seconds := GREATEST(EXTRACT(EPOCH FROM (v_now - v_send_started_at)), 1);

    IF v_processed_total > 0 THEN
      v_rate_per_second := v_processed_total::numeric / v_elapsed_seconds;

      IF v_remaining = 0 THEN
        v_estimated := v_now;
      ELSIF v_rate_per_second > 0 THEN
        v_estimated := v_now + make_interval(secs => CEIL(v_remaining / v_rate_per_second)::integer);
      END IF;
    END IF;
  END IF;

  UPDATE public.crm_campaigns c
  SET
    status = CASE
      WHEN c.status IN ('queued', 'partially_queued') THEN 'sending'
      ELSE c.status
    END,
    messages_sent = record_campaign_send_progress.messages_sent,
    messages_failed = record_campaign_send_progress.messages_failed,
    messages_skipped = record_campaign_send_progress.messages_skipped,
    worker_heartbeat_at = v_now,
    estimated_completion_at = COALESCE(v_estimated, c.estimated_completion_at),
    send_started_at = COALESCE(c.send_started_at, v_send_started_at),
    updated_at = v_now
  WHERE c.id = p_campaign_id;

  estimated_completion_at := COALESCE(v_estimated, v_row.estimated_completion_at);
  worker_heartbeat_at := v_now;
  send_started_at := v_send_started_at;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.record_campaign_send_progress(uuid, integer, integer, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_campaign_send_progress(uuid, integer, integer, integer, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_jobs_for_queued_email_messages(
  p_campaign_id uuid,
  p_batch_size integer DEFAULT 200,
  p_jobs_per_minute integer DEFAULT 6,
  p_immediate_job_count integer DEFAULT 6,
  p_activate_sending boolean DEFAULT true
)
RETURNS TABLE (
  queued_count integer,
  jobs_created integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid;
  v_actor_tenant_id uuid;

  v_campaign_user_id uuid;
  v_campaign_tenant_id uuid;
  v_effective_tenant_id uuid;
  v_domain_id uuid;

  v_base_batch_index integer;
  v_jobs_per_minute integer := GREATEST(COALESCE(p_jobs_per_minute, 1), 1);
  v_immediate_job_count integer := GREATEST(COALESCE(p_immediate_job_count, 0), 0);
  v_now timestamptz := now();
BEGIN
  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF current_user NOT IN ('postgres', 'service_role') THEN
    v_actor_user_id := auth.uid();
    IF v_actor_user_id IS NULL THEN
      RETURN;
    END IF;

    SELECT u.tenant_id
    INTO v_actor_tenant_id
    FROM public.users u
    WHERE u.id = v_actor_user_id;

    v_effective_tenant_id := v_campaign_tenant_id;

    IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
      SELECT u.tenant_id
      INTO v_effective_tenant_id
      FROM public.users u
      WHERE u.id = v_campaign_user_id;
    END IF;

    IF v_effective_tenant_id IS NULL THEN
      SELECT s.tenant_id
      INTO v_effective_tenant_id
      FROM public.crm_campaigns c
      JOIN public.crm_segments s ON s.id = c.segment_id
      WHERE c.id = p_campaign_id
      LIMIT 1;
    END IF;

    IF v_effective_tenant_id IS NULL THEN
      SELECT s.tenant_id
      INTO v_effective_tenant_id
      FROM public.campaign_segments cs
      JOIN public.crm_segments s ON s.id = cs.segment_id
      WHERE cs.campaign_id = p_campaign_id
      LIMIT 1;
    END IF;

    IF v_campaign_user_id = v_actor_user_id THEN
      NULL;
    ELSIF v_actor_tenant_id IS NOT NULL
      AND v_effective_tenant_id IS NOT NULL
      AND v_actor_tenant_id = v_effective_tenant_id THEN
      NULL;
    ELSE
      RETURN;
    END IF;
  ELSE
    v_effective_tenant_id := v_campaign_tenant_id;

    IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
      SELECT u.tenant_id
      INTO v_effective_tenant_id
      FROM public.users u
      WHERE u.id = v_campaign_user_id;
    END IF;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 THEN
    p_batch_size := 200;
  END IF;

  SELECT COUNT(*)::integer
  INTO queued_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.status = 'queued';

  IF queued_count = 0 THEN
    jobs_created := 0;
    RETURN QUERY SELECT queued_count, jobs_created;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1)
  INTO v_base_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  WITH unjobbed AS (
    SELECT
      m.id,
      m.customer_id,
      m.email,
      row_number() OVER (ORDER BY m.id) AS rn
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.status = 'queued'
      AND NOT EXISTS (
        SELECT 1
        FROM public.email_send_jobs j
        WHERE j.campaign_id = p_campaign_id
          AND m.id = ANY(COALESCE(j.recipient_message_ids, ARRAY[]::uuid[]))
      )
  ),
  batches AS (
    SELECT
      floor((rn - 1)::numeric / p_batch_size)::integer AS batch_group,
      jsonb_agg(
        jsonb_build_object('customerId', customer_id, 'email', email)
        ORDER BY rn
      ) AS recipient_emails,
      array_agg(id ORDER BY rn)::uuid[] AS recipient_message_ids
    FROM unjobbed
    GROUP BY 1
  ),
  inserted AS (
    INSERT INTO public.email_send_jobs (
      campaign_id,
      tenant_id,
      domain_id,
      status,
      recipient_emails,
      recipient_message_ids,
      batch_index,
      available_at,
      error_message,
      attempts,
      emails_sent,
      emails_failed,
      created_at,
      updated_at
    )
    SELECT
      p_campaign_id,
      v_effective_tenant_id,
      v_domain_id,
      'pending',
      b.recipient_emails,
      b.recipient_message_ids,
      v_base_batch_index + b.batch_group + 1,
      CASE
        WHEN b.batch_group < v_immediate_job_count THEN v_now
        ELSE v_now + make_interval(
          secs => (
            floor((b.batch_group - v_immediate_job_count)::numeric / v_jobs_per_minute) * 60
            + floor(mod((b.batch_group - v_immediate_job_count)::numeric, v_jobs_per_minute::numeric) * (60.0 / v_jobs_per_minute))
          )::integer
        )
      END,
      NULL,
      0,
      0,
      0,
      v_now,
      v_now
    FROM batches b
    ON CONFLICT (campaign_id, batch_index) DO NOTHING
    RETURNING 1
  )
  SELECT COALESCE(COUNT(*), 0)::integer
  INTO jobs_created
  FROM inserted;

  IF jobs_created > 0 AND COALESCE(p_activate_sending, true) THEN
    UPDATE public.crm_campaigns c
    SET
      status = CASE
        WHEN c.status IN ('queued', 'partially_queued', 'paused') THEN 'sending'
        ELSE c.status
      END,
      send_error = NULL,
      send_blocked_reason = NULL,
      send_started_at = COALESCE(c.send_started_at, v_now),
      worker_heartbeat_at = v_now,
      updated_at = v_now
    WHERE c.id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT queued_count, jobs_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_jobs_for_queued_email_messages(uuid, integer, integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_jobs_for_queued_email_messages(uuid, integer, integer, integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.campaign_health_check(
  p_stale_worker_minutes integer DEFAULT 5,
  p_stale_queue_minutes integer DEFAULT 10
)
RETURNS TABLE (
  stalled_campaigns integer,
  partially_queued_campaigns integer,
  orphaned_jobs_released integer,
  stale_messages_reset integer,
  events_logged integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_stalled_interval interval := make_interval(mins => GREATEST(COALESCE(p_stale_worker_minutes, 5), 1));
  v_partial_interval interval := make_interval(mins => GREATEST(COALESCE(p_stale_queue_minutes, 10), 1));
  v_event_count integer := 0;
  v_impacted_campaign_ids uuid[] := ARRAY[]::uuid[];
  v_recovery_batch_size integer;
  v_jobs_created integer;
  v_rate_jobs_per_minute integer;
  v_immediate_job_count integer;
  rec record;
BEGIN
  stalled_campaigns := 0;
  partially_queued_campaigns := 0;
  orphaned_jobs_released := 0;
  stale_messages_reset := 0;
  events_logged := 0;

  WITH orphaned_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'pending',
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      available_at = v_now,
      error_message = COALESCE(j.error_message, 'Recovered by campaign_health_check'),
      updated_at = v_now
    WHERE j.status = 'in_progress'
      AND j.claimed_at IS NOT NULL
      AND j.claimed_at < (v_now - v_stalled_interval)
    RETURNING j.campaign_id
  )
  SELECT COALESCE(COUNT(*), 0)::integer,
         COALESCE(array_agg(DISTINCT campaign_id), ARRAY[]::uuid[])
  INTO orphaned_jobs_released, v_impacted_campaign_ids
  FROM orphaned_jobs;

  WITH stale_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = v_now
    WHERE m.status = 'sending'
      AND m.resend_id IS NULL
      AND m.claimed_at IS NOT NULL
      AND m.claimed_at < (v_now - v_stalled_interval)
    RETURNING m.campaign_id
  )
  SELECT COALESCE(COUNT(*), 0)::integer,
         COALESCE(v_impacted_campaign_ids, ARRAY[]::uuid[]) || COALESCE(array_agg(DISTINCT campaign_id), ARRAY[]::uuid[])
  INTO stale_messages_reset, v_impacted_campaign_ids
  FROM stale_messages;

  FOR rec IN
    SELECT c.id, c.tenant_id, c.total_recipients
    FROM public.crm_campaigns c
    WHERE c.status IN ('sending', 'queued')
      AND COALESCE(c.worker_heartbeat_at, c.send_started_at, c.queued_at, c.updated_at) < (v_now - v_stalled_interval)
  LOOP
    stalled_campaigns := stalled_campaigns + 1;
    v_impacted_campaign_ids := array_append(v_impacted_campaign_ids, rec.id);

    INSERT INTO public.campaign_health_events (campaign_id, tenant_id, event_type, message, metadata)
    VALUES (
      rec.id,
      rec.tenant_id,
      'worker_stall_recovered',
      'Recovered a stalled campaign worker by releasing stale claims.',
      jsonb_build_object(
        'detected_at', v_now,
        'stale_after_minutes', GREATEST(COALESCE(p_stale_worker_minutes, 5), 1)
      )
    );
    v_event_count := v_event_count + 1;

    v_recovery_batch_size := CASE
      WHEN COALESCE(rec.total_recipients, 0) > 50000 THEN 250
      WHEN COALESCE(rec.total_recipients, 0) > 10000 THEN 200
      WHEN COALESCE(rec.total_recipients, 0) > 1000 THEN 100
      ELSE 50
    END;
    v_rate_jobs_per_minute := GREATEST(2, floor(1500.0 / GREATEST(v_recovery_batch_size, 1))::integer);
    v_immediate_job_count := LEAST(6, v_rate_jobs_per_minute);

    PERFORM public.ensure_jobs_for_queued_email_messages(
      rec.id,
      v_recovery_batch_size,
      v_rate_jobs_per_minute,
      v_immediate_job_count,
      false
    );
  END LOOP;

  FOR rec IN
    SELECT c.id, c.tenant_id, c.total_recipients
    FROM public.crm_campaigns c
    WHERE c.status = 'partially_queued'
      AND COALESCE(c.queue_started_at, c.queued_at, c.updated_at) < (v_now - v_partial_interval)
  LOOP
    partially_queued_campaigns := partially_queued_campaigns + 1;
    v_impacted_campaign_ids := array_append(v_impacted_campaign_ids, rec.id);

    v_recovery_batch_size := CASE
      WHEN COALESCE(rec.total_recipients, 0) > 50000 THEN 250
      WHEN COALESCE(rec.total_recipients, 0) > 10000 THEN 200
      WHEN COALESCE(rec.total_recipients, 0) > 1000 THEN 100
      ELSE 50
    END;
    v_rate_jobs_per_minute := GREATEST(2, floor(1500.0 / GREATEST(v_recovery_batch_size, 1))::integer);
    v_immediate_job_count := LEAST(6, v_rate_jobs_per_minute);

    SELECT e.jobs_created
    INTO v_jobs_created
    FROM public.ensure_jobs_for_queued_email_messages(
      rec.id,
      v_recovery_batch_size,
      v_rate_jobs_per_minute,
      v_immediate_job_count,
      false
    ) AS e;

    INSERT INTO public.campaign_health_events (campaign_id, tenant_id, event_type, message, metadata)
    VALUES (
      rec.id,
      rec.tenant_id,
      'queue_build_stalled',
      'Detected a stale partially queued campaign and recreated any missing jobs for queued messages.',
      jsonb_build_object(
        'detected_at', v_now,
        'stale_after_minutes', GREATEST(COALESCE(p_stale_queue_minutes, 10), 1),
        'jobs_created', COALESCE(v_jobs_created, 0)
      )
    );
    v_event_count := v_event_count + 1;
  END LOOP;

  IF COALESCE(array_length(v_impacted_campaign_ids, 1), 0) > 0 THEN
    UPDATE public.crm_campaigns c
    SET
      stall_count = COALESCE(c.stall_count, 0) + 1,
      updated_at = v_now
    WHERE c.id = ANY(
      ARRAY(
        SELECT DISTINCT unnest(v_impacted_campaign_ids)
      )
    );
  END IF;

  events_logged := v_event_count;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.campaign_health_check(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_health_check(integer, integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'campaign-health-check',
      '*/5 * * * *',
      'SELECT public.campaign_health_check();'
    );
  END IF;
EXCEPTION
  WHEN undefined_function OR insufficient_privilege THEN
    RAISE NOTICE 'Skipping campaign-health-check cron schedule setup: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;