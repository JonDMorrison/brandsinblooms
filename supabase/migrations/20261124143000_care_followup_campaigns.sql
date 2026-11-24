BEGIN;
-- Follow-up is a separately reviewed marketing campaign, never a transactional care request.
-- Keep its frozen evidence outside editable campaign metadata.
CREATE TABLE bloom_pos_private.care_followup_campaigns (
 campaign_id uuid PRIMARY KEY REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 request_id uuid NOT NULL,
 connection_id uuid NOT NULL REFERENCES public.pos_connections(id),
 variant_id uuid NOT NULL,
 from_at timestamptz NOT NULL, until_at timestamptz NOT NULL,
 customer_ids uuid[] NOT NULL CHECK(cardinality(customer_ids) BETWEEN 1 AND 5000),
 audience_digest text NOT NULL CHECK(audience_digest~'^[0-9a-f]{64}$'),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,request_id)
);
ALTER TABLE bloom_pos_private.care_followup_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_pos_private.care_followup_campaigns FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION bloom_pos_private.assert_care_followup_editor(p_tenant uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
BEGIN
 IF auth.uid() IS NULL OR (public.get_current_crm_access()->>'tenantId') IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(public.has_tenant_permission(p_tenant,'campaigns.write',NULL),false)
 OR NOT coalesce(public.has_tenant_permission(p_tenant,'customers.read',NULL),false)
 THEN RAISE EXCEPTION 'Campaign and customer permission required' USING ERRCODE='42501'; END IF;
END $care$;

CREATE FUNCTION bloom_pos_private.care_followup_buyers(p_tenant uuid,p_connection uuid,p_variant uuid,p_from timestamptz,p_until timestamptz,p_ids uuid[] DEFAULT NULL)
RETURNS TABLE(customer_id uuid,email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $care$
 SELECT DISTINCT c.id,lower(btrim(c.email))
 FROM public.pos_orders o
 JOIN bloom_pos_private.connections b ON b.pos_connection_id=o.pos_connection_id AND b.crm_tenant_id=o.tenant_id AND b.enabled
 JOIN public.pos_connections pc ON pc.id=o.pos_connection_id AND pc.tenant_id=o.tenant_id AND pc.is_active
 JOIN public.crm_customers c ON c.id=o.crm_customer_id AND c.tenant_id=o.tenant_id
 WHERE o.tenant_id=p_tenant AND o.pos_connection_id=p_connection AND o.status='completed'
 AND o.customer_resolution_status='linked' AND coalesce(o.refund_amount,0)=0 AND o.refunded_at IS NULL
 AND o.order_date>=p_from AND o.order_date<=p_until
 AND NOT EXISTS(SELECT 1 FROM bloom_pos_private.return_events re WHERE re.key_id=b.key_id AND re.original_sale_id=o.external_id)
 AND EXISTS(SELECT 1 FROM bloom_pos_private.inbox i WHERE i.key_id=b.key_id AND i.event_type='SaleCompleted' AND i.subject_id=o.external_id)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) item
   WHERE item->>'catalogueItemId'=p_variant::text AND CASE WHEN jsonb_typeof(item->'quantity')='number' THEN (item->>'quantity')::numeric>0 ELSE false END)
 AND (p_ids IS NULL OR c.id=ANY(p_ids))
 AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL AND c.email_opt_in IS TRUE
 AND c.email_opt_in_at IS NOT NULL AND (c.email_opt_out_at IS NULL OR c.email_opt_out_at<c.email_opt_in_at)
 AND coalesce(c.opt_out,false)=false AND coalesce(c.suppressed,false)=false
 AND c.email IS NOT NULL AND btrim(c.email)~'^[^[:space:]@<>;,]+@[^[:space:]@<>;,]+\.[^[:space:]@<>;,]+$'
 AND NOT public.is_reserved_email_domain(c.email)
 AND EXISTS(SELECT 1 FROM public.crm_email_consent_events e WHERE e.tenant_id=c.tenant_id AND e.customer_id=c.id
   AND lower(btrim(e.email))=lower(btrim(c.email)) AND e.event_type IN('opt_in','imported_attested_express')
   AND NOT EXISTS(SELECT 1 FROM public.crm_email_consent_events w WHERE w.tenant_id=c.tenant_id AND w.customer_id=c.id AND w.event_type='opt_out' AND w.created_at>=e.created_at))
 AND NOT EXISTS(SELECT 1 FROM public.suppression_list s WHERE s.tenant_id=c.tenant_id AND (s.customer_id=c.id OR lower(btrim(s.email))=lower(btrim(c.email))) AND s.channel IN('email','all') AND s.lifted_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()))
 AND NOT EXISTS(SELECT 1 FROM public.global_email_suppression_list s WHERE lower(btrim(s.email))=lower(btrim(c.email)) AND s.lifted_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()));
