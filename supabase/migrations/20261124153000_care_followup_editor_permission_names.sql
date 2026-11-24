BEGIN;
-- CRM access descriptors use plural resource names; the SQL permission
-- function uses singular names. Preserve both tenant scope and permissions.
CREATE OR REPLACE FUNCTION bloom_pos_private.assert_care_followup_editor(p_tenant uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $care$
BEGIN
 IF auth.uid() IS NULL OR (public.get_current_crm_access()->>'tenantId') IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(public.has_tenant_permission(p_tenant,'campaign.write',NULL),false)
 OR NOT coalesce(public.has_tenant_permission(p_tenant,'customer.read',NULL),false)
 THEN RAISE EXCEPTION 'Campaign and customer permission required' USING ERRCODE='42501'; END IF;
END $care$;
REVOKE ALL ON FUNCTION bloom_pos_private.assert_care_followup_editor(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
