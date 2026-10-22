-- LOCAL, UNRELEASED operator-run Ideal staging. No client table writes.
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('ideal-import-staging','ideal-import-staging',false,134217728) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='ideal-import-staging' AND (public IS DISTINCT FROM false OR file_size_limit IS DISTINCT FROM 134217728::bigint)) THEN RAISE EXCEPTION 'Existing staging bucket policy differs';END IF;END $$;
CREATE TABLE public.ideal_manual_sync_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),created_by uuid NOT NULL,
 source_filename text NOT NULL,source_path text NOT NULL UNIQUE,source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),source_bytes bigint NOT NULL CHECK(source_bytes BETWEEN 1 AND 134217728),
 report_family text NOT NULL,encoding text NOT NULL CHECK(encoding IN('utf-8','windows-1252')),
 status text NOT NULL DEFAULT 'uploading' CHECK(status IN('uploading','staged','preparing','review_required','quarantined','approved','applying','recovery_required','completed','cancelled')),
 manifest_sha256 text,plan_sha256 text,approval_sha256 text,identity_sha256 text,review_summary jsonb,
 plan_scope jsonb,batch_count integer NOT NULL DEFAULT 0,committed_batches integer NOT NULL DEFAULT 0,
 lease_token uuid,lease_generation integer NOT NULL DEFAULT 0,lease_until timestamptz,
 import_id uuid REFERENCES public.customer_intelligence_imports(id),approved_by uuid,approved_at timestamptz,last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,source_sha256,report_family)
);
CREATE TABLE public.ideal_manual_sync_batches(
 tenant_id uuid NOT NULL,job_id uuid NOT NULL,batch_index integer NOT NULL CHECK(batch_index>=0),payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'),payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='array' AND jsonb_array_length(payload) BETWEEN 1 AND 500),
 PRIMARY KEY(tenant_id,job_id,batch_index),FOREIGN KEY(tenant_id,job_id) REFERENCES public.ideal_manual_sync_jobs(tenant_id,id)
);
CREATE TABLE public.ideal_manual_sync_receipts(
 tenant_id uuid NOT NULL,job_id uuid NOT NULL,batch_index integer NOT NULL,payload_sha256 text NOT NULL,committed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,job_id,batch_index),FOREIGN KEY(tenant_id,job_id,batch_index) REFERENCES public.ideal_manual_sync_batches(tenant_id,job_id,batch_index)
);
ALTER TABLE public.ideal_manual_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideal_manual_sync_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideal_manual_sync_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_manual_sync_jobs,public.ideal_manual_sync_batches,public.ideal_manual_sync_receipts FROM anon,authenticated;
GRANT ALL ON public.ideal_manual_sync_jobs,public.ideal_manual_sync_batches,public.ideal_manual_sync_receipts TO service_role;
CREATE FUNCTION public.ideal_manual_job_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF ROW(NEW.tenant_id,NEW.source_filename,NEW.source_path,NEW.source_sha256,NEW.source_bytes,NEW.report_family,NEW.encoding) IS DISTINCT FROM ROW(OLD.tenant_id,OLD.source_filename,OLD.source_path,OLD.source_sha256,OLD.source_bytes,OLD.report_family,OLD.encoding) THEN RAISE EXCEPTION 'Source scope immutable'; END IF;
 IF OLD.manifest_sha256 IS NULL AND NEW.manifest_sha256 IS NOT NULL THEN
 IF OLD.status<>'preparing' OR OLD.lease_until IS NULL OR OLD.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Preparation lease expired';END IF;
 IF NEW.plan_sha256 IS NOT NULL THEN
  IF NEW.batch_count<1 OR (SELECT count(*) FROM public.ideal_manual_sync_batches WHERE tenant_id=NEW.tenant_id AND job_id=NEW.id)<>NEW.batch_count OR (SELECT max(batch_index) FROM public.ideal_manual_sync_batches WHERE tenant_id=NEW.tenant_id AND job_id=NEW.id)<>NEW.batch_count-1 THEN RAISE EXCEPTION 'Prepared batch set incomplete';END IF;
  IF NEW.plan_scope->>'sourceSha256' IS DISTINCT FROM NEW.source_sha256 OR NEW.plan_scope->>'manifestSha256' IS DISTINCT FROM NEW.manifest_sha256 OR NEW.plan_scope->>'planSha256' IS DISTINCT FROM NEW.plan_sha256 OR NEW.plan_scope->>'identitySha256' IS DISTINCT FROM NEW.identity_sha256 THEN RAISE EXCEPTION 'Prepared scope differs';END IF;
  IF EXISTS(SELECT 1 FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id AND (x->'raw'->>'source_sha256' IS DISTINCT FROM NEW.source_sha256 OR x->'raw'->>'period_start' IS DISTINCT FROM NEW.plan_scope->>'periodStart' OR x->'raw'->>'period_end' IS DISTINCT FROM NEW.plan_scope->>'periodEnd')) THEN RAISE EXCEPTION 'Member source scope differs';END IF;
  IF (SELECT sum(jsonb_array_length(x->'raw'->'items')) FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedItems')::bigint OR (SELECT sum((x->>'amount')::numeric*100) FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'amountCents')::numeric THEN RAISE EXCEPTION 'Prepared totals differ';END IF;
  IF (SELECT count(*) FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint OR
  (SELECT count(DISTINCT x->>'fingerprint') FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint THEN RAISE EXCEPTION 'Prepared membership differs';END IF;
 ELSE IF EXISTS(SELECT 1 FROM public.ideal_manual_sync_batches WHERE tenant_id=NEW.tenant_id AND job_id=NEW.id) THEN RAISE EXCEPTION 'Review-only source has staged executable batches';END IF;END IF;
 END IF;
 IF OLD.manifest_sha256 IS NOT NULL AND ROW(NEW.manifest_sha256,NEW.plan_sha256,NEW.approval_sha256,NEW.identity_sha256,NEW.plan_scope,NEW.batch_count,NEW.review_summary) IS DISTINCT FROM ROW(OLD.manifest_sha256,OLD.plan_sha256,OLD.approval_sha256,OLD.identity_sha256,OLD.plan_scope,OLD.batch_count,OLD.review_summary) THEN RAISE EXCEPTION 'Review scope immutable'; END IF;NEW.updated_at=clock_timestamp();RETURN NEW;END $$;
CREATE TRIGGER ideal_manual_job_immutable BEFORE UPDATE ON public.ideal_manual_sync_jobs FOR EACH ROW EXECUTE FUNCTION public.ideal_manual_job_immutable();
CREATE FUNCTION public.ideal_manual_batch_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'Staged batches immutable';END $$;
CREATE TRIGGER ideal_manual_batch_immutable BEFORE UPDATE OR DELETE ON public.ideal_manual_sync_batches FOR EACH ROW EXECUTE FUNCTION public.ideal_manual_batch_immutable();
CREATE FUNCTION public.claim_ideal_manual_job(p_tenant uuid,p_job uuid) RETURNS public.ideal_manual_sync_jobs LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE j public.ideal_manual_sync_jobs%ROWTYPE;BEGIN
 SELECT * INTO STRICT j FROM public.ideal_manual_sync_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.status NOT IN('staged','preparing','approved','applying','recovery_required') OR coalesce(j.lease_until>clock_timestamp(),false) THEN RAISE EXCEPTION 'Job unavailable';END IF;
 UPDATE public.ideal_manual_sync_jobs SET lease_token=gen_random_uuid(),lease_generation=lease_generation+1,lease_until=clock_timestamp()+interval '10 minutes',status=CASE WHEN manifest_sha256 IS NULL THEN 'preparing' ELSE 'applying' END WHERE id=p_job RETURNING * INTO j;RETURN j;END $$;
CREATE FUNCTION public.apply_ideal_manual_batch(p_tenant uuid,p_job uuid,p_plan text,p_approval text,p_lease uuid,p_generation integer,p_index integer) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE j public.ideal_manual_sync_jobs%ROWTYPE;b public.ideal_manual_sync_batches%ROWTYPE;r public.ideal_manual_sync_receipts%ROWTYPE;imp public.customer_intelligence_imports%ROWTYPE;BEGIN
 SELECT * INTO STRICT j FROM public.ideal_manual_sync_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.status<>'applying' OR j.approved_at IS NULL OR j.plan_sha256 IS DISTINCT FROM p_plan OR j.approval_sha256 IS DISTINCT FROM p_approval OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_generation IS DISTINCT FROM p_generation OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Execution scope or lease differs';END IF;
 IF j.report_family NOT IN('annual_sales','customer_sales') THEN RAISE EXCEPTION 'Review-only family';END IF;
 -- Initial integrated path rejects overlap. Supersession remains existing reviewed CLI only.
 LOCK TABLE public.customer_intelligence_imports IN SHARE ROW EXCLUSIVE MODE;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||'|ideal-product-summaries',0));
 IF EXISTS(SELECT 1 FROM public.customer_intelligence_imports i WHERE i.tenant_id=p_tenant AND i.source='ideal' AND i.report_type='customer_sales_summary' AND i.source_sha256<>j.source_sha256 AND i.status IN('completed','processing','failed','completed_with_errors') AND (i.source_period_start IS NULL OR i.source_period_end IS NULL OR (i.source_period_start<=(j.plan_scope->>'periodEnd')::date AND i.source_period_end>=(j.plan_scope->>'periodStart')::date))) THEN RAISE EXCEPTION 'Overlapping source requires reviewed CLI plan';END IF;
 SELECT * INTO STRICT b FROM public.ideal_manual_sync_batches WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index;
 IF p_index>=j.batch_count OR (SELECT count(*) FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index<p_index)<>p_index THEN RAISE EXCEPTION 'Batch gap';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload) x WHERE coalesce(x->>'fingerprint','')!~'^[a-f0-9]{64}$' OR (SELECT count(*) FROM public.crm_customers c WHERE c.tenant_id=p_tenant AND c.external_id=x->>'code' AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL)<>1 OR NOT EXISTS(SELECT 1 FROM public.crm_customers c WHERE c.tenant_id=p_tenant AND c.id=(x->>'expectedCustomerId')::uuid AND c.external_id=x->>'code' AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL)) THEN RAISE EXCEPTION 'Exact customer identity changed';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(b.payload))<>(SELECT count(DISTINCT x->>'fingerprint') FROM jsonb_array_elements(b.payload) x) THEN RAISE EXCEPTION 'Duplicate batch member';END IF;
 IF j.import_id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.customer_intelligence_imports WHERE tenant_id=p_tenant AND source='ideal' AND report_type='customer_sales_summary' AND source_sha256=j.source_sha256) THEN RAISE EXCEPTION 'Existing import requires separate reconciliation';END IF;
  INSERT INTO public.customer_intelligence_imports(tenant_id,source,report_type,source_filename,source_sha256,source_period_start,source_period_end,status,source_row_count,rejected_row_count,reconciliation,created_by) VALUES(p_tenant,'ideal','customer_sales_summary',j.source_filename,j.source_sha256,(j.plan_scope->>'periodStart')::date,(j.plan_scope->>'periodEnd')::date,'processing',(j.review_summary->>'sourceRows')::integer,(j.review_summary->>'excludedItems')::integer,jsonb_build_object('plan_sha256',j.plan_sha256,'job_id',j.id,'evidence_kind','annual product aggregates; no dated visits'),j.created_by) RETURNING * INTO imp;
  UPDATE public.ideal_manual_sync_jobs SET import_id=imp.id WHERE id=p_job;j.import_id=imp.id;
 END IF;
 SELECT * INTO STRICT imp FROM public.customer_intelligence_imports WHERE id=j.import_id FOR UPDATE;
 IF imp.tenant_id IS DISTINCT FROM p_tenant OR imp.source<>'ideal' OR imp.report_type<>'customer_sales_summary' OR imp.source_sha256 IS DISTINCT FROM j.source_sha256 OR imp.source_period_start IS DISTINCT FROM (j.plan_scope->>'periodStart')::date OR imp.source_period_end IS DISTINCT FROM (j.plan_scope->>'periodEnd')::date OR imp.status<>'processing' OR imp.reconciliation->>'plan_sha256' IS DISTINCT FROM j.plan_sha256 OR imp.reconciliation->>'job_id' IS DISTINCT FROM j.id::text THEN RAISE EXCEPTION 'Owning import ledger changed';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload) x JOIN public.customer_intelligence_source_events e ON e.tenant_id=p_tenant AND e.source='ideal' AND e.source_fingerprint=x->>'fingerprint' WHERE e.import_id IS DISTINCT FROM j.import_id OR e.customer_id IS DISTINCT FROM (x->>'expectedCustomerId')::uuid OR e.external_customer_code IS DISTINCT FROM x->>'code' OR e.raw_data IS DISTINCT FROM x->'raw' OR e.amount IS DISTINCT FROM (x->>'amount')::numeric OR e.event_type<>'purchase_summary' OR e.occurred_at IS NOT NULL) THEN RAISE EXCEPTION 'Persisted fact conflict';END IF;
 SELECT * INTO r FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index;
 IF FOUND THEN IF r.payload_sha256<>b.payload_sha256 OR (SELECT count(*) FROM jsonb_array_elements(b.payload) x JOIN public.customer_intelligence_source_events e ON e.tenant_id=p_tenant AND e.import_id=j.import_id AND e.source_fingerprint=x->>'fingerprint')<>jsonb_array_length(b.payload) THEN RAISE EXCEPTION 'Receipt membership differs';END IF;RETURN 'already_committed';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload) x JOIN public.customer_intelligence_source_events e ON e.tenant_id=p_tenant AND e.source='ideal' AND e.source_fingerprint=x->>'fingerprint') THEN RAISE EXCEPTION 'Unreceipted facts require reconciliation';END IF;
 INSERT INTO public.customer_intelligence_source_events(tenant_id,customer_id,import_id,source,event_type,external_customer_code,amount,occurred_at,source_fingerprint,raw_data) SELECT p_tenant,(x->>'expectedCustomerId')::uuid,j.import_id,'ideal','purchase_summary',x->>'code',(x->>'amount')::numeric,NULL,x->>'fingerprint',x->'raw' FROM jsonb_array_elements(b.payload) x;
 INSERT INTO public.ideal_manual_sync_receipts VALUES(p_tenant,p_job,p_index,b.payload_sha256,clock_timestamp());
 UPDATE public.ideal_manual_sync_jobs SET committed_batches=committed_batches+1,lease_until=clock_timestamp()+interval '10 minutes' WHERE id=p_job;
 RETURN 'committed';END $$;
