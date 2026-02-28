-- Milestone 3: Campaign Enforcement + Silent Admin Intervention Controls
-- - Enforce campaign creation block while tenant is under review
-- - Keep tenant-facing reasons category-only (no internal diagnostics)
-- - Ensure campaign final override does not bypass tenant-level gates
-- - Add admin reset action for campaign-level restrictions

CREATE OR REPLACE FUNCTION public.email_gov_tenant_reason_category(p_reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_reason TEXT := lower(COALESCE(btrim(p_reason), ''));
BEGIN
  IF v_reason = '' THEN
    RETURN NULL;
  END IF;

  IF v_reason IN ('paused_by_user', 'paused') THEN
    RETURN v_reason;
  END IF;

  IF v_reason IN ('tenant_hard_stop_under_review', 'account_under_review', 'abuse_pattern_detection_manual_review')
     OR v_reason LIKE '%under_review%'
     OR v_reason LIKE '%hard_stop%' THEN
    RETURN 'account_under_review';
  END IF;

  IF v_reason IN ('reputation_restricted')
     OR (v_reason LIKE '%reputation%' AND v_reason LIKE '%restrict%') THEN
    RETURN 'reputation_restricted';
  END IF;

  IF v_reason IN ('reputation_critical_autopause', 'reputation_critical')
     OR (v_reason LIKE '%reputation%' AND (v_reason LIKE '%critical%' OR v_reason LIKE '%below 60%' OR v_reason LIKE '%auto-paused%')) THEN
    RETURN 'reputation_critical';
  END IF;

  IF v_reason IN ('batch_safety_threshold_exceeded', 'deliverability_threshold')
     OR v_reason LIKE '%complaint%'
     OR v_reason LIKE '%bounce%'
     OR v_reason LIKE '%failed_delivery%'
     OR v_reason LIKE '%threshold%' THEN
    RETURN 'deliverability_threshold';
  END IF;

  IF v_reason = 'delivery_issue' THEN
    RETURN 'delivery_issue';
  END IF;

  RETURN 'delivery_issue';
END;
$$;

CREATE OR REPLACE FUNCTION public.email_gov_threshold_category(p_reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_reason TEXT := lower(COALESCE(btrim(p_reason), ''));
BEGIN
  IF v_reason = '' THEN
    RETURN NULL;
  END IF;

  IF v_reason LIKE 'hard_bounce_rate=%' OR v_reason = 'hard_bounce_rate' THEN
    RETURN 'hard_bounce_rate';
  END IF;

  IF v_reason LIKE 'soft_bounce_rate=%' OR v_reason = 'soft_bounce_rate' THEN
    RETURN 'soft_bounce_rate';
  END IF;

  IF v_reason LIKE 'complaint_rate=%' OR v_reason = 'complaint_rate' THEN
    RETURN 'complaint_rate';
  END IF;

  IF v_reason LIKE 'failed_delivery_rate=%' OR v_reason = 'failed_delivery_rate' THEN
    RETURN 'failed_delivery_rate';
  END IF;

  IF v_reason LIKE 'rapid_negative_trend=%' OR v_reason = 'rapid_negative_trend' THEN
    RETURN 'rapid_negative_trend';
  END IF;

  RETURN 'deliverability_threshold';
END;
$$;

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
  v_under_review BOOLEAN := false;
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

  SELECT COALESCE(t.email_under_review, false)
  INTO v_under_review
  FROM public.tenants t
  WHERE t.id = v_actor_tenant_id;

  IF COALESCE(v_locked, false) OR COALESCE(v_under_review, false) THEN
    RAISE EXCEPTION 'Campaign creation is temporarily unavailable.';
  END IF;

  RETURN NEW;
END;
$$;

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
  v_reason_category TEXT := COALESCE(
    public.email_gov_tenant_reason_category(p_block_reason),
    public.email_gov_tenant_reason_category(p_error_message),
    'paused'
  );
BEGIN
  messages_paused := 0;
  jobs_paused := 0;

  UPDATE public.crm_campaigns c
  SET
    status = 'paused',
    send_blocked_reason = v_reason_category,
    send_error = v_reason_category,
    sending_started_at = NULL,
    send_started_at = NULL,
    claim_token = NULL,
    updated_at = now()
  WHERE c.id = p_campaign_id
    AND c.status IN (
      'draft', 'scheduled', 'queued', 'partially_queued',
      'sending', 'paused'
    );

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

CREATE OR REPLACE FUNCTION public.enforce_tenant_hard_stop(
  p_tenant_id UUID,
  p_trigger_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_trigger_details JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'system'
)
RETURNS TABLE (
  enforced BOOLEAN,
  action_id UUID,
  campaigns_paused INTEGER,
  jobs_paused INTEGER,
  notifications_queued INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_action_id UUID;
  v_campaigns_paused INTEGER := 0;
  v_jobs_paused INTEGER := 0;
  v_notifications_queued INTEGER := 0;
  v_is_under_review BOOLEAN := false;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_reason := 'account_under_review';

  SELECT t.email_under_review
  INTO v_is_under_review
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;

  IF NOT COALESCE(v_is_under_review, false) THEN
    UPDATE public.tenants t
    SET
      email_under_review = true,
      email_under_review_at = now(),
      email_under_review_reason = v_reason,
      email_under_review_details = COALESCE(p_trigger_details, '{}'::jsonb),
      updated_at = now()
    WHERE t.id = p_tenant_id;
  END IF;

  INSERT INTO public.email_governance_tenant_enforcement_actions (
    tenant_id,
    action_type,
    source,
    trigger_reasons,
    trigger_reason,
    trigger_details,
    triggered_at
  )
  VALUES (
    p_tenant_id,
    'hard_stop',
    COALESCE(NULLIF(p_source, ''), 'system'),
    COALESCE(p_trigger_reasons, ARRAY[]::TEXT[]),
    v_reason,
    COALESCE(p_trigger_details, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_action_id;

  WITH paused_campaigns AS (
    UPDATE public.crm_campaigns c
    SET
      status = 'paused',
      send_blocked_reason = 'account_under_review',
      send_error = 'account_under_review',
      send_started_at = NULL,
      sending_started_at = NULL,
      claim_token = NULL,
      updated_at = now()
    WHERE c.tenant_id = p_tenant_id
      AND c.status IN ('draft', 'scheduled', 'queued', 'partially_queued', 'sending', 'paused')
    RETURNING c.id
  )
  SELECT COUNT(*)::INTEGER INTO v_campaigns_paused FROM paused_campaigns;

  WITH paused_jobs AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'paused',
      error_message = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
    FROM public.crm_campaigns c
    WHERE c.id = j.campaign_id
      AND c.tenant_id = p_tenant_id
      AND j.status IN ('pending', 'in_progress')
    RETURNING j.id
  )
  SELECT COUNT(*)::INTEGER INTO v_jobs_paused FROM paused_jobs;

  v_notifications_queued := public.enqueue_tenant_hard_stop_notifications(v_action_id);

  enforced := true;
  action_id := v_action_id;
  campaigns_paused := COALESCE(v_campaigns_paused, 0);
  jobs_paused := COALESCE(v_jobs_paused, 0);
  notifications_queued := COALESCE(v_notifications_queued, 0);
  reason := v_reason;
  RETURN NEXT;
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
  v_under_review_override_final BOOLEAN := false;
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

  PERFORM public.cleanup_expired_email_governance_overrides('ensure_campaign_sending', v_tenant_id, p_campaign_id);

  SELECT
    COALESCE(i.admin_paused, false),
    COALESCE(i.force_stopped, false)
  INTO v_admin_paused, v_force_stopped
  FROM public.email_governance_campaign_intervention_state i
  WHERE i.campaign_id = p_campaign_id;

  SELECT COALESCE(s.under_review_override_final, false)
  INTO v_under_review_override_final
  FROM public.get_tenant_under_review_override_state(v_tenant_id) s
  LIMIT 1;

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

  IF COALESCE(v_under_review, false)
     AND NOT COALESCE(v_under_review_override_final, false) THEN
    v_reason := 'account_under_review';
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

  IF v_policy.action = 'pause' THEN
    v_reason := 'reputation_critical';
    PERFORM public.system_pause_email_campaign_sending(
      p_campaign_id,
      'reputation_critical_autopause',
      v_reason
    );
    RETURN QUERY SELECT FALSE, 'paused'::TEXT, v_reason;
    RETURN;
  END IF;

  IF v_policy.action = 'restrict' THEN
    v_reason := 'reputation_restricted';

    UPDATE public.crm_campaigns
    SET
      send_blocked_reason = 'reputation_restricted',
      send_error = 'reputation_restricted',
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
      AND COALESCE(i.admin_paused, false) = false
      AND COALESCE(i.force_stopped, false) = false
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.system_pause_email_campaign_sending(
      v_campaign.id,
      'tenant_hard_stop_under_review',
      'account_under_review'
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
      AND COALESCE(i.admin_paused, false) = false
      AND COALESCE(i.force_stopped, false) = false
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.system_pause_email_campaign_sending(
      v_campaign.id,
      'reputation_critical_autopause',
      'reputation_critical'
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
      AND t.email_under_review = false
      AND p.action IN ('allow', 'throttle')
      AND COALESCE(i.admin_paused, false) = false
      AND COALESCE(i.force_stopped, false) = false
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

CREATE OR REPLACE FUNCTION public.get_campaign_delivery_status_tenant_safe(p_campaign_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  scheduled_at TIMESTAMPTZ,
  send_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  send_error TEXT,
  send_blocked_reason TEXT,
  is_throttled BOOLEAN,
  throttle_reasons TEXT[],
  throttled_at TIMESTAMPTZ,
  throttle_last_evaluated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.status,
    d.scheduled_at,
    d.send_started_at,
    d.sent_at,
    d.updated_at,
    COALESCE(
      public.email_gov_tenant_reason_category(d.send_error),
      public.email_gov_tenant_reason_category(d.send_blocked_reason)
    ) AS send_error,
    COALESCE(
      public.email_gov_tenant_reason_category(d.send_blocked_reason),
      public.email_gov_tenant_reason_category(d.send_error)
    ) AS send_blocked_reason,
    d.is_throttled,
    COALESCE(
      ARRAY(
        SELECT DISTINCT public.email_gov_threshold_category(r)
        FROM unnest(COALESCE(d.throttle_reasons, ARRAY[]::TEXT[])) AS r
        WHERE public.email_gov_threshold_category(r) IS NOT NULL
      ),
      ARRAY[]::TEXT[]
    ) AS throttle_reasons,
    d.throttled_at,
    d.throttle_last_evaluated_at
  FROM public.get_campaign_delivery_status(p_campaign_id) d;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_governance_visibility_tenant_safe(
  p_campaign_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  sent_count INTEGER,
  delivered_count INTEGER,
  hard_bounce_count INTEGER,
  soft_bounce_count INTEGER,
  complaint_count INTEGER,
  unsubscribed_count INTEGER,
  failed_count INTEGER,
  delivery_rate NUMERIC,
  hard_bounce_rate NUMERIC,
  soft_bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  unsubscribe_rate NUMERIC,
  failed_delivery_rate NUMERIC,
  risk_indicator TEXT,
  threshold_exceeded TEXT[],
  threshold_details JSONB,
  reputation_score INTEGER,
  reputation_tier TEXT,
  reputation_action TEXT,
  policy_recipient_cap INTEGER,
  policy_job_batch_size INTEGER,
  policy_send_pacing_multiplier NUMERIC,
  is_throttled BOOLEAN,
  throttle_reasons TEXT[],
  reputation_impact TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.campaign_id,
    g.tenant_id,
    g.sent_count,
    g.delivered_count,
    g.hard_bounce_count,
    g.soft_bounce_count,
    g.complaint_count,
    g.unsubscribed_count,
    g.failed_count,
    g.delivery_rate,
    g.hard_bounce_rate,
    g.soft_bounce_rate,
    g.complaint_rate,
    g.unsubscribe_rate,
    g.failed_delivery_rate,
    g.risk_indicator,
    COALESCE(
      ARRAY(
        SELECT DISTINCT public.email_gov_threshold_category(r)
        FROM unnest(COALESCE(g.threshold_exceeded, ARRAY[]::TEXT[])) AS r
        WHERE public.email_gov_threshold_category(r) IS NOT NULL
      ),
      ARRAY[]::TEXT[]
    ) AS threshold_exceeded,
    jsonb_build_object(
      'warning_triggered', COALESCE((g.threshold_details->>'warning_triggered')::BOOLEAN, false),
      'warning_reasons', COALESCE(
        (
          SELECT to_jsonb(ARRAY(
            SELECT DISTINCT public.email_gov_threshold_category(r)
            FROM unnest(COALESCE(g.throttle_reasons, ARRAY[]::TEXT[])) AS r
            WHERE public.email_gov_threshold_category(r) IS NOT NULL
          ))
        ),
        '[]'::jsonb
      ),
      'hard_stop_reasons', COALESCE(
        (
          SELECT to_jsonb(ARRAY(
            SELECT DISTINCT public.email_gov_threshold_category(r)
            FROM unnest(COALESCE(g.threshold_exceeded, ARRAY[]::TEXT[])) AS r
            WHERE public.email_gov_threshold_category(r) IS NOT NULL
          ))
        ),
        '[]'::jsonb
      )
    ) AS threshold_details,
    g.reputation_score,
    g.reputation_tier,
    g.reputation_action,
    g.policy_recipient_cap,
    g.policy_job_batch_size,
    g.policy_send_pacing_multiplier,
    g.is_throttled,
    COALESCE(
      ARRAY(
        SELECT DISTINCT public.email_gov_threshold_category(r)
        FROM unnest(COALESCE(g.throttle_reasons, ARRAY[]::TEXT[])) AS r
        WHERE public.email_gov_threshold_category(r) IS NOT NULL
      ),
      ARRAY[]::TEXT[]
    ) AS throttle_reasons,
    g.reputation_impact
  FROM public.get_campaign_governance_visibility(p_campaign_id, p_as_of) g;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_campaign_restrictions(
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
  v_effective_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'campaign_restrictions_reset');
  v_jobs_paused INTEGER := 0;
  v_messages_paused INTEGER := 0;
  v_target_status TEXT;
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
    autopause_override_until,
    autopause_override_reason,
    updated_at,
    updated_by,
    updated_reason
  ) VALUES (
    p_campaign_id,
    v_tenant_id,
    false,
    false,
    false,
    'automation_allowed',
    NULL,
    NULL,
    now(),
    v_actor,
    v_effective_reason
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    admin_paused = false,
    force_stopped = false,
    autopause_override_enabled = false,
    autopause_override_precedence = 'automation_allowed',
    autopause_override_until = NULL,
    autopause_override_reason = NULL,
    updated_at = now(),
    updated_by = v_actor,
    updated_reason = v_effective_reason;

  UPDATE public.email_governance_campaign_throttle_states s
  SET
    is_throttled = false,
    trigger_reasons = ARRAY[]::TEXT[],
    trigger_details = '{}'::jsonb,
    cleared_at = now(),
    next_claimable_at = NULL,
    last_evaluated_at = now(),
    updated_at = now()
  WHERE s.campaign_id = p_campaign_id;

  INSERT INTO public.email_governance_campaign_throttle_events (
    campaign_id,
    tenant_id,
    event_type,
    source,
    reasons,
    details
  )
  VALUES (
    p_campaign_id,
    v_tenant_id,
    'cleared',
    'admin_reset_campaign_restrictions',
    ARRAY[]::TEXT[],
    jsonb_build_object('reason', v_effective_reason)
  );

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

  UPDATE public.crm_campaigns c
  SET
    status = CASE WHEN c.scheduled_at IS NOT NULL THEN 'scheduled' ELSE 'draft' END,
    send_error = NULL,
    send_blocked_reason = NULL,
    claim_token = NULL,
    send_started_at = NULL,
    sending_started_at = NULL,
    updated_at = now()
  WHERE c.id = p_campaign_id
  RETURNING status INTO v_target_status;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    v_tenant_id,
    'campaign_restrictions_reset',
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'reason', v_effective_reason,
      'status', COALESCE(v_target_status, 'draft'),
      'jobs_paused', COALESCE(v_jobs_paused, 0),
      'messages_paused', COALESCE(v_messages_paused, 0)
    )
  );

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'status', COALESCE(v_target_status, 'draft'),
    'jobs_paused', COALESCE(v_jobs_paused, 0),
    'messages_paused', COALESCE(v_messages_paused, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_campaign_delivery_status(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_campaign_governance_visibility(UUID, TIMESTAMPTZ) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_campaign_warning_thresholds(UUID, TIMESTAMPTZ) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.maybe_update_campaign_throttle_state(UUID, TEXT, TIMESTAMPTZ) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_campaign_delivery_status_tenant_safe(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_delivery_status_tenant_safe(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_governance_visibility_tenant_safe(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_governance_visibility_tenant_safe(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_campaign_restrictions(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_campaign_restrictions(UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
