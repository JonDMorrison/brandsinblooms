-- Remove ambiguous overload for admin_clear_tenant_suppression_history.
-- PostgREST cannot choose between overloads when both match named args.

BEGIN;

-- Keep only: (p_tenant_id uuid, p_reason text)
DROP FUNCTION IF EXISTS public.admin_clear_tenant_suppression_history(TEXT, UUID);

-- Ensure PostgREST refreshes schema cache.
NOTIFY pgrst, 'reload schema';

COMMIT;
