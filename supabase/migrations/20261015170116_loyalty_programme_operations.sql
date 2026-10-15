-- CRM programme configuration, immutable measurement and repeat-safe calendar import.
-- Promotional redemption continues to belong to the shared offer authority, not these tables.
CREATE SCHEMA IF NOT EXISTS loyalty_private;
REVOKE ALL ON SCHEMA loyalty_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA loyalty_private TO service_role;

CREATE TABLE public.loyalty_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','paused','archived')),
  current_version_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id)
);
CREATE TABLE public.loyalty_programme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  programme_id uuid NOT NULL, version_number integer NOT NULL CHECK(version_number>0), request_key uuid NOT NULL,
  definition jsonb NOT NULL CHECK ((jsonb_typeof(definition)='object' AND definition->>'version'='1') IS TRUE),
  definition_hash text NOT NULL CHECK (definition_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,programme_id) REFERENCES public.loyalty_programmes(tenant_id,id),
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,request_key), UNIQUE(tenant_id,programme_id,id), UNIQUE(programme_id,version_number)
);
ALTER TABLE public.loyalty_programmes ADD CONSTRAINT loyalty_programme_current_version
  FOREIGN KEY(tenant_id,id,current_version_id) REFERENCES public.loyalty_programme_versions(tenant_id,programme_id,id);
CREATE TABLE public.loyalty_operation_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN('baseline','calendar','publication')),
  programme_version_id uuid,
  digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,programme_version_id) REFERENCES public.loyalty_programme_versions(tenant_id,id),
  UNIQUE(tenant_id,id), CHECK(expires_at>created_at)
);
CREATE TABLE public.loyalty_programme_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  programme_id uuid NOT NULL, programme_version_id uuid NOT NULL,
  preview_id uuid NOT NULL UNIQUE, snapshot jsonb NOT NULL,
  audience jsonb NOT NULL, source_cutoff timestamptz NOT NULL,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,programme_id) REFERENCES public.loyalty_programmes(tenant_id,id),
  FOREIGN KEY(tenant_id,programme_version_id) REFERENCES public.loyalty_programme_versions(tenant_id,id),
  FOREIGN KEY(tenant_id,preview_id) REFERENCES public.loyalty_operation_previews(tenant_id,id),
  UNIQUE(tenant_id,id),
  CHECK((snapshot->>'version'='1' AND jsonb_typeof(snapshot->'period'->'customers')='array') IS TRUE)
);
CREATE TABLE public.loyalty_programme_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  baseline_id uuid NOT NULL, request_key uuid NOT NULL,
  result jsonb NOT NULL, period_snapshot jsonb NOT NULL,
  campaign_id uuid, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,baseline_id) REFERENCES public.loyalty_programme_baselines(tenant_id,id),
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,request_key),
  CHECK((result->>'version'='1' AND result->>'kind'='loyalty_programme_result') IS TRUE)
);
CREATE TABLE public.loyalty_programme_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  programme_version_id uuid NOT NULL, baseline_id uuid NOT NULL,
  request_key uuid NOT NULL, target text NOT NULL CHECK(target IN('shared_authority','external_pos_export')),
  status text NOT NULL DEFAULT 'prepared' CHECK(status IN('prepared','submitted','confirmed','reconciliation_required','cancelled')),
  payload jsonb NOT NULL, response jsonb, created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,programme_version_id) REFERENCES public.loyalty_programme_versions(tenant_id,id),
  FOREIGN KEY(tenant_id,baseline_id) REFERENCES public.loyalty_programme_baselines(tenant_id,id),
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,request_key)
);
CREATE TABLE public.calendar_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  preview_id uuid NOT NULL UNIQUE, name text NOT NULL, timezone text NOT NULL,
  result jsonb NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,preview_id) REFERENCES public.loyalty_operation_previews(tenant_id,id),
  UNIQUE(tenant_id,id)
);
CREATE TABLE public.calendar_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  batch_id uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
  source_row integer NOT NULL CHECK(source_row>=2), original_row jsonb NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id), task_id uuid NOT NULL REFERENCES public.content_tasks(id),
  FOREIGN KEY(tenant_id,batch_id) REFERENCES public.calendar_import_batches(tenant_id,id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE(tenant_id,fingerprint)
);
CREATE INDEX loyalty_programmes_company ON public.loyalty_programmes(tenant_id,created_at DESC);
CREATE INDEX loyalty_baselines_company ON public.loyalty_programme_baselines(tenant_id,programme_id,created_at DESC);
CREATE INDEX loyalty_runs_company ON public.loyalty_programme_runs(tenant_id,baseline_id,created_at DESC);
CREATE INDEX loyalty_previews_owner ON public.loyalty_operation_previews(tenant_id,user_id,created_at DESC);

