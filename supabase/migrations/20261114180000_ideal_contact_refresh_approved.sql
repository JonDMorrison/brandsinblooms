-- #503: reviewed, exact-CODE IdealPOS contact refresh. No automatic imports.
-- Customer data is changed only by a separate explicit application of a staged digest.
-- Privileged implementation lives outside the Data API exposed public schema.
CREATE SCHEMA IF NOT EXISTS ideal_refresh;
CREATE TABLE public.ideal_contact_refresh_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'array'),
  plan_digest text NOT NULL CHECK (plan_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'staged' CHECK (status IN ('staged','applied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  applied_at timestamptz
);
CREATE INDEX ideal_contact_refresh_actor_idx
  ON public.ideal_contact_refresh_plans(tenant_id, actor_id, created_at DESC);
ALTER TABLE public.ideal_contact_refresh_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_contact_refresh_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ideal_contact_refresh_plans TO service_role;

CREATE TABLE public.ideal_contact_refresh_audit (
  plan_id uuid NOT NULL REFERENCES public.ideal_contact_refresh_plans(id),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id),
  source_code text NOT NULL,
  field_name text NOT NULL CHECK (field_name IN ('EMAIL','MOBILE','TYPE','MAILOUT')),
  before_value text NOT NULL,
  after_value text NOT NULL,
  actor_id uuid NOT NULL,
  source_sha256 text NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(plan_id, customer_id, field_name)
);
ALTER TABLE public.ideal_contact_refresh_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_contact_refresh_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.ideal_contact_refresh_audit TO service_role;

CREATE FUNCTION ideal_refresh.ideal_contact_refresh_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'An IdealPOS refresh audit or plan cannot be altered';
END $$;
CREATE TRIGGER ideal_contact_refresh_audit_immutable
BEFORE UPDATE OR DELETE ON public.ideal_contact_refresh_audit
FOR EACH ROW EXECUTE FUNCTION ideal_refresh.ideal_contact_refresh_immutable();
CREATE FUNCTION ideal_refresh.ideal_contact_refresh_plan_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'An IdealPOS refresh plan cannot be deleted';
 END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.actor_id,NEW.source_sha256,NEW.payload,
        NEW.plan_digest,NEW.created_at,NEW.expires_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.actor_id,OLD.source_sha256,
                         OLD.payload,OLD.plan_digest,OLD.created_at,OLD.expires_at) THEN
   RAISE EXCEPTION 'Approved IdealPOS refresh scope is immutable';
 END IF;
 IF OLD.status = 'applied' OR NEW.status <> 'applied'
    OR NEW.applied_at IS NULL THEN
   RAISE EXCEPTION 'Invalid IdealPOS refresh state transition';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ideal_contact_refresh_plan_guard
BEFORE UPDATE OR DELETE ON public.ideal_contact_refresh_plans
FOR EACH ROW EXECUTE FUNCTION ideal_refresh.ideal_contact_refresh_plan_guard();

