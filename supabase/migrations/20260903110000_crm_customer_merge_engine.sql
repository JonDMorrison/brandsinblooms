-- A tenant-safe, reversible CRM customer merge primitive.
--
-- Merges are deliberately service-role only. Every moved reference is recorded
-- by primary key, uniqueness conflicts abort the entire transaction, and the
-- losing profile remains as a suppressed soft-deleted alias. Rollback also
-- fails closed if any tracked reference has changed since the merge.

ALTER TABLE public.crm_customers
  ADD COLUMN IF NOT EXISTS merged_into_customer_id uuid
    REFERENCES public.crm_customers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS crm_customers_merged_into_idx
  ON public.crm_customers (merged_into_customer_id)
  WHERE merged_into_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_customer_merge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  survivor_customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE RESTRICT,
  duplicate_customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE RESTRICT,
  suggestion_id uuid REFERENCES public.crm_customer_merge_suggestions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 1000),
  performed_by uuid,
  survivor_before jsonb NOT NULL,
  duplicate_before jsonb NOT NULL,
  moved_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  moved_reference_count integer NOT NULL DEFAULT 0 CHECK (moved_reference_count >= 0),
  removed_duplicate_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  removed_duplicate_row_count integer NOT NULL DEFAULT 0 CHECK (removed_duplicate_row_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  rolled_back_at timestamptz,
  rolled_back_by uuid,
  rollback_reason text,
  CONSTRAINT crm_customer_merge_distinct_customers
    CHECK (survivor_customer_id <> duplicate_customer_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_customer_merge_history_one_applied_duplicate
  ON public.crm_customer_merge_history (duplicate_customer_id)
  WHERE status = 'applied';

CREATE INDEX IF NOT EXISTS crm_customer_merge_history_tenant_created_idx
  ON public.crm_customer_merge_history (tenant_id, created_at DESC);

ALTER TABLE public.crm_customer_merge_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_customer_merge_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_customer_merge_history TO service_role;

CREATE OR REPLACE FUNCTION public.merge_crm_customers(
  p_tenant_id uuid,
  p_survivor_customer_id uuid,
  p_duplicate_customer_id uuid,
  p_reason text,
  p_suggestion_id uuid DEFAULT NULL,
  p_performed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survivor public.crm_customers%ROWTYPE;
  v_duplicate public.crm_customers%ROWTYPE;
  v_history_id uuid := gen_random_uuid();
  v_target record;
  v_pk_expr text;
  v_pk_columns text[];
  v_pk_rows jsonb;
  v_reference_log jsonb := '[]'::jsonb;
  v_discarded_log jsonb := '[]'::jsonb;
  v_discarded_row jsonb;
  v_discarded_batch jsonb;
  v_row_count integer;
  v_total_count integer := 0;
  v_email_blocked boolean;
  v_sms_blocked boolean;
BEGIN
  IF p_tenant_id IS NULL
     OR p_survivor_customer_id IS NULL
     OR p_duplicate_customer_id IS NULL
     OR p_survivor_customer_id = p_duplicate_customer_id THEN
    RAISE EXCEPTION 'tenant and two different customer ids are required';
  END IF;

  IF length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'merge reason must contain between 3 and 1000 characters';
  END IF;

  -- Serialize both directions of the same pair and lock in deterministic order.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':crm-merge:' ||
    least(p_survivor_customer_id, p_duplicate_customer_id)::text || ':' ||
    greatest(p_survivor_customer_id, p_duplicate_customer_id)::text,
    0
  ));

  PERFORM 1
  FROM public.crm_customers c
  WHERE c.id IN (p_survivor_customer_id, p_duplicate_customer_id)
  ORDER BY c.id
  FOR UPDATE;

  SELECT * INTO v_survivor
  FROM public.crm_customers
  WHERE id = p_survivor_customer_id;

  SELECT * INTO v_duplicate
  FROM public.crm_customers
  WHERE id = p_duplicate_customer_id;

  IF v_survivor.id IS NULL OR v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'both customers must exist';
  END IF;
  IF v_survivor.tenant_id <> p_tenant_id OR v_duplicate.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'customers must belong to the requested tenant';
  END IF;
  IF v_survivor.deleted_at IS NOT NULL OR v_survivor.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'survivor must be an active canonical customer';
  END IF;
  IF v_duplicate.deleted_at IS NOT NULL OR v_duplicate.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate must be an active unmerged customer';
  END IF;

  IF p_suggestion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.crm_customer_merge_suggestions s
    WHERE s.id = p_suggestion_id
      AND s.tenant_id = p_tenant_id
      AND s.status = 'open'
      AND s.candidate_customer_ids @> ARRAY[p_survivor_customer_id, p_duplicate_customer_id]
  ) THEN
    RAISE EXCEPTION 'open merge suggestion does not contain both customers';
  END IF;

  SELECT
    coalesce(v_survivor.opt_out, false)
      OR coalesce(v_duplicate.opt_out, false)
      OR coalesce(v_survivor.suppressed, false)
      OR coalesce(v_duplicate.suppressed, false)
      OR v_survivor.email_opt_out_at IS NOT NULL
      OR v_duplicate.email_opt_out_at IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.customer_consents cc
        WHERE cc.customer_id IN (p_survivor_customer_id, p_duplicate_customer_id)
          AND cc.channel = 'email' AND cc.status IN ('opted_out', 'suppressed')
      ),
    coalesce(v_survivor.opt_out, false)
      OR coalesce(v_duplicate.opt_out, false)
      OR v_survivor.sms_opt_out_at IS NOT NULL
      OR v_duplicate.sms_opt_out_at IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.customer_consents cc
        WHERE cc.customer_id IN (p_survivor_customer_id, p_duplicate_customer_id)
          AND cc.channel = 'sms' AND cc.status IN ('opted_out', 'suppressed')
      )
  INTO v_email_blocked, v_sms_blocked;

  INSERT INTO public.crm_customer_merge_history (
    id, tenant_id, survivor_customer_id, duplicate_customer_id,
    suggestion_id, reason, performed_by, survivor_before, duplicate_before
  ) VALUES (
    v_history_id, p_tenant_id, p_survivor_customer_id, p_duplicate_customer_id,
    p_suggestion_id, btrim(p_reason), p_performed_by,
    to_jsonb(v_survivor), to_jsonb(v_duplicate)
  );

  -- Customer creation currently seeds four derived, one-row metric records.
  -- Both profiles therefore collide even when the duplicate record has never
  -- had activity. Archive and remove only a provably inert duplicate row. Any
  -- real metric value is a manual-consolidation blocker, never silent data loss.
  IF EXISTS (
    SELECT 1 FROM public.customer_email_metrics m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      coalesce(m.total_sent, 0) <> 0 OR coalesce(m.total_delivered, 0) <> 0
      OR coalesce(m.total_opened, 0) <> 0 OR coalesce(m.total_clicked, 0) <> 0
      OR coalesce(m.total_bounced, 0) <> 0 OR coalesce(m.hard_bounces, 0) <> 0
      OR coalesce(m.soft_bounces, 0) <> 0 OR coalesce(m.total_unsubscribes, 0) <> 0
      OR coalesce(m.engagement_score, 0) <> 0 OR m.last_sent_at IS NOT NULL
      OR m.last_delivered_at IS NOT NULL OR m.last_opened_at IS NOT NULL
      OR m.last_clicked_at IS NOT NULL OR m.last_bounced_at IS NOT NULL
      OR m.avg_time_to_open_minutes IS NOT NULL OR m.avg_time_to_click_minutes IS NOT NULL
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty email metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_email_metrics
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_email_metrics) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_email_metrics', 'row', v_discarded_row
    ));
  END IF;

  -- Exact duplicate segment membership is one logical relationship. Keep the
  -- survivor's assignment and archive the redundant row for rollback.
  WITH removed AS (
    DELETE FROM public.customer_segments d
    WHERE d.customer_id = p_duplicate_customer_id
      AND EXISTS (
        SELECT 1 FROM public.customer_segments s
        WHERE s.customer_id = p_survivor_customer_id
          AND s.segment_id = d.segment_id
      )
    RETURNING d.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', 'public', 'table', 'customer_segments', 'row', to_jsonb(removed)
  )), '[]'::jsonb)
  INTO v_discarded_batch
  FROM removed;
  v_discarded_log := v_discarded_log || v_discarded_batch;

  IF EXISTS (
    SELECT 1 FROM public.customer_sms_metrics m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      coalesce(m.total_sent, 0) <> 0 OR coalesce(m.total_delivered, 0) <> 0
      OR coalesce(m.total_failed, 0) <> 0 OR coalesce(m.total_clicked, 0) <> 0
      OR coalesce(m.total_replied, 0) <> 0 OR coalesce(m.total_opt_outs, 0) <> 0
      OR coalesce(m.engagement_score, 0) <> 0 OR m.last_sent_at IS NOT NULL
      OR m.last_delivered_at IS NOT NULL OR m.last_clicked_at IS NOT NULL
      OR m.last_replied_at IS NOT NULL OR m.last_opt_out_at IS NOT NULL
      OR m.avg_time_to_response_minutes IS NOT NULL
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty SMS metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_sms_metrics
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_sms_metrics) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_sms_metrics', 'row', v_discarded_row
    ));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_engagement_summary m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      coalesce(m.email_score, 0) <> 0 OR coalesce(m.sms_score, 0) <> 0
      OR coalesce(m.purchase_score, 0) <> 0 OR coalesce(m.overall_engagement_score, 0) <> 0
      OR m.last_engagement_at IS NOT NULL OR coalesce(m.engagement_tier, 'cold') <> 'cold'
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty engagement metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_engagement_summary
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_engagement_summary) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_engagement_summary', 'row', v_discarded_row
    ));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_identity_metrics m
    WHERE m.customer_id = p_duplicate_customer_id AND (
      m.store_id IS NOT NULL OR m.store_name IS NOT NULL OR m.city IS NOT NULL
      OR m.state_region IS NOT NULL OR m.postal_code IS NOT NULL
      OR m.lat IS NOT NULL OR m.lon IS NOT NULL OR m.signup_source IS NOT NULL
      OR m.signup_campaign IS NOT NULL OR m.signup_referrer_id IS NOT NULL
      OR coalesce(m.timezone, 'America/New_York') <> 'America/New_York'
      OR coalesce(m.country_code, 'US') <> 'US'
      OR coalesce(m.preferred_channel, 'none') <> 'none'
    )
  ) THEN RAISE EXCEPTION 'duplicate has non-empty identity metrics; consolidate before merging';
  END IF;

  DELETE FROM public.customer_identity_metrics
  WHERE customer_id = p_duplicate_customer_id
  RETURNING to_jsonb(customer_identity_metrics) INTO v_discarded_row;
  IF v_discarded_row IS NOT NULL THEN
    v_discarded_log := v_discarded_log || jsonb_build_array(jsonb_build_object(
      'schema', 'public', 'table', 'customer_identity_metrics', 'row', v_discarded_row
    ));
  END IF;

  -- Discover every real FK plus the explicitly-audited legacy UUID references.
  -- The history table is excluded so prior merge audit records remain immutable.
  FOR v_target IN
    WITH fk_targets AS (
      SELECT DISTINCT n.nspname AS schema_name, c.relname AS table_name,
        a.attname AS column_name, c.oid AS relid
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN unnest(con.conkey) k(attnum) ON true
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.crm_customers'::regclass
        AND c.relname <> 'crm_customer_merge_history'
    ), legacy_targets(schema_name, table_name, column_name) AS (
      VALUES
        ('public', 'analytics_events', 'contact_id'),
        ('public', 'campaign_attribution', 'contact_id'),
        ('public', 'crm_automation_logs', 'customer_id'),
        ('public', 'crm_outbox', 'customer_id'),
        ('public', 'crm_subscriptions', 'customer_id'),
        ('public', 'email_governance_email_events', 'customer_id'),
        ('public', 'import_job_items', 'mapped_customer_id')
    )
    SELECT schema_name, table_name, column_name, relid
    FROM fk_targets
    UNION
    SELECT l.schema_name, l.table_name, l.column_name, c.oid
    FROM legacy_targets l
    JOIN pg_namespace n ON n.nspname = l.schema_name
    JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = l.table_name
    JOIN pg_attribute a ON a.attrelid = c.oid
      AND a.attname = l.column_name AND NOT a.attisdropped
    ORDER BY 1, 2, 3
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      v_target.schema_name, v_target.table_name, v_target.column_name
    ) INTO v_row_count USING p_duplicate_customer_id;

    CONTINUE WHEN v_row_count = 0;

    SELECT array_agg(a.attname ORDER BY key_column.ordinality),
      string_agg(format('%L, t.%I', a.attname, a.attname), ', ' ORDER BY key_column.ordinality)
    INTO v_pk_columns, v_pk_expr
    FROM pg_index i
    JOIN unnest(i.indkey::smallint[]) WITH ORDINALITY key_column(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = key_column.attnum
    WHERE i.indrelid = v_target.relid AND i.indisprimary;

    IF v_pk_columns IS NULL THEN
      RAISE EXCEPTION 'cannot safely merge %.%: referenced rows have no primary key',
        v_target.table_name, v_target.column_name;
    END IF;

    EXECUTE format(
      'SELECT coalesce(jsonb_agg(jsonb_build_object(%s)), ''[]''::jsonb) '
      'FROM %I.%I t WHERE %I = $1',
      v_pk_expr, v_target.schema_name, v_target.table_name, v_target.column_name
    ) INTO v_pk_rows USING p_duplicate_customer_id;

    IF jsonb_array_length(v_pk_rows) <> v_row_count THEN
      RAISE EXCEPTION 'reference snapshot mismatch for %.%',
        v_target.table_name, v_target.column_name;
    END IF;

    v_reference_log := v_reference_log || jsonb_build_array(jsonb_build_object(
      'schema', v_target.schema_name,
      'table', v_target.table_name,
      'column', v_target.column_name,
      'primary_key_columns', to_jsonb(v_pk_columns),
      'rows', v_pk_rows
    ));
    v_total_count := v_total_count + v_row_count;

    IF v_total_count > 100000 THEN
      RAISE EXCEPTION 'merge exceeds the 100000-reference safety limit';
    END IF;

    -- A uniqueness violation intentionally aborts and rolls back the whole merge.
    EXECUTE format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      v_target.schema_name, v_target.table_name, v_target.column_name,
      v_target.column_name
    ) USING p_survivor_customer_id, p_duplicate_customer_id;
  END LOOP;

  UPDATE public.crm_customers s
  SET first_name = coalesce(nullif(s.first_name, ''), nullif(v_duplicate.first_name, '')),
      last_name = coalesce(nullif(s.last_name, ''), nullif(v_duplicate.last_name, '')),
      phone = coalesce(nullif(s.phone, ''), nullif(v_duplicate.phone, '')),
      user_id = coalesce(s.user_id, v_duplicate.user_id),
      tags = ARRAY(
        SELECT DISTINCT value FROM unnest(
          coalesce(s.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])
        ) value WHERE value IS NOT NULL AND value <> ''
      ),
      product_tags = ARRAY(
        SELECT DISTINCT value FROM unnest(
          coalesce(s.product_tags, '{}'::text[]) || coalesce(v_duplicate.product_tags, '{}'::text[])
        ) value WHERE value IS NOT NULL AND value <> ''
      ),
      custom_fields = coalesce(v_duplicate.custom_fields, '{}'::jsonb)
        || coalesce(s.custom_fields, '{}'::jsonb),
      order_history = (
        SELECT coalesce(jsonb_agg(DISTINCT value), '[]'::jsonb)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(s.order_history) = 'array' THEN s.order_history ELSE '[]'::jsonb END
          || CASE WHEN jsonb_typeof(v_duplicate.order_history) = 'array' THEN v_duplicate.order_history ELSE '[]'::jsonb END
        ) value
      ),
      persona = coalesce(nullif(s.persona, ''), nullif(v_duplicate.persona, '')),
      persona_id = coalesce(s.persona_id, v_duplicate.persona_id),
      store_id = coalesce(nullif(s.store_id, ''), nullif(v_duplicate.store_id, '')),
      store_name = coalesce(nullif(s.store_name, ''), nullif(v_duplicate.store_name, '')),
      city = coalesce(nullif(s.city, ''), nullif(v_duplicate.city, '')),
      state_region = coalesce(nullif(s.state_region, ''), nullif(v_duplicate.state_region, '')),
      postal_code = coalesce(nullif(s.postal_code, ''), nullif(v_duplicate.postal_code, '')),
      lat = coalesce(s.lat, v_duplicate.lat),
      lon = coalesce(s.lon, v_duplicate.lon),
      signup_source = coalesce(nullif(s.signup_source, ''), nullif(v_duplicate.signup_source, '')),
      signup_campaign = coalesce(nullif(s.signup_campaign, ''), nullif(v_duplicate.signup_campaign, '')),
      signup_referrer_id = coalesce(s.signup_referrer_id, v_duplicate.signup_referrer_id),
      first_purchase_date = least(s.first_purchase_date, v_duplicate.first_purchase_date),
      last_purchase_date = greatest(s.last_purchase_date, v_duplicate.last_purchase_date),
      last_visit_date = greatest(s.last_visit_date, v_duplicate.last_visit_date),
      lifetime_value = greatest(coalesce(s.lifetime_value, 0), coalesce(v_duplicate.lifetime_value, 0)),
      total_spent = greatest(coalesce(s.total_spent, 0), coalesce(v_duplicate.total_spent, 0)),
      pos_total_spent = greatest(coalesce(s.pos_total_spent, 0), coalesce(v_duplicate.pos_total_spent, 0)),
      pos_order_count = greatest(coalesce(s.pos_order_count, 0), coalesce(v_duplicate.pos_order_count, 0)),
      loyalty_member = coalesce(s.loyalty_member, false) OR coalesce(v_duplicate.loyalty_member, false),
      loyalty_rewards_balance = greatest(
        coalesce(s.loyalty_rewards_balance, 0), coalesce(v_duplicate.loyalty_rewards_balance, 0)
      ),
      is_vip = coalesce(s.is_vip, false) OR coalesce(v_duplicate.is_vip, false),
      opt_out = coalesce(s.opt_out, false) OR coalesce(v_duplicate.opt_out, false),
      suppressed = coalesce(s.suppressed, false) OR coalesce(v_duplicate.suppressed, false),
      suppressed_at = CASE WHEN coalesce(s.suppressed, false) OR coalesce(v_duplicate.suppressed, false)
        THEN coalesce(greatest(s.suppressed_at, v_duplicate.suppressed_at), now()) ELSE NULL END,
      suppressed_reason = CASE WHEN coalesce(s.suppressed, false) OR coalesce(v_duplicate.suppressed, false)
        THEN coalesce(s.suppressed_reason, v_duplicate.suppressed_reason, 'merged_consent_safety') ELSE NULL END,
      email_opt_in = (coalesce(s.email_opt_in, false) OR coalesce(v_duplicate.email_opt_in, false))
        AND NOT v_email_blocked,
      sms_opt_in = (coalesce(s.sms_opt_in, false) OR coalesce(v_duplicate.sms_opt_in, false))
        AND NOT v_sms_blocked,
      email_opt_in_at = greatest(s.email_opt_in_at, v_duplicate.email_opt_in_at),
      sms_opt_in_at = greatest(s.sms_opt_in_at, v_duplicate.sms_opt_in_at),
      email_consent_source = coalesce(s.email_consent_source, v_duplicate.email_consent_source),
      email_consent_ip = coalesce(s.email_consent_ip, v_duplicate.email_consent_ip),
      email_consent_method = coalesce(s.email_consent_method, v_duplicate.email_consent_method),
      email_consent_details = coalesce(s.email_consent_details, v_duplicate.email_consent_details),
      sms_consent_source = coalesce(s.sms_consent_source, v_duplicate.sms_consent_source),
      sms_consent_ip = coalesce(s.sms_consent_ip, v_duplicate.sms_consent_ip),
      sms_consent_method = coalesce(s.sms_consent_method, v_duplicate.sms_consent_method),
      sms_consent_details = coalesce(s.sms_consent_details, v_duplicate.sms_consent_details),
      email_opt_out_at = greatest(s.email_opt_out_at, v_duplicate.email_opt_out_at),
      sms_opt_out_at = greatest(s.sms_opt_out_at, v_duplicate.sms_opt_out_at),
      email_consent = CASE
        WHEN v_email_blocked THEN false
        WHEN coalesce(s.email_consent, false) OR coalesce(v_duplicate.email_consent, false) THEN true
        ELSE NULL END,
      sms_consent = CASE
        WHEN v_sms_blocked THEN false
        WHEN coalesce(s.sms_consent, false) OR coalesce(v_duplicate.sms_consent, false) THEN true
        ELSE NULL END,
      last_open_at = greatest(s.last_open_at, v_duplicate.last_open_at),
      last_email_sent_at = greatest(s.last_email_sent_at, v_duplicate.last_email_sent_at),
      last_email_delivered_at = greatest(s.last_email_delivered_at, v_duplicate.last_email_delivered_at),
      last_email_clicked_at = greatest(s.last_email_clicked_at, v_duplicate.last_email_clicked_at),
      last_email_bounced_at = greatest(s.last_email_bounced_at, v_duplicate.last_email_bounced_at),
      total_emails_sent = greatest(coalesce(s.total_emails_sent, 0), coalesce(v_duplicate.total_emails_sent, 0)),
      total_emails_delivered = greatest(coalesce(s.total_emails_delivered, 0), coalesce(v_duplicate.total_emails_delivered, 0)),
      total_emails_opened = greatest(coalesce(s.total_emails_opened, 0), coalesce(v_duplicate.total_emails_opened, 0)),
      total_emails_clicked = greatest(coalesce(s.total_emails_clicked, 0), coalesce(v_duplicate.total_emails_clicked, 0)),
      total_emails_bounced = greatest(coalesce(s.total_emails_bounced, 0), coalesce(v_duplicate.total_emails_bounced, 0)),
      total_soft_bounces = greatest(coalesce(s.total_soft_bounces, 0), coalesce(v_duplicate.total_soft_bounces, 0)),
      total_hard_bounces = greatest(coalesce(s.total_hard_bounces, 0), coalesce(v_duplicate.total_hard_bounces, 0)),
      total_unsubscribes = greatest(coalesce(s.total_unsubscribes, 0), coalesce(v_duplicate.total_unsubscribes, 0)),
      updated_at = now()
  WHERE s.id = p_survivor_customer_id;

  UPDATE public.crm_customers
  SET merged_into_customer_id = p_survivor_customer_id,
      deleted_at = now(),
      opt_out = true,
      email_opt_in = false,
      sms_opt_in = false,
      suppressed = true,
      suppressed_at = now(),
      suppressed_reason = 'merged_duplicate',
      updated_at = now()
  WHERE id = p_duplicate_customer_id;

  UPDATE public.crm_customer_merge_history
  SET moved_references = v_reference_log,
      moved_reference_count = v_total_count,
      removed_duplicate_rows = v_discarded_log,
      removed_duplicate_row_count = jsonb_array_length(v_discarded_log)
  WHERE id = v_history_id;

  IF p_suggestion_id IS NOT NULL THEN
    UPDATE public.crm_customer_merge_suggestions
    SET status = 'merged',
        resolution = jsonb_build_object(
          'history_id', v_history_id,
          'survivor_customer_id', p_survivor_customer_id,
          'duplicate_customer_id', p_duplicate_customer_id,
          'reason', btrim(p_reason)
        ),
        resolved_by = p_performed_by,
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_suggestion_id;
  END IF;

  RETURN jsonb_build_object(
    'history_id', v_history_id,
    'survivor_customer_id', p_survivor_customer_id,
    'duplicate_customer_id', p_duplicate_customer_id,
    'moved_reference_count', v_total_count,
    'status', 'applied'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_crm_customer_merge(
  p_history_id uuid,
  p_reason text,
  p_performed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_history public.crm_customer_merge_history%ROWTYPE;
  v_reference jsonb;
  v_discarded jsonb;
  v_pk jsonb;
  v_pk_column text;
  v_where text;
  v_set_clause text;
  v_updated integer;
  v_changed integer;
  v_expected integer;
  v_rolled_back integer := 0;
BEGIN
  IF length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'rollback reason must contain between 3 and 1000 characters';
  END IF;

  SELECT * INTO v_history
  FROM public.crm_customer_merge_history
  WHERE id = p_history_id
  FOR UPDATE;

  IF v_history.id IS NULL THEN
    RAISE EXCEPTION 'merge history not found';
  END IF;
  IF v_history.status <> 'applied' THEN
    RAISE EXCEPTION 'only an applied merge can be rolled back';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_history.tenant_id::text || ':crm-merge:' ||
    least(v_history.survivor_customer_id, v_history.duplicate_customer_id)::text || ':' ||
    greatest(v_history.survivor_customer_id, v_history.duplicate_customer_id)::text,
    0
  ));

  PERFORM 1 FROM public.crm_customers
  WHERE id IN (v_history.survivor_customer_id, v_history.duplicate_customer_id)
  ORDER BY id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_customers
    WHERE id = v_history.duplicate_customer_id
      AND merged_into_customer_id = v_history.survivor_customer_id
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'duplicate alias no longer matches this merge';
  END IF;

  -- Restore customer rows first so both valid FK targets are active again.
  SELECT string_agg(format('%I = r.%I', a.attname, a.attname), ', ' ORDER BY a.attnum)
  INTO v_set_clause
  FROM pg_attribute a
  WHERE a.attrelid = 'public.crm_customers'::regclass
    AND a.attnum > 0 AND NOT a.attisdropped AND a.attname <> 'id';

  EXECUTE format(
    'UPDATE public.crm_customers c SET %s '
    'FROM jsonb_populate_record(NULL::public.crm_customers, $1) r WHERE c.id = $2',
    v_set_clause
  ) USING v_history.duplicate_before, v_history.duplicate_customer_id;

  -- Recreate the exact inert derived rows removed to avoid unique collisions.
  FOR v_discarded IN SELECT value FROM jsonb_array_elements(v_history.removed_duplicate_rows)
  LOOP
    EXECUTE format(
      'INSERT INTO %I.%I SELECT * FROM jsonb_populate_record(NULL::%I.%I, $1)',
      v_discarded->>'schema', v_discarded->>'table',
      v_discarded->>'schema', v_discarded->>'table'
    ) USING v_discarded->'row';
  END LOOP;

  -- A changed/deleted tracked row aborts rollback rather than producing a split identity.
  FOR v_reference IN SELECT value FROM jsonb_array_elements(v_history.moved_references)
  LOOP
    v_expected := jsonb_array_length(v_reference->'rows');
    v_updated := 0;

    FOR v_pk IN SELECT value FROM jsonb_array_elements(v_reference->'rows')
    LOOP
      v_where := '';
      FOR v_pk_column IN SELECT jsonb_array_elements_text(v_reference->'primary_key_columns')
      LOOP
        v_where := v_where || CASE WHEN v_where = '' THEN '' ELSE ' AND ' END ||
          format('to_jsonb(t.%I) = $3->%L', v_pk_column, v_pk_column);
      END LOOP;

      EXECUTE format(
        'UPDATE %I.%I t SET %I = $1 WHERE %I = $2 AND %s',
        v_reference->>'schema', v_reference->>'table', v_reference->>'column',
        v_reference->>'column', v_where
      ) USING v_history.duplicate_customer_id, v_history.survivor_customer_id, v_pk;

      GET DIAGNOSTICS v_changed = ROW_COUNT;
      v_updated := v_updated + v_changed;
    END LOOP;

    IF v_updated <> v_expected THEN
      RAISE EXCEPTION 'rollback blocked: tracked references changed in %.%',
        v_reference->>'table', v_reference->>'column';
    END IF;
    v_rolled_back := v_rolled_back + v_updated;
  END LOOP;

  EXECUTE format(
    'UPDATE public.crm_customers c SET %s '
    'FROM jsonb_populate_record(NULL::public.crm_customers, $1) r WHERE c.id = $2',
    v_set_clause
  ) USING v_history.survivor_before, v_history.survivor_customer_id;

  IF v_history.suggestion_id IS NOT NULL THEN
    UPDATE public.crm_customer_merge_suggestions
    SET status = 'open', resolution = NULL, resolved_by = NULL,
        resolved_at = NULL, updated_at = now()
    WHERE id = v_history.suggestion_id
      AND status = 'merged'
      AND resolution->>'history_id' = p_history_id::text;
  END IF;

  UPDATE public.crm_customer_merge_history
  SET status = 'rolled_back', rolled_back_at = now(),
      rolled_back_by = p_performed_by, rollback_reason = btrim(p_reason)
  WHERE id = p_history_id;

  RETURN jsonb_build_object(
    'history_id', p_history_id,
    'restored_reference_count', v_rolled_back,
    'status', 'rolled_back'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_crm_customers(uuid, uuid, uuid, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollback_crm_customer_merge(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_crm_customers(uuid, uuid, uuid, text, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_crm_customer_merge(uuid, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.merge_crm_customers(uuid, uuid, uuid, text, uuid, uuid) IS
  'Moves all audited customer references to a canonical profile. Uniqueness conflicts abort atomically.';
COMMENT ON FUNCTION public.rollback_crm_customer_merge(uuid, text, uuid) IS
  'Restores a customer merge only when every tracked reference is unchanged.';
