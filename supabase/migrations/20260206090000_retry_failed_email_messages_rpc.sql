-- Retry failed email_messages for a campaign by re-queuing them and creating new email_send_jobs.
-- This supports a UI "Retry Failed Messages" button and clears campaign-level delivery issues when retry starts.

CREATE OR REPLACE FUNCTION public.retry_failed_email_messages(
  p_campaign_id UUID,
  p_batch_size INT DEFAULT 200
)
RETURNS TABLE (
  count_reset INT,
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

  SELECT COALESCE(MAX(j.batch_index), -1)
  INTO v_base_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  WITH failed AS (
    SELECT m.id, m.customer_id, m.email
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.status = 'failed'
  ),
  updated AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      attempts = 0,
      resend_id = NULL,
      error_message = NULL,
      last_attempt_at = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      claim_token = NULL,
      dead_lettered_at = NULL,
      updated_at = now()
    FROM failed f
    WHERE m.id = f.id
    RETURNING m.id, m.customer_id, m.email
  ),
  numbered AS (
    SELECT
      u.id,
      u.customer_id,
      u.email,
      row_number() OVER (ORDER BY u.id) AS rn
    FROM updated u
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
  SELECT
    (SELECT COUNT(*) FROM updated)::INT,
    (SELECT COUNT(*) FROM inserted)::INT
  INTO count_reset, jobs_created;

  IF count_reset > 0 THEN
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_error = NULL,
      send_blocked_reason = NULL,
      sent_at = NULL,
      send_started_at = COALESCE(c.send_started_at, now()),
      updated_at = now()
    WHERE c.id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT count_reset, jobs_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_failed_email_messages(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_email_messages(UUID, INT) TO service_role;
