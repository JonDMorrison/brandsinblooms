-- Fix: do not overload crm_campaigns.send_blocked_reason for user-initiated pause.
--
-- The UI treats send_blocked_reason as a delivery error string and some code paths
-- map any text containing "paused" to "Domain blocked".
-- Campaign pause is already represented by crm_campaigns.status = 'paused'.
--
-- This migration keeps status updates, but avoids writing 'paused_by_user' into
-- send_blocked_reason. It also clears the legacy value if it exists.

CREATE OR REPLACE FUNCTION public.pause_email_campaign_sending(
  p_campaign_id UUID
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
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;

  v_message_limit INT := 2000;
BEGIN
  messages_paused := 0;
  jobs_paused := 0;

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

  -- Mark campaign paused (fast).
  -- Clear the legacy paused_by_user marker if present, but do not overwrite real block reasons.
  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    send_blocked_reason = CASE
      WHEN c.send_blocked_reason = 'paused_by_user' THEN NULL
      ELSE c.send_blocked_reason
    END,
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('scheduled', 'sending', 'paused');

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

GRANT EXECUTE ON FUNCTION public.pause_email_campaign_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_email_campaign_sending(UUID) TO service_role;


CREATE OR REPLACE FUNCTION public.resume_email_campaign_sending(
  p_campaign_id UUID
)
RETURNS TABLE (
  messages_resumed INT,
  jobs_resumed INT
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
BEGIN
  messages_resumed := 0;
  jobs_resumed := 0;

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

  -- Resume campaign (fast).
  -- Only clear the legacy pause marker; preserve real block reasons/errors.
  UPDATE public.crm_campaigns c
  SET
    status = 'sending',
    send_blocked_reason = CASE
      WHEN c.send_blocked_reason = 'paused_by_user' THEN NULL
      ELSE c.send_blocked_reason
    END,
    send_error = CASE
      WHEN c.send_error = 'paused_by_user' THEN NULL
      ELSE c.send_error
    END,
    send_started_at = COALESCE(c.send_started_at, now()),
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status = 'paused';

  -- Resume paused jobs.
  WITH to_resume AS (
    SELECT j.ctid
    FROM public.email_send_jobs j
    WHERE j.campaign_id = p_campaign_id
      AND j.status = 'paused'
    FOR UPDATE SKIP LOCKED
  ), x AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'pending',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.ctid IN (SELECT ctid FROM to_resume)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO jobs_resumed FROM x;

  -- Resume a bounded number of paused messages per call.
  WITH to_resume AS (
    SELECT m.ctid
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.status = 'paused'
      AND m.resend_id IS NULL
    LIMIT v_message_limit
    FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.ctid IN (SELECT ctid FROM to_resume)
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO messages_resumed FROM u;

  RETURN QUERY SELECT messages_resumed, jobs_resumed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resume_email_campaign_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_email_campaign_sending(UUID) TO service_role;