CREATE FUNCTION ideal_refresh.stage_ideal_contact_refresh_internal(
 p_tenant uuid, p_source_sha256 text, p_changes jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 actor uuid := auth.uid();
 entry jsonb;
 code text;
 field_name text;
 old_value text;
 new_value text;
 existing_value text;
 person public.crm_customers%ROWTYPE;
 matches integer;
 assembled jsonb := '[]'::jsonb;
 fingerprint text;
 created_id uuid;
 key text;
BEGIN
 IF actor IS NULL OR NOT public.has_tenant_permission(p_tenant,'customer.write',NULL)
 THEN RAISE EXCEPTION 'Company-wide customer write permission required'; END IF;
 IF p_source_sha256 IS NULL OR p_source_sha256 !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Original source fingerprint required'; END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array'
    OR jsonb_array_length(p_changes) < 1 OR jsonb_array_length(p_changes) > 200
 THEN RAISE EXCEPTION 'Review a batch of 1–200 exact changes'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
   IF jsonb_typeof(entry) <> 'object'
      OR NOT entry ?& ARRAY['code','field','before','after']
      OR entry - ARRAY['code','field','before','after'] <> '{}'::jsonb
      OR jsonb_typeof(entry->'code') <> 'string'
      OR jsonb_typeof(entry->'field') <> 'string'
      OR jsonb_typeof(entry->'before') <> 'string'
      OR jsonb_typeof(entry->'after') <> 'string'
   THEN RAISE EXCEPTION 'Unrecognized source change'; END IF;
   code := entry->>'code'; field_name := entry->>'field';
   old_value := entry->>'before'; new_value := entry->>'after';
   IF length(code) NOT BETWEEN 1 AND 80 OR code <> btrim(code)
     OR field_name NOT IN ('EMAIL','MOBILE','TYPE','MAILOUT')
     OR length(old_value)>320 OR length(new_value)>320 OR btrim(new_value)=''
   THEN RAISE EXCEPTION 'Invalid or protected customer field'; END IF;
   IF field_name='EMAIL' AND (
      new_value !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      OR lower(new_value) LIKE '%@noemail.local'
   ) THEN RAISE EXCEPTION 'New email address is not usable'; END IF;
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(assembled) prior
              WHERE prior->>'code'=code AND prior->>'field'=field_name)
   THEN RAISE EXCEPTION 'Duplicate change for customer field'; END IF;
   SELECT count(*) INTO matches
   FROM public.crm_customer_identity_links link
   JOIN public.crm_customers customer ON customer.id=link.crm_customer_id
   WHERE link.tenant_id=p_tenant AND link.provider='ideal'
     AND link.external_id=code AND customer.tenant_id=p_tenant
     AND customer.external_id=code AND customer.deleted_at IS NULL
     AND customer.merged_into_customer_id IS NULL;
   IF matches <> 1 THEN RAISE EXCEPTION 'Customer CODE needs identity review'; END IF;
   SELECT customer.* INTO STRICT person
   FROM public.crm_customer_identity_links link
   JOIN public.crm_customers customer ON customer.id=link.crm_customer_id
   WHERE link.tenant_id=p_tenant AND link.provider='ideal'
     AND link.external_id=code AND customer.tenant_id=p_tenant
     AND customer.external_id=code AND customer.deleted_at IS NULL
     AND customer.merged_into_customer_id IS NULL;
   existing_value := CASE field_name
      WHEN 'EMAIL' THEN coalesce(person.email,'')
      WHEN 'MOBILE' THEN coalesce(person.phone,'')
      WHEN 'TYPE' THEN coalesce(person.custom_fields->>'ideal_customer_type','')
      WHEN 'MAILOUT' THEN coalesce(person.custom_fields->>'ideal_mailout','')
   END;
   -- A missing source email may be represented by a reserved IdealPOS placeholder.
   IF existing_value IS DISTINCT FROM old_value
      AND NOT (field_name='EMAIL' AND old_value=''
               AND (existing_value='' OR lower(existing_value) LIKE '%@noemail.local'))
   THEN RAISE EXCEPTION 'Customer field changed since source export; manual review required'; END IF;
   IF existing_value = new_value THEN RAISE EXCEPTION 'No actual customer update'; END IF;
   -- Permission follows the verified address/device, never a replacement contact field.
   -- An external import may have changed the authoritative source email.
   -- Never overwrite newer source provenance with a stale till export.
   IF field_name='EMAIL' AND coalesce(person.custom_fields->>'ideal_source_email','')
        IS DISTINCT FROM old_value
        AND NOT (old_value='' AND coalesce(person.custom_fields->>'ideal_source_email','')='')
   THEN RAISE EXCEPTION 'IdealPOS email source has changed; manual reconciliation required'; END IF;
   IF field_name='EMAIL' AND (
        person.email_opt_in IS TRUE OR person.email_consent_source IS NOT NULL OR
        EXISTS(SELECT 1 FROM public.customer_consents
               WHERE customer_id=person.id AND channel='email' AND status='opted_in')
   ) THEN RAISE EXCEPTION 'Verified email permission requires separate address verification'; END IF;
   IF field_name='MOBILE' AND (person.sms_opt_in IS TRUE OR
       EXISTS(SELECT 1 FROM public.customer_consents
              WHERE customer_id=person.id AND channel='sms' AND status='opted_in'))
   THEN RAISE EXCEPTION 'Verified SMS permission requires separate phone verification'; END IF;
   IF field_name='EMAIL' AND EXISTS (
       SELECT 1 FROM public.crm_customers other
       WHERE other.tenant_id=p_tenant AND other.id<>person.id
         AND other.deleted_at IS NULL AND other.merged_into_customer_id IS NULL
         AND lower(btrim(coalesce(other.email,'')))=lower(btrim(new_value))
   ) THEN RAISE EXCEPTION 'Email belongs to another customer'; END IF;
   assembled := assembled || jsonb_build_array(jsonb_build_object(
     'code',code,'customerId',person.id,'field',field_name,
     'before',existing_value,'after',new_value
   ));
 END LOOP;
 fingerprint := encode(sha256(convert_to(
   p_tenant::text || ':' || actor::text || ':' || p_source_sha256 || ':' || assembled::text,
   'UTF8')), 'hex');
 INSERT INTO public.ideal_contact_refresh_plans(
   tenant_id,actor_id,source_sha256,payload,plan_digest
 ) VALUES(p_tenant,actor,p_source_sha256,assembled,fingerprint)
 RETURNING id INTO created_id;
 RETURN jsonb_build_object('planId',created_id,'digest',fingerprint,
   'count',jsonb_array_length(assembled),'expiresInMinutes',30);
