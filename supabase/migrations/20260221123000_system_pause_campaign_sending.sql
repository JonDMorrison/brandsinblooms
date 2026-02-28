-- Milestone 2: Remove fallback sending
-- System-level campaign pause RPC for service_role callers.
-- Used when a campaign cannot proceed (e.g., no operational custom domain).

CREATE OR REPLACE FUNCTION public.system_pause_email_campaign_sending(
  p_campaign_id UUID,
  p_block_reason TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE (
  messages_paused INT,
  jobs_paused INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '1s'
AS $$
DECLARE
  v_message_limit INT := 2000;
BEGIN
  messages_paused := 0;
  jobs_paused := 0;

  -- Mark campaign paused and record reason/message for UI.
  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    send_blocked_reason = COALESCE(p_block_reason, c.send_blocked_reason),
    send_error = COALESCE(p_error_message, c.send_error),
    sending_started_at = NULL,
    send_started_at = NULL,
    claim_token = NULL,
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN (
      'draft', 'scheduled', 'queued', 'partially_queued',
      'sending', 'paused'
    );

  -- Pause jobs so the worker doesn't claim them.
  WITH to_pause AS (
    SELECT j.ctid
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    FOR UPDATE SKIP LOCKED
  ), x AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.ctid IN (SELECT ctid FROM to_pause)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO jobs_paused FROM x;

  -- Pause a bounded number of messages per call; never wait on locked rows.
  WITH to_pause AS (
    SELECT m.ctid
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending')
    LIMIT v_message_limit
    FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.email_messages m
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.ctid IN (SELECT ctid FROM to_pause)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO messages_paused FROM u;

  RETURN QUERY SELECT messages_paused, jobs_paused;
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_pause_email_campaign_sending(UUID, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
