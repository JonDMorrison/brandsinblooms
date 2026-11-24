BEGIN;
CREATE TABLE bloom_pos_private.care_website_followup_campaigns (
 campaign_id uuid PRIMARY KEY REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),request_id uuid NOT NULL,
 site_id uuid NOT NULL,product_id uuid NOT NULL,from_at timestamptz NOT NULL,until_at timestamptz NOT NULL,
 customer_ids uuid[] NOT NULL CHECK(cardinality(customer_ids) BETWEEN 1 AND 5000),
 audience_digest text NOT NULL CHECK(audience_digest~'^[a-f0-9]{64}$'),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,request_id)
);
ALTER TABLE bloom_pos_private.care_website_followup_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_pos_private.care_website_followup_campaigns FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION bloom_pos_private.website_care_candidates(p_tenant uuid,p_site uuid,p_ids uuid[] DEFAULT NULL)
RETURNS TABLE(customer_id uuid,user_id uuid,email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $care$
 SELECT DISTINCT c.id,l.storefront_user_id,lower(btrim(c.email))
 FROM public.crm_storefront_customer_links l
 JOIN public.crm_storefront_tenant_links t ON t.storefront_site_id=l.storefront_site_id AND t.crm_tenant_id=l.tenant_id AND t.enabled AND t.reviewed_at IS NOT NULL
 JOIN public.crm_connected_websites w ON w.cms_site_id=l.storefront_site_id AND w.tenant_id=l.tenant_id AND w.status='active'
 JOIN public.crm_customers c ON c.id=l.crm_customer_id AND c.tenant_id=l.tenant_id
 WHERE l.tenant_id=p_tenant AND l.storefront_site_id=p_site AND l.status='verified' AND l.reviewed_at IS NOT NULL
 AND l.reviewed_by IS NOT NULL AND lower(btrim(l.source_email))=lower(btrim(c.email))
 AND (p_ids IS NULL OR c.id=ANY(p_ids))
 AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL AND c.email_opt_in IS TRUE
 AND c.email_opt_in_at IS NOT NULL AND (c.email_opt_out_at IS NULL OR c.email_opt_out_at<c.email_opt_in_at)
 AND coalesce(c.opt_out,false)=false AND coalesce(c.suppressed,false)=false
 AND c.email IS NOT NULL AND btrim(c.email)~'^[^[:space:]@<>;,]+@[^[:space:]@<>;,]+\.[^[:space:]@<>;,]+$' AND NOT public.is_reserved_email_domain(c.email)
 AND EXISTS(SELECT 1 FROM public.crm_email_consent_events e WHERE e.tenant_id=c.tenant_id AND e.customer_id=c.id
 AND lower(btrim(e.email))=lower(btrim(c.email)) AND e.event_type IN('opt_in','imported_attested_express')
 AND NOT EXISTS(SELECT 1 FROM public.crm_email_consent_events q WHERE q.tenant_id=c.tenant_id AND q.customer_id=c.id AND q.event_type='opt_out' AND q.created_at>=e.created_at))
 AND NOT EXISTS(SELECT 1 FROM public.suppression_list s WHERE s.tenant_id=c.tenant_id AND (s.customer_id=c.id OR lower(btrim(s.email))=lower(btrim(c.email))) AND s.channel IN('email','all') AND s.lifted_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()))
 AND NOT EXISTS(SELECT 1 FROM public.global_email_suppression_list s WHERE lower(btrim(s.email))=lower(btrim(c.email)) AND s.lifted_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()));
