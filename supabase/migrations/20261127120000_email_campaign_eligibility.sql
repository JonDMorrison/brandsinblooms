-- One server-side answer to "who would this email campaign actually reach?"
--
-- public.email_campaign_eligibility counts a campaign audience with the rule
-- send-email-campaign enforces at delivery time (docs/email-eligibility.md has
-- the step-by-step rule with file and line references). The campaign editor's
-- audience panel, Audience step badge and summary, readiness bar, Schedule
-- button, Schedule drawer and Ready to send dialog all read this function and
-- nothing else, so they can no longer disagree with each other or with the
-- worker.
--
-- The worker stays the enforcement authority. This function mirrors it:
--
--  1. Audience resolution (send-email-campaign/index.ts):
--     - include all customers: every live customer in the tenant; segments,
--       personas and direct customers are then ignored;
--     - segments: the worker reads crm_campaigns.segment_id, which the editor
--       saves as the FIRST selected segment, and only falls back to
--       campaign_segments when segment_id is null. Only p_segment_ids[1] is
--       used here, for the same reason;
--     - personas: customer_personas.persona_id and crm_customers.persona_id for
--       UUID ids, customer_personas.predefined_persona_id for the rest;
--     - segments AND personas intersect; direct customers are then added.
--  2. Live customers only: this tenant, deleted_at and merged_into_customer_id
--     null, email not null.
--  3. Consent: email_opt_in IS NOT false. email_consent is never read.
--  4. Blank and @noemail.local addresses are dropped.
--  5. One copy per address (trim + lower-case). When several records share an
--     address and any of them has crm_customers.suppressed = true, the address
--     is dropped (_shared/recipientEmailDedup.ts).
--  6. canSendEmailBatch (_shared/canSendEmail.ts): malformed or RFC 2606 / 6761
--     reserved-domain addresses, the global suppression list, and tenant
--     suppression_list entries (email/all channel, not lifted, not expired, of
--     the blocking types) minus the bounce/complaint types a tenant suppression
--     bypass lifts.
--
-- Not mirrored, and documented in docs/email-eligibility.md:
--   - role-based address blocking, which the worker applies only when the
--     BLOCK_ROLE_BASED_EMAILS environment flag is on;
--   - the care follow-up delivery guard (service role only; can only narrow);
--   - the reputation-tier recipient cap (a volume limit, not eligibility).
--
-- The override columns are what the worker would send with the Ready to send
-- dialog's overrides: forceBypassConsent (opt-outs included, dedup no longer
-- drops restricted addresses) and forceBypassSoftSuppression ('bounced' lifted).
--
-- Per-contact buckets partition `total` exactly:
--   total = eligible + waiting + asked_to_stop + never_opted_in + unsendable
--           + duplicates
-- and `eligible` is the number of unique addresses a default send reaches.

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
  IF NOT (
    public.has_tenant_permission(p_tenant_id, 'customer.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.read', NULL)
    OR public.has_tenant_permission(p_tenant_id, 'campaign.write', NULL)
  ) THEN
    RAISE EXCEPTION 'Not allowed to read this business''s customers' USING ERRCODE = '42501';
  END IF;

  v_persona_uuids := ARRAY(SELECT p::uuid FROM unnest(v_personas) AS p WHERE lower(p) ~ v_uuid_re);
  v_persona_predefined := ARRAY(SELECT p FROM unnest(v_personas) AS p WHERE lower(p) !~ v_uuid_re);

  -- The worker refuses a campaign with no audience ("Choose an audience").
  IF NOT v_include_all AND v_segment IS NULL AND cardinality(v_personas) = 0
     AND cardinality(v_customers) = 0 THEN
    RETURN QUERY SELECT false, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
      0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, NULL::text;
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
             AND NOT public.is_reserved_email_domain(ad.email)
             AND NOT EXISTS (SELECT 1 FROM public.global_email_suppression_list g
                              WHERE lower(trim(g.email)) = ad.email
                                AND g.lifted_at IS NULL
                                AND (g.expires_at IS NULL OR g.expires_at > now()))) AS deliverable,
           EXISTS (SELECT 1 FROM tenant_suppression ts WHERE ts.email = ad.email) AS suppressed,
           EXISTS (SELECT 1 FROM tenant_suppression ts
                    WHERE ts.email = ad.email AND ts.kind <> 'bounced') AS suppressed_after_soft_override,
           EXISTS (SELECT 1 FROM tenant_suppression ts
                    WHERE ts.email = ad.email
                      AND ts.kind IN ('unsubscribed', 'complaint', 'complained')) AS unsubscribed
      FROM addresses ad
  ),
  -- recipientEmailDedup: with consent respected, a shared address is dropped
  -- when any consenting record for it is suppressed.
  verdict AS (
    SELECT ch.*,
           (ch.consenting_records > 1 AND ch.consenting_record_suppressed) AS restricted,
           (ch.deliverable AND NOT ch.suppressed) AS passes,
           (ch.deliverable AND NOT ch.suppressed_after_soft_override) AS passes_soft
      FROM checked ch
  ),
  classified AS (
    SELECT sc.id, sc.email,
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
      v.passes_soft
    FROM scope sc
    JOIN verdict v ON v.email = sc.email
  )
  SELECT true,
         (SELECT count(*) FROM classified)::bigint,
         (SELECT count(*) FROM classified WHERE bucket = 'eligible')::bigint,
         (SELECT count(*) FROM classified WHERE bucket = 'waiting')::bigint,
         (SELECT count(*) FROM classified WHERE bucket = 'asked_to_stop')::bigint,
         (SELECT count(*) FROM classified WHERE bucket = 'never_opted_in')::bigint,
         (SELECT count(*) FROM classified WHERE bucket = 'unsendable')::bigint,
         (SELECT count(*) FROM classified WHERE bucket = 'duplicate')::bigint,
         (SELECT count(*) FROM classified WHERE NOT passes_soft)::bigint,
         (SELECT count(*) FROM verdict WHERE passes)::bigint,
         (SELECT count(*) FROM verdict
           WHERE consenting_records > 0 AND NOT restricted AND passes_soft)::bigint,
         (SELECT count(*) FROM verdict WHERE passes_soft)::bigint,
         CASE WHEN (SELECT count(*) FROM classified WHERE bucket = 'eligible') = 1
              THEN (SELECT min(email) FROM classified WHERE bucket = 'eligible')
         END;
END $$;

REVOKE ALL ON FUNCTION public.email_campaign_eligibility(uuid, boolean, uuid[], text[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_campaign_eligibility(uuid, boolean, uuid[], text[], uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.email_campaign_eligibility(uuid, boolean, uuid[], text[], uuid[]) IS
  'Counts an email campaign audience with the send-email-campaign delivery rule. See docs/email-eligibility.md.';
