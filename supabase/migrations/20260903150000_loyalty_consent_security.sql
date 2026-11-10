-- Loyalty and consent security boundary.
-- Legacy loyalty helpers were created with PUBLIC/anon execution and allowed
-- callers to mutate arbitrary tenants. One helper also bulk-resubscribed a
-- hard-coded segment without a consent event. Retire that path completely.

DROP FUNCTION IF EXISTS public.optin_perks_members();

REVOKE ALL ON TABLE public.customer_loyalty_metrics
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_points_transactions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.perks_enrollment_events
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.customer_loyalty_metrics TO authenticated;
GRANT SELECT ON TABLE public.loyalty_points_transactions TO authenticated;
GRANT SELECT ON TABLE public.perks_enrollment_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.customer_loyalty_metrics TO service_role;
REVOKE ALL ON TABLE public.loyalty_points_transactions FROM service_role;
REVOKE ALL ON TABLE public.perks_enrollment_events FROM service_role;
GRANT SELECT, INSERT
  ON TABLE public.loyalty_points_transactions TO service_role;
GRANT SELECT, INSERT
  ON TABLE public.perks_enrollment_events TO service_role;

-- CREATE TABLE default privileges initially gave service_role every table
-- privilege. The SMS event ledger is append-only for application workers.
REVOKE ALL ON TABLE public.sms_link_click_events FROM service_role;
GRANT SELECT, INSERT ON TABLE public.sms_link_click_events TO service_role;

DROP POLICY IF EXISTS "Users can delete loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics;
DROP POLICY IF EXISTS "Users can insert loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics;
DROP POLICY IF EXISTS "Users can update loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics;
DROP POLICY IF EXISTS "Users can view loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics;
CREATE POLICY "Tenant users can view loyalty metrics"
ON public.customer_loyalty_metrics
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.tenant_id = customer_loyalty_metrics.tenant_id
  )
);

DROP POLICY IF EXISTS "Users can insert points transactions for their tenant"
  ON public.loyalty_points_transactions;
DROP POLICY IF EXISTS "Users can view points transactions for their tenant"
  ON public.loyalty_points_transactions;
CREATE POLICY "Tenant users can view loyalty point transactions"
ON public.loyalty_points_transactions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.tenant_id = loyalty_points_transactions.tenant_id
  )
);

DROP POLICY IF EXISTS "Users can insert enrollment events for their tenant"
  ON public.perks_enrollment_events;
DROP POLICY IF EXISTS "Users can view enrollment events for their tenant"
  ON public.perks_enrollment_events;
CREATE POLICY "Tenant users can view loyalty enrollment events"
ON public.perks_enrollment_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.tenant_id = perks_enrollment_events.tenant_id
  )
);

-- All balance, enrollment, and tier mutations are worker operations. Browser
-- clients retain tenant-scoped read access but cannot mint points or rewrite
-- derived balances, even when they know another customer's UUID.
REVOKE ALL ON FUNCTION public.track_loyalty_enrollment(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_points_earned(
  uuid, uuid, integer, text, uuid, uuid, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_points_redeemed(
  uuid, uuid, integer, uuid, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_loyalty_tier(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_loyalty_metrics(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_all_loyalty_metrics(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.track_loyalty_enrollment(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.track_points_earned(
  uuid, uuid, integer, text, uuid, uuid, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_points_redeemed(
  uuid, uuid, integer, uuid, numeric, numeric, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_loyalty_tier(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_loyalty_metrics(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_loyalty_metrics(uuid)
  TO service_role;

-- This is the only loyalty RPC still called by the browser. Resolve its
-- tenant authorization inside the function before reading protected rows.
CREATE OR REPLACE FUNCTION public.calculate_tenant_perks_enrollment_rate(
  p_tenant_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_customers bigint;
  v_enrolled_customers bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.is_master_admin(auth.uid())
     AND NOT EXISTS (
       SELECT 1
       FROM public.users AS app_user
       WHERE app_user.id = auth.uid()
         AND app_user.tenant_id = p_tenant_id
     ) THEN
    RAISE EXCEPTION 'Not authorized for this tenant'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_customers
  FROM public.crm_customers AS customer
  WHERE customer.tenant_id = p_tenant_id;

  SELECT count(*) INTO v_enrolled_customers
  FROM public.customer_loyalty_metrics AS metric
  WHERE metric.tenant_id = p_tenant_id
    AND metric.is_perks_member = true;

  IF v_total_customers = 0 THEN
    RETURN 0;
  END IF;

  RETURN (v_enrolled_customers::numeric / v_total_customers) * 100;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_tenant_perks_enrollment_rate(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_tenant_perks_enrollment_rate(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.calculate_tenant_perks_enrollment_rate(uuid) IS
  'Returns an exact enrollment rate only for the caller tenant, master admins, or service workers.';