$care$;
CREATE FUNCTION public.care_website_candidates(p_tenant uuid,p_site uuid,p_ids uuid[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 RETURN(SELECT coalesce(jsonb_agg(jsonb_build_object('customerId',q.customer_id,'userId',q.user_id)),'[]'::jsonb)
 FROM (SELECT customer_id,user_id FROM bloom_pos_private.website_care_candidates(p_tenant,p_site,p_ids) LIMIT 5001) q);
END $care$;
CREATE FUNCTION public.list_care_followup_websites(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
BEGIN
 PERFORM bloom_pos_private.assert_care_followup_editor(p_tenant);
 RETURN(SELECT coalesce(jsonb_agg(jsonb_build_object('siteId',w.cms_site_id,'name',w.site_name)),'[]'::jsonb)
 FROM public.crm_connected_websites w JOIN public.crm_storefront_tenant_links t ON t.storefront_site_id=w.cms_site_id AND t.crm_tenant_id=w.tenant_id
 WHERE w.tenant_id=p_tenant AND w.status='active' AND t.enabled AND t.reviewed_at IS NOT NULL);
END $care$;
CREATE FUNCTION public.create_website_care_followup_draft(p_tenant uuid,p_actor uuid,p_site uuid,p_product uuid,p_from timestamptz,p_until timestamptz,p_ids uuid[],p_digest text,p_request uuid,p_label text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $care$
DECLARE ids uuid[]; cid uuid;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_actor IS NULL OR p_request IS NULL OR p_product IS NULL OR p_site IS NULL OR p_from IS NULL OR p_until IS NULL OR p_from>p_until OR p_until-p_from>interval '91 days'
 OR p_until>now() OR p_until<now()-interval '1 day 15 minutes'
 OR p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 5000
 OR coalesce(length(btrim(p_label)),0) NOT BETWEEN 1 AND 160 OR p_label~'[<>[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid reviewed website audience'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('website-care-followup:'||p_tenant::text||':'||p_request::text,0));
 SELECT campaign_id INTO cid FROM bloom_pos_private.care_website_followup_campaigns WHERE tenant_id=p_tenant AND request_id=p_request;
 IF FOUND THEN RETURN jsonb_build_object('campaignId',cid,'replayed',true); END IF;
 SELECT coalesce(array_agg(DISTINCT customer_id ORDER BY customer_id),'{}'::uuid[]) INTO ids FROM bloom_pos_private.website_care_candidates(p_tenant,p_site,p_ids);
 IF cardinality(ids)<>cardinality(p_ids) OR encode(sha256(convert_to(ids::text,'UTF8')),'hex') IS DISTINCT FROM p_digest THEN RAISE EXCEPTION 'Audience changed; refresh and review'; END IF;
 INSERT INTO public.crm_campaigns(tenant_id,user_id,name,subject_line,preheader_text,content,status,auto_send_enabled,scheduled_at,include_all_customers,additional_customer_ids,projected_recipient_count,origin,metadata)
 VALUES(p_tenant,p_actor,'Online plant care follow-up: '||p_label,'How is your new plant settling in?','A little help from your garden centre.',
 '<h2>How is your new plant settling in?</h2><p>We hope you are enjoying your new plant. If you have questions about its light, watering or soil needs, our team is here to help. Stop by the garden centre or get in touch with a photo of your plant.</p>',
 'draft',false,NULL,false,ids,cardinality(ids),'automation:care-guide-website-followup',jsonb_build_object('campaignType','email','includeAllCustomers',false,'additionalCustomerIds',to_jsonb(ids),'careFollowup',true))
 RETURNING id INTO cid;
 INSERT INTO bloom_pos_private.care_website_followup_campaigns(campaign_id,tenant_id,request_id,site_id,product_id,from_at,until_at,customer_ids,audience_digest,created_by)
 VALUES(cid,p_tenant,p_request,p_site,p_product,p_from,p_until,ids,p_digest,p_actor);
 RETURN jsonb_build_object('campaignId',cid,'count',cardinality(ids),'sentMessages',0);
END $care$;

-- All campaigns use the same guard. Website campaigns additionally need a fresh signed purchase proof.
CREATE OR REPLACE FUNCTION public.care_followup_delivery_guard(p_campaign uuid,p_recipients jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
DECLARE g bloom_pos_private.care_followup_campaigns; w bloom_pos_private.care_website_followup_campaigns; out_ids uuid[]; candidates jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM bloom_pos_private.care_website_followup_campaigns WHERE campaign_id=p_campaign;
 IF FOUND THEN
  IF jsonb_typeof(p_recipients) IS DISTINCT FROM 'array' OR jsonb_array_length(p_recipients)>1000 THEN RAISE EXCEPTION 'Invalid guard recipient batch'; END IF;
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('customerId',b.customer_id,'userId',b.user_id)),'[]'::jsonb) INTO candidates
  FROM bloom_pos_private.website_care_candidates(w.tenant_id,w.site_id,w.customer_ids) b
  JOIN jsonb_array_elements(p_recipients) i ON i->>'customerId'=b.customer_id::text AND lower(btrim(i->>'email'))=b.email;
  RETURN jsonb_build_object('kind','website','tenantId',w.tenant_id,'siteId',w.site_id,'productId',w.product_id,'from',w.from_at,'until',w.until_at,'candidates',candidates);
 END IF;
 SELECT * INTO g FROM bloom_pos_private.care_followup_campaigns WHERE campaign_id=p_campaign;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.crm_campaigns WHERE id=p_campaign AND origin IN('automation:care-guide-followup','automation:care-guide-website-followup')) THEN RETURN '[]'::jsonb; END IF;
  RETURN NULL;
 END IF;
 IF jsonb_typeof(p_recipients) IS DISTINCT FROM 'array' OR jsonb_array_length(p_recipients)>1000 THEN RAISE EXCEPTION 'Invalid guard recipient batch'; END IF;
 SELECT coalesce(array_agg(DISTINCT b.customer_id),'{}'::uuid[]) INTO out_ids
 FROM bloom_pos_private.care_followup_buyers(g.tenant_id,g.connection_id,g.variant_id,g.from_at,g.until_at,g.customer_ids) b
 JOIN jsonb_array_elements(p_recipients) item ON item->>'customerId'=b.customer_id::text AND lower(btrim(item->>'email'))=b.email;
 RETURN to_jsonb(out_ids);
END $care$;
REVOKE ALL ON FUNCTION bloom_pos_private.website_care_candidates(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.care_website_candidates(uuid,uuid,uuid[]),public.create_website_care_followup_draft(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,uuid,text),public.list_care_followup_websites(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.care_website_candidates(uuid,uuid,uuid[]),public.create_website_care_followup_draft(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_care_followup_websites(uuid) TO authenticated;
COMMIT;