$care$;

CREATE FUNCTION public.list_care_followup_products(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
BEGIN
 PERFORM bloom_pos_private.assert_care_followup_editor(p_tenant);
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) FROM (
 SELECT o.pos_connection_id AS connection_id,item->>'catalogueItemId' AS variant_id,
 left(max(item->>'name'),160) AS product_name, max(o.order_date) AS last_purchase
 FROM public.pos_orders o
 JOIN bloom_pos_private.connections b ON b.pos_connection_id=o.pos_connection_id AND b.crm_tenant_id=o.tenant_id AND b.enabled
 JOIN public.pos_connections pc ON pc.id=o.pos_connection_id AND pc.tenant_id=o.tenant_id AND pc.is_active
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) item
 WHERE o.tenant_id=p_tenant AND o.status='completed' AND o.order_date>=now()-interval '90 days'
 AND o.customer_resolution_status='linked' AND o.crm_customer_id IS NOT NULL
 AND item->>'catalogueItemId'~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 AND coalesce(length(btrim(item->>'name')),0)>0
 GROUP BY o.pos_connection_id,item->>'catalogueItemId' ORDER BY max(o.order_date) DESC LIMIT 100
 ) q);
END $care$;

CREATE FUNCTION public.preview_care_followup(p_tenant uuid,p_connection uuid,p_variant uuid,p_days integer,p_as_of timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
DECLARE ids uuid[];
BEGIN
 PERFORM bloom_pos_private.assert_care_followup_editor(p_tenant);
 IF p_days IS NULL OR p_days NOT IN(7,14,30,60,90) OR p_as_of IS NULL OR p_as_of>now()+interval '1 minute' OR p_as_of<now()-interval '15 minutes' THEN RAISE EXCEPTION 'Refresh the purchase window'; END IF;
 SELECT coalesce(array_agg(customer_id ORDER BY customer_id),'{}'::uuid[]) INTO ids FROM (
 SELECT DISTINCT customer_id FROM bloom_pos_private.care_followup_buyers(p_tenant,p_connection,p_variant,p_as_of-make_interval(days=>p_days),p_as_of-interval '1 day') LIMIT 5001
 ) q;
 IF cardinality(ids)>5000 THEN RAISE EXCEPTION 'Choose a shorter purchase window'; END IF;
 RETURN jsonb_build_object('count',cardinality(ids),'asOf',p_as_of,'digest',encode(sha256(convert_to(ids::text,'UTF8')),'hex'));
END $care$;

CREATE FUNCTION public.create_care_followup_draft(p_tenant uuid,p_connection uuid,p_variant uuid,p_days integer,p_as_of timestamptz,p_digest text,p_request_id uuid,p_product_name text,p_confirmed boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $care$
DECLARE ids uuid[]; campaign uuid; preview jsonb; label text;
BEGIN
 PERFORM bloom_pos_private.assert_care_followup_editor(p_tenant);
 IF p_confirmed IS DISTINCT FROM true OR p_request_id IS NULL OR coalesce(length(btrim(p_product_name)),0) NOT BETWEEN 1 AND 160 OR p_product_name~'[[:cntrl:]<>]' THEN RAISE EXCEPTION 'Confirm the exact purchased plant and review the audience'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('care-followup:'||p_tenant::text||':'||p_request_id::text,0));
 SELECT campaign_id INTO campaign FROM bloom_pos_private.care_followup_campaigns WHERE tenant_id=p_tenant AND request_id=p_request_id;
 IF FOUND THEN RETURN jsonb_build_object('campaignId',campaign,'replayed',true); END IF;
 preview:=public.preview_care_followup(p_tenant,p_connection,p_variant,p_days,p_as_of);
 IF preview->>'digest' IS DISTINCT FROM p_digest OR (preview->>'count')::int<1 THEN RAISE EXCEPTION 'Audience changed or empty. Refresh and review.'; END IF;
 SELECT coalesce(array_agg(DISTINCT customer_id ORDER BY customer_id),'{}'::uuid[]) INTO ids
 FROM bloom_pos_private.care_followup_buyers(p_tenant,p_connection,p_variant,p_as_of-make_interval(days=>p_days),p_as_of-interval '1 day');
 IF cardinality(ids) NOT BETWEEN 1 AND 5000 OR encode(sha256(convert_to(ids::text,'UTF8')),'hex') IS DISTINCT FROM p_digest THEN RAISE EXCEPTION 'Audience changed. Refresh and review.'; END IF;
 SELECT left(max(item->>'name'),160) INTO label FROM public.pos_orders o
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) item
 WHERE o.tenant_id=p_tenant AND o.pos_connection_id=p_connection AND item->>'catalogueItemId'=p_variant::text AND o.order_date>=p_as_of-make_interval(days=>p_days) AND o.order_date<=p_as_of;
 IF label IS NULL OR NOT EXISTS(SELECT 1 FROM public.pos_orders o CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) item
 WHERE o.tenant_id=p_tenant AND o.pos_connection_id=p_connection AND item->>'catalogueItemId'=p_variant::text AND left(item->>'name',160)=p_product_name) THEN RAISE EXCEPTION 'Purchase identity is unavailable'; END IF;
 INSERT INTO public.crm_campaigns(tenant_id,user_id,name,subject_line,preheader_text,content,status,auto_send_enabled,scheduled_at,include_all_customers,additional_customer_ids,projected_recipient_count,origin,metadata)
 VALUES(p_tenant,auth.uid(),'Plant care follow-up: '||p_product_name,'How is your new plant settling in?','A little help from your garden centre.',
 '<h2>How is your new plant settling in?</h2><p>We hope you are enjoying your new plant. If you have questions about its light, watering or soil needs, our team is here to help. Stop by the garden centre or get in touch with a photo of your plant.</p>',
 'draft',false,NULL,false,ids,cardinality(ids),'automation:care-guide-followup',
 jsonb_build_object('campaignType','email','includeAllCustomers',false,'additionalCustomerIds',to_jsonb(ids),'careFollowup',true))
 RETURNING id INTO campaign;
 INSERT INTO bloom_pos_private.care_followup_campaigns(campaign_id,tenant_id,request_id,connection_id,variant_id,from_at,until_at,customer_ids,audience_digest,created_by)
 VALUES(campaign,p_tenant,p_request_id,p_connection,p_variant,p_as_of-make_interval(days=>p_days),p_as_of-interval '1 day',ids,p_digest,auth.uid());
 RETURN jsonb_build_object('campaignId',campaign,'count',cardinality(ids),'sentMessages',0);
