-- Per-customer email eligibility, from the same rule as the campaign count.
--
-- The campaign editor's "Add people" search has to say, for each customer it
-- lists, whether that person can receive the email and, if not, why. That
-- answer must come from the rule public.email_campaign_eligibility already
-- applies (supabase/migrations/20261127120000_email_campaign_eligibility.sql,
-- docs/email-eligibility.md), not from a second copy of it.
--
-- So the rule moves, unchanged, into one place:
--
--   private.email_campaign_audience_contacts(...)
--     one row per audience contact with an email address: its bucket (the
--     same buckets the campaign count partitions `total` into), a reason code
--     for the bucket, and the per-address verdicts the override counts read.
--     Not callable by clients (it returns addresses); only the two SECURITY
--     DEFINER functions below read it.
--
-- and both public functions read it:
--
--   public.email_campaign_eligibility(...)        same signature, same columns,
--     same numbers: it now aggregates the private rows instead of computing
--     them inline. Every per-address count (the override columns) counts
--     DISTINCT addresses, which is exactly the old `verdict` row count because
--     every address in `verdict` came from a contact row.
--
--   public.email_campaign_customer_eligibility(p_tenant_id, p_customer_ids)
--     one row per live customer of the tenant in p_customer_ids:
--     can_receive and reason. The ids are evaluated together as a direct
--     customer audience (what "Specific people" adds), so
--     can_receive is true exactly for the `eligible` and `duplicate` buckets
--     (a duplicate shares a deliverable, consenting address with another
--     listed customer). Live customers with no email address come back as
--     'no_email'. No address is returned.
--
-- Reason codes (the editor turns them into plain English):
--   eligible, duplicate_address            -> can receive
--   waiting_confirmation                   -> waiting bucket
--   unsubscribed, complained, opted_out    -> asked_to_stop bucket
--   never_opted_in                         -> never_opted_in bucket
--   undeliverable_address                  -> unsendable: malformed, placeholder
--                                             or reserved-domain address
--   blocked                                -> unsendable: global suppression or
--                                             a tenant 'blocked'/'global_block'
--   bounced                                -> unsendable: tenant bounce entry
--   shared_blocked_address                 -> unsendable: dedup drops a shared
--                                             address with a suppressed record
--   no_email                               -> (customer function only)

