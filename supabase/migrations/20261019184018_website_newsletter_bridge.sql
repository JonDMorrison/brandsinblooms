CREATE TABLE public.newsletter_storefront_connections(
 site_id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 owner_id uuid NOT NULL REFERENCES auth.users(id), origin text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.website_newsletter_receipts(
 event_id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 customer_id uuid REFERENCES public.crm_customers(id), payload_hash text NOT NULL,
 result text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_storefront_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_newsletter_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsletter_storefront_connections,public.website_newsletter_receipts FROM anon,authenticated;
GRANT ALL ON public.newsletter_storefront_connections,public.website_newsletter_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.accept_website_newsletter(p_body text,p_timestamp bigint,p_signature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text; payload jsonb; connection public.newsletter_storefront_connections%ROWTYPE;
 receipt public.website_newsletter_receipts%ROWTYPE; customer public.crm_customers%ROWTYPE;
 v_event_id uuid; v_site_id uuid; v_email text; v_subscribed timestamptz; v_origin text; host text;
 match_count integer; v_owner_id uuid; v_tenant_id uuid; blocked boolean; outcome text; hash text;
BEGIN
 IF p_timestamp IS NULL OR abs(extract(epoch from now())-p_timestamp)>300 OR length(p_body)>16384 OR p_signature !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_envelope'; END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='newsletter_bridge_secret';
 IF secret IS NULL OR length(secret)<32 THEN RAISE EXCEPTION 'bridge_not_configured'; END IF;
 IF encode(extensions.hmac(convert_to(p_timestamp::text||'.'||p_body,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex') IS DISTINCT FROM p_signature THEN RAISE EXCEPTION 'invalid_signature'; END IF;
 payload:=p_body::jsonb; v_event_id:=(payload->>'eventId')::uuid; v_site_id:=(payload->>'siteId')::uuid;
 v_email:=lower(trim(payload->>'email')); v_subscribed:=(payload->>'subscribedAt')::timestamptz;
 v_origin:=payload->>'siteOrigin'; host:=lower(substring(v_origin from '^https://([^/:]+)/*$'));
 IF v_event_id IS NULL OR v_site_id IS NULL OR v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  OR v_subscribed IS NULL OR v_subscribed>now()+interval '5 minutes' OR host IS NULL OR payload->>'consent' IS DISTINCT FROM 'newsletter-signup-v1' THEN RAISE EXCEPTION 'invalid_signup'; END IF;
 hash:=encode(extensions.digest(p_body,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_event_id::text,0));
 SELECT * INTO receipt FROM public.website_newsletter_receipts WHERE website_newsletter_receipts.event_id=v_event_id;
 IF FOUND THEN
  IF receipt.payload_hash<>hash THEN RAISE EXCEPTION 'event_conflict'; END IF;
  RETURN jsonb_build_object('status',receipt.result);
 END IF;
 SELECT * INTO connection FROM public.newsletter_storefront_connections c WHERE c.site_id=v_site_id;
 IF NOT FOUND THEN
  -- Match only a signed, server-derived HTTPS storefront to exactly one CRM company.
  SELECT count(*) INTO match_count FROM public.company_profiles c JOIN public.users u ON u.id=c.user_id
   WHERE c.deleted_at IS NULL AND u.tenant_id IS NOT NULL AND lower(substring(c.website_url from '^https?://([^/:]+)/*$'))=host;
  IF match_count<>1 THEN RAISE EXCEPTION 'storefront_connection_required'; END IF;
  SELECT c.user_id,u.tenant_id INTO v_owner_id,v_tenant_id FROM public.company_profiles c JOIN public.users u ON u.id=c.user_id
   WHERE c.deleted_at IS NULL AND u.tenant_id IS NOT NULL AND lower(substring(c.website_url from '^https?://([^/:]+)/*$'))=host;
  INSERT INTO public.newsletter_storefront_connections(site_id,tenant_id,owner_id,origin)
   VALUES(v_site_id,v_tenant_id,v_owner_id,v_origin) ON CONFLICT DO NOTHING;
  SELECT * INTO connection FROM public.newsletter_storefront_connections c WHERE c.site_id=v_site_id;
 END IF;
 IF connection.origin<>v_origin THEN RAISE EXCEPTION 'storefront_origin_changed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(connection.tenant_id::text||':'||v_email,0));
 IF (SELECT count(*) FROM public.crm_customers c WHERE c.tenant_id=connection.tenant_id AND lower(trim(c.email))=v_email)>1 THEN RAISE EXCEPTION 'customer_identity_review_required'; END IF;
 SELECT * INTO customer FROM public.crm_customers c WHERE c.tenant_id=connection.tenant_id AND lower(trim(c.email))=v_email FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO public.crm_customers(tenant_id,user_id,email,first_name,last_name,tags,signup_source,email_opt_in,email_opt_in_at,email_consent,email_consent_source,email_consent_method,email_consent_details)
  VALUES(connection.tenant_id,connection.owner_id,v_email,
   CASE WHEN coalesce(payload->>'name','') IN('','Newsletter Subscriber') THEN '' ELSE left(split_part(trim(payload->>'name'),' ',1),120) END,
   CASE WHEN coalesce(payload->>'name','') IN('','Newsletter Subscriber') THEN '' ELSE left(trim(substr(trim(payload->>'name'),length(split_part(trim(payload->>'name'),' ',1))+1)),120) END,ARRAY['Website newsletter'],'website_newsletter',true,v_subscribed,true,'website_newsletter','signup_form',jsonb_build_object('site_id',v_site_id,'subscribed_at',v_subscribed,'consent_version','newsletter-signup-v1','origin',v_origin))
  RETURNING * INTO customer;
 END IF;
 blocked:=coalesce(customer.opt_out,false) OR customer.suppressed OR customer.deleted_at IS NOT NULL OR customer.email_opt_out_at IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.customer_consents WHERE customer_id=customer.id AND channel='email' AND status IN('opted_out','suppressed'));
 IF NOT blocked THEN
  UPDATE public.crm_customers SET email_opt_in=true,email_consent=true,email_opt_in_at=coalesce(email_opt_in_at,v_subscribed),
   email_consent_source=coalesce(email_consent_source,'website_newsletter'),email_consent_method=coalesce(email_consent_method,'signup_form'),
   tags=ARRAY(SELECT DISTINCT unnest(coalesce(customer.tags,'{}'::text[])||ARRAY['Website newsletter'])),updated_at=now()
   WHERE id=customer.id;
  INSERT INTO public.customer_consents(customer_id,channel,status,consent_timestamp)
   VALUES(customer.id,'email','opted_in',v_subscribed) ON CONFLICT(customer_id,channel) DO NOTHING;
 END IF;
 outcome:=CASE WHEN blocked THEN 'suppression_preserved' ELSE 'subscribed' END;
 INSERT INTO public.website_newsletter_receipts(event_id,tenant_id,customer_id,payload_hash,result)
 VALUES(v_event_id,connection.tenant_id,customer.id,hash,outcome);
 RETURN jsonb_build_object('status',outcome);
END $$;
REVOKE ALL ON FUNCTION public.accept_website_newsletter(text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_website_newsletter(text,bigint,text) TO service_role;
