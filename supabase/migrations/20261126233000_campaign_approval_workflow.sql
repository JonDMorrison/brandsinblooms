-- Campaign approval workflow (Newsletter Builder 2.0, Milestone D).
--
-- Off for every tenant until an administrator turns it on, so nothing changes
-- for garden centres that do not ask for it.
--
-- An approval is bound to a fingerprint of what was reviewed: the content,
-- subject, preview text, sender and audience definition. Any change to those
-- makes the approval stale. The gate is enforced in the database, at the
-- points every send path goes through (schedule, claim for send, status
-- change), so a direct API call cannot go around it.

CREATE TABLE IF NOT EXISTS public.crm_campaign_approval_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  approval_required boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_campaign_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('pending', 'changes_requested', 'approved', 'invalidated', 'withdrawn')),
  fingerprint text NOT NULL,
  recipient_estimate integer,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submit_note text,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  invalidated_at timestamptz,
  invalidated_reason text
);
CREATE INDEX IF NOT EXISTS crm_campaign_approvals_campaign_idx
  ON public.crm_campaign_approvals (campaign_id, submitted_at DESC);
-- At most one live (waiting or approved) review per campaign.
CREATE UNIQUE INDEX IF NOT EXISTS crm_campaign_approvals_one_live_idx
  ON public.crm_campaign_approvals (campaign_id) WHERE state IN ('pending', 'approved');

-- Append-only record of who did what. Kept when a campaign is deleted.
CREATE TABLE IF NOT EXISTS public.crm_campaign_approval_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  campaign_id uuid,
  approval_id uuid,
  event text NOT NULL CHECK (event IN (
    'setting_changed', 'submitted', 'approved', 'changes_requested',
    'invalidated', 'withdrawn', 'scheduled', 'send_started'
  )),
  actor_user_id uuid,
  fingerprint text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_campaign_approval_events_campaign_idx
  ON public.crm_campaign_approval_events (campaign_id, created_at DESC);

-- All access goes through the functions below. No direct table access.
ALTER TABLE public.crm_campaign_approval_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaign_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaign_approval_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_campaign_approval_settings, public.crm_campaign_approvals,
  public.crm_campaign_approval_events FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (not callable by browsers)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.campaign_approval_required(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT s.approval_required FROM public.crm_campaign_approval_settings s WHERE s.tenant_id = p_tenant_id
  ), false);
$$;

-- What an approval covers. jsonb output has a fixed key order, so equal
-- inputs always give the same fingerprint.
CREATE OR REPLACE FUNCTION public.campaign_approval_fingerprint(c public.crm_campaigns)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'content', c.content,
    'subject', c.subject_line,
    'preheader', jsonb_build_array(c.preheader_text, c.preheader),
    'sender', jsonb_build_array(c.sender_name, c.sender_display_name, c.sender_email,
      c.actual_sender_email, c.from_email_domain_id, c.delivery_method, c.metadata->'replyTo'),
    'blocks', c.metadata->'contentBlocks',
    'campaignType', c.metadata->'campaignType',
    'audience', jsonb_build_object(
      'all', c.include_all_customers,
      'extra', (SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb) FROM unnest(c.additional_customer_ids) AS x),
      'segment', c.segment_id,
      'personas', (SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb) FROM unnest(c.persona_ids) AS x),
      'location', jsonb_build_array(c.location_scope, c.primary_location_id),
      'meta', jsonb_build_array(c.metadata->'includeAllCustomers', c.metadata->'include_all_customers',
        c.metadata->'additionalCustomerIds', c.metadata->'additional_customer_ids',
        c.metadata->'sourceSegmentId', c.metadata->'sourcePersonaId')
    ),
    -- The rules of every chosen segment. Changing who a segment selects makes
    -- the approval stale. New customers who come to match unchanged rules do
    -- not; the recipient estimate at approval is recorded for comparison.
    'segments', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'conditions', s.conditions, 'all', s.include_all_customers,
        'scope', s.location_scope, 'location', s.primary_location_id,
        'persona', s.persona_id, 'deleted', s.deleted_at IS NOT NULL
      ) ORDER BY s.id), '[]'::jsonb)
      FROM public.crm_segments s
      WHERE s.id = c.segment_id
         OR s.id IN (SELECT cs.segment_id FROM public.campaign_segments cs WHERE cs.campaign_id = c.id)
    )
  )::text, 'UTF8')), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.campaign_send_approval_ok(c public.crm_campaigns)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.tenant_id IS NULL
    OR NOT public.campaign_approval_required(c.tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.crm_campaign_approvals a
      WHERE a.campaign_id = c.id
        AND a.state = 'approved'
        AND a.fingerprint = public.campaign_approval_fingerprint(c)
    );