DO $policies$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['loyalty_programmes','loyalty_programme_versions','loyalty_operation_previews',
    'loyalty_programme_baselines','loyalty_programme_runs','loyalty_programme_publications','calendar_import_batches','calendar_import_rows'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',n);
    EXECUTE format('GRANT SELECT,INSERT ON public.%I TO service_role',n);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
      public.has_tenant_permission(tenant_id,'customer.read',NULL)
      AND public.has_tenant_permission(tenant_id,'reporting.read',NULL)
      %s
    )$p$,n||'_read',n,CASE WHEN n='loyalty_operation_previews' THEN 'AND user_id=(SELECT auth.uid())' ELSE '' END);
  END LOOP;
END $policies$;
GRANT UPDATE ON public.loyalty_programmes,public.loyalty_programme_publications TO service_role;

CREATE FUNCTION loyalty_private.assert_actor(p_tenant_id uuid,p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' OR p_tenant_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated server operation required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND is_active) THEN
    RAISE EXCEPTION 'Active company required' USING ERRCODE='42501';
  END IF;
  IF coalesce(public.is_master_admin(p_user_id),false) THEN
    IF NOT EXISTS(SELECT 1 FROM public.admin_session_context WHERE admin_user_id=p_user_id AND active_tenant_id=p_tenant_id) THEN
      RAISE EXCEPTION 'Selected company access required' USING ERRCODE='42501';
    END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id AND tenant_id=p_tenant_id AND role IN('owner','admin','marketing')) THEN
    RAISE EXCEPTION 'Company-wide programme management required' USING ERRCODE='42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION loyalty_private.assert_actor(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION loyalty_private.assert_actor(uuid,uuid) TO service_role;
