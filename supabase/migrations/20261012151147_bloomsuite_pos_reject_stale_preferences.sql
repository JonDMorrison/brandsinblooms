BEGIN;
CREATE OR REPLACE FUNCTION public.review_bloomsuite_pos_marketing(p_event uuid,p_approve boolean,p_reason text,p_withdrawals_reviewed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();r bloom_pos_private.marketing_requests;customer public.crm_customers;BEGIN
 IF p_approve IS NULL OR coalesce(length(btrim(p_reason)),0) NOT BETWEEN 20 AND 2000 OR (p_approve AND p_withdrawals_reviewed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Review the statement and withdrawals and record a reason';END IF;
 SELECT q.* INTO r FROM bloom_pos_private.marketing_requests q JOIN bloom_pos_private.connections c ON c.key_id=q.key_id WHERE q.event_id=p_event AND c.crm_tenant_id=t FOR UPDATE OF q;
 IF r.event_id IS NULL THEN RAISE EXCEPTION 'Tenant preference request unavailable' USING ERRCODE='42501';END IF;
 IF r.state<>'PENDING' THEN IF r.state=(CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END) AND r.review_reason=btrim(p_reason) THEN RETURN;END IF;RAISE EXCEPTION 'Preference review already recorded';END IF;
 SELECT * INTO customer FROM public.crm_customers WHERE id=r.customer_id AND tenant_id=t AND deleted_at IS NULL AND merged_into_customer_id IS NULL FOR UPDATE;
 IF p_approve AND (customer.id IS NULL OR lower(btrim(customer.email)) IS DISTINCT FROM r.recipient) THEN RAISE EXCEPTION 'Customer identity or email changed; reject this request and collect new evidence';END IF;
 IF p_approve THEN
  IF customer.email_opt_out_at>r.observed_at OR EXISTS(SELECT 1 FROM public.crm_email_consent_events WHERE tenant_id=t AND customer_id=customer.id AND event_type='opt_out' AND created_at>r.observed_at)
  OR EXISTS(SELECT 1 FROM public.suppression_list WHERE tenant_id=t AND lower(email)=r.recipient AND channel='email' AND lifted_at IS NULL AND (suppression_type IN('hard_bounce','spam_complaint','bounced','complained','bounce','complaint') OR (suppression_type='unsubscribed' AND suppressed_at>r.observed_at))) THEN RAISE EXCEPTION 'A withdrawal or provider suppression prevents approval; collect new permission after resolving it';END IF;
  PERFORM public.set_customer_marketing_consent_authorized(customer.id,'email',true,'in_store','express',jsonb_build_object('evidenceRef',r.evidence_ref,'statement',r.statement,'policyVersion',r.policy_version,'observedAt',r.observed_at,'reviewReason',btrim(p_reason))::text,NULL,NULL);
 END IF;
 UPDATE bloom_pos_private.marketing_requests SET state=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_reason=btrim(p_reason) WHERE event_id=p_event;
END $$;

COMMIT;