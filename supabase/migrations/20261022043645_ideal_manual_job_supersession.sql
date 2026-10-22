-- LOCAL ONLY: explicit covering-snapshot replacement; retain every prior ledger/fact.
-- The existing finalize RPC invokes apply for every receipt inside its transaction,
-- so this same guard runs before completion. Readers only activate replacements
-- whose owning ledger is completed. Failed/cancelled work never hides prior data.
CREATE FUNCTION public.validate_ideal_manual_supersession(j public.ideal_manual_sync_jobs)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE proposed jsonb := coalesce(j.plan_scope->'supersededSources','[]'::jsonb); p jsonb; prior public.customer_intelligence_imports%ROWTYPE;
BEGIN
 IF jsonb_typeof(proposed)<>'array' THEN RAISE EXCEPTION 'Invalid replacement scope'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(proposed))<>(SELECT count(DISTINCT value->>'sourceSha') FROM jsonb_array_elements(proposed)) THEN RAISE EXCEPTION 'Duplicate replacement source'; END IF;
 IF coalesce(j.review_summary->'supersededSources','[]'::jsonb) IS DISTINCT FROM coalesce((SELECT jsonb_agg(value-'completedAt'-'reconciliation') FROM jsonb_array_elements(proposed)),'[]'::jsonb) THEN RAISE EXCEPTION 'Replacement review scope differs'; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(proposed) LOOP
  IF coalesce(p->>'sourceSha','')!~'^[a-f0-9]{64}$' OR p->>'sourceSha'=j.source_sha256 OR p->>'periodStart' IS NULL OR p->>'periodEnd' IS NULL OR (p->>'periodStart')::date>(p->>'periodEnd')::date OR (p->>'periodStart')::date<(j.plan_scope->>'periodStart')::date OR (p->>'periodEnd')::date>(j.plan_scope->>'periodEnd')::date THEN RAISE EXCEPTION 'Replacement must fully cover exact prior period'; END IF;
  SELECT * INTO STRICT prior FROM public.customer_intelligence_imports WHERE id=(p->>'importId')::uuid;
  IF prior.tenant_id IS DISTINCT FROM j.tenant_id OR prior.source<>'ideal' OR prior.report_type<>'customer_sales_summary' OR prior.status<>'completed' OR prior.source_sha256 IS DISTINCT FROM p->>'sourceSha' OR prior.source_period_start IS DISTINCT FROM (p->>'periodStart')::date OR prior.source_period_end IS DISTINCT FROM (p->>'periodEnd')::date OR prior.accepted_row_count IS DISTINCT FROM (p->>'acceptedItems')::integer OR prior.completed_at IS DISTINCT FROM (p->>'completedAt')::timestamptz OR prior.reconciliation IS DISTINCT FROM p->'reconciliation' THEN RAISE EXCEPTION 'Reviewed prior ledger changed'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.customer_intelligence_imports i WHERE i.tenant_id=j.tenant_id AND i.source='ideal' AND i.report_type='customer_sales_summary' AND i.source_sha256<>j.source_sha256 AND (i.source_period_start IS NULL OR i.source_period_end IS NULL OR (i.source_period_start<=(j.plan_scope->>'periodEnd')::date AND i.source_period_end>=(j.plan_scope->>'periodStart')::date)) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(proposed) requested WHERE i.id=(requested->>'importId')::uuid AND i.status='completed')) THEN RAISE EXCEPTION 'Unreviewed or incomplete overlapping source'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_ideal_manual_supersession(public.ideal_manual_sync_jobs) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ideal_manual_supersession(public.ideal_manual_sync_jobs) TO service_role;

