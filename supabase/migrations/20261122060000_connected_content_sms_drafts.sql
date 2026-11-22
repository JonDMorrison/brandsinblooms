-- Promoted texts use the existing SMS queue. No recipients or schedule on creation.
ALTER TABLE public.crm_sms_campaigns
  ADD COLUMN connected_content_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN audience_confirmed boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT sms_connected_sources_array CHECK (jsonb_typeof(connected_content_sources) = 'array'),
  ADD CONSTRAINT sms_explicit_audience_before_launch CHECK (
    audience_confirmed OR (status = 'draft' AND scheduled_at IS NULL)
  );

CREATE FUNCTION public.save_connected_sms_draft(
  p_tenant_id uuid, p_campaign_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_message text, p_media_urls jsonb, p_sources jsonb,
  p_audience jsonb, p_launch boolean, p_scheduled_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_campaign public.crm_sms_campaigns;
  v_source jsonb;
  v_type text := p_audience->>'type';
  v_segment uuid;
  v_personas text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'campaign.write', NULL::uuid) THEN
    RAISE EXCEPTION 'You do not have permission to save campaigns for this business' USING ERRCODE = '42501';
  END IF;
  IF p_launch AND NOT public.has_tenant_permission(p_tenant_id, 'campaign.send', NULL::uuid) THEN
    RAISE EXCEPTION 'You do not have permission to launch campaigns for this business' USING ERRCODE = '42501';
  END IF;
  IF p_launch IS NULL OR p_name IS NULL OR length(btrim(p_name)) = 0 OR length(p_name) > 180
    OR p_message IS NULL OR length(p_message) > 10000
    OR jsonb_typeof(p_media_urls) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid text draft';
  END IF;
  IF p_campaign_id IS NULL THEN
    IF p_launch OR p_audience IS NOT NULL OR p_scheduled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Create a draft before choosing an audience';
    END IF;
    IF jsonb_typeof(p_sources) IS DISTINCT FROM 'array' OR jsonb_array_length(p_sources) NOT BETWEEN 1 AND 50 THEN
      RAISE EXCEPTION 'A connected source is required';
    END IF;
    FOR v_source IN SELECT value FROM jsonb_array_elements(p_sources) LOOP
      IF coalesce(v_source->>'type','') NOT IN ('event','page','product','blog','fundraiser')
        OR nullif(v_source->>'itemId','') IS NULL OR nullif(v_source->>'updatedAt','') IS NULL
        OR coalesce(v_source->>'publicUrl','') !~ '^https://'
        OR NOT EXISTS (SELECT 1 FROM public.crm_connected_websites AS connection
          WHERE connection.tenant_id = p_tenant_id AND connection.status = 'active'
            AND connection.cms_site_id::text = v_source->>'siteId') THEN
        RAISE EXCEPTION 'The content source is not connected to this business';
      END IF;
    END LOOP;
    INSERT INTO public.crm_sms_campaigns (tenant_id,user_id,name,message,media_urls,status,source,
      connected_content_sources,audience_confirmed,metrics)
    VALUES (p_tenant_id,auth.uid(),btrim(p_name),p_message,p_media_urls,'draft','connected_content',
      p_sources,false,'{"segment_filter":{"type":"none"}}'::jsonb)
    RETURNING * INTO v_campaign;
  ELSE
    SELECT * INTO v_campaign FROM public.crm_sms_campaigns
      WHERE id=p_campaign_id AND tenant_id=p_tenant_id AND source='connected_content' FOR UPDATE;
    IF NOT FOUND OR v_campaign.status <> 'draft' THEN
      RAISE EXCEPTION 'This text draft is unavailable or has already been launched';
    END IF;
    IF p_expected_updated_at IS NULL OR v_campaign.updated_at <> p_expected_updated_at THEN
      RAISE EXCEPTION 'This draft changed in another window. Reopen it before saving';
    END IF;
    IF p_audience IS NOT NULL AND (v_type IS NULL OR v_type NOT IN ('all','segment','persona')) THEN
      RAISE EXCEPTION 'Choose a supported audience';
    END IF;
    IF v_type='segment' THEN
      v_segment := (p_audience->>'id')::uuid;
      IF v_segment IS NULL OR NOT EXISTS (SELECT 1 FROM public.crm_segments WHERE id=v_segment AND tenant_id=p_tenant_id) THEN
        RAISE EXCEPTION 'Choose a segment in this business';
      END IF;
    ELSIF v_type='persona' THEN
      IF nullif(p_audience->>'id','') IS NULL THEN RAISE EXCEPTION 'Choose a persona'; END IF;
      v_personas := ARRAY[p_audience->>'id'];
    END IF;
    IF p_launch AND (p_audience IS NULL OR length(btrim(p_message))=0) THEN
      RAISE EXCEPTION 'Choose an audience and write a message before launch';
    END IF;
    IF p_scheduled_at IS NOT NULL AND (NOT p_launch OR p_scheduled_at <= now()) THEN
      RAISE EXCEPTION 'Choose a future schedule when launching';
    END IF;
    UPDATE public.crm_sms_campaigns SET name=btrim(p_name),message=p_message,media_urls=p_media_urls,
      segment_id=v_segment,targeting_persona_ids=v_personas,
      targeting_persona_names=CASE WHEN v_type='persona' THEN ARRAY[p_audience->>'name'] ELSE NULL END,
      targeting_logic=CASE WHEN v_type='persona' THEN 'any' ELSE NULL END,
      metrics=coalesce(metrics,'{}'::jsonb) || jsonb_build_object('segment_filter',jsonb_build_object(
        'type',CASE WHEN v_type='segment' THEN 'custom' ELSE coalesce(v_type,'none') END,
        'segment_id',v_segment,'system_segment_type',NULL)),
      audience_confirmed=p_launch,scheduled_at=p_scheduled_at,
      status=CASE WHEN p_scheduled_at IS NOT NULL THEN 'scheduled' ELSE 'draft' END,
      updated_at=clock_timestamp()
      WHERE id=p_campaign_id AND tenant_id=p_tenant_id RETURNING * INTO v_campaign;
  END IF;
  RETURN to_jsonb(v_campaign);
END;
$$;
REVOKE ALL ON FUNCTION public.save_connected_sms_draft(uuid,uuid,timestamptz,text,text,jsonb,jsonb,jsonb,boolean,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_connected_sms_draft(uuid,uuid,timestamptz,text,text,jsonb,jsonb,jsonb,boolean,timestamptz) TO authenticated;