REVOKE ALL ON FUNCTION public.claim_ideal_manual_job(uuid,uuid),public.apply_ideal_manual_batch(uuid,uuid,text,text,uuid,integer,integer),public.ideal_manual_job_immutable(),public.ideal_manual_batch_immutable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ideal_manual_job(uuid,uuid),public.apply_ideal_manual_batch(uuid,uuid,text,text,uuid,integer,integer) TO service_role;
CREATE FUNCTION public.finish_ideal_manual_job(p_tenant uuid,p_job uuid,p_plan text,p_lease uuid,p_generation integer) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE j public.ideal_manual_sync_jobs%ROWTYPE;n bigint;items bigint;cents numeric;BEGIN
 SELECT * INTO STRICT j FROM public.ideal_manual_sync_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.plan_sha256 IS DISTINCT FROM p_plan THEN RAISE EXCEPTION 'Plan changed';END IF;
 IF j.status='completed' THEN RETURN 'already_completed';END IF;
 IF j.status<>'applying' OR j.approved_at IS NULL OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_generation IS DISTINCT FROM p_generation OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Invalid execution lease';END IF;
 IF j.batch_count<1 OR (SELECT count(*) FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job)<>j.batch_count THEN RAISE EXCEPTION 'Incomplete receipts';END IF;
 -- Revalidate every committed batch using the same exact identity/payload check.
 FOR n IN 0..j.batch_count-1 LOOP PERFORM public.apply_ideal_manual_batch(p_tenant,p_job,j.plan_sha256,j.approval_sha256,p_lease,p_generation,n::integer);END LOOP;
 SELECT count(*),sum(jsonb_array_length(raw_data->'items')),sum(amount*100) INTO n,items,cents FROM public.customer_intelligence_source_events WHERE tenant_id=p_tenant AND import_id=j.import_id;
 IF n IS DISTINCT FROM (j.review_summary->>'acceptedCustomers')::bigint OR items IS DISTINCT FROM (j.review_summary->>'acceptedItems')::bigint OR cents IS DISTINCT FROM (j.review_summary->>'amountCents')::numeric THEN RAISE EXCEPTION 'Final totals differ';END IF;
 UPDATE public.customer_intelligence_imports SET status='completed',accepted_row_count=items,completed_at=clock_timestamp() WHERE tenant_id=p_tenant AND id=j.import_id AND status='processing';IF NOT FOUND THEN RAISE EXCEPTION 'Ledger state changed';END IF;
 UPDATE public.ideal_manual_sync_jobs SET status='completed',lease_until=NULL,last_error=NULL WHERE tenant_id=p_tenant AND id=p_job;RETURN 'completed';END $$;
