-- Fix ambiguous column reference errors in get_email_campaign_progress.
-- In PL/pgSQL, OUT params (RETURN TABLE columns) become variables, so unqualified
-- references like "last_attempt_at" can be ambiguous with table columns.

CREATE OR REPLACE FUNCTION public.get_email_campaign_progress(p_campaign_id UUID)
RETURNS TABLE (
  campaign_id UUID,
  total INT,
  queued INT,
  sending INT,
  sent INT,
  failed INT,
  skipped INT,
  last_message_updated_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  is_stuck BOOLEAN,
  stuck_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_status TEXT;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.status, c.user_id, c.tenant_id
  INTO v_campaign_status, v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_status IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  -- Derive tenant_id from the campaign owner if missing.
  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
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

  RETURN QUERY
  WITH m AS (
    SELECT
      em.status,
      em.updated_at,
      em.last_attempt_at AS msg_last_attempt_at,
      em.sent_at
    FROM public.email_messages em
    WHERE em.campaign_id = p_campaign_id
      AND em.tenant_id = v_effective_tenant_id
  ),
  agg AS (
    SELECT
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE status = 'queued')::INT AS queued,
      COUNT(*) FILTER (WHERE status = 'sending')::INT AS sending,
      COUNT(*) FILTER (WHERE status = 'sent')::INT AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::INT AS failed,
      COUNT(*) FILTER (WHERE status = 'skipped')::INT AS skipped,
      MAX(updated_at) AS last_message_updated_at,
      MAX(msg_last_attempt_at) AS last_attempt_at,
      MAX(sent_at) AS last_sent_at
    FROM m
  )
  SELECT
    p_campaign_id AS campaign_id,
    a.total,
    a.queued,
    a.sending,
    a.sent,
    a.failed,
    a.skipped,
    a.last_message_updated_at,
    a.last_attempt_at,
    a.last_sent_at,
    (
      v_campaign_status = 'sending'
      AND COALESCE(a.total, 0) > 0
      AND COALESCE(a.last_message_updated_at, NOW() - INTERVAL '100 years') < (NOW() - INTERVAL '10 minutes')
      AND (COALESCE(a.sent, 0) + COALESCE(a.failed, 0) + COALESCE(a.skipped, 0)) < COALESCE(a.total, 0)
    ) AS is_stuck,
    (
      CASE
        WHEN (
          v_campaign_status = 'sending'
          AND COALESCE(a.total, 0) > 0
          AND COALESCE(a.last_message_updated_at, NOW() - INTERVAL '100 years') < (NOW() - INTERVAL '10 minutes')
          AND (COALESCE(a.sent, 0) + COALESCE(a.failed, 0) + COALESCE(a.skipped, 0)) < COALESCE(a.total, 0)
        )
        THEN 'No message updates in 10+ minutes'
        ELSE NULL
      END
    ) AS stuck_reason
  FROM agg a;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_campaign_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_campaign_progress(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
