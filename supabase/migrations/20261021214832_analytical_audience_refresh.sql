-- Separate analytical audiences: never overwrite customer classifications or send eligibility.
CREATE TABLE public.bloom_analytical_audiences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 source_set_id uuid NOT NULL REFERENCES public.bloom_customer_sets(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 mode text NOT NULL CHECK(mode IN ('fixed','dynamic')),
 excluded_ids uuid[] NOT NULL DEFAULT '{}',
 snapshot jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1,
 refreshed_at timestamptz NOT NULL DEFAULT now(),
 next_refresh_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
 refresh_generation integer NOT NULL DEFAULT 0,
 claimed_generation integer,
 worker_token uuid,
 lease_until timestamptz,
 last_error text,
 UNIQUE(tenant_id,user_id,source_set_id,name)
);
ALTER TABLE public.bloom_analytical_audiences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bloom_analytical_audiences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bloom_analytical_audiences TO authenticated;
GRANT ALL ON public.bloom_analytical_audiences TO service_role;
CREATE POLICY analytical_audience_read ON public.bloom_analytical_audiences FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND public.has_tenant_permission(tenant_id,'customer.read',NULL) AND public.has_tenant_permission(tenant_id,'reporting.read',NULL));

-- Service-only atomic save; authorization/confirmation is also checked by Bloom.
CREATE FUNCTION public.save_bloom_analytical_audience(p_set_id uuid,p_user_id uuid,p_name text,p_mode text,p_excluded_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.bloom_customer_sets; a public.bloom_analytical_audiences;
BEGIN
 SELECT * INTO s FROM public.bloom_customer_sets WHERE id=p_set_id FOR UPDATE;
 IF NOT FOUND OR s.user_id<>p_user_id THEN RAISE EXCEPTION 'Audience is not accessible'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users u JOIN auth.users au ON au.id=u.id WHERE u.id=p_user_id AND u.tenant_id=s.tenant_id AND u.role IN ('owner','admin','marketing') AND (au.banned_until IS NULL OR au.banned_until<now())) THEN RAISE EXCEPTION 'Company-wide audience permission required'; END IF;
 IF p_mode NOT IN ('fixed','dynamic') OR p_mode IS NULL THEN RAISE EXCEPTION 'Choose fixed or dynamic'; END IF;
 IF p_mode='dynamic' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.payload->'trail') step WHERE step ? 'reported_spending') THEN RAISE EXCEPTION 'Reported spending rules are not replayable yet'; END IF;
 IF EXISTS(SELECT 1 FROM (SELECT value::uuid id FROM jsonb_array_elements_text(s.payload->'included_ids') UNION SELECT unnest(p_excluded_ids)) ids LEFT JOIN public.crm_customers c ON c.id=ids.id AND c.tenant_id=s.tenant_id AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL WHERE c.id IS NULL) THEN RAISE EXCEPTION 'Audience contains inaccessible customers'; END IF;
 SELECT * INTO a FROM public.bloom_analytical_audiences WHERE tenant_id=s.tenant_id AND user_id=p_user_id AND source_set_id=p_set_id AND name=btrim(p_name);
 IF FOUND THEN
  IF a.mode<>p_mode OR a.excluded_ids IS DISTINCT FROM coalesce(p_excluded_ids,'{}'::uuid[]) THEN RAISE EXCEPTION 'Existing audience has different settings'; END IF;
  RETURN jsonb_build_object('id',a.id,'mode',a.mode,'reused',true);
 END IF;
 INSERT INTO public.bloom_analytical_audiences(tenant_id,user_id,source_set_id,name,mode,excluded_ids,snapshot)
 VALUES(s.tenant_id,p_user_id,p_set_id,btrim(p_name),p_mode,coalesce(p_excluded_ids,'{}'),jsonb_build_object('result',s.payload,'member_ids',(SELECT coalesce(jsonb_agg(value),'[]') FROM jsonb_array_elements_text(s.payload->'included_ids') WHERE NOT value::uuid=ANY(coalesce(p_excluded_ids,'{}'))),'unknown_ids',(SELECT coalesce(jsonb_agg(value),'[]') FROM jsonb_array_elements_text(s.payload->'unknown_ids') WHERE NOT value::uuid=ANY(coalesce(p_excluded_ids,'{}'))),'excluded_ids',(SELECT coalesce(jsonb_agg(id),'[]') FROM (SELECT value::uuid id FROM jsonb_array_elements_text(s.payload->'excluded_ids') UNION SELECT unnest(coalesce(p_excluded_ids,'{}'))) ids))) RETURNING * INTO a;
 RETURN jsonb_build_object('id',a.id,'mode',a.mode,'reused',false);
