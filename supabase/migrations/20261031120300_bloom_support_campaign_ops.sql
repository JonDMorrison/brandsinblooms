-- Bloom Support — campaign scheduling for platform staff across tenants.
--
-- public.set_campaign_schedule / clear_campaign_schedule authorize by the
-- caller's own CRM tenant (auth.uid()), so a platform operator cannot use them
-- for a client tenant. These functions apply the same state change and the
-- same lock rule ("sending"/"sent" campaigns are locked), but authorize through
-- Bloom: ops.campaign.send on an account linked to the campaign's tenant.
-- Actual sending still happens through the existing claim_scheduled_campaigns
-- → auto-send-campaigns pipeline with all of its governance gates.

CREATE OR REPLACE FUNCTION bloom_support.campaign_tenant_for_account(p_actor uuid, p_account uuid, p_permission text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, p_permission);
  IF NOT bloom_support.can_access_account(p_actor, p_account) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
  SELECT crm_tenant_id INTO v FROM bloom_support.accounts WHERE id = p_account;
  IF v IS NULL THEN RAISE EXCEPTION 'invalid: account has no linked BloomSuite CRM tenant' USING ERRCODE = '22023'; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.campaign_schedule(p_actor uuid, p_account uuid, p_campaign uuid, p_at timestamptz, p_timezone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := bloom_support.campaign_tenant_for_account(p_actor, p_account, 'ops.campaign.send'); c record;
BEGIN
  IF p_at IS NULL OR p_at < now() + interval '1 minute' THEN RAISE EXCEPTION 'invalid: schedule time must be at least one minute in the future' USING ERRCODE = '22023'; END IF;
  SELECT id, tenant_id, status, scheduled_at, name INTO c FROM public.crm_campaigns WHERE id = p_campaign FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'not_found: campaign' USING ERRCODE = 'P0002'; END IF;
  IF c.tenant_id IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'forbidden: campaign belongs to another tenant' USING ERRCODE = '42501'; END IF;
  IF lower(coalesce(c.status, '')) IN ('sending', 'sent', 'queued', 'partially_queued') THEN RAISE EXCEPTION 'invalid: campaign is locked (%)', c.status USING ERRCODE = '22023'; END IF;
  UPDATE public.crm_campaigns SET scheduled_at = p_at, status = 'scheduled', send_started_at = NULL, send_error = NULL, send_blocked_reason = NULL, updated_at = now(),
    metadata = CASE WHEN p_timezone IS NULL THEN metadata ELSE coalesce(metadata, '{}'::jsonb) || jsonb_build_object('scheduled_timezone', p_timezone) END
  WHERE id = p_campaign;
  RETURN jsonb_build_object('campaign_id', c.id, 'name', c.name, 'before', jsonb_build_object('status', c.status, 'scheduled_at', c.scheduled_at),
    'after', jsonb_build_object('status', 'scheduled', 'scheduled_at', p_at));
END $$;

CREATE OR REPLACE FUNCTION bloom_support.campaign_unschedule(p_actor uuid, p_account uuid, p_campaign uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := bloom_support.campaign_tenant_for_account(p_actor, p_account, 'ops.campaign.send'); c record;
BEGIN
  SELECT id, tenant_id, status, scheduled_at, name INTO c FROM public.crm_campaigns WHERE id = p_campaign FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'not_found: campaign' USING ERRCODE = 'P0002'; END IF;
  IF c.tenant_id IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'forbidden: campaign belongs to another tenant' USING ERRCODE = '42501'; END IF;
  IF lower(coalesce(c.status, '')) <> 'scheduled' THEN RAISE EXCEPTION 'invalid: only scheduled campaigns can be unscheduled (status %)', c.status USING ERRCODE = '22023'; END IF;
  UPDATE public.crm_campaigns SET scheduled_at = NULL, status = 'draft', send_started_at = NULL, send_error = NULL, send_blocked_reason = NULL, updated_at = now()
  WHERE id = p_campaign;
  RETURN jsonb_build_object('campaign_id', c.id, 'name', c.name, 'before', jsonb_build_object('status', c.status, 'scheduled_at', c.scheduled_at),
    'after', jsonb_build_object('status', 'draft', 'scheduled_at', NULL));
END $$;

-- Read-only campaign facts for preview/verification (tenant-scoped).
CREATE OR REPLACE FUNCTION bloom_support.campaign_facts(p_actor uuid, p_account uuid, p_campaign uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := bloom_support.campaign_tenant_for_account(p_actor, p_account, 'ops.campaign.edit'); r jsonb;
BEGIN
  SELECT jsonb_build_object('id', c.id, 'name', c.name, 'subject_line', c.subject_line, 'status', c.status, 'scheduled_at', c.scheduled_at,
    'sent_at', c.sent_at, 'projected_recipient_count', c.projected_recipient_count, 'total_recipients', c.total_recipients,
    'send_blocked_reason', c.send_blocked_reason, 'send_error', c.send_error, 'updated_at', c.updated_at)
  INTO r FROM public.crm_campaigns c WHERE c.id = p_campaign AND c.tenant_id = v_tenant;
  IF r IS NULL THEN RAISE EXCEPTION 'not_found: campaign for this account' USING ERRCODE = 'P0002'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.campaign_list(p_actor uuid, p_account uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := bloom_support.campaign_tenant_for_account(p_actor, p_account, 'ops.campaign.edit');
BEGIN
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'subject_line', c.subject_line, 'status', c.status,
      'scheduled_at', c.scheduled_at, 'sent_at', c.sent_at, 'updated_at', c.updated_at) ORDER BY c.updated_at DESC), '[]')
    FROM (SELECT * FROM public.crm_campaigns WHERE tenant_id = v_tenant AND (p_status IS NULL OR status = p_status) ORDER BY updated_at DESC LIMIT 50) c);
