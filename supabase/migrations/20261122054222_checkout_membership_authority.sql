BEGIN;
-- Membership is an authority decision. These policies never activate financial rewards.
CREATE TABLE bloom_pos_private.membership_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key_id text NOT NULL REFERENCES bloom_pos_private.connections(key_id) ON DELETE CASCADE,
 store_id uuid NOT NULL, tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 programme_id uuid NOT NULL, programme_version_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), authority text NOT NULL CHECK(authority IN('NATIVE','PROVIDER')),
 terms_version text NOT NULL CHECK(length(btrim(terms_version)) BETWEEN 1 AND 120),
 terms text NOT NULL CHECK(length(btrim(terms)) BETWEEN 20 AND 12000),
 email_statement text NOT NULL CHECK(length(btrim(email_statement)) BETWEEN 20 AND 2000),
 sms_statement text NOT NULL CHECK(length(btrim(sms_statement)) BETWEEN 20 AND 2000),
 enabled boolean NOT NULL DEFAULT false, created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,programme_id,programme_version_id) REFERENCES public.loyalty_programme_versions(tenant_id,programme_id,id),
 UNIQUE(key_id,store_id,version)
);
CREATE TABLE bloom_pos_private.membership_requests (
 id uuid PRIMARY KEY, event_id uuid NOT NULL UNIQUE REFERENCES bloom_pos_private.inbox(event_id) ON DELETE CASCADE,
 policy_id uuid NOT NULL REFERENCES bloom_pos_private.membership_policies(id),key_id text NOT NULL REFERENCES bloom_pos_private.connections(key_id) ON DELETE CASCADE,
 store_id uuid NOT NULL,customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
 identity_result jsonb NOT NULL,state text NOT NULL CHECK(state IN('REVIEW_REQUIRED','PROVIDER_PENDING','CONFIRMED','REJECTED')),
 email_result text NOT NULL DEFAULT 'not_requested',sms_result text NOT NULL DEFAULT 'not_requested',
 enrollment_event_id uuid,observed_at timestamptz NOT NULL,confirmed_at timestamptz,reviewed_by uuid,review_reason text
);
ALTER TABLE bloom_pos_private.membership_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_pos_private.membership_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_pos_private.membership_policies,bloom_pos_private.membership_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER membership_policy_immutable BEFORE UPDATE ON bloom_pos_private.membership_policies FOR EACH ROW EXECUTE FUNCTION loyalty_private.immutable_record();