CREATE FUNCTION loyalty_private.immutable_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Saved programme evidence is immutable; append a new version or report'; END $$;
DO $immutable$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['loyalty_programme_versions','loyalty_operation_previews','loyalty_programme_baselines','loyalty_programme_runs','calendar_import_batches','calendar_import_rows'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION loyalty_private.immutable_record()',n||'_immutable',n);
  END LOOP;
END $immutable$;

CREATE FUNCTION public.save_loyalty_programme_v1(p_tenant_id uuid,p_user_id uuid,p_definition jsonb,p_request_key uuid,p_programme_id uuid DEFAULT NULL,p_expected_version_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.loyalty_programmes%ROWTYPE; v public.loyalty_programme_versions%ROWTYPE; n integer;
BEGIN
  PERFORM loyalty_private.assert_actor(p_tenant_id,p_user_id);
  IF jsonb_typeof(p_definition)<>'object' OR p_definition->>'version'<>'1' OR octet_length(p_definition::text)>50000
     OR coalesce(length(btrim(p_definition->>'name')),0) NOT BETWEEN 1 AND 120
     OR p_definition->>'currency' NOT IN('CAD','USD','GBP','EUR') THEN RAISE EXCEPTION 'Invalid programme definition'; END IF;
  SELECT * INTO v FROM public.loyalty_programme_versions WHERE tenant_id=p_tenant_id AND request_key=p_request_key;
  IF FOUND THEN
    IF v.created_by<>p_user_id OR v.definition IS DISTINCT FROM p_definition OR (p_programme_id IS NOT NULL AND v.programme_id<>p_programme_id) THEN RAISE EXCEPTION 'Request key already used for a different draft'; END IF;
    RETURN jsonb_build_object('programmeId',v.programme_id,'versionId',v.id,'versionNumber',v.version_number,'definitionHash',v.definition_hash,'replayed',true);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('programme-save:'||p_tenant_id::text||p_request_key::text,0));
  SELECT * INTO v FROM public.loyalty_programme_versions WHERE tenant_id=p_tenant_id AND request_key=p_request_key;
  IF FOUND THEN
    IF v.created_by<>p_user_id OR v.definition IS DISTINCT FROM p_definition OR (p_programme_id IS NOT NULL AND v.programme_id<>p_programme_id) THEN RAISE EXCEPTION 'Request key already used for a different draft'; END IF;
    RETURN jsonb_build_object('programmeId',v.programme_id,'versionId',v.id,'versionNumber',v.version_number,'definitionHash',v.definition_hash,'replayed',true);
  END IF;
  IF p_programme_id IS NULL THEN
    IF p_expected_version_id IS NOT NULL THEN RAISE EXCEPTION 'Unexpected prior version'; END IF;
    INSERT INTO public.loyalty_programmes(tenant_id,name,created_by) VALUES(p_tenant_id,p_definition->>'name',p_user_id) RETURNING * INTO p;
  ELSE
    SELECT * INTO p FROM public.loyalty_programmes WHERE id=p_programme_id AND tenant_id=p_tenant_id FOR UPDATE;
    IF NOT FOUND OR p.current_version_id IS DISTINCT FROM p_expected_version_id THEN RAISE EXCEPTION 'Programme changed; reload before saving'; END IF;
    IF p.status='archived' THEN RAISE EXCEPTION 'Create a new programme instead of modifying an archive'; END IF;
    IF EXISTS(SELECT 1 FROM public.loyalty_programme_versions WHERE id=p.current_version_id AND definition=p_definition) THEN
      RETURN jsonb_build_object('programmeId',p.id,'versionId',p.current_version_id,'unchanged',true);
    END IF;
  END IF;
  SELECT coalesce(max(version_number),0)+1 INTO n FROM public.loyalty_programme_versions WHERE programme_id=p.id;
  INSERT INTO public.loyalty_programme_versions(tenant_id,programme_id,version_number,definition,definition_hash,created_by,request_key)
    VALUES(p_tenant_id,p.id,n,p_definition,encode(sha256(convert_to(p_definition::text,'UTF8')),'hex'),p_user_id,p_request_key) RETURNING * INTO v;
  UPDATE public.loyalty_programmes SET current_version_id=v.id,name=p_definition->>'name',status='draft',updated_at=now() WHERE id=p.id;
  RETURN jsonb_build_object('programmeId',p.id,'versionId',v.id,'versionNumber',n,'definitionHash',v.definition_hash);
END $$;

CREATE FUNCTION public.confirm_loyalty_baseline_v1(p_tenant_id uuid,p_user_id uuid,p_preview_id uuid,p_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE review public.loyalty_operation_previews%ROWTYPE; b public.loyalty_programme_baselines%ROWTYPE;
  v public.loyalty_programme_versions%ROWTYPE; p public.loyalty_programmes%ROWTYPE; expected integer; actual integer;
BEGIN
  PERFORM loyalty_private.assert_actor(p_tenant_id,p_user_id);
  SELECT * INTO review FROM public.loyalty_operation_previews WHERE id=p_preview_id AND tenant_id=p_tenant_id AND user_id=p_user_id AND kind='baseline';
  IF NOT FOUND OR review.digest IS DISTINCT FROM p_digest THEN RAISE EXCEPTION 'The reviewed baseline does not match'; END IF;
  SELECT * INTO v FROM public.loyalty_programme_versions WHERE id=review.programme_version_id AND tenant_id=p_tenant_id;
  SELECT * INTO p FROM public.loyalty_programmes WHERE id=v.programme_id AND tenant_id=p_tenant_id FOR UPDATE;
  SELECT * INTO b FROM public.loyalty_programme_baselines WHERE preview_id=p_preview_id AND tenant_id=p_tenant_id;
  IF FOUND THEN RETURN jsonb_build_object('baselineId',b.id,'replayed',true); END IF;
  IF p.id IS NULL OR p.current_version_id IS DISTINCT FROM v.id OR review.expires_at<=now() THEN RAISE EXCEPTION 'Preview expired or programme changed; review again'; END IF;
  IF review.payload->'baseline'->'period'->>'tenantId' IS DISTINCT FROM p_tenant_id::text THEN RAISE EXCEPTION 'Baseline company mismatch'; END IF;
  expected:=jsonb_array_length(review.payload->'baseline'->'period'->'customers');
  IF expected<1 OR expected>100000 THEN RAISE EXCEPTION 'Choose a nonempty, bounded cohort'; END IF;
  SELECT count(DISTINCT c.id) INTO actual FROM public.crm_customers c
    JOIN jsonb_array_elements(review.payload->'baseline'->'period'->'customers') r ON c.id=(r->>'customerId')::uuid
    WHERE c.tenant_id=p_tenant_id AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL;
  IF actual<>expected THEN RAISE EXCEPTION 'Customer identity changed since preview; no cohort was silently reduced'; END IF;
  INSERT INTO public.loyalty_programme_baselines(tenant_id,programme_id,programme_version_id,preview_id,snapshot,audience,source_cutoff,created_by)
    VALUES(p_tenant_id,p.id,v.id,review.id,review.payload->'baseline',review.payload->'audience',
      (review.payload->'baseline'->'period'->>'sourceCutoff')::timestamptz,p_user_id) RETURNING * INTO b;
  UPDATE public.loyalty_programmes SET status='ready',updated_at=now() WHERE id=p.id;
  RETURN jsonb_build_object('baselineId',b.id,'customers',expected,'programmeId',p.id,'versionId',v.id);
END $$;

CREATE FUNCTION public.save_loyalty_run_v1(p_tenant_id uuid,p_user_id uuid,p_baseline_id uuid,p_request_key uuid,p_result jsonb,p_period jsonb,p_campaign_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.loyalty_programme_baselines%ROWTYPE; r public.loyalty_programme_runs%ROWTYPE;
BEGIN
  PERFORM loyalty_private.assert_actor(p_tenant_id,p_user_id);
  SELECT * INTO b FROM public.loyalty_programme_baselines WHERE id=p_baseline_id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baseline not accessible'; END IF;
  IF p_result->>'tenantId' IS DISTINCT FROM p_tenant_id::text OR p_period->>'tenantId' IS DISTINCT FROM p_tenant_id::text OR p_result->>'version'<>'1'
    OR jsonb_array_length(p_result->'rows')<>jsonb_array_length(b.snapshot->'period'->'customers') THEN RAISE EXCEPTION 'Report must preserve the complete original cohort'; END IF;
  IF (SELECT array_agg((x->>'customerId')::uuid ORDER BY x->>'customerId') FROM jsonb_array_elements(p_result->'rows') x)
    IS DISTINCT FROM (SELECT array_agg((x->>'customerId')::uuid ORDER BY x->>'customerId') FROM jsonb_array_elements(b.snapshot->'period'->'customers') x)
    THEN RAISE EXCEPTION 'Report customer identities must match the frozen baseline'; END IF;
  IF p_campaign_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.crm_campaigns WHERE id=p_campaign_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Campaign company mismatch'; END IF;
  INSERT INTO public.loyalty_programme_runs(tenant_id,baseline_id,request_key,result,period_snapshot,campaign_id,created_by)
    VALUES(p_tenant_id,p_baseline_id,p_request_key,p_result,p_period,p_campaign_id,p_user_id)
    ON CONFLICT(tenant_id,request_key) DO NOTHING RETURNING * INTO r;
  IF NOT FOUND THEN
    SELECT * INTO r FROM public.loyalty_programme_runs WHERE tenant_id=p_tenant_id AND request_key=p_request_key;
    IF r.baseline_id<>p_baseline_id OR r.created_by<>p_user_id OR r.campaign_id IS DISTINCT FROM p_campaign_id
      OR r.result->'currentWindow' IS DISTINCT FROM p_result->'currentWindow'
      OR r.result->'normalizeDaily' IS DISTINCT FROM p_result->'normalizeDaily'
      OR r.period_snapshot->'coverage'->>'status' IS DISTINCT FROM p_period->'coverage'->>'status'
      OR r.period_snapshot->'coverage'->>'evidence' IS DISTINCT FROM p_period->'coverage'->>'evidence' THEN RAISE EXCEPTION 'Request key belongs to another report'; END IF;
  END IF;
  RETURN jsonb_build_object('runId',r.id,'result',r.result);
END $$;

CREATE FUNCTION public.commit_calendar_import_v1(p_tenant_id uuid,p_user_id uuid,p_preview_id uuid,p_digest text,p_accept_rejected boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE review public.loyalty_operation_previews%ROWTYPE; batch public.calendar_import_batches%ROWTYPE;
  row jsonb; item jsonb; parent_id uuid; task uuid; batch_id uuid:=gen_random_uuid(); n integer:=0; duplicates integer:=0; rejected integer:=0; reply jsonb;
BEGIN
  PERFORM loyalty_private.assert_actor(p_tenant_id,p_user_id);
  SELECT * INTO review FROM public.loyalty_operation_previews WHERE id=p_preview_id AND tenant_id=p_tenant_id AND user_id=p_user_id AND kind='calendar';
  IF NOT FOUND OR review.digest IS DISTINCT FROM p_digest THEN RAISE EXCEPTION 'Calendar preview does not match'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-calendar:'||p_tenant_id::text,0));
  SELECT * INTO batch FROM public.calendar_import_batches WHERE tenant_id=p_tenant_id AND preview_id=p_preview_id;
  IF FOUND THEN RETURN batch.result; END IF;
  IF review.expires_at<=now() THEN RAISE EXCEPTION 'Calendar preview expired; review again'; END IF;
  IF review.payload->>'kind'<>'calendar_import' OR jsonb_array_length(review.payload->'rows') NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid calendar preview'; END IF;
  rejected:=(review.payload->'counts'->>'rejected')::integer;
  IF rejected>0 AND NOT p_accept_rejected THEN RAISE EXCEPTION 'Explicitly acknowledge rejected rows before importing the remaining rows'; END IF;
  -- The batch foreign key is deferred: write tasks and original rows, then the final immutable result in this transaction.
  FOR row IN SELECT value FROM jsonb_array_elements(review.payload->'rows') LOOP
    IF row->>'state'='rejected' THEN CONTINUE; END IF;
    IF row->>'state'='duplicate' OR EXISTS(SELECT 1 FROM public.calendar_import_rows WHERE tenant_id=p_tenant_id AND fingerprint=row->>'fingerprint') THEN duplicates:=duplicates+1; CONTINUE; END IF;
    item:=row->'item';
    IF row->>'state'<>'accepted' OR item->>'channel' NOT IN('email','newsletter','sms','blog') OR coalesce(length(item->>'title'),0) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid accepted calendar row'; END IF;
    IF parent_id IS NULL THEN
      INSERT INTO public.campaigns(tenant_id,user_id,created_by_user_id,title,start_date,description,source)
        VALUES(p_tenant_id,p_user_id,p_user_id,review.payload->>'name',(item->>'date')::date,
          'Imported marketing plan. Tasks are planned only; messages are not scheduled.','manual_import') RETURNING id INTO parent_id;
    END IF;
    INSERT INTO public.content_tasks(tenant_id,user_id,created_by_user_id,campaign_id,status,scheduled_date,post_type,ai_output,notes,plan_theme)
      VALUES(p_tenant_id,p_user_id,p_user_id,parent_id,'planned',(item->>'date')::date,item->>'channel',item->>'title',item->>'notes',item->>'theme') RETURNING id INTO task;
    INSERT INTO public.calendar_import_rows(tenant_id,batch_id,fingerprint,source_row,original_row,campaign_id,task_id)
      VALUES(p_tenant_id,batch_id,row->>'fingerprint',(row->>'rowNumber')::integer,row->'original',parent_id,task);
    n:=n+1;
  END LOOP;
  reply:=jsonb_build_object('batchId',batch_id,'campaignId',parent_id,'created',n,'duplicates',duplicates,'rejected',rejected,'scheduledMessages',0);
  INSERT INTO public.calendar_import_batches(id,tenant_id,preview_id,name,timezone,result,created_by)
    VALUES(batch_id,p_tenant_id,p_preview_id,review.payload->>'name',review.payload->>'timezone',reply,p_user_id);
  RETURN reply;
END $$;

REVOKE ALL ON FUNCTION public.save_loyalty_programme_v1(uuid,uuid,jsonb,uuid,uuid,uuid),
  public.confirm_loyalty_baseline_v1(uuid,uuid,uuid,text),
  public.save_loyalty_run_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid),
  public.commit_calendar_import_v1(uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_loyalty_programme_v1(uuid,uuid,jsonb,uuid,uuid,uuid),
  public.confirm_loyalty_baseline_v1(uuid,uuid,uuid,text),
  public.save_loyalty_run_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid),
  public.commit_calendar_import_v1(uuid,uuid,uuid,text,boolean) TO service_role;

CREATE UNIQUE INDEX crm_segments_loyalty_result_identity ON public.crm_segments(tenant_id,source_id)
  WHERE source='loyalty_programme_result' AND source_id IS NOT NULL;
CREATE FUNCTION public.save_loyalty_result_segment_v1(p_tenant_id uuid,p_user_id uuid,p_run_id uuid,p_states text[],p_name text,p_expected_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE run public.loyalty_programme_runs%ROWTYPE; ids uuid[]; valid integer; sid uuid; key text; states text[];
BEGIN
  PERFORM loyalty_private.assert_actor(p_tenant_id,p_user_id);
  IF coalesce(length(btrim(p_name)),0) NOT BETWEEN 1 AND 120 OR p_expected_count<1 THEN RAISE EXCEPTION 'Review the segment name and count'; END IF;
  SELECT array_agg(DISTINCT s ORDER BY s) INTO states FROM unnest(p_states) s;
  IF cardinality(states) NOT BETWEEN 1 AND 10 OR NOT(states <@ ARRAY['growing','stable','declining','lapsed','reactivated','newly_observed','no_baseline','unknown','identity_review']::text[]) THEN RAISE EXCEPTION 'Choose known result states'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-result-segment:'||p_tenant_id::text||p_run_id::text,0));
  SELECT * INTO run FROM public.loyalty_programme_runs WHERE id=p_run_id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Programme result not accessible'; END IF;
  key:=p_run_id::text||':'||encode(sha256(convert_to(array_to_string(states,','),'UTF8')),'hex');
  SELECT id INTO sid FROM public.crm_segments WHERE tenant_id=p_tenant_id AND source='loyalty_programme_result' AND source_id=key;
  IF FOUND THEN RETURN jsonb_build_object('segmentId',sid,'replayed',true); END IF;
  SELECT array_agg(DISTINCT (r->>'customerId')::uuid ORDER BY (r->>'customerId')::uuid) INTO ids
    FROM jsonb_array_elements(run.result->'rows') r WHERE r->>'state'=ANY(states);
  IF coalesce(cardinality(ids),0)<>p_expected_count THEN RAISE EXCEPTION 'Review the actual segment count'; END IF;
  SELECT count(*) INTO valid FROM public.crm_customers WHERE tenant_id=p_tenant_id AND id=ANY(ids) AND deleted_at IS NULL AND merged_into_customer_id IS NULL;
  IF valid<>cardinality(ids) THEN RAISE EXCEPTION 'Some original customers need identity reconciliation; no member was silently dropped'; END IF;
  INSERT INTO public.crm_segments(tenant_id,user_id,name,description,conditions,customer_count,auto_update,status,source,source_id,analysis_provenance)
    VALUES(p_tenant_id,p_user_id,btrim(p_name),'Frozen audience from a reviewed programme result.','{}',valid,false,'active','loyalty_programme_result',key,
      jsonb_build_object('runId',p_run_id,'states',states,'sourceCutoff',run.result->>'sourceCutoff','customerCount',valid,'sendingConsentChecked',false)) RETURNING id INTO sid;
  INSERT INTO public.customer_segments(customer_id,segment_id,assigned_by_user_id) SELECT unnest(ids),sid,p_user_id;
  RETURN jsonb_build_object('segmentId',sid,'customers',valid,'sentMessages',0);
END $$;
REVOKE ALL ON FUNCTION public.save_loyalty_result_segment_v1(uuid,uuid,uuid,text[],text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_loyalty_result_segment_v1(uuid,uuid,uuid,text[],text,integer) TO service_role;
