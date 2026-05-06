-- Re-enable / tighten RLS on tables surfaced by the campaign-builder audit.
--
-- 1. email_governance_campaign_throttle_states (RLS off)
-- 2. email_governance_campaign_throttle_events (RLS off)
-- 3. admin_crm_customers_backup (RLS off, contains customer PII snapshots)
-- 4. email_send_log (RLS on, but two policies use WITH CHECK true / USING true)
--
-- Reference pattern: existing crm_customers / crm_campaigns policies use
--   EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.tenant_id = <table>.tenant_id)
--
-- Service role bypasses RLS automatically (BYPASSRLS attribute), so the
-- send pipeline's edge functions and the SECURITY DEFINER RPCs (run as
-- postgres, the table owner) continue to work without explicit allow-policies.
-- The "Service role full access" policies below are belt-and-suspenders for
-- consistency with the prior migration 20260320130000_security_rls_fixes.
--
-- Background: 20260320130000_security_rls_fixes is recorded in
-- supabase_migrations.schema_migrations but the runtime state of the two
-- throttle tables shows rls_enabled=false with no policies — indicating a
-- later manual ALTER TABLE ... DISABLE ROW LEVEL SECURITY (no later
-- migration in the repo touches these tables). This migration is idempotent
-- (DROP POLICY IF EXISTS guards) so it can re-assert the intended state.

-- ============================================================================
-- 1. email_governance_campaign_throttle_states
-- ============================================================================
ALTER TABLE public.email_governance_campaign_throttle_states
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation"
  ON public.email_governance_campaign_throttle_states;
CREATE POLICY "Tenant isolation"
  ON public.email_governance_campaign_throttle_states
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = email_governance_campaign_throttle_states.tenant_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = email_governance_campaign_throttle_states.tenant_id
  ));

DROP POLICY IF EXISTS "Service role full access"
  ON public.email_governance_campaign_throttle_states;
CREATE POLICY "Service role full access"
  ON public.email_governance_campaign_throttle_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. email_governance_campaign_throttle_events
-- ============================================================================
ALTER TABLE public.email_governance_campaign_throttle_events
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation"
  ON public.email_governance_campaign_throttle_events;
CREATE POLICY "Tenant isolation"
  ON public.email_governance_campaign_throttle_events
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = email_governance_campaign_throttle_events.tenant_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = email_governance_campaign_throttle_events.tenant_id
  ));

DROP POLICY IF EXISTS "Service role full access"
  ON public.email_governance_campaign_throttle_events;
CREATE POLICY "Service role full access"
  ON public.email_governance_campaign_throttle_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. admin_crm_customers_backup
--    PII restore snapshots — read-only for tenants on their own rows;
--    only service_role can mutate (admin maintenance RPCs).
-- ============================================================================
ALTER TABLE public.admin_crm_customers_backup
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read own backup"
  ON public.admin_crm_customers_backup;
CREATE POLICY "Tenant read own backup"
  ON public.admin_crm_customers_backup
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = admin_crm_customers_backup.tenant_id
  ));

DROP POLICY IF EXISTS "Service role full access"
  ON public.admin_crm_customers_backup;
CREATE POLICY "Service role full access"
  ON public.admin_crm_customers_backup
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. email_send_log
--    Drop the two overly-permissive policies. Tenant-scoped SELECT survives.
--    Add an explicit service_role policy as belt-and-suspenders; current
--    edge functions don't write here, but service_role bypass handles any
--    future writer regardless.
-- ============================================================================
DROP POLICY IF EXISTS "Service can insert send logs" ON public.email_send_log;
DROP POLICY IF EXISTS "Service can update send logs" ON public.email_send_log;

DROP POLICY IF EXISTS "Service role full access" ON public.email_send_log;
CREATE POLICY "Service role full access"
  ON public.email_send_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
