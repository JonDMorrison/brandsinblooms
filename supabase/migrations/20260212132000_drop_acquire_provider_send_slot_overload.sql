-- Drop the compatibility overload that causes PostgREST ambiguity.
--
-- PostgREST cannot choose between two equally valid candidates when invoking RPC
-- with named parameters. Keep only the canonical signature:
--   acquire_provider_send_slot(p_provider TEXT, p_min_interval_ms INT)

DROP FUNCTION IF EXISTS public.acquire_provider_send_slot(INT, TEXT);

-- Ensure execute grant remains on the canonical signature.
GRANT EXECUTE ON FUNCTION public.acquire_provider_send_slot(TEXT, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
