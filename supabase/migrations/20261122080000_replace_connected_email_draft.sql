-- Explicit source review creates an unscheduled draft without copying recipients.
CREATE FUNCTION public.replace_connected_email_draft(
  p_tenant_id uuid, p_campaign_id uuid, p_expected_updated_at timestamptz,
  p_blocks jsonb, p_content text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_original public.crm_campaigns;
  v_id uuid;
  v_source jsonb;
  v_sources jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_tenant_permission(p_tenant_id,'campaign.write',NULL::uuid) THEN
    RAISE EXCEPTION 'You cannot review campaigns in this business' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_original FROM public.crm_campaigns WHERE id=p_campaign_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign unavailable'; END IF;
  IF nullif(v_original.metadata->>'contentReviewReplacementId','') IS NOT NULL THEN
    SELECT id INTO v_id FROM public.crm_campaigns
      WHERE id=(v_original.metadata->>'contentReviewReplacementId')::uuid AND tenant_id=p_tenant_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Replacement draft unavailable'; END IF;
    RETURN v_id;
  END IF;
  IF v_original.status IS DISTINCT FROM 'paused' OR v_original.send_blocked_reason IS DISTINCT FROM 'connected_content_review' THEN
    RAISE EXCEPTION 'This campaign does not need website content review';
  END IF;
  IF p_expected_updated_at IS NULL OR v_original.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Campaign changed. Refresh the review before continuing';
  END IF;
  IF p_blocks IS NULL OR jsonb_typeof(p_blocks)<>'array' OR jsonb_array_length(p_blocks) NOT BETWEEN 1 AND 200
    OR p_content IS NULL OR length(p_content)>2000000 THEN
    RAISE EXCEPTION 'Invalid refreshed newsletter';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_blocks) b WHERE jsonb_typeof(b)<>'object' OR nullif(b->>'type','') IS NULL) THEN
    RAISE EXCEPTION 'Invalid newsletter block';
  END IF;
  SELECT coalesce(jsonb_agg(b->'connectedContent'),'[]'::jsonb) INTO v_sources
    FROM jsonb_array_elements(p_blocks) b WHERE b ? 'connectedContent' AND b->'visible' IS DISTINCT FROM 'false'::jsonb;
  IF jsonb_array_length(v_sources) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid website source manifest'; END IF;
  FOR v_source IN SELECT * FROM jsonb_array_elements(v_sources) LOOP
    IF jsonb_typeof(v_source)<>'object' OR nullif(v_source->>'itemId','') IS NULL
      OR coalesce(v_source->>'type','') NOT IN ('event','page','product','blog','fundraiser')
      OR nullif(v_source->>'updatedAt','') IS NULL OR coalesce(v_source->>'publicUrl','') NOT LIKE 'https://%'
      OR NOT EXISTS (SELECT 1 FROM public.crm_connected_websites w WHERE w.tenant_id=p_tenant_id
        AND w.cms_site_id::text=v_source->>'siteId' AND w.status='active') THEN
      RAISE EXCEPTION 'Website source is unavailable in this business';
    END IF;
  END LOOP;
  INSERT INTO public.crm_campaigns (
    tenant_id,user_id,name,subject_line,preheader_text,preheader,content,status,scheduled_at,auto_send_enabled,
    sender_name,sender_display_name,sender_email,actual_sender_email,from_email_domain_id,delivery_method,
    source_campaign_id,include_all_customers,additional_customer_ids,segment_id,persona_ids,projected_recipient_count,metadata
  ) VALUES (
    p_tenant_id,auth.uid(),v_original.name||' (Reviewed)',v_original.subject_line,v_original.preheader_text,v_original.preheader,
    p_content,'draft',NULL,false,v_original.sender_name,v_original.sender_display_name,v_original.sender_email,
    v_original.actual_sender_email,v_original.from_email_domain_id,v_original.delivery_method,
    p_campaign_id,false,'{}'::uuid[],NULL,'{}'::uuid[],0,
    jsonb_build_object('campaignType','email','replyTo',v_original.metadata->>'replyTo','contentBlocks',p_blocks,
      'connectedContentSources',v_sources,'includeAllCustomers',false,'additionalCustomerIds','[]'::jsonb,
      'sourceSegmentId',NULL,'sourcePersonaId',NULL,'reviewedFromCampaignId',p_campaign_id)
  ) RETURNING id INTO v_id;
  INSERT INTO public.campaign_blocks(campaign_id,block_type,content,headline,image_url,cta_text,cta_url,source,order_index)
    SELECT v_id,b->>'type',b,coalesce(b->>'headline',b->>'title'),coalesce(b->>'imageUrl',b->>'backgroundImageUrl'),
      coalesce(b->>'buttonText',b->>'ctaText'),coalesce(b->>'buttonUrl',b->>'ctaUrl'),'manual',(ordinality-1)::integer
    FROM jsonb_array_elements(p_blocks) WITH ORDINALITY AS x(b,ordinality);
  -- Never clear a live claim or an uncertain provider outcome: receipts must still reconcile.
  UPDATE public.email_messages SET status='skipped',error_message='Superseded after website content review',
    dead_lettered_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE campaign_id=p_campaign_id AND tenant_id=p_tenant_id AND status IN ('queued','paused')
      AND resend_id IS NULL AND claim_token IS NULL AND NOT delivery_reconciliation_required;
  UPDATE public.email_send_jobs j SET status='failed',error_message='Superseded after website content review',updated_at=clock_timestamp()
    WHERE j.campaign_id=p_campaign_id AND j.tenant_id=p_tenant_id AND j.status IN ('pending','paused') AND j.claim_token IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.email_messages m WHERE m.id=ANY(j.recipient_message_ids)
        AND (m.claim_token IS NOT NULL OR m.delivery_reconciliation_required OR m.status='sending'));
  UPDATE public.crm_campaigns SET metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{contentReviewReplacementId}',to_jsonb(v_id::text)),
    auto_send_enabled=false,updated_at=clock_timestamp() WHERE id=p_campaign_id AND tenant_id=p_tenant_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_connected_email_draft(uuid,uuid,timestamptz,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.replace_connected_email_draft(uuid,uuid,timestamptz,jsonb,text) TO authenticated;
