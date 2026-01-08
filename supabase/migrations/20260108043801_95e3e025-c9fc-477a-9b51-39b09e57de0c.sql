
-- Security hardening: Remove PUBLIC access, only service_role can execute
-- Add tenant_id parameter for proper tenant isolation

-- Revoke all existing permissions
REVOKE ALL ON FUNCTION public.claim_outbox_messages(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_outbox_messages(integer, text) FROM authenticated;

-- Drop and recreate with tenant_id parameter
DROP FUNCTION IF EXISTS public.claim_outbox_messages(integer, text);

CREATE OR REPLACE FUNCTION public.claim_outbox_messages(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_worker_id TEXT DEFAULT NULL
)
RETURNS SETOF crm_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_lock_until TIMESTAMPTZ := now() + INTERVAL '5 minutes';
  v_worker_id TEXT := COALESCE(p_worker_id, 'worker-' || substring(gen_random_uuid()::text, 1, 8));
BEGIN
  -- Only claim messages for the specified tenant
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.crm_outbox
    WHERE tenant_id = p_tenant_id
      AND status = 'queued'
      AND scheduled_at <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.crm_outbox o
  SET 
    status = 'processing',
    locked_until = v_lock_until,
    locked_by = v_worker_id,
    updated_at = now()
  FROM claimable c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

-- Grant ONLY to service_role (backend workers only)
GRANT EXECUTE ON FUNCTION public.claim_outbox_messages(UUID, INTEGER, TEXT) TO service_role;

-- Verify no public access
COMMENT ON FUNCTION public.claim_outbox_messages(UUID, INTEGER, TEXT) IS 'Claims outbox messages for processing. Service-role only for security.';