REVOKE ALL ON FUNCTION public.finish_ideal_manual_job(uuid,uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ideal_manual_job(uuid,uuid,text,uuid,integer) TO service_role;
CREATE FUNCTION public.stage_ideal_manual_batch(p_tenant uuid,p_job uuid,p_lease uuid,p_generation integer,p_index integer,p_hash text,p_payload jsonb) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE j public.ideal_manual_sync_jobs%ROWTYPE;b public.ideal_manual_sync_batches%ROWTYPE;BEGIN
 SELECT * INTO STRICT j FROM public.ideal_manual_sync_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.status<>'preparing' OR j.manifest_sha256 IS NOT NULL OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_generation IS DISTINCT FROM p_generation OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Preparation lease differs';END IF;
 SELECT * INTO b FROM public.ideal_manual_sync_batches WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index;
 IF FOUND THEN IF b.payload_sha256 IS DISTINCT FROM p_hash OR b.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Prepared batch differs';END IF;RETURN 'already_staged';END IF;
 INSERT INTO public.ideal_manual_sync_batches VALUES(p_tenant,p_job,p_index,p_hash,p_payload);RETURN 'staged';END $$;
REVOKE ALL ON FUNCTION public.stage_ideal_manual_batch(uuid,uuid,uuid,integer,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_ideal_manual_batch(uuid,uuid,uuid,integer,integer,text,jsonb) TO service_role;

CREATE FUNCTION public.heartbeat_ideal_manual_job(p_tenant uuid,p_job uuid,p_lease uuid,p_generation integer) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 UPDATE public.ideal_manual_sync_jobs SET lease_until=clock_timestamp()+interval '10 minutes' WHERE tenant_id=p_tenant AND id=p_job AND lease_token=p_lease AND lease_generation=p_generation AND lease_until>clock_timestamp() AND status IN('preparing','applying');RETURN FOUND;END $$;
REVOKE ALL ON FUNCTION public.heartbeat_ideal_manual_job(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_ideal_manual_job(uuid,uuid,uuid,integer) TO service_role;
