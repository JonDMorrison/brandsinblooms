-- Serialize automation enrollment per automation/customer pair so overlap
-- behavior and run sequence allocation are deterministic under concurrency.

ALTER TABLE public.crm_automations
  DROP CONSTRAINT IF EXISTS crm_automations_overlap_behavior_check;
ALTER TABLE public.crm_automations
  ADD CONSTRAINT crm_automations_overlap_behavior_check
  CHECK (overlap_behavior IN ('ignore', 'restart', 'parallel', 'queue'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_outbox_live_run_step_unique
  ON public.crm_outbox (automation_run_id, step_index)
  WHERE automation_run_id IS NOT NULL
    AND status NOT IN ('failed', 'cancelled');

CREATE OR REPLACE FUNCTION public.begin_automation_run(
  p_automation_id uuid,
  p_customer_id uuid,
  p_total_steps integer,
  p_trigger_data jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_channel_availability jsonb DEFAULT '{}'::jsonb,
  p_cooldown_minutes integer DEFAULT 1440
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_is_active boolean;
  v_overlap_behavior text;
  v_existing_run public.automation_runs%ROWTYPE;
  v_run_id uuid;
  v_run_sequence integer;
  v_queued_until timestamptz;
  v_cancelled_run_ids uuid[] := '{}'::uuid[];
BEGIN
  IF p_automation_id IS NULL OR p_customer_id IS NULL THEN
    RAISE EXCEPTION 'automation and customer are required';
  END IF;
  IF p_total_steps IS NULL OR p_total_steps < 1 THEN
    RAISE EXCEPTION 'total_steps must be at least 1';
  END IF;
  IF p_cooldown_minutes IS NULL OR p_cooldown_minutes NOT BETWEEN 0 AND 525600 THEN
    RAISE EXCEPTION 'cooldown_minutes must be between 0 and 525600';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_automation_id::text || ':' || p_customer_id::text, 0)
  );

  SELECT a.tenant_id, a.is_active, a.overlap_behavior
  INTO v_tenant_id, v_is_active, v_overlap_behavior
  FROM public.crm_automations a
  WHERE a.id = p_automation_id;

  IF NOT FOUND OR NOT coalesce(v_is_active, false) THEN
    RETURN jsonb_build_object(
      'decision', 'inactive',
      'reason', 'Automation not found or inactive'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_customers c
    WHERE c.id = p_customer_id
      AND c.tenant_id = v_tenant_id
      AND c.deleted_at IS NULL
      AND c.merged_into_customer_id IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'decision', 'invalid_customer',
      'reason', 'Customer is unavailable or belongs to another tenant'
    );
  END IF;

  SELECT r.*
  INTO v_existing_run
  FROM public.automation_runs r
  WHERE r.automation_id = p_automation_id
    AND r.customer_id = p_customer_id
    AND r.status IN ('active', 'paused')
  ORDER BY r.run_sequence DESC, r.started_at DESC, r.id
  LIMIT 1;

  IF FOUND THEN
    CASE v_overlap_behavior
      WHEN 'ignore' THEN
        RETURN jsonb_build_object(
          'decision', 'ignored',
          'reason', 'Customer already has an active run',
          'existing_run_id', v_existing_run.id
        );
      WHEN 'queue' THEN
        v_queued_until := greatest(
          coalesce(
            v_existing_run.next_step_scheduled_at + interval '5 minutes',
            now() + interval '1 hour'
          ),
          now() + interval '5 minutes'
        );
        RETURN jsonb_build_object(
          'decision', 'queued',
          'reason', 'Customer already has an active run',
          'existing_run_id', v_existing_run.id,
          'queued_until', v_queued_until
        );
      WHEN 'restart' THEN
        WITH cancelled AS (
          UPDATE public.automation_runs r
          SET status = 'cancelled',
              error_message = 'Cancelled due to re-trigger (restart mode)',
              completed_at = now(),
              next_step_scheduled_at = NULL,
              updated_at = now()
          WHERE r.automation_id = p_automation_id
            AND r.customer_id = p_customer_id
            AND r.status IN ('active', 'paused')
          RETURNING r.id
        )
        SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[])
        INTO v_cancelled_run_ids
        FROM cancelled;

        UPDATE public.crm_outbox o
        SET status = 'skipped',
            skip_reason = 'Run restarted',
            skipped_at = now(),
            locked_until = NULL,
            locked_by = NULL,
            updated_at = now()
        WHERE o.automation_run_id = ANY(v_cancelled_run_ids)
          AND o.status IN ('queued', 'retrying', 'processing');
      WHEN 'parallel' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'Unsupported overlap behavior: %', v_overlap_behavior;
    END CASE;
  ELSIF p_cooldown_minutes > 0 AND EXISTS (
    SELECT 1
    FROM public.automation_runs r
    WHERE r.automation_id = p_automation_id
      AND r.customer_id = p_customer_id
      AND r.status = 'completed'
      AND r.completed_at >= now() - make_interval(mins => p_cooldown_minutes)
  ) THEN
    RETURN jsonb_build_object(
      'decision', 'cooldown',
      'reason', 'Automation completed within cooldown window'
    );
  END IF;

  SELECT coalesce(max(r.run_sequence), 0) + 1
  INTO v_run_sequence
  FROM public.automation_runs r
  WHERE r.automation_id = p_automation_id
    AND r.customer_id = p_customer_id;

  INSERT INTO public.automation_runs (
    automation_id,
    customer_id,
    tenant_id,
    status,
    current_step_index,
    total_steps,
    run_sequence,
    trigger_data,
    metadata,
    channel_availability
  ) VALUES (
    p_automation_id,
    p_customer_id,
    v_tenant_id,
    'active',
    0,
    p_total_steps,
    v_run_sequence,
    coalesce(p_trigger_data, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'overlap_behavior', v_overlap_behavior
    ),
    coalesce(p_channel_availability, '{}'::jsonb)
  )
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'decision', 'started',
    'run_id', v_run_id,
    'run_sequence', v_run_sequence,
    'overlap_behavior', v_overlap_behavior,
    'cancelled_run_ids', v_cancelled_run_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_automation_run(
  uuid, uuid, integer, jsonb, jsonb, jsonb, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_automation_run(
  uuid, uuid, integer, jsonb, jsonb, jsonb, integer
) TO service_role;

COMMENT ON FUNCTION public.begin_automation_run(
  uuid, uuid, integer, jsonb, jsonb, jsonb, integer
) IS 'Atomically applies cooldown and overlap behavior, allocates a run sequence, and starts an automation run.';
