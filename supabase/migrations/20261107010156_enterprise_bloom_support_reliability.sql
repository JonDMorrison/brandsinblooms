-- The analytical audience worker is the only caller of these primitives. They need
-- to inspect auth.users to reject banned owners, which service_role cannot SELECT
-- directly. Run the complete authorization checks as the function owner instead of
-- granting broad read access to Auth. Execution remains service-role only.
ALTER FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 SECURITY DEFINER;
ALTER FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 SET search_path = '';
ALTER FUNCTION public.claim_bloom_audience_refresh(uuid)
 SECURITY DEFINER;
ALTER FUNCTION public.claim_bloom_audience_refresh(uuid)
 SET search_path = '';
ALTER FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 SECURITY DEFINER;
ALTER FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 SET search_path = '';

REVOKE ALL ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_bloom_audience_refresh(uuid)
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_bloom_audience_refresh(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 TO service_role;

COMMENT ON FUNCTION public.claim_bloom_audience_refresh(uuid) IS
 'Service-only worker claim. SECURITY DEFINER is required solely for the banned-owner check in auth.users.';
