-- newsletter-qa2 #3: split "Asked us to stop" into explicit opt-outs and
-- contacts who never opted in.
--
-- email_reachability_summary gains two columns that partition `stopped`:
--   asked_to_stop  - explicit opt-outs: crm_customers.opt_out = true,
--                    email_opt_out_at set, or an unsubscribe / complaint
--                    suppression;
--   never_opted_in - email_opt_in = false with no opt-out on record.
-- `stopped` keeps its meaning (asked_to_stop + never_opted_in) so clients
-- built before this change still add up. `reachable` is unchanged and still
-- mirrors send-email-campaign + _shared/canSendEmail.ts.
--
-- Northfield (2026-11-24): total 9,500 = reachable 0 + waiting 0 +
-- asked_to_stop 0 + never_opted_in 1,900 + unsendable 7,600.

DROP FUNCTION IF EXISTS public.email_reachability_summary(uuid, uuid[]);

CREATE FUNCTION public.email_reachability_summary(
  p_tenant_id uuid,
  p_customer_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  total bigint,
  reachable bigint,
  waiting bigint,
  stopped bigint,
  unsendable bigint,
  asked_to_stop bigint,
  never_opted_in bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
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
    SELECT c.id, lower(trim(c.email)) AS email, c.email_opt_in, c.email_consent_method,
           (coalesce(c.opt_out, false) OR c.email_opt_out_at IS NOT NULL) AS opted_out
      FROM public.crm_customers c
     WHERE c.tenant_id = p_tenant_id
       AND c.deleted_at IS NULL
       AND c.merged_into_customer_id IS NULL
       AND c.email IS NOT NULL
       AND trim(c.email) <> ''
       AND (p_customer_ids IS NULL OR c.id = ANY (p_customer_ids))
  ),
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
  flagged AS (
    SELECT sc.*,
           EXISTS (SELECT 1 FROM tenant_suppression ts
                    WHERE ts.email = sc.email
                      AND ts.kind IN ('unsubscribed', 'complaint', 'complained')) AS unsubscribed
      FROM scope sc
  ),
  classified AS (
    SELECT
      CASE
        WHEN (f.email_opt_in = false
              AND coalesce(f.email_consent_method, '') <> 'pending_confirmation')
          OR f.unsubscribed
          THEN CASE WHEN f.opted_out OR f.unsubscribed THEN 'asked_to_stop' ELSE 'never_opted_in' END
        WHEN f.email LIKE '%@noemail.local'
          OR f.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          OR public.is_reserved_email_domain(f.email)
          OR EXISTS (SELECT 1 FROM public.global_email_suppression_list g
                      WHERE lower(trim(g.email)) = f.email
                        AND g.lifted_at IS NULL
                        AND (g.expires_at IS NULL OR g.expires_at > now()))
          OR EXISTS (SELECT 1 FROM tenant_suppression ts WHERE ts.email = f.email)
          THEN 'unsendable'
        WHEN f.email_opt_in = false THEN 'waiting'
        ELSE 'reachable'
      END AS bucket
    FROM flagged f
  )
  SELECT count(*)::bigint,
         count(*) FILTER (WHERE bucket = 'reachable')::bigint,
         count(*) FILTER (WHERE bucket = 'waiting')::bigint,
         count(*) FILTER (WHERE bucket IN ('asked_to_stop', 'never_opted_in'))::bigint,
         count(*) FILTER (WHERE bucket = 'unsendable')::bigint,
         count(*) FILTER (WHERE bucket = 'asked_to_stop')::bigint,
         count(*) FILTER (WHERE bucket = 'never_opted_in')::bigint
    FROM classified;
END $function$;

REVOKE ALL ON FUNCTION public.email_reachability_summary(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_reachability_summary(uuid, uuid[]) TO authenticated, service_role;
