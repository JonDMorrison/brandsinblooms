-- Unseeded, owner-reviewed read mappings. No financial execution is enabled.
CREATE TABLE bloom_pos_private.native_reward_read_mappings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 key_id text NOT NULL REFERENCES bloom_pos_private.connections(key_id),programme_id uuid NOT NULL,programme_version_id uuid NOT NULL,
 activation_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),enabled boolean NOT NULL DEFAULT false,
 review_reason text NOT NULL CHECK(length(btrim(review_reason)) BETWEEN 20 AND 2000),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,programme_id,programme_version_id) REFERENCES public.loyalty_programme_versions(tenant_id,programme_id,id),
 UNIQUE(key_id,programme_id,version)
);
ALTER TABLE bloom_pos_private.native_reward_read_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_pos_private.native_reward_read_mappings FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER native_reward_mapping_immutable BEFORE UPDATE OR DELETE ON bloom_pos_private.native_reward_read_mappings FOR EACH ROW EXECUTE FUNCTION loyalty_private.immutable_record();
CREATE FUNCTION public.save_native_reward_read_mapping(p_key text,p_programme_version uuid,p_activation uuid,p_expected_version integer,p_enabled boolean,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();v public.loyalty_programme_versions;current_version integer;result uuid;
BEGIN
 IF public.get_current_crm_access()->>'role' IS DISTINCT FROM 'owner_admin' THEN RAISE EXCEPTION 'Programme owner required' USING ERRCODE='42501'; END IF;
 IF p_activation IS NULL OR p_enabled IS NULL OR NOT EXISTS(SELECT 1 FROM bloom_pos_private.connections WHERE key_id=p_key AND crm_tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Enabled tenant connection and existing POS activation required'; END IF;
 SELECT * INTO v FROM public.loyalty_programme_versions WHERE tenant_id=t AND id=p_programme_version;
 IF v.id IS NULL OR coalesce(v.definition->>'currency','') NOT IN('CAD','USD') OR NOT EXISTS(SELECT 1 FROM public.loyalty_programmes WHERE tenant_id=t AND id=v.programme_id AND current_version_id=v.id AND status NOT IN('paused','archived')) THEN RAISE EXCEPTION 'Current saved CAD or USD programme required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':native-reward-read',0));
 SELECT max(version) INTO current_version FROM bloom_pos_private.native_reward_read_mappings WHERE key_id=p_key AND programme_id=v.programme_id;
 IF current_version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Mapping changed; refresh before saving'; END IF;
 IF current_version IS NULL AND (SELECT count(DISTINCT (key_id,programme_id)) FROM bloom_pos_private.native_reward_read_mappings WHERE tenant_id=t)>=20 THEN RAISE EXCEPTION 'Review existing balance connections before adding another'; END IF;
 INSERT INTO bloom_pos_private.native_reward_read_mappings(tenant_id,key_id,programme_id,programme_version_id,activation_id,version,enabled,review_reason,created_by)
 VALUES(t,p_key,v.programme_id,v.id,p_activation,coalesce(current_version,0)+1,p_enabled,btrim(p_reason),auth.uid()) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.native_reward_read_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();BEGIN
 RETURN jsonb_build_object('role',public.get_current_crm_access()->>'role',
  'programmes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'versionId',v.id,'currency',v.definition->>'currency')) FROM public.loyalty_programmes p JOIN public.loyalty_programme_versions v ON v.tenant_id=p.tenant_id AND v.id=p.current_version_id WHERE p.tenant_id=t AND p.status NOT IN('paused','archived')),'[]'),
  'connections',coalesce((SELECT jsonb_agg(jsonb_build_object('keyId',key_id,'posTenantId',pos_tenant_id)) FROM bloom_pos_private.connections WHERE crm_tenant_id=t AND enabled),'[]'),
  'mappings',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(SELECT DISTINCT ON(key_id,programme_id) * FROM bloom_pos_private.native_reward_read_mappings WHERE tenant_id=t ORDER BY key_id,programme_id,version DESC)x),'[]'));
END $$;
-- Service-only context; credentials never go to a browser or customer wallet.
CREATE FUNCTION public.native_reward_read_context(p_tenant uuid,p_customer uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Balance service required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.crm_customers WHERE id=p_customer AND tenant_id=p_tenant AND deleted_at IS NULL AND merged_into_customer_id IS NULL) THEN RAISE EXCEPTION 'Current customer unavailable'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('mappingId',m.id,'programmeId',m.programme_id,'programmeVersionId',m.programme_version_id,'programName',p.name,
   'currency',v.definition->>'currency','keyId',c.key_id,'secret',c.secret,'posTenantId',c.pos_tenant_id,'crmTenantId',p_tenant,'customerId',p_customer,'activationId',m.activation_id,
   'eligible',EXISTS(SELECT 1 FROM public.crm_customers current_customer WHERE current_customer.id=p_customer AND current_customer.tenant_id=p_tenant AND current_customer.loyalty_member IS TRUE) AND p.current_version_id=m.programme_version_id AND p.status NOT IN('paused','archived') AND EXISTS(
     SELECT 1 FROM bloom_pos_private.membership_requests r JOIN bloom_pos_private.membership_policies policy ON policy.id=r.policy_id
     WHERE policy.tenant_id=p_tenant AND r.customer_id=p_customer AND r.state='CONFIRMED' AND r.key_id=m.key_id AND policy.authority='NATIVE'
       AND policy.programme_version_id=m.programme_version_id AND policy.enabled AND NOT EXISTS(
         SELECT 1 FROM bloom_pos_private.membership_policies newer WHERE newer.key_id=policy.key_id AND newer.store_id=policy.store_id AND newer.version>policy.version))))
  FROM(SELECT DISTINCT ON(key_id,programme_id) * FROM bloom_pos_private.native_reward_read_mappings WHERE tenant_id=p_tenant ORDER BY key_id,programme_id,version DESC)m
  JOIN bloom_pos_private.connections c ON c.key_id=m.key_id AND c.crm_tenant_id=p_tenant AND c.enabled
  JOIN public.loyalty_programmes p ON p.id=m.programme_id AND p.tenant_id=p_tenant
  JOIN public.loyalty_programme_versions v ON v.id=m.programme_version_id AND v.tenant_id=p_tenant
  WHERE m.enabled),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.save_native_reward_read_mapping(text,uuid,uuid,integer,boolean,text),public.native_reward_read_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_native_reward_read_mapping(text,uuid,uuid,integer,boolean,text),public.native_reward_read_workspace() TO authenticated;
REVOKE ALL ON FUNCTION public.native_reward_read_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.native_reward_read_context(uuid,uuid) TO service_role;
