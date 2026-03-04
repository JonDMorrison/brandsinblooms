-- User-facing "Stop" control for CRM campaigns.
-- Unlike pause/resume, this is a terminal action: marks the campaign as failed and fails any unsent jobs/messages.
-- Authorization matches pause/resume: owner OR same tenant.

CREATE OR REPLACE FUNCTION public.stop_email_campaign_sending(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  messages_stopped INT,
  jobs_stopped INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '1s'
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;

  v_message_limit INT := 2000;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'stopped_by_user');
BEGIN
  messages_stopped := 0;
  jobs_stopped := 0;

  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL THEN
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

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  -- Mark campaign failed to indicate a terminal user stop.
  UPDATE public.crm_campaigns c
  SET
    status = 'failed',
    failure_reason = v_reason,
    send_error = v_reason,
    send_blocked_reason = v_reason,
    sending_started_at = NULL,
    send_started_at = NULL,
    claim_token = NULL,
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN (
      'draft',
      'scheduled',
      'queued',
      'partially_queued',
      'sending',
      'paused',
      'failed'
    );

  -- Fail any not-yet-completed jobs so the worker does not claim them.
  WITH to_stop AS (
    SELECT j.ctid
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress', 'paused')
    FOR UPDATE SKIP LOCKED
  ), x AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'failed',
      error_message = v_reason,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.ctid IN (SELECT ctid FROM to_stop)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO jobs_stopped FROM x;

  -- Fail a bounded number of messages per call; never wait on locked rows.
  WITH to_stop AS (
    SELECT m.ctid
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending', 'paused')
    ORDER BY (m.status = 'sending') DESC, m.claimed_at NULLS LAST
    LIMIT v_message_limit
    FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.email_messages m
    SET
      status = 'failed',
      error_message = v_reason,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.ctid IN (SELECT ctid FROM to_stop)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO messages_stopped FROM u;

  RETURN QUERY SELECT messages_stopped, jobs_stopped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stop_email_campaign_sending(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_email_campaign_sending(UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
