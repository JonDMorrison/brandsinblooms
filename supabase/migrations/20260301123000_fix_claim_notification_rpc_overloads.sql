-- Forward-only repair migration.
-- PostgREST does not support omitting optional RPC parameters.
-- Edge Functions call these RPCs without p_claim_token, so we provide overloads.

CREATE OR REPLACE FUNCTION public.claim_tenant_hard_stop_notifications(
  p_limit INTEGER DEFAULT 20,
  p_stale_after_minutes INTEGER DEFAULT 10,
  p_worker_id TEXT DEFAULT 'worker'
)
RETURNS TABLE (
  id UUID,
  enforcement_action_id UUID,
  tenant_id UUID,
  recipient_email TEXT,
  subject TEXT,
  body_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.claim_tenant_hard_stop_notifications(
    p_limit := p_limit,
    p_worker_id := p_worker_id,
    p_claim_token := gen_random_uuid(),
    p_stale_after_minutes := p_stale_after_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_tenant_hard_stop_notifications(INTEGER, INTEGER, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_domain_crisis_notifications(
  p_limit INTEGER DEFAULT 20,
  p_stale_after_minutes INTEGER DEFAULT 10,
  p_worker_id TEXT DEFAULT 'worker'
)
RETURNS TABLE (
  id UUID,
  crisis_action_id UUID,
  tenant_id UUID,
  domain_id UUID,
  recipient_email TEXT,
  subject TEXT,
  body_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.claim_domain_crisis_notifications(
    p_limit := p_limit,
    p_worker_id := p_worker_id,
    p_claim_token := gen_random_uuid(),
    p_stale_after_minutes := p_stale_after_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_domain_crisis_notifications(INTEGER, INTEGER, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
