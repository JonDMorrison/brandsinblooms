-- Ensure queued email_messages have pending email_send_jobs
--
-- Problem this solves:
-- The worker processes email_send_jobs, not email_messages. If messages are queued
-- but there are no pending jobs (e.g., due to manual edits or partial queue writes),
-- the worker will log "No pending jobs" forever.
--
-- This RPC creates pending jobs for queued messages when there are no active jobs.

CREATE OR REPLACE FUNCTION public.ensure_jobs_for_queued_email_messages(
  p_campaign_id UUID,
  p_batch_size INT DEFAULT 200
)
RETURNS TABLE (
  queued_count INT,
  jobs_created INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_domain_id UUID;

  v_base_batch_index INT;
  v_has_active_jobs BOOLEAN;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  -- Derive tenant_id from owner if missing.
  IF v_effective_tenant_id IS NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  -- Derive tenant_id from segment linkages if still missing.
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

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 THEN
    p_batch_size := 200;
  END IF;

  SELECT COUNT(*)::INT
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

  SELECT EXISTS(
    SELECT 1
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    LIMIT 1
  )
  INTO v_has_active_jobs;

  -- If jobs already exist, don't create duplicates.
  IF v_has_active_jobs THEN
    jobs_created := 0;
    RETURN QUERY SELECT queued_count, jobs_created;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1)
  INTO v_base_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  WITH queued AS (
    SELECT m.id, m.customer_id, m.email
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.status = 'queued'
  ),
  numbered AS (
    SELECT
      q.id,
      q.customer_id,
      q.email,
      row_number() OVER (ORDER BY q.id) AS rn
    FROM queued q
  ),
  batches AS (
    SELECT
      floor((rn - 1) / p_batch_size)::INT AS batch_group,
      jsonb_agg(
        jsonb_build_object('customerId', customer_id, 'email', email)
        ORDER BY rn
      ) AS recipient_emails,
      array_agg(id ORDER BY rn)::UUID[] AS recipient_message_ids
    FROM numbered
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
      NULL,
      0,
      0,
      0,
      now(),
      now()
    FROM batches b
    RETURNING 1
  )
  SELECT (SELECT COUNT(*) FROM inserted)::INT
  INTO jobs_created;

  -- Nudge the campaign back into a sendable status when we (re)create work.
  IF jobs_created > 0 THEN
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_error = NULL,
      send_blocked_reason = NULL,
      send_started_at = COALESCE(c.send_started_at, now()),
      updated_at = now()
    WHERE c.id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT queued_count, jobs_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_jobs_for_queued_email_messages(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_jobs_for_queued_email_messages(UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