END $$;

CREATE FUNCTION public.claim_bloom_audience_refresh(p_token uuid)
RETURNS SETOF public.bloom_analytical_audiences LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 SELECT a.id INTO target FROM public.bloom_analytical_audiences a
 JOIN public.users u ON u.id=a.user_id AND u.tenant_id=a.tenant_id AND u.role IN ('owner','admin','marketing')
 JOIN auth.users au ON au.id=u.id AND (au.banned_until IS NULL OR au.banned_until<now())
 WHERE a.mode='dynamic' AND a.next_refresh_at<=now() AND (a.lease_until IS NULL OR a.lease_until<now())
 ORDER BY a.next_refresh_at,a.id FOR UPDATE OF a SKIP LOCKED LIMIT 1;
 RETURN QUERY UPDATE public.bloom_analytical_audiences SET worker_token=p_token,claimed_generation=refresh_generation,lease_until=now()+interval '5 minutes' WHERE id=target RETURNING *;
END $$;

CREATE FUNCTION public.finish_bloom_audience_refresh(p_id uuid,p_token uuid,p_version integer,p_snapshot jsonb,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.bloom_analytical_audiences;
BEGIN
 SELECT * INTO a FROM public.bloom_analytical_audiences WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.mode<>'dynamic' OR a.worker_token IS DISTINCT FROM p_token OR a.version<>p_version OR a.lease_until<now() THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users u JOIN auth.users au ON au.id=u.id WHERE u.id=a.user_id AND u.tenant_id=a.tenant_id AND u.role IN ('owner','admin','marketing') AND (au.banned_until IS NULL OR au.banned_until<now())) THEN RAISE EXCEPTION 'Audience owner no longer authorized'; END IF;
 IF p_error IS NULL THEN
  IF p_snapshot->'result'->>'tenant_id' IS DISTINCT FROM a.tenant_id::text OR p_snapshot->'result'->>'user_id' IS DISTINCT FROM a.user_id::text OR jsonb_typeof(p_snapshot->'member_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid refreshed audience'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_snapshot->'member_ids') x(value) LEFT JOIN public.crm_customers c ON c.id=x.value::uuid AND c.tenant_id=a.tenant_id AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL WHERE c.id IS NULL OR c.id=ANY(a.excluded_ids)) THEN RAISE EXCEPTION 'Invalid refreshed membership'; END IF;
 END IF;
 UPDATE public.bloom_analytical_audiences SET snapshot=CASE WHEN p_error IS NULL THEN p_snapshot ELSE snapshot END,version=version+CASE WHEN p_error IS NULL THEN 1 ELSE 0 END,refreshed_at=CASE WHEN p_error IS NULL THEN now() ELSE refreshed_at END,next_refresh_at=CASE WHEN p_error IS NULL AND refresh_generation>claimed_generation THEN now() ELSE now()+CASE WHEN p_error IS NULL THEN interval '1 day' ELSE interval '1 hour' END END,worker_token=NULL,lease_until=NULL,last_error=left(p_error,300) WHERE id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[]),public.claim_bloom_audience_refresh(uuid),public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[]),public.claim_bloom_audience_refresh(uuid),public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';

-- A completed relevant import makes dynamic audiences due, without editing membership.
CREATE FUNCTION public.queue_analytical_audiences_after_import() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  UPDATE public.bloom_analytical_audiences SET refresh_generation=refresh_generation+1,next_refresh_at=least(next_refresh_at,now()) WHERE tenant_id=NEW.tenant_id AND mode='dynamic';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_analytical_audiences_after_import() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_analytical_audiences_after_import() TO service_role;
CREATE TRIGGER analytical_audience_import_completed AFTER INSERT OR UPDATE OF status ON public.customer_intelligence_imports FOR EACH ROW EXECUTE FUNCTION public.queue_analytical_audiences_after_import();