CREATE FUNCTION public.save_pos_membership_policy(p_key text,p_store uuid,p_programme_version uuid,p_expected_version integer,p_authority text,p_terms_version text,p_terms text,p_email_statement text,p_sms_statement text,p_enabled boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();v public.loyalty_programme_versions; current_version integer; result uuid;
BEGIN
 IF (public.get_current_crm_access()->>'role') IS DISTINCT FROM 'owner_admin' THEN RAISE EXCEPTION 'Programme owner required' USING ERRCODE='42501'; END IF;
 IF p_store IS NULL OR p_enabled IS NULL OR NOT EXISTS(SELECT 1 FROM bloom_pos_private.connections WHERE key_id=p_key AND crm_tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Enabled tenant connection and store required'; END IF;
 SELECT * INTO v FROM public.loyalty_programme_versions WHERE id=p_programme_version AND tenant_id=t;
 IF v.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.loyalty_programmes WHERE id=v.programme_id AND tenant_id=t AND current_version_id=v.id AND status NOT IN('archived','paused')) THEN RAISE EXCEPTION 'Current saved programme required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key||p_store::text||':membership-policy',0));
 SELECT max(version) INTO current_version FROM bloom_pos_private.membership_policies WHERE key_id=p_key AND store_id=p_store;
 IF current_version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Policy changed; refresh before saving'; END IF;
 INSERT INTO bloom_pos_private.membership_policies(key_id,store_id,tenant_id,programme_id,programme_version_id,version,authority,terms_version,terms,email_statement,sms_statement,enabled,created_by)
 VALUES(p_key,p_store,t,v.programme_id,v.id,coalesce(current_version,0)+1,p_authority,btrim(p_terms_version),btrim(p_terms),btrim(p_email_statement),btrim(p_sms_statement),p_enabled,auth.uid()) RETURNING id INTO result;
 RETURN result;
END $$;

-- This helper is called only after a validated signed connection or staff retry.
CREATE FUNCTION bloom_pos_private.finish_membership_request(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r bloom_pos_private.membership_requests;p bloom_pos_private.membership_policies;c bloom_pos_private.connections;d jsonb;identity jsonb;customer public.crm_customers;v_channel text;consent_result text;enrollment uuid;
BEGIN
 SELECT * INTO r FROM bloom_pos_private.membership_requests WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.state IN('CONFIRMED','REJECTED') THEN RETURN; END IF;
 SELECT * INTO p FROM bloom_pos_private.membership_policies WHERE id=r.policy_id;
 SELECT * INTO c FROM bloom_pos_private.connections WHERE key_id=r.key_id AND enabled;
 IF c.key_id IS NULL OR NOT p.enabled OR EXISTS(SELECT 1 FROM bloom_pos_private.membership_policies WHERE key_id=p.key_id AND store_id=p.store_id AND version>p.version)
 OR NOT EXISTS(SELECT 1 FROM public.loyalty_programmes WHERE id=p.programme_id AND tenant_id=c.crm_tenant_id AND current_version_id=p.programme_version_id AND status NOT IN('archived','paused')) THEN RAISE EXCEPTION 'Membership policy changed; collect a new request'; END IF;
 SELECT envelope->'data' INTO d FROM bloom_pos_private.inbox WHERE event_id=r.event_id;
 identity:=public.resolve_crm_customer_identity(c.crm_tenant_id,'bloom_pos_membership',c.key_id||':'||coalesce(nullif(d->>'customerId',''),r.id::text),c.pos_connection_id,NULL,d->>'email',d->>'phone',NULL,jsonb_build_object('first_name',d->>'firstName','last_name',d->>'lastName'));
 UPDATE bloom_pos_private.membership_requests SET identity_result=identity,customer_id=(identity->>'customer_id')::uuid WHERE id=r.id;
 IF identity->>'customer_id' IS NULL OR identity->>'match_method' IN('ambiguous','email_with_conflict','phone_with_conflict') OR identity->>'conflict_id' IS NOT NULL THEN RETURN; END IF;
 SELECT * INTO customer FROM public.crm_customers WHERE id=(identity->>'customer_id')::uuid AND tenant_id=c.crm_tenant_id AND deleted_at IS NULL AND merged_into_customer_id IS NULL FOR UPDATE;
 IF customer.id IS NULL THEN RETURN; END IF;
 -- Apply independent checked choices through the same suppression-aware writer as forms.
 FOREACH v_channel IN ARRAY ARRAY['email','sms'] LOOP
  IF d->(v_channel||'Consent')='true'::jsonb AND (CASE WHEN v_channel='email' THEN r.email_result ELSE r.sms_result END)='not_requested' THEN
   IF (v_channel='email' AND public.normalize_customer_email(customer.email) IS DISTINCT FROM public.normalize_customer_email(d->>'email')) OR (v_channel='sms' AND public.normalize_customer_phone(customer.phone) IS DISTINCT FROM public.normalize_customer_phone(d->>'phone')) THEN consent_result:='identity_review_required';
   ELSIF (v_channel='email' AND EXISTS(SELECT 1 FROM public.global_email_suppression_list g WHERE lower(g.email)=lower(customer.email) AND g.lifted_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()))) OR EXISTS(SELECT 1 FROM public.suppression_list s WHERE s.tenant_id=c.crm_tenant_id AND s.channel=v_channel AND s.lifted_at IS NULL AND (s.customer_id=customer.id OR (v_channel='email' AND lower(s.email)=lower(customer.email)) OR (v_channel='sms' AND public.normalize_customer_phone(s.phone)=public.normalize_customer_phone(customer.phone)))) THEN consent_result:='suppression_preserved';
   ELSE consent_result:=public.apply_form_channel_consent(c.crm_tenant_id,customer.id,v_channel,r.observed_at,'pos_membership',jsonb_build_object('request_id',r.id,'store_id',r.store_id,'policy_id',p.id,'consent_text',CASE WHEN v_channel='email' THEN p.email_statement ELSE p.sms_statement END,'phone',d->>'phone','captured_at',r.observed_at)); END IF;
   UPDATE bloom_pos_private.membership_requests SET email_result=CASE WHEN v_channel='email' THEN consent_result ELSE email_result END,sms_result=CASE WHEN v_channel='sms' THEN consent_result ELSE sms_result END WHERE id=r.id;
  END IF;
 END LOOP;
 IF p.authority='PROVIDER' THEN UPDATE bloom_pos_private.membership_requests SET state='PROVIDER_PENDING' WHERE id=r.id; RETURN; END IF;
 enrollment:=public.track_loyalty_enrollment(customer.id,c.crm_tenant_id,'pos_membership');
 UPDATE bloom_pos_private.membership_requests SET state='CONFIRMED',enrollment_event_id=enrollment,confirmed_at=clock_timestamp() WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION bloom_pos_private.finish_membership_request(uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.accept_bloomsuite_pos_event(text,jsonb) RENAME TO accept_bloomsuite_pos_before_membership;
CREATE FUNCTION public.accept_bloomsuite_pos_event(p_key text,p_envelope jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c bloom_pos_private.connections;p bloom_pos_private.membership_policies;prior bloom_pos_private.inbox;r bloom_pos_private.membership_requests;d jsonb;eid uuid;rid uuid;st uuid;observed timestamptz;rev bigint;
BEGIN
 IF p_envelope->>'type' NOT IN('MembershipEnrollmentRequested','MembershipStatusRequested','MembershipPolicyRequested') OR p_envelope->>'type' IS NULL THEN RETURN public.accept_bloomsuite_pos_before_membership(p_key,p_envelope); END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Connection service required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM bloom_pos_private.connections WHERE key_id=p_key AND enabled FOR SHARE;
 IF c.key_id IS NULL OR public.bloomsuite_pos_connection(p_key) IS NULL OR p_envelope->>'tenantId' IS DISTINCT FROM c.pos_tenant_id::text OR p_envelope->>'source' IS DISTINCT FROM 'POS' OR p_envelope->'version' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(p_envelope->'data') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid membership connection scope'; END IF;
 d:=p_envelope->'data';st:=(d->>'storeId')::uuid;
 IF st IS NULL THEN RAISE EXCEPTION 'Store required'; END IF;
 IF p_envelope->>'type'='MembershipPolicyRequested' THEN
  SELECT * INTO p FROM bloom_pos_private.membership_policies WHERE key_id=p_key AND store_id=st ORDER BY version DESC LIMIT 1;
  RETURN jsonb_build_object('storeId',st,'policy',CASE WHEN p.enabled THEN jsonb_build_object('id',p.id,'programmeId',p.programme_id,'programmeVersionId',p.programme_version_id,'authority',p.authority,'termsVersion',p.terms_version,'terms',p.terms,'emailStatement',p.email_statement,'smsStatement',p.sms_statement) ELSE NULL END);
 END IF;
 rid:=(p_envelope->>'recordId')::uuid;
 IF p_envelope->>'type'='MembershipStatusRequested' THEN
  SELECT * INTO r FROM bloom_pos_private.membership_requests WHERE id=rid AND key_id=p_key AND store_id=st;
  RETURN jsonb_build_object('requestId',rid,'storeId',st,'state',coalesce(r.state,'PENDING'),'emailResult',r.email_result,'smsResult',r.sms_result);
 END IF;
 eid:=(p_envelope->>'id')::uuid;rev:=bloom_pos_private.event_integer(p_envelope->'revision',1,'Valid revision required');observed:=(d->>'observedAt')::timestamptz;
 IF eid IS NULL OR rid IS NULL OR d->'membershipAgreed' IS DISTINCT FROM 'true'::jsonb OR d->>'authority' IS DISTINCT FROM 'CRM' OR observed IS NULL OR observed>clock_timestamp()+interval '5 minutes'
 OR jsonb_typeof(d->'emailConsent') IS DISTINCT FROM 'boolean' OR jsonb_typeof(d->'smsConsent') IS DISTINCT FROM 'boolean'
 OR (public.normalize_customer_email(d->>'email') IS NULL AND public.normalize_customer_phone(d->>'phone') IS NULL)
 OR (d->'emailConsent'='true'::jsonb AND public.normalize_customer_email(d->>'email') IS NULL) OR (d->'smsConsent'='true'::jsonb AND public.normalize_customer_phone(d->>'phone') IS NULL)
 OR (nullif(d->>'email','') IS NOT NULL AND d->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR (nullif(d->>'phone','') IS NOT NULL AND public.normalize_customer_phone(d->>'phone') IS NULL) OR coalesce(length(d->>'email'),0)>320 OR coalesce(length(d->>'phone'),0)>40 OR coalesce(length(d->>'firstName'),0)>120 OR coalesce(length(d->>'lastName'),0)>120 THEN RAISE EXCEPTION 'Explicit membership and independent contact choices required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key||':membership:'||rid::text,0));
 SELECT * INTO prior FROM bloom_pos_private.inbox WHERE event_id=eid OR (key_id=p_key AND event_type='MembershipEnrollmentRequested' AND record_id=rid::text) LIMIT 1;
 IF FOUND THEN IF prior.key_id IS DISTINCT FROM p_key OR prior.envelope IS DISTINCT FROM p_envelope THEN RAISE EXCEPTION 'Membership retry changed'; END IF; RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',true); END IF;
 SELECT * INTO p FROM bloom_pos_private.membership_policies WHERE key_id=p_key AND store_id=st ORDER BY version DESC LIMIT 1;
 IF p.id IS NULL OR NOT p.enabled OR p.id::text IS DISTINCT FROM d->>'policyId' OR p.terms_version IS DISTINCT FROM d->>'termsVersion' THEN RAISE EXCEPTION 'Current reviewed membership policy required'; END IF;
 INSERT INTO bloom_pos_private.inbox(event_id,key_id,event_type,record_id,revision,envelope,subject_id) VALUES(eid,p_key,'MembershipEnrollmentRequested',rid::text,rev,p_envelope,rid::text);
 INSERT INTO bloom_pos_private.membership_requests(id,event_id,policy_id,key_id,store_id,identity_result,state,observed_at) VALUES(rid,eid,p.id,p_key,st,'{}','REVIEW_REQUIRED',observed);
 PERFORM bloom_pos_private.finish_membership_request(rid);
 RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.accept_bloomsuite_pos_before_membership(text,jsonb),public.accept_bloomsuite_pos_event(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.accept_bloomsuite_pos_event(text,jsonb) TO service_role;

CREATE FUNCTION public.pos_membership_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();BEGIN
 RETURN jsonb_build_object('role',public.get_current_crm_access()->>'role','programmes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'versionId',current_version_id)) FROM public.loyalty_programmes WHERE tenant_id=t AND current_version_id IS NOT NULL AND status NOT IN('archived','paused')),'[]'),'connections',coalesce((SELECT jsonb_agg(jsonb_build_object('keyId',key_id,'posTenantId',pos_tenant_id)) FROM bloom_pos_private.connections WHERE crm_tenant_id=t AND enabled),'[]'),
 'policies',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM bloom_pos_private.membership_policies p WHERE tenant_id=t),'[]'),
 'requests',coalesce((SELECT jsonb_agg(x) FROM(SELECT r.*,i.envelope->'data' AS evidence FROM bloom_pos_private.membership_requests r JOIN bloom_pos_private.connections c ON c.key_id=r.key_id JOIN bloom_pos_private.inbox i ON i.event_id=r.event_id WHERE c.crm_tenant_id=t ORDER BY r.observed_at DESC LIMIT 100)x),'[]'));
END $$;
CREATE FUNCTION public.review_pos_membership_request(p_tenant uuid,p_user uuid,p_request uuid,p_reject boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r bloom_pos_private.membership_requests;BEGIN
 PERFORM loyalty_private.assert_actor(p_tenant,p_user);
 IF p_reject IS NULL OR coalesce(length(btrim(p_reason)),0) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION 'Identity review reason required'; END IF;
 SELECT q.* INTO r FROM bloom_pos_private.membership_requests q JOIN bloom_pos_private.connections c ON c.key_id=q.key_id WHERE q.id=p_request AND c.crm_tenant_id=p_tenant FOR UPDATE OF q;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Tenant request unavailable'; END IF;
 IF r.state IN('CONFIRMED','REJECTED') THEN RAISE EXCEPTION 'Request already finalized'; END IF;
 IF p_reject THEN UPDATE bloom_pos_private.membership_requests SET state='REJECTED' WHERE id=r.id; ELSE PERFORM bloom_pos_private.finish_membership_request(r.id); END IF;
 UPDATE bloom_pos_private.membership_requests SET reviewed_by=p_user,review_reason=btrim(p_reason) WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.save_pos_membership_policy(text,uuid,uuid,integer,text,text,text,text,text,boolean),public.pos_membership_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_pos_membership_policy(text,uuid,uuid,integer,text,text,text,text,text,boolean),public.pos_membership_workspace() TO authenticated;
REVOKE ALL ON FUNCTION public.review_pos_membership_request(uuid,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_pos_membership_request(uuid,uuid,uuid,boolean,text) TO service_role;
COMMIT;
