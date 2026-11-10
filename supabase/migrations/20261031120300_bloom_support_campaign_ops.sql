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

-- Everything a person must see before a consequential campaign action: who the
-- client is, who receives it, what it says, when it goes. The fingerprint lets
-- execution refuse if any of it changed after the preview.
CREATE OR REPLACE FUNCTION bloom_support.campaign_snapshot(p_tenant uuid, p_campaign uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c record; segs jsonb; snap jsonb;
BEGIN
  SELECT * INTO c FROM public.crm_campaigns WHERE id = p_campaign AND tenant_id = p_tenant;
  IF c.id IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)), '[]') INTO segs
  FROM public.crm_segments s
  WHERE s.tenant_id = p_tenant AND (s.id = c.segment_id OR s.id IN (SELECT cs.segment_id FROM public.campaign_segments cs WHERE cs.campaign_id = c.id));
  snap := jsonb_build_object(
    'client', (SELECT jsonb_build_object('tenant_id', t.id, 'name', t.name) FROM public.tenants t WHERE t.id = p_tenant),
    'audience', jsonb_build_object('segments', segs, 'include_all_customers', coalesce(c.include_all_customers, false),
       'additional_customers', coalesce(cardinality(c.additional_customer_ids), 0), 'projected_recipients', c.projected_recipient_count),
    'content', jsonb_build_object('channel', c.delivery_method, 'subject', c.subject_line, 'preheader', c.preheader_text,
       'sender_name', c.sender_name, 'sender_email', c.sender_email, 'excerpt', left(regexp_replace(coalesce(c.content, ''), '<[^>]+>', ' ', 'g'), 400),
       'content_length', length(coalesce(c.content, ''))),
    'timing', jsonb_build_object('scheduled_at', c.scheduled_at, 'timezone', c.metadata->>'scheduled_timezone'),
    'campaign', jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'send_blocked_reason', c.send_blocked_reason));
  -- The fingerprint covers everything that decides who receives what, not just the preview: the full
  -- body, every additional recipient (sorted), the template and the sender, so any change after the
  -- preview, even one the excerpt or the counts would not show, refuses execution.
  RETURN snap || jsonb_build_object('fingerprint', md5(
    (snap->'audience')::text || (snap->'content')::text || coalesce(c.status, '') || '|' ||
    md5(coalesce(c.content, '')) || '|' ||
    coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(c.additional_customer_ids) x), '') || '|' ||
    coalesce(to_jsonb(c)->>'template_id', '') || '|' || coalesce(to_jsonb(c)->>'sender_display_name', '') || '|' ||
    coalesce(to_jsonb(c)->>'from_email_domain_id', '')));
END $$;