END $$;

REVOKE ALL ON FUNCTION bloom_support.campaign_tenant_for_account(uuid, uuid, text), bloom_support.campaign_schedule(uuid, uuid, uuid, timestamptz, text),
  bloom_support.campaign_unschedule(uuid, uuid, uuid), bloom_support.campaign_facts(uuid, uuid, uuid), bloom_support.campaign_list(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.campaign_schedule(uuid, uuid, uuid, timestamptz, text), bloom_support.campaign_unschedule(uuid, uuid, uuid),
  bloom_support.campaign_facts(uuid, uuid, uuid), bloom_support.campaign_list(uuid, uuid, text) TO service_role;

-- Gateway extension (re-declared with the campaign entries added).
CREATE OR REPLACE FUNCTION public.bloom_support_ops_rpc(p_fn text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid := nullif(p->>'actor','')::uuid;
BEGIN
  CASE p_fn
    WHEN 'campaign_schedule' THEN RETURN bloom_support.campaign_schedule(a, (p->>'account_id')::uuid, (p->>'campaign_id')::uuid, (p->>'scheduled_at')::timestamptz, p->>'timezone');
    WHEN 'campaign_unschedule' THEN RETURN bloom_support.campaign_unschedule(a, (p->>'account_id')::uuid, (p->>'campaign_id')::uuid);
    WHEN 'campaign_facts' THEN RETURN bloom_support.campaign_facts(a, (p->>'account_id')::uuid, (p->>'campaign_id')::uuid);
    WHEN 'campaign_list' THEN RETURN bloom_support.campaign_list(a, (p->>'account_id')::uuid, p->>'status');
    WHEN 'campaign_tenant' THEN RETURN to_jsonb(bloom_support.campaign_tenant_for_account(a, (p->>'account_id')::uuid, p->>'permission'));
    ELSE RAISE EXCEPTION 'unknown bloom_support ops function %', p_fn USING ERRCODE = '42883';
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_ops_rpc(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_ops_rpc(text, jsonb) TO service_role;
