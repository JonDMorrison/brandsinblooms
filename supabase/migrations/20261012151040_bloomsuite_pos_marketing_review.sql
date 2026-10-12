BEGIN;
CREATE TABLE bloom_pos_private.marketing_requests(
 event_id uuid PRIMARY KEY REFERENCES bloom_pos_private.inbox(event_id),key_id text NOT NULL REFERENCES bloom_pos_private.connections(key_id),
 customer_id uuid NOT NULL REFERENCES public.crm_customers(id),recipient text NOT NULL,statement text NOT NULL,policy_version integer NOT NULL,
 evidence_ref text NOT NULL,observed_at timestamptz NOT NULL,state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','APPROVED','REJECTED')),
 reviewed_by uuid,reviewed_at timestamptz,review_reason text
);
ALTER TABLE bloom_pos_private.marketing_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_pos_private.marketing_requests FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.accept_bloomsuite_pos_event(text,jsonb) RENAME TO accept_bloomsuite_pos_before_marketing;
CREATE FUNCTION public.accept_bloomsuite_pos_event(p_key text,p_envelope jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c bloom_pos_private.connections;prior bloom_pos_private.inbox;eid uuid;incoming_revision bigint;data jsonb;customer uuid;pos_customer uuid;observed timestamptz;policy integer;BEGIN
 IF p_envelope->>'type' IS DISTINCT FROM 'MarketingConsentRequested' THEN RETURN public.accept_bloomsuite_pos_before_marketing(p_key,p_envelope);END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Connection service required' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM bloom_pos_private.connections WHERE key_id=p_key AND enabled FOR SHARE;
 IF c.key_id IS NULL OR public.bloomsuite_pos_connection(p_key) IS NULL OR p_envelope->>'tenantId' IS DISTINCT FROM c.pos_tenant_id::text OR p_envelope->>'source' IS DISTINCT FROM 'POS'
 OR p_envelope->'version' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(p_envelope->'data') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid POS preference scope';END IF;
 eid:=(p_envelope->>'id')::uuid;incoming_revision:=bloom_pos_private.event_integer(p_envelope->'revision',1,'Valid revision required');data:=p_envelope->'data';
 IF eid IS NULL OR coalesce(length(p_envelope->>'recordId'),0) NOT BETWEEN 1 AND 200 OR data->>'authority' IS DISTINCT FROM 'CRM' OR data->>'channel' IS DISTINCT FROM 'EMAIL' OR data->>'status' IS DISTINCT FROM 'PENDING_AUTHORITY_REVIEW'
 OR coalesce(length(btrim(data->>'statement')),0) NOT BETWEEN 20 AND 1200 OR coalesce(length(data->>'evidenceRef'),0) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Explicit pending preference evidence required';END IF;
 customer:=(data->>'externalCustomerId')::uuid;pos_customer:=(data->>'customerId')::uuid;observed:=(data->>'observedAt')::timestamptz;policy:=bloom_pos_private.event_integer(data->'policyVersion',1,'Policy version required')::integer;
 IF observed IS NULL OR observed>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'Verified observation time required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key||':marketing:'||(p_envelope->>'recordId'),0));
 SELECT * INTO prior FROM bloom_pos_private.inbox WHERE event_id=eid OR (key_id=p_key AND event_type='MarketingConsentRequested' AND record_id=p_envelope->>'recordId' AND revision=incoming_revision) LIMIT 1;
 IF FOUND THEN IF prior.key_id IS DISTINCT FROM p_key OR prior.envelope IS DISTINCT FROM p_envelope THEN RAISE EXCEPTION 'POS preference retry changed';END IF;RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',true);END IF;
 IF NOT EXISTS(SELECT 1 FROM bloom_pos_private.customer_links WHERE key_id=p_key AND pos_customer_id=pos_customer AND crm_customer_id=customer)
 OR NOT EXISTS(SELECT 1 FROM public.crm_customers WHERE id=customer AND tenant_id=c.crm_tenant_id AND deleted_at IS NULL AND merged_into_customer_id IS NULL AND lower(btrim(email))=lower(btrim(data->>'recipient'))) THEN RAISE EXCEPTION 'Reviewed POS and CRM customer identity required';END IF;
 INSERT INTO bloom_pos_private.inbox(event_id,key_id,event_type,record_id,revision,envelope,subject_id) VALUES(eid,p_key,'MarketingConsentRequested',p_envelope->>'recordId',incoming_revision,p_envelope,pos_customer::text);
 INSERT INTO bloom_pos_private.marketing_requests(event_id,key_id,customer_id,recipient,statement,policy_version,evidence_ref,observed_at) VALUES(eid,p_key,customer,lower(btrim(data->>'recipient')),data->>'statement',policy,data->>'evidenceRef',observed);
 RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.accept_bloomsuite_pos_before_marketing(text,jsonb),public.accept_bloomsuite_pos_event(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.accept_bloomsuite_pos_event(text,jsonb) TO service_role;
CREATE FUNCTION bloom_pos_private.preference_reviewer() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE access jsonb;BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=auth.uid() AND id=(auth.jwt()->>'session_id')::uuid) THEN RAISE EXCEPTION 'Current staff session required' USING ERRCODE='42501';END IF;
 access:=public.get_current_crm_access();
 IF access->>'role' NOT IN('owner_admin','marketing') OR access->>'tenantId' IS NULL THEN RAISE EXCEPTION 'Marketing review access required' USING ERRCODE='42501';END IF;
 RETURN (access->>'tenantId')::uuid;
END $$;
REVOKE ALL ON FUNCTION bloom_pos_private.preference_reviewer() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.bloomsuite_pos_marketing_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();BEGIN
 RETURN coalesce((SELECT jsonb_agg(x) FROM(SELECT r.event_id AS id,r.customer_id AS "customerId",r.recipient,r.statement,r.policy_version AS "policyVersion",r.observed_at AS "observedAt",r.state,r.evidence_ref AS "evidenceRef",r.reviewed_at AS "reviewedAt" FROM bloom_pos_private.marketing_requests r JOIN bloom_pos_private.connections c ON c.key_id=r.key_id WHERE c.crm_tenant_id=t ORDER BY r.observed_at DESC,r.event_id LIMIT 100)x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.review_bloomsuite_pos_marketing(p_event uuid,p_approve boolean,p_reason text,p_withdrawals_reviewed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();r bloom_pos_private.marketing_requests;customer public.crm_customers;BEGIN
 IF p_approve IS NULL OR coalesce(length(btrim(p_reason)),0) NOT BETWEEN 20 AND 2000 OR (p_approve AND p_withdrawals_reviewed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Review the statement and withdrawals and record a reason';END IF;
 SELECT q.* INTO r FROM bloom_pos_private.marketing_requests q JOIN bloom_pos_private.connections c ON c.key_id=q.key_id WHERE q.event_id=p_event AND c.crm_tenant_id=t FOR UPDATE OF q;
 IF r.event_id IS NULL THEN RAISE EXCEPTION 'Tenant preference request unavailable' USING ERRCODE='42501';END IF;
 IF r.state<>'PENDING' THEN IF r.state=(CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END) AND r.review_reason=btrim(p_reason) THEN RETURN;END IF;RAISE EXCEPTION 'Preference review already recorded';END IF;
 SELECT * INTO customer FROM public.crm_customers WHERE id=r.customer_id AND tenant_id=t AND deleted_at IS NULL AND merged_into_customer_id IS NULL FOR UPDATE;
 IF customer.id IS NULL OR lower(btrim(customer.email)) IS DISTINCT FROM r.recipient THEN RAISE EXCEPTION 'Customer identity or email changed; reject this request and collect new evidence';END IF;
 IF p_approve THEN
  IF customer.email_opt_out_at>r.observed_at OR EXISTS(SELECT 1 FROM public.crm_email_consent_events WHERE tenant_id=t AND customer_id=customer.id AND event_type='opt_out' AND created_at>r.observed_at)
  OR EXISTS(SELECT 1 FROM public.suppression_list WHERE tenant_id=t AND lower(email)=r.recipient AND channel='email' AND lifted_at IS NULL AND (suppression_type IN('hard_bounce','spam_complaint','bounced','complained','bounce','complaint') OR (suppression_type='unsubscribed' AND suppressed_at>r.observed_at))) THEN RAISE EXCEPTION 'A withdrawal or provider suppression prevents approval; collect new permission after resolving it';END IF;
  PERFORM public.set_customer_marketing_consent_authorized(customer.id,'email',true,'in_store','express',jsonb_build_object('evidenceRef',r.evidence_ref,'statement',r.statement,'policyVersion',r.policy_version,'observedAt',r.observed_at,'reviewReason',btrim(p_reason))::text,NULL,NULL);
 END IF;
 UPDATE bloom_pos_private.marketing_requests SET state=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_reason=btrim(p_reason) WHERE event_id=p_event;
END $$;
REVOKE ALL ON FUNCTION public.bloomsuite_pos_marketing_workspace(),public.review_bloomsuite_pos_marketing(uuid,boolean,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bloomsuite_pos_marketing_workspace(),public.review_bloomsuite_pos_marketing(uuid,boolean,text,boolean) TO authenticated;
COMMIT;