CREATE OR REPLACE FUNCTION bloom_support.campaign_schedule(p_actor uuid, p_account uuid, p_campaign uuid, p_at timestamptz, p_timezone text, p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := bloom_support.campaign_tenant_for_account(p_actor, p_account, 'ops.campaign.send'); c record; snap jsonb;
BEGIN
  IF p_at IS NULL OR p_at < now() + interval '1 minute' THEN RAISE EXCEPTION 'invalid: schedule time must be at least one minute in the future' USING ERRCODE = '22023'; END IF;
  SELECT id, tenant_id, status, scheduled_at, name INTO c FROM public.crm_campaigns WHERE id = p_campaign FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'not_found: campaign' USING ERRCODE = 'P0002'; END IF;
  IF c.tenant_id IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'forbidden: campaign belongs to another tenant' USING ERRCODE = '42501'; END IF;
  IF lower(coalesce(c.status, '')) IN ('sending', 'sent', 'queued', 'partially_queued') THEN RAISE EXCEPTION 'invalid: campaign is locked (%)', c.status USING ERRCODE = '22023'; END IF;
  snap := bloom_support.campaign_snapshot(v_tenant, p_campaign);
  IF p_fingerprint IS NULL OR snap->>'fingerprint' IS DISTINCT FROM p_fingerprint THEN
    RAISE EXCEPTION 'conflict: the campaign''s audience or content changed after the preview — preview again' USING ERRCODE = '40001';
  END IF;
  IF coalesce(btrim(snap->'content'->>'subject'), '') = '' AND snap->'content'->>'channel' IS DISTINCT FROM 'sms' THEN RAISE EXCEPTION 'invalid: campaign has no subject line' USING ERRCODE = '22023'; END IF;
  IF (snap->'content'->>'content_length')::int = 0 THEN RAISE EXCEPTION 'invalid: campaign has no content' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(snap->'audience'->'segments') = 0 AND NOT (snap->'audience'->>'include_all_customers')::boolean
     AND (snap->'audience'->>'additional_customers')::int = 0 THEN
    RAISE EXCEPTION 'invalid: campaign has no audience' USING ERRCODE = '22023';
  END IF;
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
  r := bloom_support.campaign_snapshot(v_tenant, p_campaign);
  IF r IS NULL THEN RAISE EXCEPTION 'not_found: campaign for this account' USING ERRCODE = 'P0002'; END IF;
  -- Flattened fields kept for existing callers.
  RETURN r || jsonb_build_object('id', r->'campaign'->'id', 'name', r->'campaign'->'name', 'status', r->'campaign'->'status',
    'scheduled_at', r->'timing'->'scheduled_at', 'subject_line', r->'content'->'subject', 'projected_recipient_count', r->'audience'->'projected_recipients');
END $$;

CREATE OR REPLACE FUNCTION bloom_support.campaign_list(p_actor uuid, p_account uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := bloom_support.campaign_tenant_for_account(p_actor, p_account, 'ops.campaign.edit');
BEGIN
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'subject_line', c.subject_line, 'status', c.status,
      'scheduled_at', c.scheduled_at, 'sent_at', c.sent_at, 'updated_at', c.updated_at) ORDER BY c.updated_at DESC), '[]')
    FROM (SELECT * FROM public.crm_campaigns WHERE tenant_id = v_tenant AND (p_status IS NULL OR status = p_status) ORDER BY updated_at DESC LIMIT 50) c);
END $$;

REVOKE ALL ON FUNCTION bloom_support.campaign_tenant_for_account(uuid, uuid, text), bloom_support.campaign_schedule(uuid, uuid, uuid, timestamptz, text, text), bloom_support.campaign_snapshot(uuid, uuid),
  bloom_support.campaign_unschedule(uuid, uuid, uuid), bloom_support.campaign_facts(uuid, uuid, uuid), bloom_support.campaign_list(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.campaign_schedule(uuid, uuid, uuid, timestamptz, text, text), bloom_support.campaign_snapshot(uuid, uuid), bloom_support.campaign_unschedule(uuid, uuid, uuid),
  bloom_support.campaign_facts(uuid, uuid, uuid), bloom_support.campaign_list(uuid, uuid, text) TO service_role;

-- Gateway extension (re-declared with the campaign entries added).
CREATE OR REPLACE FUNCTION public.bloom_support_ops_rpc(p_fn text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid := nullif(p->>'actor','')::uuid;
BEGIN
  CASE p_fn
    WHEN 'campaign_schedule' THEN RETURN bloom_support.campaign_schedule(a, (p->>'account_id')::uuid, (p->>'campaign_id')::uuid, (p->>'scheduled_at')::timestamptz, p->>'timezone', p->>'fingerprint');
    WHEN 'campaign_unschedule' THEN RETURN bloom_support.campaign_unschedule(a, (p->>'account_id')::uuid, (p->>'campaign_id')::uuid);
    WHEN 'campaign_facts' THEN RETURN bloom_support.campaign_facts(a, (p->>'account_id')::uuid, (p->>'campaign_id')::uuid);
    WHEN 'campaign_list' THEN RETURN bloom_support.campaign_list(a, (p->>'account_id')::uuid, p->>'status');
    WHEN 'campaign_tenant' THEN RETURN to_jsonb(bloom_support.campaign_tenant_for_account(a, (p->>'account_id')::uuid, p->>'permission'));
    ELSE RAISE EXCEPTION 'unknown bloom_support ops function %', p_fn USING ERRCODE = '42883';
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_ops_rpc(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_ops_rpc(text, jsonb) TO service_role;
