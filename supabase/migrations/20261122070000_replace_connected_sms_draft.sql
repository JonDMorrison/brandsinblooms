-- Explicit owner review creates a new draft; already-sent copy stays immutable.
CREATE FUNCTION public.replace_connected_sms_draft(
  p_tenant_id uuid, p_campaign_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_message text, p_sources jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_original public.crm_sms_campaigns;
  v_replacement public.crm_sms_campaigns;
  v_draft jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'campaign.write', NULL::uuid) THEN
    RAISE EXCEPTION 'You do not have permission to review campaigns for this business' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_original FROM public.crm_sms_campaigns
    WHERE id=p_campaign_id AND tenant_id=p_tenant_id AND source='connected_content' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This website campaign is unavailable'; END IF;
  -- A retry after a lost response must not create another draft or cancel new work.
  IF nullif(v_original.metrics->>'replacement_campaign_id','') IS NOT NULL THEN
    SELECT * INTO v_replacement FROM public.crm_sms_campaigns
      WHERE id=(v_original.metrics->>'replacement_campaign_id')::uuid AND tenant_id=p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The replacement draft is no longer available'; END IF;
    RETURN to_jsonb(v_replacement);
  END IF;
  IF v_original.status <> 'paused' OR v_original.metrics->'content_review'->>'decision' IS DISTINCT FROM 'review_required' THEN
    RAISE EXCEPTION 'Pause and review the changed website campaign before replacing it';
  END IF;
  IF p_expected_updated_at IS NULL OR v_original.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'This campaign changed in another window. Refresh before reviewing';
  END IF;
  v_draft := public.save_connected_sms_draft(p_tenant_id,NULL,NULL,p_name,p_message,'[]'::jsonb,p_sources,NULL,false,NULL);
  -- Stop only unsent work. Sent/delivered records and their reporting remain intact.
  UPDATE public.sms_send_jobs SET status='failed',error_message='Superseded after website content review',
    dead_lettered_at=clock_timestamp(),claimed_at=NULL,claimed_by=NULL,claim_token=NULL,updated_at=clock_timestamp()
    WHERE campaign_id=p_campaign_id AND tenant_id=p_tenant_id AND status IN ('pending','in_progress');
  UPDATE public.sms_messages SET status='failed',error_code='CONTENT_SUPERSEDED',
    error_message='Superseded after website content review',dead_lettered_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE campaign_id=p_campaign_id AND tenant_id=p_tenant_id AND status='queued' AND twilio_sid IS NULL;
  UPDATE public.crm_sms_campaigns SET
    metrics=coalesce(metrics,'{}'::jsonb) || jsonb_build_object('replacement_campaign_id',v_draft->>'id'),
    updated_at=clock_timestamp()
    WHERE id=p_campaign_id AND tenant_id=p_tenant_id;
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_connected_sms_draft(uuid,uuid,timestamptz,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_connected_sms_draft(uuid,uuid,timestamptz,text,text,jsonb) TO authenticated;

-- A worker may record a review while delivery counters advance in another transaction.
-- Merge only the review key under the row lock; never write a stale metrics snapshot.
CREATE FUNCTION public.record_sms_content_review(
  p_tenant_id uuid, p_campaign_id uuid, p_expected_status text,
  p_decision text, p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_updated integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('review_required','retry') THEN
    RAISE EXCEPTION 'Invalid content review decision';
  END IF;
  UPDATE public.crm_sms_campaigns SET
    metrics=jsonb_set(coalesce(metrics,'{}'::jsonb),'{content_review}',jsonb_build_object(
      'decision',p_decision,'reason',left(p_reason,500),'checked_at',clock_timestamp())),
    status=CASE WHEN p_decision='review_required' THEN 'paused' ELSE status END,
    updated_at=clock_timestamp()
    WHERE id=p_campaign_id AND tenant_id=p_tenant_id AND status=p_expected_status
      AND status IN ('draft','scheduled','queued','sending','paused');
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  RETURN v_updated=1;
END;
$$;
REVOKE ALL ON FUNCTION public.record_sms_content_review(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sms_content_review(uuid,uuid,text,text,text) TO service_role;

-- Queue payloads keep their source version even if campaign metadata is later edited.
-- NULL identifies legacy payloads; [] explicitly means no connected sources.
ALTER TABLE public.email_messages ADD COLUMN connected_content_sources jsonb,
  ADD CONSTRAINT email_message_connected_sources_array CHECK (
    connected_content_sources IS NULL OR jsonb_typeof(connected_content_sources)='array'
  );
