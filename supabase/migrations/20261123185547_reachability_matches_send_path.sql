-- Email reachability now follows the send path (send-email-campaign +
-- _shared/canSendEmail.ts) rule for rule.
--
-- Milestone 4 retired engagement-based suppression and Milestone 5 made
-- suppression_list the only source of truth, so crm_customers.suppressed,
-- opt_out, email_opt_out_at and total_hard_bounces no longer decide anything
-- here (the send path never reads them).
--
-- Both sides now treat RFC 2606 / 6761 reserved domains (.invalid, .test,
-- .localhost, .example, example.com/.net/.org) as invalid addresses.
--
-- Buckets, exclusive, in this order:
--   stopped     email_opt_in = false (not pending confirmation), or an active
--               unsubscribe/complaint entry in suppression_list
--   unsendable  blank/@noemail.local/malformed/reserved-domain address, the
--               global suppression list, or any other active suppression_list
--               entry the send path blocks on
--   waiting     email_opt_in = false while confirmation is pending
--   reachable   everything else: exactly the contacts a send would include
--               (email_opt_in true, or not recorded)
--
-- Not mirrored: role-based address blocking, which the send path applies only
-- when the BLOCK_ROLE_BASED_EMAILS environment flag is on.

CREATE OR REPLACE FUNCTION public.is_reserved_email_domain(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH d AS (
    SELECT rtrim(lower(trim(split_part(coalesce(p_email, ''), '@', -1))), '.') AS domain
  )
  SELECT CASE
    WHEN d.domain = '' OR position('@' in coalesce(p_email, '')) = 0 THEN false
    WHEN d.domain IN ('example.com', 'example.net', 'example.org')
      OR d.domain LIKE '%.example.com'
      OR d.domain LIKE '%.example.net'
      OR d.domain LIKE '%.example.org' THEN true
    ELSE split_part(d.domain, '.', -1) IN ('invalid', 'test', 'localhost', 'example')
  END
  FROM d;
$$;

GRANT EXECUTE ON FUNCTION public.is_reserved_email_domain(text) TO authenticated, service_role;

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
DECLARE
  -- Same switch the send path reads: while a tenant's suppression bypass is
  -- active, bounce and complaint entries do not block a campaign send.
  v_bypass boolean := coalesce(
    (public.get_tenant_suppression_bypass_state(p_tenant_id) ->> 'suppression_bypass_active')::boolean,
    false);
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
    SELECT c.id, lower(trim(c.email)) AS email, c.email_opt_in, c.email_consent_method
      FROM public.crm_customers c
     WHERE c.tenant_id = p_tenant_id
       AND c.deleted_at IS NULL
       AND c.merged_into_customer_id IS NULL
       AND c.email IS NOT NULL
       AND trim(c.email) <> ''
       AND (p_customer_ids IS NULL OR c.id = ANY (p_customer_ids))
  ),
  -- canSendEmailBatch: matched by email, these types only, minus bypassed ones.
  tenant_suppression AS (
    SELECT lower(trim(s.email)) AS email, lower(s.suppression_type) AS kind
      FROM public.suppression_list s
     WHERE s.tenant_id = p_tenant_id
       AND s.channel IN ('email', 'all')
       AND s.lifted_at IS NULL
       AND (s.expires_at IS NULL OR s.expires_at > now())
       AND lower(s.suppression_type) IN
           ('unsubscribed', 'bounced', 'complaint', 'blocked', 'global_block', 'complained', 'hard_bounce')
       AND NOT (v_bypass AND lower(s.suppression_type) IN ('bounced', 'hard_bounce', 'complaint', 'complained'))
  ),
  classified AS (
    SELECT
      CASE
        WHEN (sc.email_opt_in = false
              AND coalesce(sc.email_consent_method, '') <> 'pending_confirmation')
          OR EXISTS (SELECT 1 FROM tenant_suppression ts
                      WHERE ts.email = sc.email
                        AND ts.kind IN ('unsubscribed', 'complaint', 'complained'))
          THEN 'stopped'
        WHEN sc.email LIKE '%@noemail.local'
          OR sc.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          OR public.is_reserved_email_domain(sc.email)
          OR EXISTS (SELECT 1 FROM public.global_email_suppression_list g
                      WHERE lower(trim(g.email)) = sc.email
                        AND g.lifted_at IS NULL
                        AND (g.expires_at IS NULL OR g.expires_at > now()))
          OR EXISTS (SELECT 1 FROM tenant_suppression ts WHERE ts.email = sc.email)
          THEN 'unsendable'
        WHEN sc.email_opt_in = false THEN 'waiting'
        ELSE 'reachable'
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
