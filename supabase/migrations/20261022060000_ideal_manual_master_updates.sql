-- LOCAL UNRELEASED: protected customer-master names only. Job review/lease owns every write.
CREATE TABLE public.ideal_manual_master_audit(
 tenant_id uuid NOT NULL,job_id uuid NOT NULL,batch_index integer NOT NULL,
 customer_id uuid NOT NULL REFERENCES public.crm_customers(id),fingerprint text NOT NULL,payload jsonb NOT NULL,
 committed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,job_id,customer_id),UNIQUE(tenant_id,job_id,fingerprint),
 FOREIGN KEY(tenant_id,job_id,batch_index) REFERENCES public.ideal_manual_sync_batches(tenant_id,job_id,batch_index)
);
ALTER TABLE public.ideal_manual_master_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_manual_master_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.ideal_manual_master_audit TO service_role;
CREATE TRIGGER ideal_manual_master_audit_immutable BEFORE UPDATE OR DELETE ON public.ideal_manual_master_audit FOR EACH ROW EXECUTE FUNCTION public.ideal_manual_batch_immutable();

CREATE FUNCTION public.validate_ideal_master_member(x jsonb,p_source text,p_identity text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE k text;
BEGIN
 IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR NOT x ?& ARRAY['code','expectedCustomerId','before','after','source','identitySha256','fingerprint'] OR x-ARRAY['code','expectedCustomerId','before','after','source','identitySha256','fingerprint']<>'{}'::jsonb THEN RETURN false;END IF;
 IF jsonb_typeof(x->'code') IS DISTINCT FROM 'string' OR x->>'code'='' OR coalesce(x->>'expectedCustomerId','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR coalesce(x->>'fingerprint','')!~'^[a-f0-9]{64}$' OR x->>'identitySha256' IS DISTINCT FROM p_identity THEN RETURN false;END IF;
 IF jsonb_typeof(x->'source') IS DISTINCT FROM 'object' OR (x->'source')-ARRAY['sha256','sheet','row']<>'{}'::jsonb OR x->'source'->>'sha256' IS DISTINCT FROM p_source OR jsonb_typeof(x->'source'->'sheet') IS DISTINCT FROM 'string' OR coalesce(x->'source'->>'row','')!~'^[1-9][0-9]*$' THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['before','after'] LOOP
  IF jsonb_typeof(x->k) IS DISTINCT FROM 'object' OR NOT (x->k) ?& ARRAY['first_name','last_name'] OR (x->k)-ARRAY['first_name','last_name']<>'{}'::jsonb OR jsonb_typeof(x->k->'first_name') NOT IN('string','null') OR jsonb_typeof(x->k->'last_name') NOT IN('string','null') THEN RETURN false;END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['first_name','last_name'] LOOP
  IF (x->'after'->>k IS NULL OR btrim(x->'after'->>k)='') AND x->'after'->k IS DISTINCT FROM x->'before'->k THEN RETURN false;END IF;
 END LOOP;
 RETURN x->'before' IS DISTINCT FROM x->'after';
END $$;

CREATE FUNCTION public.apply_ideal_master_batch(p_tenant uuid,p_job uuid,p_plan text,p_approval text,p_lease uuid,p_generation integer,p_index integer) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE j public.ideal_manual_sync_jobs%ROWTYPE;b public.ideal_manual_sync_batches%ROWTYPE;r public.ideal_manual_sync_receipts%ROWTYPE;x jsonb;c public.crm_customers%ROWTYPE;a public.ideal_manual_master_audit%ROWTYPE;replay boolean;
BEGIN
 SELECT * INTO STRICT j FROM public.ideal_manual_sync_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.report_family<>'customer_master' OR j.status<>'applying' OR j.approved_at IS NULL OR j.plan_sha256 IS DISTINCT FROM p_plan OR j.approval_sha256 IS DISTINCT FROM p_approval OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_generation IS DISTINCT FROM p_generation OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Master execution scope or lease differs';END IF;
 SELECT * INTO STRICT b FROM public.ideal_manual_sync_batches WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index;
 IF p_index>=j.batch_count OR (SELECT count(*) FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index<p_index)<>p_index THEN RAISE EXCEPTION 'Master batch gap';END IF;
 -- Fence concurrent CODE inserts/remaps as well as updates while checking exact identity.
 LOCK TABLE public.crm_customers IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO r FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index;replay:=FOUND;
 IF replay AND r.payload_sha256 IS DISTINCT FROM b.payload_sha256 THEN RAISE EXCEPTION 'Master receipt differs';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(b.payload) LOOP
  IF NOT public.validate_ideal_master_member(x,j.source_sha256,j.identity_sha256) THEN RAISE EXCEPTION 'Invalid protected master payload';END IF;
  IF (SELECT count(*) FROM public.crm_customers WHERE tenant_id=p_tenant AND external_id=x->>'code' AND deleted_at IS NULL AND merged_into_customer_id IS NULL)<>1 THEN RAISE EXCEPTION 'Master identity ambiguous or missing';END IF;
  SELECT * INTO STRICT c FROM public.crm_customers WHERE tenant_id=p_tenant AND id=(x->>'expectedCustomerId')::uuid AND external_id=x->>'code' AND deleted_at IS NULL AND merged_into_customer_id IS NULL FOR UPDATE;
  SELECT * INTO a FROM public.ideal_manual_master_audit WHERE tenant_id=p_tenant AND job_id=p_job AND customer_id=c.id;
  IF replay THEN
   IF NOT FOUND OR a.batch_index<>p_index OR a.payload IS DISTINCT FROM x OR a.fingerprint IS DISTINCT FROM x->>'fingerprint' OR jsonb_build_object('first_name',c.first_name,'last_name',c.last_name) IS DISTINCT FROM x->'after' THEN RAISE EXCEPTION 'Master committed state differs';END IF;
  ELSE
   IF FOUND THEN RAISE EXCEPTION 'Unreceipted or repeated master member';END IF;
   IF jsonb_build_object('first_name',c.first_name,'last_name',c.last_name) IS DISTINCT FROM x->'before' THEN RAISE EXCEPTION 'Master name snapshot stale';END IF;
   UPDATE public.crm_customers SET first_name=x->'after'->>'first_name',last_name=x->'after'->>'last_name' WHERE tenant_id=p_tenant AND id=c.id;
   INSERT INTO public.ideal_manual_master_audit(tenant_id,job_id,batch_index,customer_id,fingerprint,payload) VALUES(p_tenant,p_job,p_index,c.id,x->>'fingerprint',x);
  END IF;
 END LOOP;
 IF replay THEN
  IF (SELECT count(*) FROM public.ideal_manual_master_audit WHERE tenant_id=p_tenant AND job_id=p_job AND batch_index=p_index)<>jsonb_array_length(b.payload) THEN RAISE EXCEPTION 'Master audit membership differs';END IF;
  RETURN 'already_committed';
 END IF;
 INSERT INTO public.ideal_manual_sync_receipts VALUES(p_tenant,p_job,p_index,b.payload_sha256,clock_timestamp());
 UPDATE public.ideal_manual_sync_jobs SET committed_batches=committed_batches+1,lease_until=clock_timestamp()+interval '10 minutes' WHERE tenant_id=p_tenant AND id=p_job;
 RETURN 'committed';
END $$;
CREATE FUNCTION public.finish_ideal_master_job(p_tenant uuid,p_job uuid,p_plan text,p_lease uuid,p_generation integer) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE j public.ideal_manual_sync_jobs%ROWTYPE;n integer;
BEGIN
 SELECT * INTO STRICT j FROM public.ideal_manual_sync_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.report_family<>'customer_master' OR j.plan_sha256 IS DISTINCT FROM p_plan THEN RAISE EXCEPTION 'Master plan differs';END IF;
 IF j.status='completed' THEN RETURN 'already_completed';END IF;
 IF j.status<>'applying' OR j.approved_at IS NULL OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_generation IS DISTINCT FROM p_generation OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Master finalization lease differs';END IF;
 IF j.batch_count<1 OR (SELECT count(*) FROM public.ideal_manual_sync_receipts WHERE tenant_id=p_tenant AND job_id=p_job)<>j.batch_count THEN RAISE EXCEPTION 'Incomplete master receipts';END IF;
 FOR n IN 0..j.batch_count-1 LOOP PERFORM public.apply_ideal_master_batch(p_tenant,p_job,j.plan_sha256,j.approval_sha256,p_lease,p_generation,n);END LOOP;
 IF (SELECT count(*) FROM public.ideal_manual_master_audit WHERE tenant_id=p_tenant AND job_id=p_job) IS DISTINCT FROM (j.review_summary->>'acceptedCustomers')::bigint THEN RAISE EXCEPTION 'Master final count differs';END IF;
 UPDATE public.ideal_manual_sync_jobs SET status='completed',lease_until=NULL,last_error=NULL WHERE tenant_id=p_tenant AND id=p_job;
 RETURN 'completed';
END $$;
REVOKE ALL ON FUNCTION public.validate_ideal_master_member(jsonb,text,text),public.apply_ideal_master_batch(uuid,uuid,text,text,uuid,integer,integer),public.finish_ideal_master_job(uuid,uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ideal_master_member(jsonb,text,text),public.apply_ideal_master_batch(uuid,uuid,text,text,uuid,integer,integer),public.finish_ideal_master_job(uuid,uuid,text,uuid,integer) TO service_role;

-- Retain original product guards; master has its own names-only publication contract.
CREATE OR REPLACE FUNCTION public.ideal_manual_job_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF ROW(NEW.tenant_id,NEW.source_filename,NEW.source_path,NEW.source_sha256,NEW.source_bytes,NEW.report_family,NEW.encoding) IS DISTINCT FROM ROW(OLD.tenant_id,OLD.source_filename,OLD.source_path,OLD.source_sha256,OLD.source_bytes,OLD.report_family,OLD.encoding) THEN RAISE EXCEPTION 'Source scope immutable'; END IF;
 IF OLD.manifest_sha256 IS NULL AND NEW.manifest_sha256 IS NOT NULL THEN
 IF OLD.status<>'preparing' OR OLD.lease_until IS NULL OR OLD.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Preparation lease expired';END IF;
 IF NEW.plan_sha256 IS NOT NULL THEN
  IF NEW.batch_count<1 OR (SELECT count(*) FROM public.ideal_manual_sync_batches WHERE tenant_id=NEW.tenant_id AND job_id=NEW.id)<>NEW.batch_count OR (SELECT max(batch_index) FROM public.ideal_manual_sync_batches WHERE tenant_id=NEW.tenant_id AND job_id=NEW.id)<>NEW.batch_count-1 THEN RAISE EXCEPTION 'Prepared batch set incomplete';END IF;
  IF NEW.plan_scope->>'sourceSha256' IS DISTINCT FROM NEW.source_sha256 OR NEW.plan_scope->>'manifestSha256' IS DISTINCT FROM NEW.manifest_sha256 OR NEW.plan_scope->>'planSha256' IS DISTINCT FROM NEW.plan_sha256 OR NEW.plan_scope->>'identitySha256' IS DISTINCT FROM NEW.identity_sha256 THEN RAISE EXCEPTION 'Prepared scope differs';END IF;
  IF NEW.report_family='customer_master' THEN
   IF NEW.plan_scope->'updateFields' IS DISTINCT FROM '["first_name","last_name"]'::jsonb OR NEW.plan_scope->>'periodStart' IS NOT NULL OR NEW.plan_scope->>'periodEnd' IS NOT NULL THEN RAISE EXCEPTION 'Protected master field scope differs';END IF;
   IF EXISTS(SELECT 1 FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id AND NOT public.validate_ideal_master_member(x,NEW.source_sha256,NEW.identity_sha256)) THEN RAISE EXCEPTION 'Master staged payload differs';END IF;
   IF (SELECT count(*) FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint OR
   (SELECT count(DISTINCT x->>'expectedCustomerId') FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint OR
   (SELECT count(DISTINCT x->>'code') FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint OR
   (SELECT count(DISTINCT x->>'fingerprint') FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint OR
   (NEW.review_summary->>'acceptedItems')::bigint IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint OR (NEW.review_summary->>'amountCents')::numeric IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'Master prepared membership differs';END IF;
  ELSIF NEW.report_family IN('annual_sales','customer_sales') THEN
  IF EXISTS(SELECT 1 FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id AND (x->'raw'->>'source_sha256' IS DISTINCT FROM NEW.source_sha256 OR x->'raw'->>'period_start' IS DISTINCT FROM NEW.plan_scope->>'periodStart' OR x->'raw'->>'period_end' IS DISTINCT FROM NEW.plan_scope->>'periodEnd')) THEN RAISE EXCEPTION 'Member source scope differs';END IF;
  IF (SELECT sum(jsonb_array_length(x->'raw'->'items')) FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedItems')::bigint OR (SELECT sum((x->>'amount')::numeric*100) FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'amountCents')::numeric THEN RAISE EXCEPTION 'Prepared totals differ';END IF;
  IF (SELECT count(*) FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint OR
  (SELECT count(DISTINCT x->>'fingerprint') FROM public.ideal_manual_sync_batches b,jsonb_array_elements(b.payload) x WHERE b.tenant_id=NEW.tenant_id AND b.job_id=NEW.id) IS DISTINCT FROM (NEW.review_summary->>'acceptedCustomers')::bigint THEN RAISE EXCEPTION 'Prepared membership differs';END IF;
  ELSE RAISE EXCEPTION 'Unsupported executable family';END IF;
 ELSE IF EXISTS(SELECT 1 FROM public.ideal_manual_sync_batches WHERE tenant_id=NEW.tenant_id AND job_id=NEW.id) THEN RAISE EXCEPTION 'Review-only source has staged executable batches';END IF;END IF;
 END IF;
 IF OLD.manifest_sha256 IS NOT NULL AND ROW(NEW.manifest_sha256,NEW.plan_sha256,NEW.approval_sha256,NEW.identity_sha256,NEW.plan_scope,NEW.batch_count,NEW.review_summary) IS DISTINCT FROM ROW(OLD.manifest_sha256,OLD.plan_sha256,OLD.approval_sha256,OLD.identity_sha256,OLD.plan_scope,OLD.batch_count,OLD.review_summary) THEN RAISE EXCEPTION 'Review scope immutable'; END IF;NEW.updated_at=clock_timestamp();RETURN NEW;END $$;
