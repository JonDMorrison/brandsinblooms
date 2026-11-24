-- Applied to udldmkqwnxhdeztyqcau on 2026-11-24 (recorded version in filename).

-- QA pass 4 follow-up #1c: count_sms_campaign_recipients reads
-- crm_customers.pos_order_count for the built-in "frequent-buyers" segment.
--
-- crm_customers has no order_count column, so the count raised
-- "column customer.order_count does not exist" for every campaign once the
-- persona comparison was fixed (PL/pgSQL plans the whole statement). The
-- enqueue worker (sms-campaign-enqueue-worker) and SegmentSMSDialog already
-- define frequent buyers as pos_order_count >= 3; the count now matches them.
-- Nothing else changes.

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
      WHEN 'frequent-buyers' THEN coalesce(customer.pos_order_count,0)>=3
      WHEN 'perks-members' THEN EXISTS (SELECT 1 FROM public.customer_loyalty_metrics AS loyalty WHERE loyalty.customer_id=customer.id AND loyalty.is_perks_member)
      ELSE true END;
  RETURN coalesce(v_count,0);
END; $function$;