END $care$;

-- Invoked by the existing campaign queue builder and provider worker; null means ordinary campaign.
CREATE FUNCTION public.care_followup_delivery_guard(p_campaign uuid,p_recipients jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
DECLARE g bloom_pos_private.care_followup_campaigns; out_ids uuid[];
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM bloom_pos_private.care_followup_campaigns WHERE campaign_id=p_campaign;
 IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM public.crm_campaigns WHERE id=p_campaign AND origin='automation:care-guide-followup') THEN RETURN '[]'::jsonb; END IF;
   RETURN NULL;
 END IF;
 IF jsonb_typeof(p_recipients) IS DISTINCT FROM 'array' OR jsonb_array_length(p_recipients)>1000 THEN RAISE EXCEPTION 'Invalid guard recipient batch'; END IF;
 SELECT coalesce(array_agg(DISTINCT b.customer_id),'{}'::uuid[]) INTO out_ids
 FROM bloom_pos_private.care_followup_buyers(g.tenant_id,g.connection_id,g.variant_id,g.from_at,g.until_at,g.customer_ids) b
 JOIN jsonb_array_elements(p_recipients) item ON item->>'customerId'=b.customer_id::text AND lower(btrim(item->>'email'))=b.email;
 RETURN to_jsonb(out_ids);
END $care$;
REVOKE ALL ON FUNCTION bloom_pos_private.assert_care_followup_editor(uuid),bloom_pos_private.care_followup_buyers(uuid,uuid,uuid,timestamptz,timestamptz,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.list_care_followup_products(uuid),public.preview_care_followup(uuid,uuid,uuid,integer,timestamptz),public.create_care_followup_draft(uuid,uuid,uuid,integer,timestamptz,text,uuid,text,boolean),public.care_followup_delivery_guard(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_care_followup_products(uuid),public.preview_care_followup(uuid,uuid,uuid,integer,timestamptz),public.create_care_followup_draft(uuid,uuid,uuid,integer,timestamptz,text,uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_followup_delivery_guard(uuid,jsonb) TO service_role;
COMMIT;