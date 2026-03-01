-- Forward-only repair migration.
-- PostgREST cannot choose between the 3-arg overload and canonical 4-arg function
-- when the caller omits p_claim_token (it has a default).
-- Remove the 3-arg overloads to make resolution unambiguous.

DROP FUNCTION IF EXISTS public.claim_tenant_hard_stop_notifications(INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.claim_domain_crisis_notifications(INTEGER, INTEGER, TEXT);

NOTIFY pgrst, 'reload schema';
