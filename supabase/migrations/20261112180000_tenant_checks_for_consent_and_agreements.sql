-- Central login milestone 50 (Wave 5c, decision 61): no tenant decision trusts user-editable metadata.
-- Closes 47/R-04 and 47/R-05 on the server. Both objects are live today; this file stands alone (no central-login
-- dependency). Forward-only; no earlier migration is edited.
--
-- 1. 47/R-04: public.get_email_consent_stats(p_tenant_id) is SECURITY DEFINER and granted to authenticated, and
--    counted any tenant's customers for any caller (the UI passed user_metadata.tenant_id). It now answers only a
--    caller who may read that tenant's customers company-wide (public.has_tenant_permission, the check the
--    crm_customers policies use); anyone else gets 42501. Service-role callers keep working (has_tenant_permission
--    returns true for them). Same name, arguments, result columns and grants.
-- 2. 47/R-05: the insert policy on public.user_agreement_acceptances checked only the user id, so an acceptance
--    could name any tenant. The tenant must now be empty or the caller's own (public.users.tenant_id).

CREATE OR REPLACE FUNCTION public.get_email_consent_stats(p_tenant_id uuid)
RETURNS TABLE(total_customers bigint, opted_in_count bigint, opted_out_count bigint, unknown_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.read', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    COUNT(*) AS total_customers,
    COUNT(*) FILTER (WHERE c.email_opt_in = true) AS opted_in_count,
    COUNT(*) FILTER (WHERE c.email_opt_in = false) AS opted_out_count,
    COUNT(*) FILTER (WHERE c.email_opt_in IS NULL AND c.email IS NOT NULL) AS unknown_count
  FROM public.crm_customers c
  WHERE c.tenant_id = p_tenant_id
    AND c.email IS NOT NULL;
END;
$$;

DROP POLICY IF EXISTS "Users can insert their own agreement acceptances" ON public.user_agreement_acceptances;
CREATE POLICY "Users can insert their own agreement acceptances"
  ON public.user_agreement_acceptances
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      tenant_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.users app_user
        WHERE app_user.id = auth.uid()
          AND app_user.tenant_id = user_agreement_acceptances.tenant_id
      )
    )
  );
