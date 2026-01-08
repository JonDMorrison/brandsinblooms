
-- Fix: Revoke PUBLIC access and ensure only service_role can execute
REVOKE ALL ON FUNCTION public.claim_outbox_messages(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_outbox_messages(UUID, INTEGER, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.claim_outbox_messages(UUID, INTEGER, TEXT) FROM anon;

-- Ensure service_role can execute
GRANT EXECUTE ON FUNCTION public.claim_outbox_messages(UUID, INTEGER, TEXT) TO service_role;
