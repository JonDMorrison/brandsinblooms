-- One definition of email reachability, shared by the dashboard
-- "Reachable customers" card and the campaign Audience step.
--
-- Every customer in scope lands in exactly one bucket, so the buckets add up
-- to the total:
--   stopped     asked us to stop: opted out, opt_out flag, email_opt_out_at,
--               or an active unsubscribe/complaint suppression
--   unsendable  can't be sent to: unusable address, suppressed flag, an active
--               bounce/block suppression (tenant or global), or a hard bounce
--   reachable   said yes to email (email_opt_in = true) and none of the above
--   waiting     everything else (pending confirmation or consent not recorded)
--
-- Scope: live (not deleted, not merged) customers with a non-empty email.
-- p_customer_ids = NULL means the whole tenant.
--
-- SECURITY DEFINER because the global suppression list is admin-only; access
-- is checked explicitly with has_tenant_permission and only counts are returned.
CREATE OR REPLACE FUNCTION public.email_reachability_summary(
  p_tenant_id uuid,
  p_customer_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  total bigint,
  reachable bigint,
  waiting bigint,
  stopped bigint,
  unsendable bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (
    public.has_tenant_permission(p_tenant_id, 'customer.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.write', NULL)
  ) THEN
    RAISE EXCEPTION 'Not allowed to read this business''s customers' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH scope AS (
    SELECT c.id, lower(trim(c.email)) AS email, c.email_opt_in, c.email_consent_method,
           c.opt_out, c.email_opt_out_at, c.suppressed, c.total_hard_bounces
      FROM public.crm_customers c
     WHERE c.tenant_id = p_tenant_id
       AND c.deleted_at IS NULL
       AND c.merged_into_customer_id IS NULL
       AND c.email IS NOT NULL
       AND trim(c.email) <> ''
       AND (p_customer_ids IS NULL OR c.id = ANY (p_customer_ids))
  ),
  tenant_suppression AS (
    SELECT lower(trim(s.email)) AS email, s.customer_id, lower(s.suppression_type) AS kind
      FROM public.suppression_list s
     WHERE s.tenant_id = p_tenant_id
       AND s.channel IN ('email', 'all')
       AND s.lifted_at IS NULL
       AND (s.expires_at IS NULL OR s.expires_at > now())
  ),
  classified AS (
    SELECT
      CASE
        WHEN (sc.email_opt_in = false
              AND sc.email_consent_method IS NOT NULL
              AND sc.email_consent_method <> 'pending_confirmation')
          OR coalesce(sc.opt_out, false)
          OR sc.email_opt_out_at IS NOT NULL
          OR EXISTS (SELECT 1 FROM tenant_suppression ts
                      WHERE (ts.customer_id = sc.id OR ts.email = sc.email)
                        AND ts.kind IN ('unsubscribed', 'complaint', 'complained'))
          THEN 'stopped'
        WHEN sc.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          OR sc.email LIKE '%@noemail.local'
          OR coalesce(sc.suppressed, false)
          OR coalesce(sc.total_hard_bounces, 0) > 0
          OR EXISTS (SELECT 1 FROM tenant_suppression ts
                      WHERE (ts.customer_id = sc.id OR ts.email = sc.email))
          OR EXISTS (SELECT 1 FROM public.global_email_suppression_list g
                      WHERE lower(trim(g.email)) = sc.email
                        AND g.lifted_at IS NULL
                        AND (g.expires_at IS NULL OR g.expires_at > now()))
          THEN 'unsendable'
        WHEN sc.email_opt_in = true THEN 'reachable'
        ELSE 'waiting'
      END AS bucket
    FROM scope sc
  )
  SELECT count(*)::bigint,
         count(*) FILTER (WHERE bucket = 'reachable')::bigint,
         count(*) FILTER (WHERE bucket = 'waiting')::bigint,
         count(*) FILTER (WHERE bucket = 'stopped')::bigint,
         count(*) FILTER (WHERE bucket = 'unsendable')::bigint
    FROM classified;
END $$;

REVOKE ALL ON FUNCTION public.email_reachability_summary(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_reachability_summary(uuid, uuid[]) TO authenticated;