$$;

REVOKE ALL ON FUNCTION public.campaign_approval_required(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.campaign_approval_fingerprint(public.crm_campaigns) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.campaign_send_approval_ok(public.crm_campaigns) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The gate. Fires for every writer: browser, edge function, worker, SQL.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_campaign_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_starts boolean;
  v_schedules boolean;
  v_auto boolean;
  v_ok boolean;
BEGIN
  -- Fast path: tenants that do not use approval are never touched.
  IF NEW.tenant_id IS NULL OR NOT public.campaign_approval_required(NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  v_starts := NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('scheduled', 'queued', 'sending', 'enqueuing', 'partially_queued', 'processing')
    AND coalesce(OLD.status, 'draft') IN ('draft', 'scheduled', 'paused', 'failed');
  v_schedules := NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at;
  v_auto := coalesce(NEW.auto_send_enabled, false) AND NOT coalesce(OLD.auto_send_enabled, false);

  IF v_starts OR v_schedules OR v_auto THEN
    v_ok := public.campaign_send_approval_ok(NEW);
    IF NOT v_ok THEN
      RAISE EXCEPTION 'Campaign approval required'
        USING ERRCODE = '23514',
              HINT = 'Send this email for approval. It can be scheduled or sent once the current version is approved.';
    END IF;
    INSERT INTO public.crm_campaign_approval_events (tenant_id, campaign_id, event, actor_user_id, fingerprint, detail)
    VALUES (
      NEW.tenant_id, NEW.id,
      CASE WHEN NEW.status = 'scheduled' OR (v_schedules AND NOT v_starts) THEN 'scheduled' ELSE 'send_started' END,
      auth.uid(), public.campaign_approval_fingerprint(NEW),
      jsonb_build_object('status', NEW.status, 'scheduled_at', NEW.scheduled_at)
    );
    RETURN NEW;
  END IF;

  -- An approved, scheduled email was edited. Take it off the schedule so the
  -- changed version cannot go out unreviewed.
  IF OLD.status = 'scheduled' AND NEW.status = 'scheduled'
     AND NOT public.campaign_send_approval_ok(NEW) THEN
    NEW.status := 'draft';
    NEW.scheduled_at := NULL;
    UPDATE public.crm_campaign_approvals
       SET state = 'invalidated', invalidated_at = now(),
           invalidated_reason = 'Edited after approval while scheduled'
     WHERE campaign_id = NEW.id AND state = 'approved';
    INSERT INTO public.crm_campaign_approval_events (tenant_id, campaign_id, event, actor_user_id, detail)
    VALUES (NEW.tenant_id, NEW.id, 'invalidated', auth.uid(),
      jsonb_build_object('reason', 'Edited after approval while scheduled', 'unscheduled', true));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_campaign_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_campaigns_approval_gate ON public.crm_campaigns;
CREATE TRIGGER crm_campaigns_approval_gate
  BEFORE UPDATE ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_approval();

-- A new row must not start life already scheduled or sending without review.
CREATE OR REPLACE FUNCTION public.enforce_campaign_approval_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NOT public.campaign_approval_required(NEW.tenant_id) THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.status, 'draft') IN ('scheduled', 'queued', 'sending', 'enqueuing', 'partially_queued', 'processing')
     OR NEW.scheduled_at IS NOT NULL OR coalesce(NEW.auto_send_enabled, false) THEN
    RAISE EXCEPTION 'Campaign approval required'
      USING ERRCODE = '23514', HINT = 'New emails start as drafts and are sent for approval.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_campaign_approval_on_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_campaigns_approval_gate_insert ON public.crm_campaigns;
CREATE TRIGGER crm_campaigns_approval_gate_insert
  BEFORE INSERT ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_approval_on_insert();

-- ---------------------------------------------------------------------------
-- Claim functions: same bodies as before plus the approval check, so an
-- unapproved email is skipped cleanly and never blocks other tenants' sends.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_campaign_for_send(campaign_id uuid)
 RETURNS TABLE(success boolean, previous_status text, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_status TEXT;
  v_campaign public.crm_campaigns;
BEGIN
  -- Get current status with row lock
  SELECT status INTO current_status
  FROM crm_campaigns
  WHERE id = campaign_id
  FOR UPDATE;
  
  -- Check if campaign exists
  IF current_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;
  
  -- Only allow claiming from these statuses
  IF current_status NOT IN ('draft', 'scheduled') THEN
    RETURN QUERY SELECT 
      FALSE, 
      current_status, 
      CASE 
        WHEN current_status = 'sending' THEN 'Campaign is already being sent'
        WHEN current_status = 'sent' THEN 'Campaign has already been sent'
        WHEN current_status = 'failed' THEN 'Campaign previously failed - reset to draft first'
        ELSE 'Campaign cannot be sent from status: ' || current_status
      END;
    RETURN;
  END IF;

  -- Approval gate (only for tenants that turned approval on).
  SELECT c.* INTO v_campaign
  FROM public.crm_campaigns c
  WHERE c.id = claim_campaign_for_send.campaign_id;
  IF NOT public.campaign_send_approval_ok(v_campaign) THEN
    RETURN QUERY SELECT FALSE, current_status, 'Campaign approval required'::TEXT;
    RETURN;
  END IF;
  
  -- Atomically update to sending
  UPDATE crm_campaigns
  SET 
    status = 'sending',
    send_started_at = NOW(),
    send_error = NULL
  WHERE id = campaign_id;
  
  RETURN QUERY SELECT TRUE, current_status, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size integer DEFAULT 10)
 RETURNS SETOF crm_campaigns
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  claimed_ids UUID[];
BEGIN
  WITH claimable AS (
    SELECT c.id
    FROM public.crm_campaigns c
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      -- Approval gate (only for tenants that turned approval on).
      AND public.campaign_send_approval_ok(c)
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.crm_campaigns
    SET
      status = 'sending',
      send_started_at = NOW(),
      send_error = NULL
    WHERE id IN (SELECT id FROM claimable)
    RETURNING id
  )
  SELECT ARRAY_AGG(id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT *
  FROM public.crm_campaigns
  WHERE id = ANY(COALESCE(claimed_ids, ARRAY[]::UUID[]));
END;
$function$;

-- ---------------------------------------------------------------------------
-- Permission: campaigns.approve, added to the existing owner/admin role.
-- The role map lives in get_current_crm_access(); patch it in place so the
-- rest of that function stays exactly as deployed.
-- ---------------------------------------------------------------------------

DO $patch$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'get_current_crm_access';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'get_current_crm_access() not found';
  END IF;
  IF position('''campaigns.approve''' IN v_def) = 0 THEN
    IF (length(v_def) - length(replace(v_def, '''integrations.manage''', ''))) / length('''integrations.manage''') <> 1 THEN
      RAISE EXCEPTION 'Unexpected role map in get_current_crm_access(); not patching';
    END IF;
    v_def := replace(v_def, '''integrations.manage''', '''integrations.manage'', ''campaigns.approve''');
    EXECUTE v_def;
  END IF;
END
$patch$;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_campaign_approval(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_access jsonb := public.get_current_crm_access();
  v_tenant uuid := (v_access->>'tenantId')::uuid;
  v_campaign public.crm_campaigns;
  v_row public.crm_campaign_approvals;
  v_required boolean;
  v_fingerprint text;
  v_state text;
BEGIN
  IF NOT coalesce(v_access->'permissions' ? 'campaigns.read', false) THEN
    RAISE EXCEPTION 'Campaign permission required' USING ERRCODE = '42501';
  END IF;
  SELECT c.* INTO v_campaign FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id AND c.tenant_id = v_tenant;
  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found' USING ERRCODE = 'P0002';
  END IF;
  v_required := public.campaign_approval_required(v_tenant);
  v_fingerprint := public.campaign_approval_fingerprint(v_campaign);
  SELECT a.* INTO v_row FROM public.crm_campaign_approvals a
  WHERE a.campaign_id = p_campaign_id ORDER BY a.submitted_at DESC LIMIT 1;

  v_state := CASE
    WHEN NOT v_required THEN 'not_required'
    WHEN v_row.id IS NULL THEN 'draft'
    WHEN v_row.state IN ('pending', 'approved') AND v_row.fingerprint <> v_fingerprint THEN 'changed'
    WHEN v_row.state IN ('invalidated', 'withdrawn') THEN 'draft'
    ELSE v_row.state
  END;

  RETURN jsonb_build_object(
    'required', v_required,
    'state', v_state,
    'fingerprint', v_fingerprint,
    'canSubmit', coalesce(v_access->'permissions' ? 'campaigns.write', false),
    'canApprove', coalesce(v_access->'permissions' ? 'campaigns.approve', false),
    'canSend', coalesce(v_access->'permissions' ? 'campaigns.send', false),
    'review', CASE WHEN v_row.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_row.id, 'state', v_row.state,
      'isCurrentVersion', v_row.fingerprint = v_fingerprint,
      'recipientEstimate', v_row.recipient_estimate,
      'submittedAt', v_row.submitted_at, 'submitNote', v_row.submit_note,
      'submittedBy', (SELECT coalesce(nullif(u.full_name, ''), nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = v_row.submitted_by),
      'decidedAt', v_row.decided_at, 'decisionNote', v_row.decision_note,
      'decidedBy', (SELECT coalesce(nullif(u.full_name, ''), nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = v_row.decided_by),
      'invalidatedReason', v_row.invalidated_reason
    ) END,
    'history', (
      SELECT coalesce(jsonb_agg(h.item ORDER BY h.created_at DESC), '[]'::jsonb) FROM (
        SELECT e.created_at, jsonb_build_object(
          'event', e.event, 'at', e.created_at, 'detail', e.detail,
          'by', (SELECT coalesce(nullif(u.full_name, ''), nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = e.actor_user_id)
        ) AS item
        FROM public.crm_campaign_approval_events e
        WHERE e.campaign_id = p_campaign_id AND e.tenant_id = v_tenant
        ORDER BY e.created_at DESC LIMIT 30
      ) h
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_campaign_for_approval(p_campaign_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_access jsonb := public.get_current_crm_access();
  v_tenant uuid := (v_access->>'tenantId')::uuid;
  v_campaign public.crm_campaigns;
  v_fingerprint text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(v_access->'permissions' ? 'campaigns.write', false) THEN
    RAISE EXCEPTION 'Campaign editing permission required' USING ERRCODE = '42501';
  END IF;
  SELECT c.* INTO v_campaign FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id AND c.tenant_id = v_tenant FOR UPDATE;
  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(v_campaign.status, 'draft') <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft can be sent for approval' USING ERRCODE = '23514';
  END IF;
  v_fingerprint := public.campaign_approval_fingerprint(v_campaign);

  UPDATE public.crm_campaign_approvals
     SET state = CASE WHEN state = 'pending' THEN 'withdrawn' ELSE 'invalidated' END,
         invalidated_at = now(), invalidated_reason = 'Sent for approval again'
   WHERE campaign_id = p_campaign_id AND state IN ('pending', 'approved');

  INSERT INTO public.crm_campaign_approvals
    (tenant_id, campaign_id, state, fingerprint, recipient_estimate, submitted_by, submit_note)
  VALUES (v_tenant, p_campaign_id, 'pending', v_fingerprint, v_campaign.projected_recipient_count,
    auth.uid(), nullif(left(btrim(coalesce(p_note, '')), 2000), ''))
  RETURNING id INTO v_id;

  INSERT INTO public.crm_campaign_approval_events (tenant_id, campaign_id, approval_id, event, actor_user_id, fingerprint)
  VALUES (v_tenant, p_campaign_id, v_id, 'submitted', auth.uid(), v_fingerprint);
  RETURN jsonb_build_object('ok', true, 'approvalId', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_campaign_approval(
  p_campaign_id uuid, p_decision text, p_reviewed_fingerprint text, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_access jsonb := public.get_current_crm_access();
  v_tenant uuid := (v_access->>'tenantId')::uuid;
  v_campaign public.crm_campaigns;
  v_row public.crm_campaign_approvals;
  v_fingerprint text;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 2000), '');
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(v_access->'permissions' ? 'campaigns.approve', false) THEN
    RAISE EXCEPTION 'Campaign approval permission required' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approve', 'request_changes') THEN
    RAISE EXCEPTION 'Unknown decision' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'request_changes' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Say what needs to change' USING ERRCODE = '22023';
  END IF;
  SELECT c.* INTO v_campaign FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id AND c.tenant_id = v_tenant FOR UPDATE;
  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT a.* INTO v_row FROM public.crm_campaign_approvals a
  WHERE a.campaign_id = p_campaign_id AND a.state = 'pending' FOR UPDATE;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  -- The approval covers exactly what the approver looked at.
  v_fingerprint := public.campaign_approval_fingerprint(v_campaign);
  IF v_fingerprint <> v_row.fingerprint OR v_fingerprint IS DISTINCT FROM p_reviewed_fingerprint THEN
    IF v_fingerprint <> v_row.fingerprint THEN
      UPDATE public.crm_campaign_approvals
         SET state = 'invalidated', invalidated_at = now(),
             invalidated_reason = 'Edited after it was sent for approval'
       WHERE id = v_row.id;
      INSERT INTO public.crm_campaign_approval_events (tenant_id, campaign_id, approval_id, event, actor_user_id, detail)
      VALUES (v_tenant, p_campaign_id, v_row.id, 'invalidated', auth.uid(),
        jsonb_build_object('reason', 'Edited after it was sent for approval'));
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'changed');
  END IF;

  UPDATE public.crm_campaign_approvals
     SET state = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'changes_requested' END,
         decided_by = auth.uid(), decided_at = now(), decision_note = v_note
   WHERE id = v_row.id;
  INSERT INTO public.crm_campaign_approval_events (tenant_id, campaign_id, approval_id, event, actor_user_id, fingerprint, detail)
  VALUES (v_tenant, p_campaign_id, v_row.id,
    CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'changes_requested' END,
    auth.uid(), v_fingerprint, jsonb_build_object('note', v_note));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_approval_setting()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_access jsonb := public.get_current_crm_access();
  v_tenant uuid := (v_access->>'tenantId')::uuid;
BEGIN
  RETURN jsonb_build_object(
    'required', public.campaign_approval_required(v_tenant),
    'canManage', coalesce(v_access->'permissions' ? 'access.manage', false),
    'canApprove', coalesce(v_access->'permissions' ? 'campaigns.approve', false),
    'waiting', (SELECT count(*) FROM public.crm_campaign_approvals a WHERE a.tenant_id = v_tenant AND a.state = 'pending')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_campaign_approval_required(p_required boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_access jsonb := public.get_current_crm_access();
  v_tenant uuid := (v_access->>'tenantId')::uuid;
  v_held integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(v_access->'permissions' ? 'access.manage', false) THEN
    RAISE EXCEPTION 'Only an administrator can change this' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.crm_campaign_approval_settings (tenant_id, approval_required, updated_by, updated_at)
  VALUES (v_tenant, coalesce(p_required, false), auth.uid(), now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET approval_required = EXCLUDED.approval_required, updated_by = EXCLUDED.updated_by, updated_at = now();
  IF coalesce(p_required, false) THEN
    -- Emails already on the schedule now wait for approval. Tell the caller.
    SELECT count(*) INTO v_held FROM public.crm_campaigns c
    WHERE c.tenant_id = v_tenant AND c.status = 'scheduled' AND NOT public.campaign_send_approval_ok(c);
  END IF;
  INSERT INTO public.crm_campaign_approval_events (tenant_id, event, actor_user_id, detail)
  VALUES (v_tenant, 'setting_changed', auth.uid(),
    jsonb_build_object('required', coalesce(p_required, false), 'scheduledNowWaiting', v_held));
  RETURN jsonb_build_object('ok', true, 'required', coalesce(p_required, false), 'scheduledNowWaiting', v_held);
END;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_approval(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_campaign_for_approval(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_campaign_approval(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_campaign_approval_setting() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_campaign_approval_required(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_campaign_for_approval(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_campaign_approval(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_approval_setting() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_campaign_approval_required(boolean) TO authenticated;

-- For edge functions (service role only): is this email cleared to send?
-- send-email-campaign calls this before it queues a single message.
CREATE OR REPLACE FUNCTION public.campaign_send_approval_check(p_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT public.campaign_send_approval_ok(c) FROM public.crm_campaigns c WHERE c.id = p_campaign_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.campaign_send_approval_check(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_send_approval_check(uuid) TO service_role;
