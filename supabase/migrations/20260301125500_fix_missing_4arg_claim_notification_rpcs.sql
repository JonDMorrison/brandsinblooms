-- Forward-only repair migration.
-- Some environments are missing the canonical 4-arg claim RPCs.
-- Recreate them with the exact signature expected by workers.

CREATE OR REPLACE FUNCTION public.claim_tenant_hard_stop_notifications(
  p_limit INTEGER DEFAULT 20,
  p_worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  p_stale_after_minutes INTEGER DEFAULT 10
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
  BEGIN
    RETURN QUERY
    WITH claimable AS (
      SELECT n.id
      FROM public.email_governance_tenant_hard_stop_notifications n
      WHERE (
        n.status = 'pending'
        OR (
          n.status = 'in_progress'
          AND (n.claimed_at IS NULL OR n.claimed_at < (now() - make_interval(mins => p_stale_after_minutes)))
        )
      )
      ORDER BY n.created_at ASC
      LIMIT GREATEST(COALESCE(p_limit, 20), 1)
      FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE public.email_governance_tenant_hard_stop_notifications n
      SET
        status = 'in_progress',
        claimed_at = now(),
        claimed_by = p_worker_id,
        claim_token = p_claim_token,
        attempts = COALESCE(n.attempts, 0) + 1,
        updated_at = now()
      WHERE n.id IN (SELECT c.id FROM claimable c)
      RETURNING n.id, n.enforcement_action_id, n.tenant_id, n.recipient_email, n.subject, n.body_text
    )
    SELECT c.id, c.enforcement_action_id, c.tenant_id, c.recipient_email, c.subject, c.body_text
    FROM claimed c;
  EXCEPTION
    WHEN undefined_table THEN
      RETURN;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_tenant_hard_stop_notifications(INTEGER, TEXT, UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_domain_crisis_notifications(
  p_limit INTEGER DEFAULT 20,
  p_worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  p_stale_after_minutes INTEGER DEFAULT 10
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
  BEGIN
    RETURN QUERY
    WITH claimable AS (
      SELECT n.id
      FROM public.email_governance_domain_crisis_notifications n
      WHERE (
        n.status = 'pending'
        OR (
          n.status = 'in_progress'
          AND (n.claimed_at IS NULL OR n.claimed_at < (now() - make_interval(mins => p_stale_after_minutes)))
        )
      )
      ORDER BY n.created_at ASC
      LIMIT GREATEST(COALESCE(p_limit, 20), 1)
      FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE public.email_governance_domain_crisis_notifications n
      SET
        status = 'in_progress',
        claimed_at = now(),
        claimed_by = p_worker_id,
        claim_token = p_claim_token,
        attempts = COALESCE(n.attempts, 0) + 1,
        updated_at = now()
      WHERE n.id IN (SELECT c.id FROM claimable c)
      RETURNING n.id, n.crisis_action_id, n.tenant_id, n.domain_id, n.recipient_email, n.subject, n.body_text
    )
    SELECT c.id, c.crisis_action_id, c.tenant_id, c.domain_id, c.recipient_email, c.subject, c.body_text
    FROM claimed c;
  EXCEPTION
    WHEN undefined_table THEN
      RETURN;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_domain_crisis_notifications(INTEGER, TEXT, UUID, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
