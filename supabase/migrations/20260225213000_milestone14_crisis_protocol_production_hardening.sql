-- Milestone 14: Crisis Protocol & Production Hardening
-- Domain-scoped investigation mode with immediate send halt, auditable actions,
-- warmup reset on recovery, and tenant notification queueing.

ALTER TABLE public.email_domains
  ADD COLUMN IF NOT EXISTS investigation_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS investigation_mode_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS investigation_mode_reason TEXT,
  ADD COLUMN IF NOT EXISTS investigation_mode_details JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_email_domains_tenant_investigation_mode
  ON public.email_domains (tenant_id, investigation_mode)
  WHERE investigation_mode = true;

CREATE TABLE IF NOT EXISTS public.email_governance_domain_crisis_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('enter_investigation', 'exit_investigation', 'reset_warmup')),
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  triggered_by_role TEXT NOT NULL DEFAULT 'system',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_domain_crisis_actions_tenant_time
  ON public.email_governance_domain_crisis_actions (tenant_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_domain_crisis_actions_domain_time
  ON public.email_governance_domain_crisis_actions (domain_id, triggered_at DESC);

CREATE TABLE IF NOT EXISTS public.email_governance_domain_crisis_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_action_id UUID REFERENCES public.email_governance_domain_crisis_actions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  crisis_event_key TEXT NOT NULL,
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  claim_token UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crisis_event_key, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_domain_crisis_notif_claimable
  ON public.email_governance_domain_crisis_notifications (status, created_at)
  WHERE status IN ('pending', 'in_progress');

CREATE OR REPLACE FUNCTION public.claim_domain_crisis_notifications(
  p_limit INTEGER DEFAULT 20,
  p_worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  p_stale_after_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  crisis_action_id UUID,
  tenant_id UUID,
  domain_id UUID,
  recipient_email TEXT,
  subject TEXT,
  body_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT n.id
    FROM public.email_governance_domain_crisis_notifications n
    WHERE (
      n.status = 'pending'
      OR (
        n.status = 'in_progress'
        AND (n.claimed_at IS NULL OR n.claimed_at < (now() - make_interval(mins => p_stale_after_minutes)))
      )
    )
    ORDER BY n.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.email_governance_domain_crisis_notifications n
    SET
      status = 'in_progress',
      claimed_at = now(),
      claimed_by = p_worker_id,
      claim_token = p_claim_token,
      attempts = n.attempts + 1,
      updated_at = now()
    WHERE n.id IN (SELECT c.id FROM claimable c)
    RETURNING n.id, n.crisis_action_id, n.tenant_id, n.domain_id, n.recipient_email, n.subject, n.body_text
  )
  SELECT c.id, c.crisis_action_id, c.tenant_id, c.domain_id, c.recipient_email, c.subject, c.body_text
  FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_domain_crisis_notifications(
  p_crisis_action_id UUID,
  p_crisis_event_key TEXT,
  p_subject TEXT,
  p_body_text TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action RECORD;
  v_inserted INTEGER := 0;
BEGIN
  IF p_crisis_action_id IS NULL OR p_crisis_event_key IS NULL OR btrim(p_crisis_event_key) = '' THEN
    RETURN 0;
  END IF;

  SELECT a.*
  INTO v_action
  FROM public.email_governance_domain_crisis_actions a
  WHERE a.id = p_crisis_action_id;

  IF v_action.id IS NULL THEN
    RETURN 0;
  END IF;

  WITH admin_users AS (
    SELECT u.id, u.email
    FROM public.users u
    WHERE u.tenant_id = v_action.tenant_id
      AND u.email IS NOT NULL
      AND btrim(u.email) <> ''
      AND COALESCE(u.role, '') IN ('admin', 'super_admin')
  ), recipients AS (
    SELECT au.id, au.email FROM admin_users au
    UNION ALL
    SELECT u.id, u.email
    FROM public.users u
    WHERE u.tenant_id = v_action.tenant_id
      AND u.email IS NOT NULL
      AND btrim(u.email) <> ''
      AND NOT EXISTS (SELECT 1 FROM admin_users)
  ), inserted AS (
    INSERT INTO public.email_governance_domain_crisis_notifications (
      crisis_action_id,
      tenant_id,
      domain_id,
      crisis_event_key,
      recipient_user_id,
      recipient_email,
      subject,
      body_text,
      status
    )
    SELECT
      v_action.id,
      v_action.tenant_id,
      v_action.domain_id,
      p_crisis_event_key,
      r.id,
      r.email,
      p_subject,
      p_body_text,
      'pending'
    FROM recipients r
    ON CONFLICT (crisis_event_key, recipient_email) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_inserted FROM inserted;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_domain_warmup_after_crisis(
  p_domain_id UUID,
  p_reason TEXT DEFAULT 'crisis_recovery_reset',
  p_details JSONB DEFAULT '{}'::jsonb,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  domain_id UUID,
  tenant_id UUID,
  previous_stage INTEGER,
  current_stage INTEGER,
  previous_status TEXT,
  current_status TEXT,
  reset BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain RECORD;
  v_actor_user_id UUID := NULL;
  v_actor_role TEXT := 'system';
BEGIN
  IF p_domain_id IS NULL THEN
    RAISE EXCEPTION 'p_domain_id is required';
  END IF;

  IF auth.role() = 'service_role' THEN
    v_actor_user_id := p_admin_user_id;
    IF v_actor_user_id IS NOT NULL AND NOT public.is_master_admin(v_actor_user_id) THEN
      RAISE EXCEPTION 'p_admin_user_id must be a master admin when called by service_role';
    END IF;
  ELSE
    v_actor_user_id := auth.uid();
    IF v_actor_user_id IS NULL OR NOT public.is_master_admin(v_actor_user_id) THEN
      RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;
  END IF;

  IF v_actor_user_id IS NOT NULL THEN
    v_actor_role := 'admin';
  END IF;

  SELECT d.*
  INTO v_domain
  FROM public.email_domains d
  WHERE d.id = p_domain_id
  FOR UPDATE;

  IF v_domain.id IS NULL THEN
    RAISE EXCEPTION 'Domain % not found', p_domain_id;
  END IF;

  domain_id := v_domain.id;
  tenant_id := v_domain.tenant_id;
  previous_stage := GREATEST(COALESCE(v_domain.warmup_stage, 1), 1);
  previous_status := v_domain.status;

  UPDATE public.email_domains d
  SET
    status = 'warming_up',
    warmup_stage = 1,
    daily_limit = public.get_warmup_daily_cap_by_stage(1),
    healthy_days_counter = 0,
    last_stage_updated_at = now(),
    warmup_started_at = COALESCE(d.warmup_started_at, now()),
    updated_at = now()
  WHERE d.id = v_domain.id;

  current_stage := 1;
  current_status := 'warming_up';
  reset := true;

  INSERT INTO public.email_governance_domain_crisis_actions (
    tenant_id,
    domain_id,
    action_type,
    reason,
    details,
    triggered_by_user_id,
    triggered_by_role,
    triggered_at
  ) VALUES (
    v_domain.tenant_id,
    v_domain.id,
    'reset_warmup',
    COALESCE(NULLIF(btrim(p_reason), ''), 'crisis_recovery_reset'),
    jsonb_build_object(
      'details', COALESCE(p_details, '{}'::jsonb),
      'previous_stage', previous_stage,
      'current_stage', current_stage,
      'previous_status', previous_status,
      'current_status', current_status,
      'triggered_at', now()
    ),
    v_actor_user_id,
    v_actor_role,
    now()
  );

  INSERT INTO public.email_governance_audit_logs (
    tenant_id,
    actor_type,
    actor_id,
    action_type,
    decision,
    reason,
    policy_name,
    policy_version,
    domain_id,
    metadata,
    occurred_at
  ) VALUES (
    v_domain.tenant_id,
    CASE WHEN v_actor_user_id IS NOT NULL THEN 'admin' ELSE 'system' END,
    v_actor_user_id,
    'domain_warmup_reset',
    'log',
    COALESCE(NULLIF(btrim(p_reason), ''), 'crisis_recovery_reset'),
    'milestone14_crisis_protocol',
    '2026-02-25',
    v_domain.id,
    jsonb_build_object(
      'details', COALESCE(p_details, '{}'::jsonb),
      'previous_stage', previous_stage,
      'current_stage', current_stage,
      'previous_status', previous_status,
      'current_status', current_status
    ),
    now()
  );

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.enter_domain_investigation_mode(
  p_domain_id UUID,
  p_reason TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  action_id UUID,
  tenant_id UUID,
  domain_id UUID,
  campaigns_paused INTEGER,
  jobs_paused INTEGER,
  messages_paused INTEGER,
  notifications_queued INTEGER,
  state_changed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain RECORD;
  v_campaign RECORD;
  v_action_id UUID;
  v_actor_user_id UUID := NULL;
  v_actor_role TEXT := 'system';
  v_pause_result RECORD;
  v_campaigns_paused INTEGER := 0;
  v_jobs_paused INTEGER := 0;
  v_messages_paused INTEGER := 0;
  v_notifications_queued INTEGER := 0;
  v_state_changed BOOLEAN := false;
  v_reason TEXT;
  v_event_key TEXT;
  v_subject TEXT;
  v_body TEXT;
BEGIN
  IF p_domain_id IS NULL THEN
    RAISE EXCEPTION 'p_domain_id is required';
  END IF;

  IF auth.role() = 'service_role' THEN
    v_actor_user_id := p_admin_user_id;
    IF v_actor_user_id IS NULL OR NOT public.is_master_admin(v_actor_user_id) THEN
      RAISE EXCEPTION 'p_admin_user_id must be a master admin when called by service_role';
    END IF;
  ELSE
    v_actor_user_id := auth.uid();
    IF v_actor_user_id IS NULL OR NOT public.is_master_admin(v_actor_user_id) THEN
      RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;
  END IF;

  v_actor_role := 'admin';
  v_reason := COALESCE(NULLIF(btrim(p_reason), ''), 'manual_investigation');

  SELECT d.*
  INTO v_domain
  FROM public.email_domains d
  WHERE d.id = p_domain_id
  FOR UPDATE;

  IF v_domain.id IS NULL THEN
    RAISE EXCEPTION 'Domain % not found', p_domain_id;
  END IF;

  IF NOT COALESCE(v_domain.investigation_mode, false) THEN
    UPDATE public.email_domains d
    SET
      investigation_mode = true,
      investigation_mode_at = now(),
      investigation_mode_reason = v_reason,
      investigation_mode_details = COALESCE(p_details, '{}'::jsonb),
      manual_pause = true,
      updated_at = now()
    WHERE d.id = v_domain.id;

    v_state_changed := true;
  END IF;

  FOR v_campaign IN
    SELECT c.id
    FROM public.crm_campaigns c
    WHERE c.tenant_id = v_domain.tenant_id
      AND c.from_email_domain_id = v_domain.id
      AND c.status IN ('draft', 'scheduled', 'queued', 'partially_queued', 'sending', 'paused')
  LOOP
    SELECT *
    INTO v_pause_result
    FROM public.system_pause_email_campaign_sending(
      v_campaign.id,
      'domain_investigation_mode',
      format('Campaign paused: domain %s is under investigation.', COALESCE(v_domain.domain, v_domain.id::text))
    )
    LIMIT 1;

    v_campaigns_paused := v_campaigns_paused + 1;
    v_jobs_paused := v_jobs_paused + COALESCE(v_pause_result.jobs_paused, 0);
    v_messages_paused := v_messages_paused + COALESCE(v_pause_result.messages_paused, 0);
  END LOOP;

  INSERT INTO public.email_governance_domain_crisis_actions (
    tenant_id,
    domain_id,
    action_type,
    reason,
    details,
    triggered_by_user_id,
    triggered_by_role,
    triggered_at
  ) VALUES (
    v_domain.tenant_id,
    v_domain.id,
    'enter_investigation',
    v_reason,
    jsonb_build_object(
      'details', COALESCE(p_details, '{}'::jsonb),
      'campaigns_paused', v_campaigns_paused,
      'jobs_paused', v_jobs_paused,
      'messages_paused', v_messages_paused,
      'state_changed', v_state_changed,
      'triggered_at', now()
    ),
    v_actor_user_id,
    v_actor_role,
    now()
  ) RETURNING id INTO v_action_id;

  INSERT INTO public.email_governance_audit_logs (
    tenant_id,
    actor_type,
    actor_id,
    action_type,
    decision,
    reason,
    policy_name,
    policy_version,
    domain_id,
    metadata,
    occurred_at
  ) VALUES (
    v_domain.tenant_id,
    'admin',
    v_actor_user_id,
    'domain_investigation_entered',
    'block',
    v_reason,
    'milestone14_crisis_protocol',
    '2026-02-25',
    v_domain.id,
    jsonb_build_object(
      'details', COALESCE(p_details, '{}'::jsonb),
      'campaigns_paused', v_campaigns_paused,
      'jobs_paused', v_jobs_paused,
      'messages_paused', v_messages_paused,
      'state_changed', v_state_changed,
      'action_id', v_action_id
    ),
    now()
  );

  INSERT INTO public.crm_activity_events (
    tenant_id,
    timestamp,
    actor_type,
    actor_id,
    source,
    activity_type,
    status,
    title,
    description,
    metadata,
    related_entities,
    links,
    error_message
  ) VALUES (
    v_domain.tenant_id,
    now(),
    'system',
    NULL,
    'automation',
    'email.domain.investigation.entered',
    'warning',
    'Sending halted for domain under investigation',
    jsonb_build_object(
      'parts', jsonb_build_array(
        jsonb_build_object(
          'type', 'text',
          'text', format('Domain %s has been placed in investigation mode. Sending is halted until recovery.', COALESCE(v_domain.domain, v_domain.id::text))
        )
      )
    ),
    jsonb_build_object(
      'domain_id', v_domain.id,
      'action_id', v_action_id
    ),
    jsonb_build_array(),
    NULL
  );

  IF v_actor_user_id IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_tenant_id,
      action_type,
      action_details
    ) VALUES (
      v_actor_user_id,
      v_domain.tenant_id,
      'domain_investigation_entered',
      jsonb_build_object(
        'domain_id', v_domain.id,
        'domain', v_domain.domain,
        'reason', v_reason,
        'details', COALESCE(p_details, '{}'::jsonb),
        'action_id', v_action_id,
        'campaigns_paused', v_campaigns_paused,
        'jobs_paused', v_jobs_paused,
        'messages_paused', v_messages_paused,
        'state_changed', v_state_changed
      )
    );
  END IF;

  v_event_key := format('domain_crisis_enter:%s', v_action_id::text);
  v_subject := format('[Action Required] Sending halted for %s', COALESCE(v_domain.domain, v_domain.id::text));
  v_body := format(
    'Sending has been halted for domain %s and the domain is now under investigation.%s%s%s%s%s',
    COALESCE(v_domain.domain, v_domain.id::text),
    E'\n\nReason: ',
    v_reason,
    E'\n\nTriggered at: ',
    to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC',
    E'\n\nPlease pause operational changes, investigate recent sending behavior, and use recovery workflow after remediation.'
  );

  v_notifications_queued := public.enqueue_domain_crisis_notifications(
    v_action_id,
    v_event_key,
    v_subject,
    v_body
  );

  action_id := v_action_id;
  tenant_id := v_domain.tenant_id;
  domain_id := v_domain.id;
  campaigns_paused := v_campaigns_paused;
  jobs_paused := v_jobs_paused;
  messages_paused := v_messages_paused;
  notifications_queued := v_notifications_queued;
  state_changed := v_state_changed;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_domain_investigation_mode(
  p_domain_id UUID,
  p_reason TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_reset_warmup BOOLEAN DEFAULT true,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  action_id UUID,
  tenant_id UUID,
  domain_id UUID,
  warmup_reset BOOLEAN,
  notifications_queued INTEGER,
  state_changed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain RECORD;
  v_action_id UUID;
  v_actor_user_id UUID := NULL;
  v_actor_role TEXT := 'system';
  v_notifications_queued INTEGER := 0;
  v_state_changed BOOLEAN := false;
  v_warmup_reset BOOLEAN := false;
  v_reason TEXT;
  v_event_key TEXT;
  v_subject TEXT;
  v_body TEXT;
BEGIN
  IF p_domain_id IS NULL THEN
    RAISE EXCEPTION 'p_domain_id is required';
  END IF;

  IF auth.role() = 'service_role' THEN
    v_actor_user_id := p_admin_user_id;
    IF v_actor_user_id IS NULL OR NOT public.is_master_admin(v_actor_user_id) THEN
      RAISE EXCEPTION 'p_admin_user_id must be a master admin when called by service_role';
    END IF;
  ELSE
    v_actor_user_id := auth.uid();
    IF v_actor_user_id IS NULL OR NOT public.is_master_admin(v_actor_user_id) THEN
      RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;
  END IF;

  v_actor_role := 'admin';
  v_reason := COALESCE(NULLIF(btrim(p_reason), ''), 'manual_recovery');

  SELECT d.*
  INTO v_domain
  FROM public.email_domains d
  WHERE d.id = p_domain_id
  FOR UPDATE;

  IF v_domain.id IS NULL THEN
    RAISE EXCEPTION 'Domain % not found', p_domain_id;
  END IF;

  IF COALESCE(v_domain.investigation_mode, false) THEN
    UPDATE public.email_domains d
    SET
      investigation_mode = false,
      investigation_mode_at = NULL,
      investigation_mode_reason = NULL,
      investigation_mode_details = '{}'::jsonb,
      manual_pause = false,
      updated_at = now()
    WHERE d.id = v_domain.id;

    v_state_changed := true;
  END IF;

  IF COALESCE(p_reset_warmup, true) THEN
    PERFORM 1
    FROM public.reset_domain_warmup_after_crisis(
      v_domain.id,
      'crisis_recovery_reset',
      jsonb_build_object(
        'reason', v_reason,
        'details', COALESCE(p_details, '{}'::jsonb),
        'source', 'exit_domain_investigation_mode'
      ),
      v_actor_user_id
    );
    v_warmup_reset := true;
  END IF;

  INSERT INTO public.email_governance_domain_crisis_actions (
    tenant_id,
    domain_id,
    action_type,
    reason,
    details,
    triggered_by_user_id,
    triggered_by_role,
    triggered_at
  ) VALUES (
    v_domain.tenant_id,
    v_domain.id,
    'exit_investigation',
    v_reason,
    jsonb_build_object(
      'details', COALESCE(p_details, '{}'::jsonb),
      'state_changed', v_state_changed,
      'warmup_reset', v_warmup_reset,
      'triggered_at', now()
    ),
    v_actor_user_id,
    v_actor_role,
    now()
  ) RETURNING id INTO v_action_id;

  INSERT INTO public.email_governance_audit_logs (
    tenant_id,
    actor_type,
    actor_id,
    action_type,
    decision,
    reason,
    policy_name,
    policy_version,
    domain_id,
    metadata,
    occurred_at
  ) VALUES (
    v_domain.tenant_id,
    'admin',
    v_actor_user_id,
    'domain_investigation_exited',
    'allow',
    v_reason,
    'milestone14_crisis_protocol',
    '2026-02-25',
    v_domain.id,
    jsonb_build_object(
      'details', COALESCE(p_details, '{}'::jsonb),
      'state_changed', v_state_changed,
      'warmup_reset', v_warmup_reset,
      'action_id', v_action_id
    ),
    now()
  );

  INSERT INTO public.crm_activity_events (
    tenant_id,
    timestamp,
    actor_type,
    actor_id,
    source,
    activity_type,
    status,
    title,
    description,
    metadata,
    related_entities,
    links,
    error_message
  ) VALUES (
    v_domain.tenant_id,
    now(),
    'system',
    NULL,
    'automation',
    'email.domain.investigation.exited',
    'success',
    'Domain investigation completed',
    jsonb_build_object(
      'parts', jsonb_build_array(
        jsonb_build_object(
          'type', 'text',
          'text', format('Domain %s investigation mode ended. Warmup was reset to stage 1 for controlled recovery.', COALESCE(v_domain.domain, v_domain.id::text))
        )
      )
    ),
    jsonb_build_object(
      'domain_id', v_domain.id,
      'action_id', v_action_id,
      'warmup_reset', v_warmup_reset
    ),
    jsonb_build_array(),
    NULL
  );

  IF v_actor_user_id IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_tenant_id,
      action_type,
      action_details
    ) VALUES (
      v_actor_user_id,
      v_domain.tenant_id,
      'domain_investigation_exited',
      jsonb_build_object(
        'domain_id', v_domain.id,
        'domain', v_domain.domain,
        'reason', v_reason,
        'details', COALESCE(p_details, '{}'::jsonb),
        'action_id', v_action_id,
        'state_changed', v_state_changed,
        'warmup_reset', v_warmup_reset
      )
    );
  END IF;

  v_event_key := format('domain_crisis_exit:%s', v_action_id::text);
  v_subject := format('[Recovery] Domain %s returned to warmup', COALESCE(v_domain.domain, v_domain.id::text));
  v_body := format(
    'Investigation mode has ended for domain %s.%s%s%s%s%s',
    COALESCE(v_domain.domain, v_domain.id::text),
    E'\n\nReason: ',
    v_reason,
    E'\n\nWarmup reset: ',
    CASE WHEN v_warmup_reset THEN 'yes (stage 1)' ELSE 'no' END,
    E'\n\nSending may resume only after operational checks are complete and policies allow campaign execution.'
  );

  v_notifications_queued := public.enqueue_domain_crisis_notifications(
    v_action_id,
    v_event_key,
    v_subject,
    v_body
  );

  action_id := v_action_id;
  tenant_id := v_domain.tenant_id;
  domain_id := v_domain.id;
  warmup_reset := v_warmup_reset;
  notifications_queued := v_notifications_queued;
  state_changed := v_state_changed;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_send_quota(
  p_tenant_id uuid,
  p_domain_id uuid DEFAULT NULL,
  p_recipient_count integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain record;
  v_tenant record;
  v_from_email text;
  v_from_name text;
  v_is_high_volume boolean := COALESCE(p_recipient_count, 0) > 50000;
  v_spf_ok boolean := false;
  v_dkim_ok boolean := false;
  v_return_path_ok boolean := false;
  v_dmarc_ok boolean := false;
  v_domain_verification_ok boolean := false;
  v_ownership_ok boolean := false;
  v_failures text[] := ARRAY[]::text[];
  v_warnings text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'tenant_not_found',
      'message', 'Tenant not found'
    );
  END IF;

  v_from_name := COALESCE(v_tenant.fallback_from_name, 'BloomSuite');

  IF p_domain_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'sender_domain_required',
      'message', 'Campaign sending requires an explicit sending domain.'
    );
  END IF;

  SELECT * INTO v_domain
  FROM email_domains
  WHERE id = p_domain_id AND tenant_id = p_tenant_id;

  IF v_domain IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_found',
      'message', 'Sending domain not found'
    );
  END IF;

  IF COALESCE(v_domain.investigation_mode, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_under_investigation',
      'message', 'Sending domain is under investigation. Sending is halted until recovery is completed.',
      'domain', jsonb_build_object(
        'id', v_domain.id,
        'domain', v_domain.domain,
        'status', v_domain.status,
        'investigation_mode', true,
        'investigation_mode_at', v_domain.investigation_mode_at,
        'investigation_mode_reason', v_domain.investigation_mode_reason
      )
    );
  END IF;

  IF v_domain.status NOT IN ('active', 'warming_up') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'domain_not_operational',
      'message', 'Sending domain is not operational'
    );
  END IF;

  v_from_email := COALESCE(v_domain.default_from_email, 'mail@' || v_domain.domain);
  v_from_name := COALESCE(v_domain.default_from_name, v_from_name);

  WITH latest_checks AS (
    SELECT DISTINCT ON (check_name) check_name, ok
    FROM email_dns_checks
    WHERE email_domain_id = v_domain.id
      AND check_name IN ('spf', 'dkim', 'return_path', 'dmarc', 'domain_verification')
    ORDER BY check_name, checked_at DESC
  )
  SELECT
    COALESCE(MAX(CASE WHEN check_name = 'spf' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'dkim' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'return_path' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'dmarc' THEN ok::int END), 0) = 1,
    COALESCE(MAX(CASE WHEN check_name = 'domain_verification' THEN ok::int END), 0) = 1
  INTO
    v_spf_ok,
    v_dkim_ok,
    v_return_path_ok,
    v_dmarc_ok,
    v_domain_verification_ok
  FROM latest_checks;

  v_ownership_ok := COALESCE(v_domain_verification_ok, false) OR v_domain.verified_at IS NOT NULL;

  IF NOT v_spf_ok THEN
    v_failures := array_append(v_failures, 'SPF is not verified');
  END IF;

  IF NOT v_dkim_ok THEN
    v_failures := array_append(v_failures, 'DKIM is not verified');
  END IF;

  IF NOT v_return_path_ok THEN
    v_failures := array_append(v_failures, 'Return-path DNS is not verified');
  END IF;

  IF NOT v_dmarc_ok THEN
    v_failures := array_append(v_failures, 'DMARC is missing or does not meet p=none minimum');
  END IF;

  IF NOT v_ownership_ok THEN
    v_failures := array_append(v_failures, 'Domain ownership is not verified');
  END IF;

  IF array_length(v_failures, 1) IS NOT NULL THEN
    IF v_is_high_volume THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'domain_not_compliant_for_scale',
        'message', 'High-volume sending requires SPF, DKIM, DMARC (p=none minimum), and domain ownership verification.',
        'domain', jsonb_build_object(
          'id', v_domain.id,
          'domain', v_domain.domain,
          'status', v_domain.status
        ),
        'sender', jsonb_build_object(
          'from_name', v_from_name,
          'from_email', v_from_email
        ),
        'requested', p_recipient_count,
        'high_volume_threshold', 50000,
        'compliance', jsonb_build_object(
          'high_volume', true,
          'authenticated_for_scale', false,
          'spf_ok', v_spf_ok,
          'dkim_ok', v_dkim_ok,
          'return_path_ok', v_return_path_ok,
          'dmarc_ok', v_dmarc_ok,
          'ownership_verified', v_ownership_ok,
          'failures', to_jsonb(v_failures),
          'warnings', to_jsonb(v_warnings)
        )
      );
    END IF;

    v_warnings := array_append(v_warnings, 'Domain authentication is incomplete. Low-volume sending is allowed, but high-volume sending is blocked until SPF, DKIM, DMARC, and ownership are verified.');
    v_warnings := v_warnings || v_failures;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'domain', jsonb_build_object(
      'id', v_domain.id,
      'domain', v_domain.domain,
      'status', v_domain.status,
      'investigation_mode', COALESCE(v_domain.investigation_mode, false)
    ),
    'sender', jsonb_build_object(
      'from_name', v_from_name,
      'from_email', v_from_email
    ),
    'requested', p_recipient_count,
    'high_volume_threshold', 50000,
    'warnings', to_jsonb(v_warnings),
    'compliance', jsonb_build_object(
      'high_volume', v_is_high_volume,
      'authenticated_for_scale', array_length(v_failures, 1) IS NULL,
      'spf_ok', v_spf_ok,
      'dkim_ok', v_dkim_ok,
      'return_path_ok', v_return_path_ok,
      'dmarc_ok', v_dmarc_ok,
      'ownership_verified', v_ownership_ok,
      'failures', to_jsonb(v_failures),
      'warnings', to_jsonb(v_warnings)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_domain_crisis_notifications(INTEGER, TEXT, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_domain_crisis_notifications(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_domain_warmup_after_crisis(UUID, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_domain_warmup_after_crisis(UUID, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.enter_domain_investigation_mode(UUID, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enter_domain_investigation_mode(UUID, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.exit_domain_investigation_mode(UUID, TEXT, JSONB, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exit_domain_investigation_mode(UUID, TEXT, JSONB, BOOLEAN, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_send_quota(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_send_quota(UUID, UUID, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
