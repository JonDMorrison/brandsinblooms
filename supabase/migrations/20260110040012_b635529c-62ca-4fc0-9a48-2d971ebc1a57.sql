-- POSITIVE TEST: Call RPC as service_role (simulating edge function)
SELECT public.server_finalize_onboarding('a6534f6c-76cd-4d98-9d0e-69c42b3fec37'::uuid) as result;