CREATE OR REPLACE FUNCTION private.email_campaign_audience_contacts(
  p_tenant_id uuid,
  p_include_all_customers boolean DEFAULT false,
  p_segment_ids uuid[] DEFAULT '{}'::uuid[],
  p_persona_ids text[] DEFAULT '{}'::text[],
  p_customer_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  customer_id uuid,
  email text,
  bucket text,
  reason text,
  address_passes boolean,
  address_passes_soft boolean,
  address_consenting_records bigint,
  address_restricted boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_include_all boolean := coalesce(p_include_all_customers, false);
  v_segment uuid := (coalesce(p_segment_ids, '{}'::uuid[]))[1];
  v_personas text[] := ARRAY(
    SELECT DISTINCT trim(p) FROM unnest(coalesce(p_persona_ids, '{}'::text[])) AS p
     WHERE p IS NOT NULL AND trim(p) <> '');
  v_persona_uuids uuid[];
  v_persona_predefined text[];
  v_customers uuid[] := ARRAY(
    SELECT DISTINCT c FROM unnest(coalesce(p_customer_ids, '{}'::uuid[])) AS c WHERE c IS NOT NULL);
  v_bypass boolean;
BEGIN
  v_persona_uuids := ARRAY(SELECT p::uuid FROM unnest(v_personas) AS p WHERE lower(p) ~ v_uuid_re);
  v_persona_predefined := ARRAY(SELECT p FROM unnest(v_personas) AS p WHERE lower(p) !~ v_uuid_re);

  -- No audience: no contacts (the worker refuses to send).
  IF NOT v_include_all AND v_segment IS NULL AND cardinality(v_personas) = 0
     AND cardinality(v_customers) = 0 THEN
    RETURN;
  END IF;

  -- Same switch the worker reads (getTenantSuppressionBypassState).
  v_bypass := coalesce(
    (public.get_tenant_suppression_bypass_state(p_tenant_id) ->> 'suppression_bypass_active')::boolean,
    false);

  RETURN QUERY
  WITH segment_ids AS (
    SELECT cs.customer_id AS id
      FROM public.customer_segments cs
      JOIN public.crm_segments s ON s.id = cs.segment_id
     WHERE v_segment IS NOT NULL
       AND cs.segment_id = v_segment
       AND s.tenant_id = p_tenant_id
       AND s.deleted_at IS NULL
  ),
  persona_ids AS (
    SELECT cp.customer_id AS id FROM public.customer_personas cp
     WHERE cp.persona_id = ANY (v_persona_uuids)
    UNION
    SELECT c.id FROM public.crm_customers c
     WHERE c.tenant_id = p_tenant_id AND c.persona_id = ANY (v_persona_uuids)
    UNION
    SELECT cp.customer_id FROM public.customer_personas cp
     WHERE cp.predefined_persona_id = ANY (v_persona_predefined)
  ),
  targeted AS (
    SELECT sg.id FROM segment_ids sg
     WHERE v_segment IS NOT NULL
       AND (cardinality(v_personas) = 0 OR sg.id IN (SELECT pi.id FROM persona_ids pi))
    UNION
    SELECT pi.id FROM persona_ids pi
     WHERE v_segment IS NULL AND cardinality(v_personas) > 0
    UNION
    SELECT unnest(v_customers)
  ),
  scope AS (
    SELECT c.id,
           lower(trim(c.email)) AS email,
           c.email_opt_in,
           c.email_consent_method,
           coalesce(c.suppressed, false) AS record_suppressed,
           (coalesce(c.opt_out, false) OR c.email_opt_out_at IS NOT NULL) AS opted_out,
           c.created_at
      FROM public.crm_customers c
     WHERE c.tenant_id = p_tenant_id
       AND c.deleted_at IS NULL
       AND c.merged_into_customer_id IS NULL
       AND c.email IS NOT NULL
       AND trim(c.email) <> ''
       AND (v_include_all OR c.id IN (SELECT t.id FROM targeted t))
  ),
  -- canSendEmailBatch: tenant entries matched by address, blocking types only,
  -- minus the types a tenant suppression bypass lifts.
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
  addresses AS (
    SELECT a.email,
           count(*) FILTER (WHERE a.email_opt_in IS DISTINCT FROM false) AS consenting_records,
           coalesce(bool_or(a.record_suppressed) FILTER (WHERE a.email_opt_in IS DISTINCT FROM false), false)
             AS consenting_record_suppressed
      FROM scope a
     GROUP BY a.email
  ),
  checked AS (
    SELECT ad.*,
           (ad.email NOT LIKE '%@noemail.local'
             AND ad.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
             AND NOT public.is_reserved_email_domain(ad.email)) AS valid_address,
           EXISTS (SELECT 1 FROM public.global_email_suppression_list g
                    WHERE lower(trim(g.email)) = ad.email
                      AND g.lifted_at IS NULL
                      AND (g.expires_at IS NULL OR g.expires_at > now())) AS globally_suppressed,
           EXISTS (SELECT 1 FROM tenant_suppression ts WHERE ts.email = ad.email) AS suppressed,
           EXISTS (SELECT 1 FROM tenant_suppression ts
                    WHERE ts.email = ad.email AND ts.kind <> 'bounced') AS suppressed_after_soft_override,
           EXISTS (SELECT 1 FROM tenant_suppression ts
                    WHERE ts.email = ad.email
                      AND ts.kind IN ('unsubscribed', 'complaint', 'complained')) AS unsubscribed,
           EXISTS (SELECT 1 FROM tenant_suppression ts
                    WHERE ts.email = ad.email AND ts.kind = 'unsubscribed') AS unsubscribed_entry,
           EXISTS (SELECT 1 FROM tenant_suppression ts
                    WHERE ts.email = ad.email AND ts.kind IN ('bounced', 'hard_bounce')) AS bounced_entry
      FROM addresses ad
  ),
  -- recipientEmailDedup: with consent respected, a shared address is dropped
  -- when any consenting record for it is suppressed.
  verdict AS (
    SELECT ch.*,
           (ch.valid_address AND NOT ch.globally_suppressed) AS deliverable,
           (ch.consenting_records > 1 AND ch.consenting_record_suppressed) AS restricted,
           (ch.valid_address AND NOT ch.globally_suppressed AND NOT ch.suppressed) AS passes,
           (ch.valid_address AND NOT ch.globally_suppressed AND NOT ch.suppressed_after_soft_override)
             AS passes_soft
      FROM checked ch
  ),
  classified AS (
    SELECT sc.id, sc.email, sc.opted_out,
      CASE
        WHEN (sc.email_opt_in = false
              AND coalesce(sc.email_consent_method, '') <> 'pending_confirmation')
          OR v.unsubscribed
          THEN CASE WHEN sc.opted_out OR v.unsubscribed THEN 'asked_to_stop' ELSE 'never_opted_in' END
        WHEN NOT v.passes OR (sc.email_opt_in IS DISTINCT FROM false AND v.restricted)
          THEN 'unsendable'
        WHEN sc.email_opt_in = false THEN 'waiting'
        WHEN row_number() OVER (
               PARTITION BY sc.email, (sc.email_opt_in IS DISTINCT FROM false)
               ORDER BY sc.created_at NULLS LAST, sc.id::text) = 1
          THEN 'eligible'
        ELSE 'duplicate'
      END AS bucket,
      v.valid_address, v.globally_suppressed, v.suppressed, v.unsubscribed,
      v.unsubscribed_entry, v.bounced_entry, v.consenting_records, v.restricted,
      v.passes, v.passes_soft
    FROM scope sc
    JOIN verdict v ON v.email = sc.email
  )
  SELECT cl.id,
         cl.email,
         cl.bucket,
         CASE cl.bucket
           WHEN 'eligible' THEN 'eligible'
           WHEN 'duplicate' THEN 'duplicate_address'
           WHEN 'waiting' THEN 'waiting_confirmation'
           WHEN 'never_opted_in' THEN 'never_opted_in'
           WHEN 'asked_to_stop' THEN
             CASE
               WHEN cl.unsubscribed_entry THEN 'unsubscribed'
               WHEN cl.unsubscribed THEN 'complained'
               ELSE 'opted_out'
             END
           ELSE
             CASE
               WHEN NOT cl.valid_address THEN 'undeliverable_address'
               WHEN cl.globally_suppressed THEN 'blocked'
               WHEN cl.suppressed AND cl.bounced_entry THEN 'bounced'
               WHEN cl.suppressed THEN 'blocked'
               ELSE 'shared_blocked_address'
             END
         END,
         cl.passes,
         cl.passes_soft,
         cl.consenting_records,
         cl.restricted
    FROM classified cl;
END $$;

REVOKE ALL ON FUNCTION private.email_campaign_audience_contacts(uuid, boolean, uuid[], text[], uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.email_campaign_audience_contacts(uuid, boolean, uuid[], text[], uuid[])
  TO service_role;

COMMENT ON FUNCTION private.email_campaign_audience_contacts(uuid, boolean, uuid[], text[], uuid[]) IS
  'The send-email-campaign eligibility rule, one row per audience contact. Read by email_campaign_eligibility and email_campaign_customer_eligibility. See docs/email-eligibility.md.';

-- Same signature and columns as before; the numbers now come from the shared rows.
CREATE OR REPLACE FUNCTION public.email_campaign_eligibility(
  p_tenant_id uuid,
  p_include_all_customers boolean DEFAULT false,
  p_segment_ids uuid[] DEFAULT '{}'::uuid[],
  p_persona_ids text[] DEFAULT '{}'::text[],
  p_customer_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  audience_configured boolean,
  total bigint,
  eligible bigint,
  waiting bigint,
  asked_to_stop bigint,
  never_opted_in bigint,
  unsendable bigint,
  duplicates bigint,
  blocked bigint,
  eligible_with_consent_override bigint,
  eligible_with_soft_override bigint,
  eligible_with_both_overrides bigint,
  single_eligible_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_include_all boolean := coalesce(p_include_all_customers, false);
  v_segment uuid := (coalesce(p_segment_ids, '{}'::uuid[]))[1];
  v_has_persona boolean := EXISTS (
    SELECT 1 FROM unnest(coalesce(p_persona_ids, '{}'::text[])) AS p
     WHERE p IS NOT NULL AND trim(p) <> '');
  v_has_customer boolean := EXISTS (
    SELECT 1 FROM unnest(coalesce(p_customer_ids, '{}'::uuid[])) AS c WHERE c IS NOT NULL);
BEGIN
  IF NOT (
    public.has_tenant_permission(p_tenant_id, 'customer.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.write', NULL)
  ) THEN
    RAISE EXCEPTION 'Not allowed to read this business''s customers' USING ERRCODE = '42501';
  END IF;

  -- The worker refuses a campaign with no audience ("Choose an audience").
  IF NOT v_include_all AND v_segment IS NULL AND NOT v_has_persona AND NOT v_has_customer THEN
    RETURN QUERY SELECT false, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
      0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  WITH contacts AS (
    SELECT * FROM private.email_campaign_audience_contacts(
      p_tenant_id, p_include_all_customers, p_segment_ids, p_persona_ids, p_customer_ids)
  )
  SELECT true,
         count(*)::bigint,
         count(*) FILTER (WHERE ct.bucket = 'eligible')::bigint,
         count(*) FILTER (WHERE ct.bucket = 'waiting')::bigint,
         count(*) FILTER (WHERE ct.bucket = 'asked_to_stop')::bigint,
         count(*) FILTER (WHERE ct.bucket = 'never_opted_in')::bigint,
         count(*) FILTER (WHERE ct.bucket = 'unsendable')::bigint,
         count(*) FILTER (WHERE ct.bucket = 'duplicate')::bigint,
         count(*) FILTER (WHERE NOT ct.address_passes_soft)::bigint,
         count(DISTINCT ct.email) FILTER (WHERE ct.address_passes)::bigint,
         count(DISTINCT ct.email) FILTER (
           WHERE ct.address_consenting_records > 0 AND NOT ct.address_restricted
             AND ct.address_passes_soft)::bigint,
         count(DISTINCT ct.email) FILTER (WHERE ct.address_passes_soft)::bigint,
         CASE WHEN count(*) FILTER (WHERE ct.bucket = 'eligible') = 1
              THEN min(ct.email) FILTER (WHERE ct.bucket = 'eligible')
         END
    FROM contacts ct;
END $$;

REVOKE ALL ON FUNCTION public.email_campaign_eligibility(uuid, boolean, uuid[], text[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_campaign_eligibility(uuid, boolean, uuid[], text[], uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.email_campaign_eligibility(uuid, boolean, uuid[], text[], uuid[]) IS
  'Counts an email campaign audience with the send-email-campaign delivery rule (private.email_campaign_audience_contacts). See docs/email-eligibility.md.';

-- Whether each listed customer can receive a campaign email, and why not.
CREATE OR REPLACE FUNCTION public.email_campaign_customer_eligibility(
  p_tenant_id uuid,
  p_customer_ids uuid[]
)
RETURNS TABLE (
  customer_id uuid,
  can_receive boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customers uuid[] := ARRAY(
    SELECT DISTINCT c FROM unnest(coalesce(p_customer_ids, '{}'::uuid[])) AS c WHERE c IS NOT NULL);
BEGIN
  IF NOT (
    public.has_tenant_permission(p_tenant_id, 'customer.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.write', NULL)
  ) THEN
    RAISE EXCEPTION 'Not allowed to read this business''s customers' USING ERRCODE = '42501';
  END IF;

  IF cardinality(v_customers) > 500 THEN
    RAISE EXCEPTION 'Check at most 500 customers at a time' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_customers) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH live AS (
    SELECT c.id
      FROM public.crm_customers c
     WHERE c.tenant_id = p_tenant_id
       AND c.id = ANY (v_customers)
       AND c.deleted_at IS NULL
       AND c.merged_into_customer_id IS NULL
  ),
  contacts AS (
    SELECT ct.customer_id, ct.bucket, ct.reason
      FROM private.email_campaign_audience_contacts(
        p_tenant_id, false, '{}'::uuid[], '{}'::text[], v_customers) ct
  )
  SELECT l.id,
         coalesce(ct.bucket IN ('eligible', 'duplicate'), false),
         coalesce(ct.reason, 'no_email')
    FROM live l
    LEFT JOIN contacts ct ON ct.customer_id = l.id;
END $$;

REVOKE ALL ON FUNCTION public.email_campaign_customer_eligibility(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_campaign_customer_eligibility(uuid, uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.email_campaign_customer_eligibility(uuid, uuid[]) IS
  'Per-customer email campaign eligibility (can_receive, reason) from the send-email-campaign rule. See docs/email-eligibility.md.';