END $$;

CREATE FUNCTION ideal_refresh.apply_ideal_contact_refresh_internal(
 p_tenant uuid, p_plan_id uuid, p_digest text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 actor uuid := auth.uid();
 plan public.ideal_contact_refresh_plans%ROWTYPE;
 entry jsonb;
 person public.crm_customers%ROWTYPE;
 code text;
 field_name text;
 old_value text;
 new_value text;
 existing_value text;
 link_count integer;
 committed integer := 0;
BEGIN
 IF actor IS NULL OR NOT public.has_tenant_permission(p_tenant,'customer.write',NULL)
 THEN RAISE EXCEPTION 'Company-wide customer write permission required'; END IF;
 SELECT * INTO STRICT plan FROM public.ideal_contact_refresh_plans
 WHERE id=p_plan_id AND tenant_id=p_tenant AND actor_id=actor FOR UPDATE;
 IF plan.status <> 'staged' OR plan.expires_at <= clock_timestamp()
    OR plan.plan_digest IS DISTINCT FROM p_digest
    OR jsonb_typeof(plan.payload) <> 'array'
    OR jsonb_array_length(plan.payload) NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'Plan is expired, changed or already applied'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(plan.payload) LOOP
   code := entry->>'code'; field_name := entry->>'field';
   old_value := entry->>'before'; new_value := entry->>'after';
   IF field_name NOT IN ('EMAIL','MOBILE','TYPE','MAILOUT')
      OR new_value IS NULL OR btrim(new_value)=''
   THEN RAISE EXCEPTION 'Protected field scope differs'; END IF;
   SELECT count(*) INTO link_count FROM public.crm_customer_identity_links
   WHERE tenant_id=p_tenant AND provider='ideal' AND external_id=code
     AND crm_customer_id=(entry->>'customerId')::uuid;
   IF link_count <> 1 THEN RAISE EXCEPTION 'Customer CODE ownership changed'; END IF;
   SELECT * INTO STRICT person FROM public.crm_customers
   WHERE tenant_id=p_tenant AND id=(entry->>'customerId')::uuid
     AND external_id=code AND deleted_at IS NULL
     AND merged_into_customer_id IS NULL FOR UPDATE;
   existing_value := CASE field_name
      WHEN 'EMAIL' THEN coalesce(person.email,'')
      WHEN 'MOBILE' THEN coalesce(person.phone,'')
      WHEN 'TYPE' THEN coalesce(person.custom_fields->>'ideal_customer_type','')
      WHEN 'MAILOUT' THEN coalesce(person.custom_fields->>'ideal_mailout','')
   END;
   IF existing_value IS DISTINCT FROM old_value
   THEN RAISE EXCEPTION 'Customer field changed after review; no changes applied'; END IF;
   IF field_name='EMAIL' AND coalesce(person.custom_fields->>'ideal_source_email','')
      IS DISTINCT FROM old_value AND NOT
      (coalesce(person.custom_fields->>'ideal_source_email','')='' AND
       (old_value='' OR lower(old_value) LIKE '%@noemail.local'))
   THEN RAISE EXCEPTION 'IdealPOS source changed after review'; END IF;
   IF field_name='EMAIL' AND (
     person.email_opt_in IS TRUE OR person.email_consent_source IS NOT NULL OR
     EXISTS(SELECT 1 FROM public.customer_consents
            WHERE customer_id=person.id AND channel='email' AND status='opted_in') OR
     EXISTS(SELECT 1 FROM public.crm_customers other
           WHERE other.tenant_id=p_tenant AND other.id<>person.id
             AND other.deleted_at IS NULL AND other.merged_into_customer_id IS NULL
             AND lower(btrim(coalesce(other.email,'')))=lower(btrim(new_value)))
   ) THEN RAISE EXCEPTION 'Email identity or consent changed; no updates applied'; END IF;
   IF field_name='MOBILE' AND (person.sms_opt_in IS TRUE OR
      EXISTS(SELECT 1 FROM public.customer_consents
             WHERE customer_id=person.id AND channel='sms' AND status='opted_in'))
   THEN RAISE EXCEPTION 'SMS permission requires re-verification'; END IF;
   UPDATE public.crm_customers SET
      email = CASE WHEN field_name='EMAIL' THEN new_value ELSE email END,
      phone = CASE WHEN field_name='MOBILE' THEN new_value ELSE phone END,
      custom_fields = CASE WHEN field_name='EMAIL'
        THEN jsonb_set(coalesce(custom_fields,'{}'::jsonb),'{ideal_source_email}',to_jsonb(new_value),true)
        WHEN field_name='TYPE'
        THEN jsonb_set(coalesce(custom_fields,'{}'::jsonb),'{ideal_customer_type}',to_jsonb(new_value),true)
        WHEN field_name='MAILOUT'
        THEN jsonb_set(coalesce(custom_fields,'{}'::jsonb),'{ideal_mailout}',to_jsonb(new_value),true)
        ELSE custom_fields END
   WHERE id=person.id AND tenant_id=p_tenant;
   INSERT INTO public.ideal_contact_refresh_audit(
     plan_id,tenant_id,customer_id,source_code,field_name,
     before_value,after_value,actor_id,source_sha256
   ) VALUES(plan.id,p_tenant,person.id,code,field_name,
            old_value,new_value,actor,plan.source_sha256);
   committed := committed + 1;
 END LOOP;
 UPDATE public.ideal_contact_refresh_plans
 SET status='applied',applied_at=clock_timestamp()
 WHERE id=plan.id AND tenant_id=p_tenant;
 RETURN jsonb_build_object('planId',plan.id,'status','applied','updatedFields',committed);
END $$;
-- Public entrypoints are invoker-only; the privileged implementations are
-- in the unexposed ideal_refresh schema with explicit internal authorization.
REVOKE ALL ON SCHEMA ideal_refresh FROM PUBLIC;
GRANT USAGE ON SCHEMA ideal_refresh TO authenticated;
REVOKE ALL ON FUNCTION ideal_refresh.stage_ideal_contact_refresh_internal(uuid,text,jsonb),
 ideal_refresh.apply_ideal_contact_refresh_internal(uuid,uuid,text),
 ideal_refresh.ideal_contact_refresh_immutable(),
 ideal_refresh.ideal_contact_refresh_plan_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ideal_refresh.stage_ideal_contact_refresh_internal(uuid,text,jsonb),
 ideal_refresh.apply_ideal_contact_refresh_internal(uuid,uuid,text) TO authenticated;
CREATE FUNCTION public.stage_ideal_contact_refresh(
 p_tenant uuid,p_source_sha256 text,p_changes jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $
 SELECT ideal_refresh.stage_ideal_contact_refresh_internal($1,$2,$3);
$;
CREATE FUNCTION public.apply_ideal_contact_refresh(
 p_tenant uuid,p_plan_id uuid,p_digest text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $
 SELECT ideal_refresh.apply_ideal_contact_refresh_internal($1,$2,$3);
$;
REVOKE ALL ON FUNCTION public.stage_ideal_contact_refresh(uuid,text,jsonb),
 public.apply_ideal_contact_refresh(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stage_ideal_contact_refresh(uuid,text,jsonb),
 public.apply_ideal_contact_refresh(uuid,uuid,text) TO authenticated;