-- Scope is validated at preparation publication and again at approval; stale
-- approval never authorizes a changed source. Table lock matches batch/finalize.
CREATE FUNCTION public.ideal_manual_supersession_review() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF NEW.report_family IN ('annual_sales','customer_sales') AND ((OLD.manifest_sha256 IS NULL AND NEW.plan_sha256 IS NOT NULL) OR (NEW.status='approved' AND OLD.status IS DISTINCT FROM NEW.status)) THEN
  LOCK TABLE public.customer_intelligence_imports IN SHARE ROW EXCLUSIVE MODE;
  PERFORM public.validate_ideal_manual_supersession(NEW);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ideal_manual_supersession_review BEFORE UPDATE ON public.ideal_manual_sync_jobs FOR EACH ROW EXECUTE FUNCTION public.ideal_manual_supersession_review();
REVOKE ALL ON FUNCTION public.ideal_manual_supersession_review() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.apply_ideal_manual_batch(p_tenant uuid,p_job uuid,p_plan text,p_approval text,p_lease uuid,p_generation integer,p_index integer) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE j public.ideal_manual_sync_jobs%ROWTYPE;b public.ideal_manual_sync_batches%ROWTYPE;r public.ideal_manual_sync_receipts%ROWTYPE;imp public.customer_intelligence_imports%ROWTYPE;BEGIN
 SELECT * INTO STRICT j FROM public.ideal_manual_sync_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.status<>'applying' OR j.approved_at IS NULL OR j.plan_sha256 IS DISTINCT FROM p_plan OR j.approval_sha256 IS DISTINCT FROM p_approval OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_generation IS DISTINCT FROM p_generation OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Execution scope or lease differs';END IF;
 IF j.report_family NOT IN('annual_sales','customer_sales') THEN RAISE EXCEPTION 'Review-only family';END IF;
 -- Serialize with both durable jobs and the reviewed legacy importer.
 LOCK TABLE public.customer_intelligence_imports IN SHARE ROW EXCLUSIVE MODE;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||'|ideal-product-summaries',0));
 PERFORM public.validate_ideal_manual_supersession(j);
 SELECT * INTO STRICT b FROM public.ideal_manual_sync_batches WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index;
 IF p_index>=j.batch_count OR (SELECT count(*) FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index<p_index)<>p_index THEN RAISE EXCEPTION 'Batch gap';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload) x WHERE coalesce(x->>'fingerprint','')!~'^[a-f0-9]{64}$' OR (SELECT count(*) FROM public.crm_customers c WHERE c.tenant_id=p_tenant AND c.external_id=x->>'code' AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL)<>1 OR NOT EXISTS(SELECT 1 FROM public.crm_customers c WHERE c.tenant_id=p_tenant AND c.id=(x->>'expectedCustomerId')::uuid AND c.external_id=x->>'code' AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL)) THEN RAISE EXCEPTION 'Exact customer identity changed';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(b.payload))<>(SELECT count(DISTINCT x->>'fingerprint') FROM jsonb_array_elements(b.payload) x) THEN RAISE EXCEPTION 'Duplicate batch member';END IF;
 IF j.import_id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.customer_intelligence_imports WHERE tenant_id=p_tenant AND source='ideal' AND report_type='customer_sales_summary' AND source_sha256=j.source_sha256) THEN RAISE EXCEPTION 'Existing import requires separate reconciliation';END IF;
  INSERT INTO public.customer_intelligence_imports(tenant_id,source,report_type,source_filename,source_sha256,source_period_start,source_period_end,status,source_row_count,rejected_row_count,reconciliation,created_by) VALUES(p_tenant,'ideal','customer_sales_summary',j.source_filename,j.source_sha256,(j.plan_scope->>'periodStart')::date,(j.plan_scope->>'periodEnd')::date,'processing',(j.review_summary->>'sourceRows')::integer,(j.review_summary->>'excludedItems')::integer,jsonb_build_object('plan_sha256',j.plan_sha256,'job_id',j.id,'evidence_kind','annual product aggregates; no dated visits','superseded_sources',coalesce((SELECT jsonb_agg(jsonb_build_object('sourceSha',s->>'sourceSha','periodStart',s->>'periodStart','periodEnd',s->>'periodEnd')) FROM jsonb_array_elements(coalesce(j.plan_scope->'supersededSources','[]'::jsonb)) s),'[]'::jsonb),'supersession_mode','retain_prior_complete_covering_snapshots'),j.created_by) RETURNING * INTO imp;
  UPDATE public.ideal_manual_sync_jobs SET import_id=imp.id WHERE id=p_job;j.import_id=imp.id;
 END IF;
 SELECT * INTO STRICT imp FROM public.customer_intelligence_imports WHERE id=j.import_id FOR UPDATE;
 IF imp.tenant_id IS DISTINCT FROM p_tenant OR imp.source<>'ideal' OR imp.report_type<>'customer_sales_summary' OR imp.source_sha256 IS DISTINCT FROM j.source_sha256 OR imp.source_period_start IS DISTINCT FROM (j.plan_scope->>'periodStart')::date OR imp.source_period_end IS DISTINCT FROM (j.plan_scope->>'periodEnd')::date OR imp.status<>'processing' OR imp.reconciliation->>'plan_sha256' IS DISTINCT FROM j.plan_sha256 OR imp.reconciliation->>'job_id' IS DISTINCT FROM j.id::text OR coalesce(imp.reconciliation->'superseded_sources','[]'::jsonb) IS DISTINCT FROM coalesce((SELECT jsonb_agg(jsonb_build_object('sourceSha',s->>'sourceSha','periodStart',s->>'periodStart','periodEnd',s->>'periodEnd')) FROM jsonb_array_elements(coalesce(j.plan_scope->'supersededSources','[]'::jsonb)) s),'[]'::jsonb) THEN RAISE EXCEPTION 'Owning import ledger changed';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload) x JOIN public.customer_intelligence_source_events e ON e.tenant_id=p_tenant AND e.source='ideal' AND e.source_fingerprint=x->>'fingerprint' WHERE e.import_id IS DISTINCT FROM j.import_id OR e.customer_id IS DISTINCT FROM (x->>'expectedCustomerId')::uuid OR e.external_customer_code IS DISTINCT FROM x->>'code' OR e.raw_data IS DISTINCT FROM x->'raw' OR e.amount IS DISTINCT FROM (x->>'amount')::numeric OR e.event_type<>'purchase_summary' OR e.occurred_at IS NOT NULL) THEN RAISE EXCEPTION 'Persisted fact conflict';END IF;
 SELECT * INTO r FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index;
 IF FOUND THEN IF r.payload_sha256<>b.payload_sha256 OR (SELECT count(*) FROM jsonb_array_elements(b.payload) x JOIN public.customer_intelligence_source_events e ON e.tenant_id=p_tenant AND e.import_id=j.import_id AND e.source_fingerprint=x->>'fingerprint')<>jsonb_array_length(b.payload) THEN RAISE EXCEPTION 'Receipt membership differs';END IF;RETURN 'already_committed';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload) x JOIN public.customer_intelligence_source_events e ON e.tenant_id=p_tenant AND e.source='ideal' AND e.source_fingerprint=x->>'fingerprint') THEN RAISE EXCEPTION 'Unreceipted facts require reconciliation';END IF;
 INSERT INTO public.customer_intelligence_source_events(tenant_id,customer_id,import_id,source,event_type,external_customer_code,amount,occurred_at,source_fingerprint,raw_data) SELECT p_tenant,(x->>'expectedCustomerId')::uuid,j.import_id,'ideal','purchase_summary',x->>'code',(x->>'amount')::numeric,NULL,x->>'fingerprint',x->'raw' FROM jsonb_array_elements(b.payload) x;
 INSERT INTO public.ideal_manual_sync_receipts VALUES(p_tenant,p_job,p_index,b.payload_sha256,clock_timestamp());
 UPDATE public.ideal_manual_sync_jobs SET committed_batches=committed_batches+1,lease_until=clock_timestamp()+interval '10 minutes' WHERE id=p_job;
 RETURN 'committed';END $$;
