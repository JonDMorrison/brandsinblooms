BEGIN;
-- Delivery counters and provider reconciliation remain writable. A reviewed
-- original is immutable marketing copy; only a separately created draft can send.
CREATE FUNCTION public.protect_connected_campaign_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_row jsonb:=to_jsonb(OLD); after_row jsonb:=to_jsonb(NEW);
 prior_marker text; next_marker text; field text; protected_fields text[];
BEGIN
 IF TG_TABLE_NAME='crm_campaigns' THEN
  prior_marker:=nullif(OLD.metadata->>'contentReviewReplacementId','');
  IF OLD.send_blocked_reason IS DISTINCT FROM 'connected_content_review' AND prior_marker IS NULL THEN RETURN NEW; END IF;
  IF OLD.send_blocked_reason='connected_content_review' AND NEW.send_blocked_reason IS DISTINCT FROM OLD.send_blocked_reason THEN RAISE EXCEPTION 'Website review hold cannot be cleared; use the reviewed draft' USING ERRCODE='23514'; END IF;
  IF NEW.auto_send_enabled AND NOT coalesce(OLD.auto_send_enabled,false) THEN RAISE EXCEPTION 'Reviewed original cannot be scheduled' USING ERRCODE='23514'; END IF;
  protected_fields:=ARRAY['id','tenant_id','user_id','content','subject_line','preheader_text','preheader','sender_name','sender_display_name','sender_email','actual_sender_email','from_email_domain_id','delivery_method','include_all_customers','additional_customer_ids','segment_id','persona_ids','source_campaign_id'];
  FOREACH field IN ARRAY ARRAY['contentBlocks','connectedContentSources','campaignType','replyTo','includeAllCustomers','include_all_customers','additionalCustomerIds','additional_customer_ids','sourceSegmentId','sourcePersonaId'] LOOP
   IF NEW.metadata->field IS DISTINCT FROM OLD.metadata->field THEN RAISE EXCEPTION 'Reviewed newsletter copy and audience cannot be edited' USING ERRCODE='23514'; END IF;
  END LOOP;
  next_marker:=nullif(NEW.metadata->>'contentReviewReplacementId','');
  IF prior_marker IS NOT NULL AND next_marker IS DISTINCT FROM prior_marker THEN RAISE EXCEPTION 'Newsletter replacement reference is permanent' USING ERRCODE='23514'; END IF;
  IF prior_marker IS NULL AND next_marker IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.crm_campaigns c WHERE c.id=next_marker::uuid AND c.tenant_id=OLD.tenant_id AND c.source_campaign_id=OLD.id
    AND c.status='draft' AND c.scheduled_at IS NULL AND NOT c.include_all_customers AND NOT c.auto_send_enabled
  ) THEN RAISE EXCEPTION 'Reviewed replacement must be a new tenant draft without a schedule' USING ERRCODE='23514'; END IF;
 ELSE
  prior_marker:=nullif(OLD.metrics->>'replacement_campaign_id','');
  IF OLD.metrics#>>'{content_review,decision}' IS DISTINCT FROM 'review_required' AND prior_marker IS NULL THEN RETURN NEW; END IF;
  IF OLD.metrics#>>'{content_review,decision}'='review_required' AND NEW.metrics#>>'{content_review,decision}' IS DISTINCT FROM 'review_required' THEN RAISE EXCEPTION 'Website review hold cannot be cleared; use the reviewed draft' USING ERRCODE='23514'; END IF;
  protected_fields:=ARRAY['id','tenant_id','user_id','message','media_urls','image_url','from_phone','sending_identity_id','segment_id','targeting_persona_ids','targeting_persona_names','targeting_logic','connected_content_sources','audience_confirmed','source'];
  IF NEW.metrics->'segment_filter' IS DISTINCT FROM OLD.metrics->'segment_filter' THEN RAISE EXCEPTION 'Reviewed text audience cannot be edited' USING ERRCODE='23514'; END IF;
  next_marker:=nullif(NEW.metrics->>'replacement_campaign_id','');
  IF prior_marker IS NOT NULL AND next_marker IS DISTINCT FROM prior_marker THEN RAISE EXCEPTION 'Text replacement reference is permanent' USING ERRCODE='23514'; END IF;
  IF prior_marker IS NULL AND next_marker IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.crm_sms_campaigns c WHERE c.id=next_marker::uuid AND c.tenant_id=OLD.tenant_id
    AND c.id<>OLD.id AND c.status='draft' AND c.scheduled_at IS NULL AND NOT c.audience_confirmed
  ) THEN RAISE EXCEPTION 'Reviewed replacement must be a new tenant draft without an audience' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN('draft','scheduled','queued','sending','enqueuing','partially_queued','processing') THEN RAISE EXCEPTION 'Reviewed original cannot resume; open the reviewed draft' USING ERRCODE='23514'; END IF;
 IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN RAISE EXCEPTION 'Reviewed original cannot be scheduled' USING ERRCODE='23514'; END IF;
 FOREACH field IN ARRAY protected_fields LOOP
  IF after_row->field IS DISTINCT FROM before_row->field THEN RAISE EXCEPTION 'Reviewed original content and audience are immutable' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_connected_campaign_review() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_connected_email_review BEFORE UPDATE ON public.crm_campaigns FOR EACH ROW EXECUTE FUNCTION public.protect_connected_campaign_review();
CREATE TRIGGER protect_connected_sms_review BEFORE UPDATE ON public.crm_sms_campaigns FOR EACH ROW EXECUTE FUNCTION public.protect_connected_campaign_review();

CREATE FUNCTION public.protect_connected_email_review_blocks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign_id uuid; row public.crm_campaigns;
BEGIN
 -- Reassignment must not move blocks out of (or into) an immutable original.
 FOR campaign_id IN SELECT DISTINCT id FROM unnest(CASE WHEN TG_OP='INSERT' THEN ARRAY[NEW.campaign_id] WHEN TG_OP='DELETE' THEN ARRAY[OLD.campaign_id] ELSE ARRAY[OLD.campaign_id,NEW.campaign_id] END) id ORDER BY id LOOP
  SELECT * INTO row FROM public.crm_campaigns c WHERE c.id=campaign_id FOR SHARE;
  IF row.send_blocked_reason='connected_content_review' OR nullif(row.metadata->>'contentReviewReplacementId','') IS NOT NULL THEN RAISE EXCEPTION 'Reviewed newsletter blocks are immutable; edit the reviewed draft' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_connected_email_review_blocks() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_connected_email_review_blocks BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_blocks FOR EACH ROW EXECUTE FUNCTION public.protect_connected_email_review_blocks();
COMMIT;
