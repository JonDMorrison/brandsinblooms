BEGIN;
-- Receiving POS updates does not grant permission to export this business.
ALTER TABLE bloom_pos_private.connections ADD COLUMN onboarding_enabled boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.pos_onboarding_binding(p_key text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Connection service required' USING ERRCODE='42501'; END IF;
 IF public.bloomsuite_pos_connection(p_key) IS NULL THEN RETURN NULL; END IF;
 RETURN (SELECT jsonb_build_object('tenantId',pos_tenant_id,'accountId',crm_tenant_id,'secret',secret) FROM bloom_pos_private.connections WHERE key_id=p_key AND enabled AND onboarding_enabled);
END $$;
CREATE FUNCTION public.pos_onboarding_snapshot(p_key text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c bloom_pos_private.connections; records jsonb; business jsonb; money text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Connection service required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM bloom_pos_private.connections WHERE key_id=p_key AND enabled AND onboarding_enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding transfer is not enabled'; END IF;
 SELECT jsonb_build_object('name',name,'country',country,'city',city,'region',region,'website',website) INTO business FROM public.tenants WHERE id=c.crm_tenant_id;
 money:=c.currency;
 IF money NOT IN ('CAD','USD') OR EXISTS(SELECT 1 FROM public.products WHERE tenant_id=c.crm_tenant_id AND currency IS DISTINCT FROM money) THEN RAISE EXCEPTION 'Review missing or mixed product currencies before transfer'; END IF;
 SELECT coalesce(jsonb_agg(x.record ORDER BY x.identity),'[]'::jsonb) INTO records FROM (
  SELECT p.id identity,jsonb_build_object('id',p.id,'name',p.name,'sku',p.sku,'price',p.price::text,
   'kind','GOODS','description',p.description,'sellingUnit','EACH','active',p.status='active',
   'barcodes',CASE WHEN nullif(p.barcode,'') IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(p.barcode) END,
   'imageUrls',coalesce((SELECT jsonb_agg(i.image_url ORDER BY i.sort_order,i.id) FROM public.product_images i WHERE i.product_id=p.id AND i.image_url ~ '^https://'),'[]'::jsonb)
  ) record FROM public.products p WHERE p.tenant_id=c.crm_tenant_id ORDER BY p.id LIMIT 2001
 )x;
 IF jsonb_array_length(records)>2000 THEN RAISE EXCEPTION 'Large catalogue requires an assisted transfer'; END IF;
 RETURN jsonb_build_object('version',1,'source','CRM','tenantId',c.pos_tenant_id,'accountId',c.crm_tenant_id,'exportedAt',statement_timestamp(),'currency',money,'complete',true,'business',business,'products',records);
END $$;
REVOKE ALL ON FUNCTION public.pos_onboarding_binding(text),public.pos_onboarding_snapshot(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pos_onboarding_binding(text),public.pos_onboarding_snapshot(text) TO service_role;
COMMIT;
