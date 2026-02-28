-- Milestone 8: Campaign-Level Admin Intervention Controls
-- - Pause / Resume / Force stop campaigns
-- - Override auto-pause precedence (final_override | automation_allowed)
-- - Tenant-level campaign creation lock
-- - Keep intervention details internal (admin_audit_log), tenant sees resulting state only

CREATE TABLE IF NOT EXISTS public.email_governance_campaign_intervention_state (
  campaign_id UUID PRIMARY KEY REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  admin_paused BOOLEAN NOT NULL DEFAULT false,
  force_stopped BOOLEAN NOT NULL DEFAULT false,
  autopause_override_enabled BOOLEAN NOT NULL DEFAULT false,
  autopause_override_precedence TEXT NOT NULL DEFAULT 'automation_allowed',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES auth.users(id),
  updated_reason TEXT NULL,
  CONSTRAINT email_governance_campaign_intervention_state_precedence_check
    CHECK (autopause_override_precedence IN ('final_override', 'automation_allowed'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_intervention_state_tenant
  ON public.email_governance_campaign_intervention_state(tenant_id);

CREATE INDEX IF NOT EXISTS idx_campaign_intervention_state_effective
  ON public.email_governance_campaign_intervention_state(tenant_id, admin_paused, force_stopped, autopause_override_enabled, autopause_override_precedence);

ALTER TABLE public.email_governance_campaign_intervention_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_intervention_state_master_admin_select ON public.email_governance_campaign_intervention_state;
CREATE POLICY campaign_intervention_state_master_admin_select
  ON public.email_governance_campaign_intervention_state
  FOR SELECT
  USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS campaign_intervention_state_master_admin_insert ON public.email_governance_campaign_intervention_state;
CREATE POLICY campaign_intervention_state_master_admin_insert
  ON public.email_governance_campaign_intervention_state
  FOR INSERT
  WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS campaign_intervention_state_master_admin_update ON public.email_governance_campaign_intervention_state;
CREATE POLICY campaign_intervention_state_master_admin_update
  ON public.email_governance_campaign_intervention_state
  FOR UPDATE
  USING (public.is_master_admin(auth.uid()))
  WITH CHECK (public.is_master_admin(auth.uid()));

ALTER TABLE public.email_governance_tenant_control_state
  ADD COLUMN IF NOT EXISTS campaign_creation_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_creation_locked_reason TEXT;

CREATE OR REPLACE FUNCTION public.enforce_campaign_creation_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_tenant_id UUID;
  v_locked BOOLEAN := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor;

  IF v_actor_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.campaign_creation_locked, false)
  INTO v_locked
  FROM public.email_governance_tenant_control_state s
  WHERE s.tenant_id = v_actor_tenant_id;

  IF COALESCE(v_locked, false) THEN
    RAISE EXCEPTION 'Campaign creation is temporarily unavailable.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_campaign_creation_lock_before_insert ON public.crm_campaigns;
CREATE TRIGGER enforce_campaign_creation_lock_before_insert
  BEFORE INSERT ON public.crm_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_creation_lock();

CREATE OR REPLACE FUNCTION public.get_campaign_intervention_state(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  admin_paused BOOLEAN,
  force_stopped BOOLEAN,
  autopause_override_enabled BOOLEAN,
  autopause_override_precedence TEXT,
  autopause_override_final BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_tenant_id UUID;
BEGIN
  SELECT c.tenant_id
  INTO v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p_campaign_id,
    v_campaign_tenant_id,
    COALESCE(s.admin_paused, false) AS admin_paused,
    COALESCE(s.force_stopped, false) AS force_stopped,
    COALESCE(s.autopause_override_enabled, false) AS autopause_override_enabled,
    COALESCE(s.autopause_override_precedence, 'automation_allowed') AS autopause_override_precedence,
    (
      COALESCE(s.autopause_override_enabled, false)
      AND COALESCE(s.autopause_override_precedence, 'automation_allowed') = 'final_override'
    ) AS autopause_override_final
  FROM public.crm_campaigns c
  LEFT JOIN public.email_governance_campaign_intervention_state s
    ON s.campaign_id = c.id
  WHERE c.id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_tenant_campaign_creation_lock(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'campaign_creation_locked', COALESCE(s.campaign_creation_locked, false),
      'campaign_creation_locked_reason', s.campaign_creation_locked_reason
    )
    FROM (
      SELECT 1
    ) x
    LEFT JOIN public.email_governance_tenant_control_state s
      ON s.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_campaign_creation_lock(
  p_tenant_id UUID,
  p_locked BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_effective_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), CASE WHEN COALESCE(p_locked, false) THEN 'campaign_creation_locked' ELSE 'campaign_creation_unlocked' END);
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.email_governance_tenant_control_state (
    tenant_id,
    campaign_creation_locked,
    campaign_creation_locked_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_tenant_id,
    COALESCE(p_locked, false),
    CASE WHEN COALESCE(p_locked, false) THEN v_effective_reason ELSE NULL END,
    now(),
    v_actor,
    v_effective_reason
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    campaign_creation_locked = EXCLUDED.campaign_creation_locked,
    campaign_creation_locked_reason = EXCLUDED.campaign_creation_locked_reason,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    CASE WHEN COALESCE(p_locked, false) THEN 'tenant_campaign_creation_locked' ELSE 'tenant_campaign_creation_unlocked' END,
    jsonb_build_object(
      'locked', COALESCE(p_locked, false),
      'reason', v_effective_reason
    )
  );

  RETURN jsonb_build_object(
    'campaign_creation_locked', COALESCE(p_locked, false),
    'campaign_creation_locked_reason', CASE WHEN COALESCE(p_locked, false) THEN v_effective_reason ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_tenant_campaigns(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT 'all',
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_page INTEGER := GREATEST(COALESCE(p_page, 0), 0);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_offset INTEGER := v_page * v_page_size;
  v_count INTEGER := 0;
  v_data JSONB := '[]'::jsonb;
  v_search TEXT := NULLIF(lower(btrim(COALESCE(p_search, ''))), '');
  v_status TEXT := lower(COALESCE(p_status_filter, 'all'));
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH base AS (
    SELECT
      c.id,
      c.name,
      c.subject_line,
      c.status,
      c.scheduled_at,
      c.send_started_at,
      c.sent_at,
      c.updated_at,
      c.created_at,
      COALESCE(i.admin_paused, false) AS admin_paused,
      COALESCE(i.force_stopped, false) AS force_stopped,
      COALESCE(i.autopause_override_enabled, false) AS autopause_override_enabled,
      COALESCE(i.autopause_override_precedence, 'automation_allowed') AS autopause_override_precedence
    FROM public.crm_campaigns c
    LEFT JOIN public.email_governance_campaign_intervention_state i
      ON i.campaign_id = c.id
    WHERE c.tenant_id = p_tenant_id
      AND (
        v_search IS NULL
        OR lower(c.name) LIKE '%' || v_search || '%'
        OR lower(COALESCE(c.subject_line, '')) LIKE '%' || v_search || '%'
        OR c.id::text ILIKE '%' || v_search || '%'
      )
      AND (
        v_status = 'all'
        OR lower(c.status) = v_status
      )
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM base;

  WITH base AS (
    SELECT
      c.id,
      c.name,
      c.subject_line,
      c.status,
      c.scheduled_at,
      c.send_started_at,
      c.sent_at,
      c.updated_at,
      c.created_at,
      COALESCE(i.admin_paused, false) AS admin_paused,
      COALESCE(i.force_stopped, false) AS force_stopped,
      COALESCE(i.autopause_override_enabled, false) AS autopause_override_enabled,
      COALESCE(i.autopause_override_precedence, 'automation_allowed') AS autopause_override_precedence
    FROM public.crm_campaigns c
    LEFT JOIN public.email_governance_campaign_intervention_state i
      ON i.campaign_id = c.id
    WHERE c.tenant_id = p_tenant_id
      AND (
        v_search IS NULL
        OR lower(c.name) LIKE '%' || v_search || '%'
        OR lower(COALESCE(c.subject_line, '')) LIKE '%' || v_search || '%'
        OR c.id::text ILIKE '%' || v_search || '%'
      )
      AND (
        v_status = 'all'
        OR lower(c.status) = v_status
      )
    ORDER BY c.updated_at DESC, c.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'subject_line', subject_line,
        'status', status,
        'scheduled_at', scheduled_at,
        'send_started_at', send_started_at,
        'sent_at', sent_at,
        'updated_at', updated_at,
        'created_at', created_at,
        'admin_paused', admin_paused,
        'force_stopped', force_stopped,
        'autopause_override_enabled', autopause_override_enabled,
        'autopause_override_precedence', autopause_override_precedence
      )
    ),
    '[]'::jsonb
  )
  INTO v_data
  FROM base;

  RETURN jsonb_build_object(
    'data', v_data,
    'count', COALESCE(v_count, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_campaign_intervention_state(
  p_campaign_id UUID,
  p_admin_paused BOOLEAN,
  p_force_stopped BOOLEAN,
  p_autopause_override_enabled BOOLEAN,
  p_autopause_override_precedence TEXT DEFAULT 'automation_allowed',
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_precedence TEXT := CASE
    WHEN lower(COALESCE(p_autopause_override_precedence, 'automation_allowed')) = 'final_override' THEN 'final_override'
    ELSE 'automation_allowed'
  END;
  v_effective_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_intervention_state_updated');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'p_campaign_id is required';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  INSERT INTO public.email_governance_campaign_intervention_state (
    campaign_id,
    tenant_id,
    admin_paused,
    force_stopped,
    autopause_override_enabled,
    autopause_override_precedence,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_campaign_id,
    v_tenant_id,
    COALESCE(p_admin_paused, false),
    COALESCE(p_force_stopped, false),
    COALESCE(p_autopause_override_enabled, false),
    v_precedence,
    now(),
    v_actor,
    v_effective_reason
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    admin_paused = EXCLUDED.admin_paused,
    force_stopped = EXCLUDED.force_stopped,
    autopause_override_enabled = EXCLUDED.autopause_override_enabled,
    autopause_override_precedence = EXCLUDED.autopause_override_precedence,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    updated_reason = EXCLUDED.updated_reason;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_intervention_state_updated',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'admin_paused', COALESCE(p_admin_paused, false),
      'force_stopped', COALESCE(p_force_stopped, false),
      'autopause_override_enabled', COALESCE(p_autopause_override_enabled, false),
      'autopause_override_precedence', v_precedence,
      'reason', v_effective_reason
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'tenant_id', v_tenant_id,
    'admin_paused', COALESCE(p_admin_paused, false),
    'force_stopped', COALESCE(p_force_stopped, false),
    'autopause_override_enabled', COALESCE(p_autopause_override_enabled, false),
    'autopause_override_precedence', v_precedence,
    'updated_reason', v_effective_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_pause_campaign(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_jobs_paused INTEGER := 0;
  v_messages_paused INTEGER := 0;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_admin_pause');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    true,
    false,
    COALESCE((SELECT autopause_override_enabled FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), false),
    COALESCE((SELECT autopause_override_precedence FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), 'automation_allowed'),
    v_reason
  );

  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('scheduled', 'sending', 'paused', 'queued', 'partially_queued');

  WITH paused_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    RETURNING 1
  ), paused_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending')
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM paused_jobs),
    (SELECT COUNT(*)::INTEGER FROM paused_messages)
  INTO v_jobs_paused, v_messages_paused;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_paused',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_reason,
      'jobs_paused', COALESCE(v_jobs_paused, 0),
      'messages_paused', COALESCE(v_messages_paused, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'jobs_paused', COALESCE(v_jobs_paused, 0),
    'messages_paused', COALESCE(v_messages_paused, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_stop_campaign(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_jobs_paused INTEGER := 0;
  v_messages_paused INTEGER := 0;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_force_stop');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    true,
    true,
    COALESCE((SELECT autopause_override_enabled FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), false),
    COALESCE((SELECT autopause_override_precedence FROM public.email_governance_campaign_intervention_state s WHERE s.campaign_id = p_campaign_id), 'automation_allowed'),
    v_reason
  );

  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('scheduled', 'sending', 'paused', 'queued', 'partially_queued');

  WITH paused_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id = p_campaign_id
      AND j.status IN ('pending', 'in_progress')
    RETURNING 1
  ), paused_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status IN ('queued', 'sending')
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM paused_jobs),
    (SELECT COUNT(*)::INTEGER FROM paused_messages)
  INTO v_jobs_paused, v_messages_paused;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_force_stopped',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_reason,
      'jobs_paused', COALESCE(v_jobs_paused, 0),
      'messages_paused', COALESCE(v_messages_paused, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'jobs_paused', COALESCE(v_jobs_paused, 0),
    'messages_paused', COALESCE(v_messages_paused, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resume_campaign(
  p_campaign_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_jobs_resumed INTEGER := 0;
  v_messages_resumed INTEGER := 0;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_admin_resume');
  v_override_enabled BOOLEAN := false;
  v_override_precedence TEXT := 'automation_allowed';
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT
    COALESCE(s.autopause_override_enabled, false),
    COALESCE(s.autopause_override_precedence, 'automation_allowed')
  INTO v_override_enabled, v_override_precedence
  FROM public.email_governance_campaign_intervention_state s
  WHERE s.campaign_id = p_campaign_id;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    false,
    false,
    COALESCE(v_override_enabled, false),
    COALESCE(v_override_precedence, 'automation_allowed'),
    v_reason
  );

  UPDATE public.crm_campaigns c
  SET
    status = 'sending',
    send_started_at = COALESCE(c.send_started_at, now()),
    send_blocked_reason = CASE
      WHEN c.send_blocked_reason = 'paused_by_user' THEN NULL
      ELSE c.send_blocked_reason
    END,
    send_error = CASE
      WHEN c.send_blocked_reason = 'paused_by_user' THEN NULL
      ELSE c.send_error
    END,
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN ('paused', 'scheduled', 'queued', 'partially_queued', 'sending');

  WITH resumed_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'pending',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE j.campaign_id = p_campaign_id
      AND j.status = 'paused'
    RETURNING 1
  ), resumed_messages AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    WHERE m.campaign_id = p_campaign_id
      AND m.resend_id IS NULL
      AND m.status = 'paused'
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM resumed_jobs),
    (SELECT COUNT(*)::INTEGER FROM resumed_messages)
  INTO v_jobs_resumed, v_messages_resumed;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_resumed',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_reason,
      'jobs_resumed', COALESCE(v_jobs_resumed, 0),
      'messages_resumed', COALESCE(v_messages_resumed, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'jobs_resumed', COALESCE(v_jobs_resumed, 0),
    'messages_resumed', COALESCE(v_messages_resumed, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_campaign_autopause_override(
  p_campaign_id UUID,
  p_enabled BOOLEAN,
  p_precedence TEXT DEFAULT 'automation_allowed',
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_tenant_id UUID;
  v_precedence TEXT := CASE
    WHEN lower(COALESCE(p_precedence, 'automation_allowed')) = 'final_override' THEN 'final_override'
    ELSE 'automation_allowed'
  END;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_autopause_override_updated');
  v_admin_paused BOOLEAN := false;
  v_force_stopped BOOLEAN := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT
    COALESCE(s.admin_paused, false),
    COALESCE(s.force_stopped, false)
  INTO v_admin_paused, v_force_stopped
  FROM public.email_governance_campaign_intervention_state s
  WHERE s.campaign_id = p_campaign_id;

  PERFORM public.admin_set_campaign_intervention_state(
    p_campaign_id,
    COALESCE(v_admin_paused, false),
    COALESCE(v_force_stopped, false),
    COALESCE(p_enabled, false),
    v_precedence,
    v_reason
  );

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_autopause_override_updated',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'enabled', COALESCE(p_enabled, false),
      'precedence', v_precedence,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'autopause_override_enabled', COALESCE(p_enabled, false),
    'autopause_override_precedence', v_precedence
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_campaign_sending(p_campaign_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  current_status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st TEXT;
  v_tenant_id UUID;
  v_under_review BOOLEAN := false;
  v_policy RECORD;
  v_reason TEXT;
  v_admin_paused BOOLEAN := false;
  v_force_stopped BOOLEAN := false;
  v_override_final BOOLEAN := false;
BEGIN
  SELECT c.status, c.tenant_id
  INTO st, v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF st IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;

  SELECT
    COALESCE(i.admin_paused, false),
    COALESCE(i.force_stopped, false),
    (
      COALESCE(i.autopause_override_enabled, false)
      AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
    )
  INTO v_admin_paused, v_force_stopped, v_override_final
  FROM public.email_governance_campaign_intervention_state i
  WHERE i.campaign_id = p_campaign_id;

  IF COALESCE(v_force_stopped, false) THEN
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, 'Campaign is paused.'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(v_admin_paused, false) THEN
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, 'Campaign is paused.'::TEXT;
    RETURN;
  END IF;

  SELECT t.email_under_review
  INTO v_under_review
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF COALESCE(v_under_review, false) AND NOT COALESCE(v_override_final, false) THEN
    v_reason := 'Campaign blocked: tenant is under review due to deliverability hard-stop enforcement.';
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'tenant_hard_stop_under_review',
      v_reason
    );
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, v_reason;
    RETURN;
  END IF;

  SELECT * INTO v_policy
  FROM public.get_campaign_reputation_policy(p_campaign_id);

  IF v_policy.action = 'pause' AND NOT COALESCE(v_override_final, false) THEN
    v_reason := format('Campaign auto-paused: reputation score %s is below 60.', v_policy.score);
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'reputation_critical_autopause',
      v_reason
    );
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, v_reason;
    RETURN;
  END IF;

  IF v_policy.action = 'restrict' THEN
    v_reason := format('Campaign blocked: reputation score %s is in restricted tier (60-74).', v_policy.score);

    UPDATE public.crm_campaigns
    SET
      send_blocked_reason = 'reputation_restricted',
      send_error = v_reason,
      updated_at = now()
    WHERE id = p_campaign_id;

    RETURN QUERY SELECT FALSE, st, v_reason;
    RETURN;
  END IF;

  IF st IN ('sent') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign already sent'::TEXT;
    RETURN;
  END IF;

  IF st IN ('failed') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign previously failed - reset to draft first'::TEXT;
    RETURN;
  END IF;

  IF st IN ('draft', 'scheduled', 'queued', 'partially_queued') THEN
    UPDATE public.crm_campaigns
    SET
      status = 'sending',
      send_started_at = COALESCE(send_started_at, NOW()),
      send_error = NULL,
      send_blocked_reason = NULL
    WHERE id = p_campaign_id;

    RETURN QUERY SELECT TRUE, 'sending'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF st = 'sending' THEN
    RETURN QUERY SELECT TRUE, st, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, st, 'Campaign cannot be sent from status: ' || st;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size INT DEFAULT 10)
RETURNS SETOF public.crm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids UUID[];
  v_campaign RECORD;
BEGIN
  FOR v_campaign IN
    SELECT c.id
    FROM public.crm_campaigns c
    JOIN public.tenants t ON t.id = c.tenant_id
    LEFT JOIN public.email_governance_campaign_intervention_state i ON i.campaign_id = c.id
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      AND t.email_under_review = true
      AND NOT (
        COALESCE(i.autopause_override_enabled, false)
        AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
      )
      AND COALESCE(i.admin_paused, false) = false
      AND COALESCE(i.force_stopped, false) = false
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.system_pause_email_campaign_sending(
      v_campaign.id,
      'tenant_hard_stop_under_review',
      'Campaign auto-paused: tenant is under review due to hard-stop enforcement.'
    );
  END LOOP;

  FOR v_campaign IN
    SELECT c.id
    FROM public.crm_campaigns c
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    LEFT JOIN public.email_governance_campaign_intervention_state i ON i.campaign_id = c.id
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      AND p.action = 'pause'
      AND NOT (
        COALESCE(i.autopause_override_enabled, false)
        AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
      )
      AND COALESCE(i.admin_paused, false) = false
      AND COALESCE(i.force_stopped, false) = false
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.system_pause_email_campaign_sending(
      v_campaign.id,
      'reputation_critical_autopause',
      'Campaign auto-paused due to critical tenant reputation score (<60).'
    );
  END LOOP;

  WITH claimable AS (
    SELECT c.id
    FROM public.crm_campaigns c
    JOIN public.tenants t ON t.id = c.tenant_id
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    LEFT JOIN public.email_governance_campaign_intervention_state i ON i.campaign_id = c.id
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      AND COALESCE(i.admin_paused, false) = false
      AND COALESCE(i.force_stopped, false) = false
      AND (
        (
          t.email_under_review = false
          AND p.action IN ('allow', 'throttle')
        )
        OR (
          COALESCE(i.autopause_override_enabled, false)
          AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
          AND p.action IN ('allow', 'throttle', 'pause')
        )
      )
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_started_at = NOW(),
      send_error = NULL,
      send_blocked_reason = NULL
    WHERE c.id IN (SELECT id FROM claimable)
    RETURNING c.id
  )
  SELECT ARRAY_AGG(id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT *
  FROM public.crm_campaigns
  WHERE id = ANY(COALESCE(claimed_ids, ARRAY[]::UUID[]));
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_send_job_ids(
  batch_size INT DEFAULT 10,
  worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  stale_after_minutes INT DEFAULT 10
)
RETURNS TABLE (
  id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate RECORD;
  v_claimed_count INTEGER := 0;
  v_target_count INTEGER := GREATEST(COALESCE(batch_size, 10), 1);
  v_now TIMESTAMPTZ := now();

  v_domain_status TEXT;
  v_domain_stage INTEGER;
  v_cap INTEGER;
  v_reserved INTEGER;
  v_remaining INTEGER;
  v_job_size INTEGER;

  v_claimable_message_ids UUID[];
  v_remaining_message_ids UUID[];
  v_claimable_recipient_emails JSONB;
  v_remaining_recipient_emails JSONB;
  v_new_batch_index INTEGER;

  v_effective_message_ids UUID[];
  v_effective_recipient_emails JSONB;
  v_effective_available_at TIMESTAMPTZ;
  v_throttle_claimable_count INTEGER;
  v_throttle_delay_seconds INTEGER;
BEGIN
  FOR v_candidate IN
    SELECT
      j.id,
      j.campaign_id,
      j.tenant_id,
      j.domain_id,
      j.status,
      j.claimed_at,
      j.batch_index,
      j.recipient_message_ids,
      j.recipient_emails,
      j.available_at,
      j.created_at,
      j.attempts,
      p.action AS reputation_action,
      COALESCE(ts.is_throttled, false) AS is_throttled,
      ts.next_claimable_at,
      COALESCE(i.admin_paused, false) AS admin_paused,
      COALESCE(i.force_stopped, false) AS force_stopped,
      (
        COALESCE(i.autopause_override_enabled, false)
        AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
      ) AS override_final
    FROM public.email_send_jobs j
    JOIN public.crm_campaigns c ON c.id = j.campaign_id
    CROSS JOIN LATERAL public.get_campaign_reputation_policy(c.id) p
    LEFT JOIN public.email_governance_campaign_throttle_states ts ON ts.campaign_id = j.campaign_id
    LEFT JOIN public.email_governance_campaign_intervention_state i ON i.campaign_id = j.campaign_id
    WHERE (
        p.action IN ('allow', 'throttle')
        OR (p.action = 'pause' AND COALESCE(i.autopause_override_enabled, false) AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override')
      )
      AND COALESCE(i.admin_paused, false) = false
      AND COALESCE(i.force_stopped, false) = false
      AND c.status IN ('sending', 'queued', 'partially_queued')
      AND j.available_at <= v_now
      AND (
        COALESCE(ts.is_throttled, false) = false
        OR COALESCE(ts.next_claimable_at, '-infinity'::timestamptz) <= v_now
      )
      AND (
        j.status = 'pending'
        OR (
          j.status = 'in_progress'
          AND (j.claimed_at IS NULL OR j.claimed_at < (v_now - make_interval(mins => stale_after_minutes)))
        )
      )
    ORDER BY j.available_at ASC, j.created_at ASC, j.batch_index ASC
    LIMIT (v_target_count * 20)
    FOR UPDATE OF j SKIP LOCKED
  LOOP
    EXIT WHEN v_claimed_count >= v_target_count;

    IF v_candidate.domain_id IS NOT NULL THEN
      SELECT
        d.status,
        GREATEST(COALESCE(d.warmup_stage, 1), 1)
      INTO v_domain_status, v_domain_stage
      FROM public.email_domains d
      WHERE d.id = v_candidate.domain_id
        AND d.tenant_id = v_candidate.tenant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      IF v_domain_status = 'warming_up' THEN
        PERFORM 1 FROM public.maybe_advance_domain_warmup(v_candidate.domain_id, v_now);

        v_cap := public.get_domain_warmup_daily_cap(v_candidate.domain_id, v_now);
        v_reserved := public.get_domain_warmup_reserved_today(v_candidate.domain_id, v_now);

        v_job_size := GREATEST(
          COALESCE(cardinality(v_candidate.recipient_message_ids), 0),
          COALESCE(jsonb_array_length(v_candidate.recipient_emails), 0)
        );

        IF v_job_size <= 0 THEN
          CONTINUE;
        END IF;

        v_remaining := GREATEST(v_cap - v_reserved, 0);

        IF v_remaining <= 0 THEN
          CONTINUE;
        END IF;

        IF v_job_size > v_remaining THEN
          IF COALESCE(cardinality(v_candidate.recipient_message_ids), 0) > 0 THEN
            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_claimable_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_candidate.recipient_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord <= v_remaining
            ) t;

            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_remaining_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_candidate.recipient_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord > v_remaining
            ) t;
          ELSE
            v_claimable_message_ids := ARRAY[]::UUID[];
            v_remaining_message_ids := ARRAY[]::UUID[];
          END IF;

          IF COALESCE(jsonb_array_length(v_candidate.recipient_emails), 0) > 0 THEN
            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_claimable_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_candidate.recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord <= v_remaining
            ) t;

            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_remaining_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_candidate.recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord > v_remaining
            ) t;
          ELSE
            v_claimable_recipient_emails := '[]'::jsonb;
            v_remaining_recipient_emails := '[]'::jsonb;
          END IF;

          IF COALESCE(cardinality(v_claimable_message_ids), 0) = 0
             AND COALESCE(jsonb_array_length(v_claimable_recipient_emails), 0) = 0 THEN
            CONTINUE;
          END IF;

          UPDATE public.email_send_jobs j
          SET
            recipient_message_ids = v_claimable_message_ids,
            recipient_emails = v_claimable_recipient_emails,
            updated_at = v_now
          WHERE j.id = v_candidate.id;

          PERFORM 1
          FROM public.crm_campaigns c
          WHERE c.id = v_candidate.campaign_id
          FOR UPDATE;

          SELECT COALESCE(MAX(j.batch_index), -1) + 1
          INTO v_new_batch_index
          FROM public.email_send_jobs j
          WHERE j.campaign_id = v_candidate.campaign_id;

          INSERT INTO public.email_send_jobs (
            campaign_id,
            tenant_id,
            domain_id,
            status,
            error_message,
            recipient_emails,
            batch_index,
            created_at,
            updated_at,
            attempts,
            emails_sent,
            emails_failed,
            recipient_message_ids,
            available_at
          ) VALUES (
            v_candidate.campaign_id,
            v_candidate.tenant_id,
            v_candidate.domain_id,
            'pending',
            NULL,
            v_remaining_recipient_emails,
            v_new_batch_index,
            v_now,
            v_now,
            0,
            0,
            0,
            v_remaining_message_ids,
            v_candidate.available_at
          );
        END IF;
      END IF;
    END IF;

    IF COALESCE(v_candidate.is_throttled, false) THEN
      SELECT
        j.recipient_message_ids,
        j.recipient_emails,
        j.available_at
      INTO
        v_effective_message_ids,
        v_effective_recipient_emails,
        v_effective_available_at
      FROM public.email_send_jobs j
      WHERE j.id = v_candidate.id
      FOR UPDATE;

      v_job_size := GREATEST(
        COALESCE(cardinality(v_effective_message_ids), 0),
        COALESCE(jsonb_array_length(v_effective_recipient_emails), 0)
      );

      IF v_job_size > 1 THEN
        v_throttle_claimable_count := GREATEST(1, FLOOR(v_job_size * 0.5)::INTEGER);

        IF v_throttle_claimable_count < v_job_size THEN
          IF COALESCE(cardinality(v_effective_message_ids), 0) > 0 THEN
            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_claimable_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_effective_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord <= v_throttle_claimable_count
            ) t;

            SELECT COALESCE(array_agg(t.msg_id ORDER BY t.ord), ARRAY[]::UUID[])
            INTO v_remaining_message_ids
            FROM (
              SELECT msg_id, ord
              FROM unnest(v_effective_message_ids) WITH ORDINALITY AS u(msg_id, ord)
              WHERE ord > v_throttle_claimable_count
            ) t;
          ELSE
            v_claimable_message_ids := ARRAY[]::UUID[];
            v_remaining_message_ids := ARRAY[]::UUID[];
          END IF;

          IF COALESCE(jsonb_array_length(v_effective_recipient_emails), 0) > 0 THEN
            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_claimable_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_effective_recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord <= v_throttle_claimable_count
            ) t;

            SELECT COALESCE(jsonb_agg(t.elem ORDER BY t.ord), '[]'::jsonb)
            INTO v_remaining_recipient_emails
            FROM (
              SELECT elem, ord
              FROM jsonb_array_elements(v_effective_recipient_emails) WITH ORDINALITY AS e(elem, ord)
              WHERE ord > v_throttle_claimable_count
            ) t;
          ELSE
            v_claimable_recipient_emails := '[]'::jsonb;
            v_remaining_recipient_emails := '[]'::jsonb;
          END IF;

          IF COALESCE(cardinality(v_claimable_message_ids), 0) = 0
             AND COALESCE(jsonb_array_length(v_claimable_recipient_emails), 0) = 0 THEN
            CONTINUE;
          END IF;

          UPDATE public.email_send_jobs j
          SET
            recipient_message_ids = v_claimable_message_ids,
            recipient_emails = v_claimable_recipient_emails,
            updated_at = v_now
          WHERE j.id = v_candidate.id;

          PERFORM 1
          FROM public.crm_campaigns c
          WHERE c.id = v_candidate.campaign_id
          FOR UPDATE;

          SELECT COALESCE(MAX(j.batch_index), -1) + 1
          INTO v_new_batch_index
          FROM public.email_send_jobs j
          WHERE j.campaign_id = v_candidate.campaign_id;

          INSERT INTO public.email_send_jobs (
            campaign_id,
            tenant_id,
            domain_id,
            status,
            error_message,
            recipient_emails,
            batch_index,
            created_at,
            updated_at,
            attempts,
            emails_sent,
            emails_failed,
            recipient_message_ids,
            available_at
          ) VALUES (
            v_candidate.campaign_id,
            v_candidate.tenant_id,
            v_candidate.domain_id,
            'pending',
            NULL,
            v_remaining_recipient_emails,
            v_new_batch_index,
            v_now,
            v_now,
            0,
            0,
            0,
            v_remaining_message_ids,
            COALESCE(v_effective_available_at, v_now)
          );
        END IF;
      END IF;
    END IF;

    UPDATE public.email_send_jobs j
    SET
      status = 'in_progress',
      claimed_at = v_now,
      claimed_by = worker_id,
      claim_token = p_claim_token,
      attempts = j.attempts + 1,
      updated_at = v_now
    WHERE j.id = v_candidate.id
    RETURNING j.id INTO id;

    IF FOUND THEN
      IF COALESCE(v_candidate.is_throttled, false) THEN
        v_throttle_delay_seconds := (120 + FLOOR(random() * 121))::INTEGER;

        INSERT INTO public.email_governance_campaign_throttle_states (
          campaign_id,
          tenant_id,
          is_throttled,
          trigger_reasons,
          trigger_details,
          throttled_at,
          next_claimable_at,
          last_evaluated_at,
          updated_at
        )
        VALUES (
          v_candidate.campaign_id,
          v_candidate.tenant_id,
          true,
          ARRAY[]::TEXT[],
          '{}'::jsonb,
          v_now,
          v_now + make_interval(secs => v_throttle_delay_seconds),
          v_now,
          v_now
        )
        ON CONFLICT (campaign_id) DO UPDATE
        SET
          next_claimable_at = EXCLUDED.next_claimable_at,
          updated_at = v_now;
      END IF;

      v_claimed_count := v_claimed_count + 1;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_campaign_batch_safety(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  sent_count INTEGER,
  failed_count INTEGER,
  bounced_count INTEGER,
  complained_count INTEGER,
  failed_delivery_rate NUMERIC,
  bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  should_pause BOOLEAN,
  pause_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_bounced_count INTEGER := 0;
  v_complained_count INTEGER := 0;
  v_failed_delivery_rate NUMERIC := 0;
  v_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;
  v_should_pause BOOLEAN := FALSE;
  v_pause_reason TEXT := NULL;
  v_tenant_id UUID;
  v_tenant_enforcement RECORD;
  v_throttle_state RECORD;
  v_override_final BOOLEAN := false;
BEGIN
  SELECT
    c.tenant_id,
    (
      COALESCE(i.autopause_override_enabled, false)
      AND COALESCE(i.autopause_override_precedence, 'automation_allowed') = 'final_override'
    )
  INTO v_tenant_id, v_override_final
  FROM public.crm_campaigns c
  LEFT JOIN public.email_governance_campaign_intervention_state i ON i.campaign_id = c.id
  WHERE c.id = p_campaign_id;

  SELECT
    COUNT(*) FILTER (WHERE m.status = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE m.status = 'failed')::INTEGER
  INTO v_sent_count, v_failed_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id;

  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'bounced')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER
  INTO v_bounced_count, v_complained_count
  FROM public.email_governance_email_events e
  WHERE e.campaign_id = p_campaign_id;

  v_sent_count := COALESCE(v_sent_count, 0);
  v_failed_count := COALESCE(v_failed_count, 0);
  v_bounced_count := COALESCE(v_bounced_count, 0);
  v_complained_count := COALESCE(v_complained_count, 0);

  v_failed_delivery_rate := v_failed_count::NUMERIC / GREATEST(v_sent_count + v_failed_count, 1);
  v_bounce_rate := v_bounced_count::NUMERIC / GREATEST(v_sent_count, 1);
  v_complaint_rate := v_complained_count::NUMERIC / GREATEST(v_sent_count, 1);

  IF NOT COALESCE(v_override_final, false) THEN
    IF v_complaint_rate >= 0.002 THEN
      v_should_pause := TRUE;
      v_pause_reason := format(
        'Campaign auto-paused mid-send: complaint rate %.3f%% exceeded 0.200%% threshold.',
        v_complaint_rate * 100
      );
    ELSIF v_bounce_rate >= 0.05 THEN
      v_should_pause := TRUE;
      v_pause_reason := format(
        'Campaign auto-paused mid-send: hard bounce rate %.2f%% exceeded 5.00%% threshold.',
        v_bounce_rate * 100
      );
    ELSIF v_failed_delivery_rate >= 0.08 THEN
      v_should_pause := TRUE;
      v_pause_reason := format(
        'Campaign auto-paused mid-send: failed delivery rate %.2f%% exceeded 8.00%% threshold.',
        v_failed_delivery_rate * 100
      );
    END IF;

    IF v_should_pause THEN
      PERFORM public.system_pause_email_campaign_sending(
        p_campaign_id,
        'batch_safety_threshold_exceeded',
        v_pause_reason
      );
    END IF;
  END IF;

  IF v_tenant_id IS NOT NULL AND NOT COALESCE(v_override_final, false) THEN
    SELECT *
    INTO v_tenant_enforcement
    FROM public.maybe_enforce_tenant_hard_stop(v_tenant_id, 'batch_eval', now());

    IF COALESCE(v_tenant_enforcement.triggered, false) THEN
      v_should_pause := TRUE;
      v_pause_reason := COALESCE(
        v_pause_reason,
        'Campaign paused by tenant hard-stop enforcement (under review).'
      );
    END IF;
  END IF;

  SELECT *
  INTO v_throttle_state
  FROM public.maybe_update_campaign_throttle_state(p_campaign_id, 'batch_eval', now());

  campaign_id := p_campaign_id;
  sent_count := v_sent_count;
  failed_count := v_failed_count;
  bounced_count := v_bounced_count;
  complained_count := v_complained_count;
  failed_delivery_rate := v_failed_delivery_rate;
  bounce_rate := v_bounce_rate;
  complaint_rate := v_complaint_rate;
  should_pause := CASE WHEN COALESCE(v_override_final, false) THEN false ELSE v_should_pause END;
  pause_reason := CASE WHEN COALESCE(v_override_final, false) THEN NULL ELSE v_pause_reason END;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_intervention_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_campaign_creation_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_campaign_creation_lock(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_tenant_campaigns(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_campaign_intervention_state(UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pause_campaign(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resume_campaign(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_stop_campaign(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_campaign_autopause_override(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
