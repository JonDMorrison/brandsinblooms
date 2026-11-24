-- Service-only atomic save of a server-recomputed, explicitly reviewed audience.
-- No campaign, consent, reward or transaction writes.
CREATE OR REPLACE FUNCTION public.save_observed_journal_segment_v1(
 p_tenant_id uuid,p_user_id uuid,p_name text,p_digest text,p_ids uuid[],p_provenance jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE sid uuid; actual integer; prior public.crm_segments%ROWTYPE; key text;
BEGIN
 PERFORM loyalty_private.assert_actor(p_tenant_id,p_user_id);
 IF coalesce(length(btrim(p_name)),0) NOT BETWEEN 1 AND 120 OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$'
   OR coalesce(cardinality(p_ids),0) NOT BETWEEN 1 AND 20000 OR array_position(p_ids,NULL) IS NOT NULL
   OR jsonb_typeof(p_provenance) IS DISTINCT FROM 'object'
   OR p_provenance->>'basis' IS DISTINCT FROM 'observed_journal_comparison'
   OR p_provenance->'source_coverage_complete' IS DISTINCT FROM 'false'::jsonb
   OR p_provenance->'sendingConsentChecked' IS DISTINCT FROM 'false'::jsonb
   OR (p_provenance->>'original_count')::int IS DISTINCT FROM cardinality(p_ids)
 THEN RAISE EXCEPTION 'Invalid reviewed journal audience'; END IF;
 IF (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>cardinality(p_ids) THEN RAISE EXCEPTION 'Duplicate audience identities'; END IF;
 -- Bind this source to current tenant-scoped completed or explicitly partial evidence.
 IF (SELECT count(*) FROM public.customer_intelligence_imports i
 WHERE i.tenant_id=p_tenant_id AND i.source='ideal' AND (
 (i.id::text=p_provenance->'baselineSource'->>'id' AND i.source_sha256=p_provenance->'baselineSource'->>'sha256') OR
 (i.id::text=p_provenance->'currentSource'->>'id' AND i.source_sha256=p_provenance->'currentSource'->>'sha256'))
 AND ((i.report_type='journal' AND i.status='completed') OR (i.report_type='journal_partial' AND i.status='completed_with_errors' AND i.reconciliation->'applied'->'coverage_complete'='false'::jsonb))) <> 
 CASE WHEN p_provenance->'baselineSource'->>'id'=p_provenance->'currentSource'->>'id' THEN 1 ELSE 2 END
 THEN RAISE EXCEPTION 'Journal source changed; review again'; END IF;
 key:='review:'||p_digest;
 PERFORM pg_advisory_xact_lock(hashtextextended('journal-segment:'||p_tenant_id::text,0));
 PERFORM c.id FROM public.crm_customers c WHERE c.tenant_id=p_tenant_id AND c.id=ANY(p_ids) AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL ORDER BY c.id FOR UPDATE;
 GET DIAGNOSTICS actual=ROW_COUNT;
 IF actual<>cardinality(p_ids) THEN RAISE EXCEPTION 'Some audience identities changed; no member was silently dropped'; END IF;
 SELECT * INTO prior FROM public.crm_segments s WHERE s.tenant_id=p_tenant_id AND s.source='observed_ideal_journal' AND s.source_id=key LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF prior.deleted_at IS NOT NULL OR prior.status<>'active' OR prior.auto_update IS DISTINCT FROM false OR prior.customer_count IS DISTINCT FROM actual
  OR (SELECT count(*) FROM public.customer_segments cs WHERE cs.segment_id=prior.id)<>actual
  OR EXISTS(SELECT 1 FROM public.customer_segments cs WHERE cs.segment_id=prior.id AND NOT(cs.customer_id=ANY(p_ids)))
  THEN RAISE EXCEPTION 'The previously saved audience changed; review it in Segments'; END IF;
  RETURN jsonb_build_object('segmentId',prior.id,'name',prior.name,'customers',actual,'replayed',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.crm_segments s WHERE s.tenant_id=p_tenant_id AND lower(s.name)=lower(btrim(p_name)) AND s.deleted_at IS NULL) THEN RAISE EXCEPTION 'A segment with this name already exists'; END IF;
 INSERT INTO public.crm_segments(tenant_id,user_id,name,description,conditions,customer_count,auto_update,include_all_customers,status,source,source_id,analysis_provenance)
 VALUES(p_tenant_id,p_user_id,btrim(p_name),'Frozen observed decline audience. Incomplete journal coverage; no lost-customer or consent claim.','{}'::jsonb,actual,false,false,'active','observed_ideal_journal',key,p_provenance||jsonb_build_object('review_digest',p_digest,'captured_at',now()))
 RETURNING id INTO sid;
 INSERT INTO public.customer_segments(customer_id,segment_id,assigned_by_user_id) SELECT unnest(p_ids),sid,p_user_id;
 IF (SELECT count(*) FROM public.customer_segments cs WHERE cs.segment_id=sid)<>actual THEN RAISE EXCEPTION 'Saved membership did not reconcile'; END IF;
 RETURN jsonb_build_object('segmentId',sid,'name',btrim(p_name),'customers',actual,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.save_observed_journal_segment_v1(uuid,uuid,text,text,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_observed_journal_segment_v1(uuid,uuid,text,text,uuid[],jsonb) TO service_role;
