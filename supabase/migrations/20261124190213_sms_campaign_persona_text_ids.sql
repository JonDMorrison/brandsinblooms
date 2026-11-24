-- Applied to udldmkqwnxhdeztyqcau on 2026-11-24 (recorded version in filename).

-- QA pass 4 follow-up #1b: SMS persona targeting compares text to text.
--
-- crm_sms_campaigns.targeting_persona_ids became text[] in
-- 20260418184500_campaign_persona_arrays_support_system_ids, but
-- count_sms_campaign_recipients and get_sms_persona_recipient_page (from
-- 20260903220000_reliable_scheduled_sms_claim) compare it with
-- customer_personas.persona_id (uuid). PL/pgSQL plans the whole statement, so
-- count_sms_campaign_recipients failed with "operator does not exist:
-- uuid = text" for every campaign (send-sms-campaign answered "Failed to count
-- eligible recipients"), and the persona recipient page failed for every
-- persona campaign. Cast persona_id to text on the comparison side; the
-- rest of both functions is unchanged from the previous migration.

CREATE OR REPLACE FUNCTION public.count_sms_campaign_recipients(p_campaign_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_campaign public.crm_sms_campaigns%ROWTYPE; v_system_segment_type text; v_count bigint;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT campaign.* INTO v_campaign FROM public.crm_sms_campaigns AS campaign WHERE campaign.id=p_campaign_id;
  IF v_campaign.id IS NULL THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  v_system_segment_type := v_campaign.metrics #>> '{segment_filter,system_segment_type}';
  -- Eligibility is public.sms_eligible_customers, the one SMS rule.
  SELECT count(*) INTO v_count
  FROM public.sms_eligible_customers(v_campaign.tenant_id) AS eligible
  JOIN public.crm_customers AS customer
    ON customer.id = eligible.customer_id AND customer.tenant_id = v_campaign.tenant_id
  WHERE (v_campaign.segment_id IS NULL OR EXISTS (SELECT 1 FROM public.customer_segments AS membership WHERE membership.segment_id=v_campaign.segment_id AND membership.customer_id=customer.id))
    AND (coalesce(cardinality(v_campaign.targeting_persona_ids),0)=0 OR CASE lower(coalesce(v_campaign.targeting_logic,'any'))
      WHEN 'all' THEN NOT EXISTS (SELECT 1 FROM unnest(v_campaign.targeting_persona_ids) AS target(persona_id) WHERE NOT EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id::text=target.persona_id))
      ELSE EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id::text=ANY(v_campaign.targeting_persona_ids)) END)
    AND CASE coalesce(v_system_segment_type,'')
      WHEN 'high-value' THEN coalesce(customer.total_spent,0)>=500
      WHEN 'new-customers' THEN customer.created_at>=now()-interval '30 days'
      WHEN 'frequent-buyers' THEN coalesce(customer.order_count,0)>=3
      WHEN 'perks-members' THEN EXISTS (SELECT 1 FROM public.customer_loyalty_metrics AS loyalty WHERE loyalty.customer_id=customer.id AND loyalty.is_perks_member)
      ELSE true END;
  RETURN coalesce(v_count,0);
END; $function$;

CREATE OR REPLACE FUNCTION public.get_sms_persona_recipient_page(p_campaign_id uuid, p_after_customer_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 1000)
 RETURNS TABLE(id uuid, first_name text, last_name text, phone text, email text, custom_fields jsonb, lifetime_value numeric, total_spent numeric, tags text[], is_vip boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_campaign public.crm_sms_campaigns%ROWTYPE;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT campaign.* INTO v_campaign FROM public.crm_sms_campaigns AS campaign WHERE campaign.id=p_campaign_id;
 IF v_campaign.id IS NULL OR coalesce(cardinality(v_campaign.targeting_persona_ids),0)=0 THEN RETURN; END IF;
 -- Eligibility is public.sms_eligible_customers, the one SMS rule.
 RETURN QUERY SELECT customer.id,customer.first_name,customer.last_name,customer.phone,customer.email,customer.custom_fields,customer.lifetime_value,customer.total_spent,customer.tags,customer.is_vip
 FROM public.sms_eligible_customers(v_campaign.tenant_id) AS eligible
 JOIN public.crm_customers AS customer
   ON customer.id = eligible.customer_id AND customer.tenant_id = v_campaign.tenant_id
 WHERE (p_after_customer_id IS NULL OR customer.id>p_after_customer_id)
 AND CASE lower(coalesce(v_campaign.targeting_logic,'any')) WHEN 'all' THEN NOT EXISTS (SELECT 1 FROM unnest(v_campaign.targeting_persona_ids) AS target(persona_id) WHERE NOT EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id::text=target.persona_id))
 ELSE EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id::text=ANY(v_campaign.targeting_persona_ids)) END
 ORDER BY customer.id LIMIT least(greatest(coalesce(p_limit,1000),1),5000);
END; $function$;
