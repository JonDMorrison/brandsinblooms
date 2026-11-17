-- Exact-client, owner-authorized customer intelligence without contact exports.
CREATE OR REPLACE FUNCTION public.bloom_support_slack_client_intelligence(p_job uuid,p_account uuid,p_kind text,p_query text DEFAULT NULL,p_customer uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; a uuid; tenants uuid[]; tenant uuid; result jsonb; q text; needle text;
BEGIN
 c:=public.bloom_support_slack_conversation_context(p_job);
 IF coalesce(c->>'allowed','false')<>'true' OR c->>'role' NOT IN ('platform_admin','platform_operator') THEN RAISE EXCEPTION 'An active owner-level Slack identity is required' USING ERRCODE='42501'; END IF;
 a:=(c->>'principal_id')::uuid; PERFORM bloom_support.require_permission(a,'accounts.read_all');
 IF NOT bloom_support.can_access_account(a,p_account) THEN RAISE EXCEPTION 'Client access denied' USING ERRCODE='42501'; END IF;
 IF c->>'ticket_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bloom_support.tickets WHERE id=(c->>'ticket_id')::uuid AND account_id=p_account) THEN RAISE EXCEPTION 'This ticket is scoped to a different client' USING ERRCODE='42501'; END IF;
 SELECT array_agg(DISTINCT v) INTO tenants FROM(SELECT ac.crm_tenant_id v FROM bloom_support.accounts ac WHERE ac.id=p_account AND ac.crm_tenant_id IS NOT NULL UNION ALL SELECT CASE WHEN l.external_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN l.external_id::uuid END FROM bloom_support.account_links l WHERE l.account_id=p_account AND l.product='crm') linked WHERE v IS NOT NULL;
 IF coalesce(cardinality(tenants),0)<>1 THEN RAISE EXCEPTION 'One verified CRM link is required; missing or ambiguous client link' USING ERRCODE='22023'; END IF;
 tenant:=tenants[1];
 IF p_kind='overview' THEN
  IF p_customer IS NOT NULL OR p_query IS NOT NULL THEN RAISE EXCEPTION 'Overview accepts no personal identifier' USING ERRCODE='22023'; END IF;
  SELECT jsonb_build_object('customers_on_file',count(*),'with_address_on_file',count(*) FILTER(WHERE nullif(btrim(email),'') IS NOT NULL),'recorded_opt_in',count(*) FILTER(WHERE email_opt_in IS TRUE),'recorded_opt_out',count(*) FILTER(WHERE opt_out IS TRUE),'suppressed',count(*) FILTER(WHERE suppressed IS TRUE),'with_purchase_date',count(*) FILTER(WHERE last_purchase_date IS NOT NULL),'with_recorded_vip_flag',count(*) FILTER(WHERE is_vip IS TRUE),'last_record_update',max(updated_at),'interpretation','These are data-coverage and recorded-preference counts, not an approved marketing audience. Missing history is unknown. Consent conflicts, suppressions and send eligibility must be resolved by the existing campaign checks.') INTO result FROM public.crm_customers WHERE tenant_id=tenant AND deleted_at IS NULL AND merged_into_customer_id IS NULL;
 ELSIF p_kind='find' THEN
  q:=btrim(coalesce(p_query,''));
  IF length(q) NOT BETWEEN 3 AND 100 OR p_customer IS NOT NULL OR q ~ '[%@_[:cntrl:]]' THEN RAISE EXCEPTION 'Use 3-100 literal name characters, without wildcards or contact details' USING ERRCODE='22023'; END IF;
  needle:='%'||replace(replace(replace(q,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  SELECT jsonb_build_object('results',coalesce(jsonb_agg(jsonb_build_object('customer_id',r.id,'name',concat_ws(' ',r.first_name,r.last_name),'updated_at',r.updated_at) ORDER BY r.id),'[]'::jsonb),'maximum_results',5,'more_may_exist',count(*)=5,'instruction','Select the exact customer by name; ask when names are ambiguous. No contact details are included.') INTO result FROM(SELECT id,first_name,last_name,updated_at FROM public.crm_customers WHERE tenant_id=tenant AND deleted_at IS NULL AND merged_into_customer_id IS NULL AND concat_ws(' ',first_name,last_name) ILIKE needle ORDER BY id LIMIT 5) r;
 ELSIF p_kind='profile' THEN
  IF p_customer IS NULL OR p_query IS NOT NULL THEN RAISE EXCEPTION 'One previously selected customer is required' USING ERRCODE='22023'; END IF;
  SELECT jsonb_build_object('customer_id',cu.id,'name',concat_ws(' ',cu.first_name,cu.last_name),'record_updated_at',cu.updated_at,'recorded_vip',cu.is_vip,'loyalty_member',cu.loyalty_member,'last_purchase_date',cu.last_purchase_date,'first_purchase_date',cu.first_purchase_date,'recorded_permissions',jsonb_build_object('opt_in',cu.email_opt_in,'opt_in_at',cu.email_opt_in_at,'opt_out',cu.opt_out,'suppressed',cu.suppressed),'purchase_measurements',jsonb_build_object('last_updated_at',pm.updated_at,'recorded_purchases',pm.total_purchases,'days_since_last_purchase',pm.days_since_last_purchase,'purchase_frequency',pm.purchase_frequency,'recorded_tier',pm.customer_tier,'recorded_lifetime_value',pm.lifetime_value,'currency','Not established by this snapshot; do not compare or combine currencies'),'interpretation','Recorded values may be incomplete or stale. Null means unknown, not zero. A purchase count or recorded opt-in is not proof of campaign eligibility, marketing impact, or a complete lifetime history.') INTO result FROM public.crm_customers cu LEFT JOIN public.customer_purchase_metrics pm ON pm.customer_id=cu.id AND pm.tenant_id=tenant WHERE cu.id=p_customer AND cu.tenant_id=tenant AND cu.deleted_at IS NULL AND cu.merged_into_customer_id IS NULL;
  IF result IS NULL THEN RAISE EXCEPTION 'Customer not found in the selected client' USING ERRCODE='P0002'; END IF;
 ELSE RAISE EXCEPTION 'Unsupported intelligence operation' USING ERRCODE='22023'; END IF;
 PERFORM bloom_support.log(NULL,p_account,a,'slack.client_intelligence.read',jsonb_build_object('source_job_id',p_job,'kind',p_kind,'customer_id',p_customer));
 RETURN jsonb_build_object('account_id',p_account,'observed_at',now(),'source','CRM customer records and recorded purchase metrics','data',result);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_slack_client_intelligence(uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_client_intelligence(uuid,uuid,text,text,uuid) TO service_role;
