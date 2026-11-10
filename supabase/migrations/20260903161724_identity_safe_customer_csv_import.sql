-- CSV imports must use the same normalized email/phone identity layer as POS
-- syncs. Each batch is atomic per row, suppression-aware, and writes consent
-- evidence in the same transaction as the customer update.

CREATE OR REPLACE FUNCTION public.begin_customer_csv_import(
  p_attestation_type text,
  p_contact_count integer,
  p_import_batch_id text,
  p_attestation_wording text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_access jsonb;
  v_tenant_id uuid;
  v_role text;
  v_attestation_id uuid;
  v_type text := lower(btrim(coalesce(p_attestation_type, '')));
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_access := public.get_current_crm_access();
  v_tenant_id := (v_access->>'tenantId')::uuid;
  v_role := v_access->>'role';

  IF v_role NOT IN ('owner_admin', 'marketing') THEN
    RAISE EXCEPTION 'Customer imports require owner or marketing access'
      USING ERRCODE = '42501';
  END IF;

  IF v_type NOT IN ('express', 'unsure', 'implied')
     OR p_contact_count IS NULL OR p_contact_count < 0
     OR nullif(btrim(coalesce(p_attestation_wording, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Valid consent attestation details are required';
  END IF;

  INSERT INTO public.consent_attestations (
    tenant_id, attested_by_user_id, attestation_type, contact_count,
    source, import_batch_id, attestation_wording
  ) VALUES (
    v_tenant_id, v_actor, v_type, p_contact_count,
    'csv_import', nullif(btrim(p_import_batch_id), ''), p_attestation_wording
  )
  RETURNING id INTO v_attestation_id;

  RETURN jsonb_build_object(
    'attestationId', v_attestation_id,
    'tenantId', v_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_crm_customer_batch(
  p_customers jsonb,
  p_attestation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_access jsonb;
  v_tenant_id uuid;
  v_role text;
  v_attestation_type text;
  v_item jsonb;
  v_row_number integer := 0;
  v_imported integer := 0;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_customers jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_email text;
  v_phone text;
  v_external_id text;
  v_identity jsonb;
  v_customer_id uuid;
  v_created boolean;
  v_customer public.crm_customers%ROWTYPE;
  v_email_explicit boolean;
  v_sms_explicit boolean;
  v_requested_email_opt_in boolean;
  v_requested_sms_opt_in boolean;
  v_email_protected boolean;
  v_sms_protected boolean;
  v_effective_email_opt_in boolean;
  v_effective_sms_opt_in boolean;
  v_email_source text;
  v_email_method text;
  v_now timestamptz;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_customers) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_customers) = 0
     OR jsonb_array_length(p_customers) > 500 THEN
    RAISE EXCEPTION 'Customer batch must contain between 1 and 500 rows';
  END IF;

  v_access := public.get_current_crm_access();
  v_tenant_id := (v_access->>'tenantId')::uuid;
  v_role := v_access->>'role';

  IF v_role NOT IN ('owner_admin', 'marketing') THEN
    RAISE EXCEPTION 'Customer imports require owner or marketing access'
      USING ERRCODE = '42501';
  END IF;

  SELECT attestation.attestation_type
  INTO v_attestation_type
  FROM public.consent_attestations AS attestation
  WHERE attestation.id = p_attestation_id
    AND attestation.tenant_id = v_tenant_id
    AND attestation.attested_by_user_id = v_actor;

  IF v_attestation_type IS NULL THEN
    RAISE EXCEPTION 'Import attestation not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_customers)
  LOOP
    v_row_number := v_row_number + 1;
    BEGIN
      v_now := statement_timestamp();
      v_email := public.normalize_customer_email(v_item->>'email');
      v_phone := public.normalize_customer_phone(v_item->>'phone');

      IF v_email IS NULL THEN
        RAISE EXCEPTION 'A valid email is required';
      END IF;

      v_external_id := nullif(btrim(v_item->>'external_id'), '');
      v_identity := public.resolve_crm_customer_identity(
        v_tenant_id,
        'csv_import',
        CASE
          WHEN v_external_id IS NOT NULL THEN 'external:' || v_external_id
          ELSE 'email:' || v_email
        END,
        NULL,
        NULL,
        v_email,
        v_phone,
        v_actor,
        '{}'::jsonb
      );

      v_customer_id := nullif(v_identity->>'customer_id', '')::uuid;
      IF v_customer_id IS NULL THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'email', v_email,
          'message', 'Identity is ambiguous; review the generated merge suggestion'
        ));
        CONTINUE;
      END IF;

      IF coalesce(v_identity->>'match_method', '') LIKE '%conflict%' THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'email', v_email,
          'message', 'Email and phone identify different customers; review the generated merge suggestion'
        ));
        CONTINUE;
      END IF;

      v_created := coalesce((v_identity->>'created')::boolean, false);

      SELECT customer.*
      INTO v_customer
      FROM public.crm_customers AS customer
      WHERE customer.id = v_customer_id
        AND customer.tenant_id = v_tenant_id
      FOR UPDATE;

      v_email_explicit := coalesce(
        (v_item->>'email_opt_in_explicit')::boolean,
        false
      );
      v_sms_explicit := coalesce(
        (v_item->>'sms_opt_in_explicit')::boolean,
        false
      );
      v_requested_email_opt_in := coalesce(
        (v_item->>'email_opt_in')::boolean,
        false
      );
      v_requested_sms_opt_in := coalesce(
        (v_item->>'sms_opt_in')::boolean,
        false
      );

      v_email_protected := v_customer.email_opt_out_at IS NOT NULL OR EXISTS (
        SELECT 1
        FROM public.suppression_list AS suppression
        WHERE suppression.tenant_id = v_tenant_id
          AND suppression.channel = 'email'
          AND suppression.lifted_at IS NULL
          AND lower(btrim(suppression.email)) = v_email
      ) OR EXISTS (
        SELECT 1
        FROM public.global_email_suppression_list AS suppression
        WHERE suppression.lifted_at IS NULL
          AND lower(btrim(suppression.email)) = v_email
      );

      v_sms_protected := v_customer.sms_opt_out_at IS NOT NULL OR (
        v_phone IS NOT NULL AND EXISTS (
          SELECT 1
          FROM public.suppression_list AS suppression
          WHERE suppression.tenant_id = v_tenant_id
            AND suppression.channel = 'sms'
            AND suppression.lifted_at IS NULL
            AND (
              suppression.customer_id = v_customer_id
              OR public.normalize_customer_phone(suppression.phone) = v_phone
            )
        )
      );

      v_effective_email_opt_in := CASE
        WHEN v_email_protected THEN false
        WHEN v_email_explicit THEN v_requested_email_opt_in
        WHEN v_created THEN v_attestation_type IN ('express', 'implied')
        WHEN v_attestation_type = 'unsure' THEN coalesce(v_customer.email_opt_in, false)
        ELSE true
      END;

      v_effective_sms_opt_in := CASE
        WHEN NOT v_sms_explicit THEN coalesce(v_customer.sms_opt_in, false)
        WHEN v_sms_protected THEN false
        ELSE v_requested_sms_opt_in
      END;

      v_email_source := CASE
        WHEN v_email_protected THEN coalesce(v_customer.email_consent_source, 'suppression_list')
        WHEN v_email_explicit THEN 'csv_import'
        WHEN NOT v_created AND v_attestation_type = 'unsure'
          THEN coalesce(v_customer.email_consent_source, 'csv_import')
        WHEN v_attestation_type IN ('express', 'implied') THEN 'import_attested'
        ELSE 'csv_import'
      END;

      v_email_method := CASE
        WHEN v_email_protected THEN coalesce(v_customer.email_consent_method, 'suppressed')
        WHEN v_email_explicit AND NOT v_requested_email_opt_in THEN 'imported_unsubscribed'
        WHEN v_email_explicit AND v_requested_email_opt_in THEN 'imported_explicit_field'
        WHEN NOT v_created AND v_attestation_type = 'unsure'
          THEN coalesce(v_customer.email_consent_method, 'pending_confirmation')
        WHEN v_attestation_type = 'express' THEN 'owner_attested_express'
        WHEN v_attestation_type = 'implied' THEN 'owner_attested_implied'
        ELSE 'pending_confirmation'
      END;

      UPDATE public.crm_customers AS customer
      SET first_name = coalesce(nullif(btrim(v_item->>'first_name'), ''), customer.first_name),
          last_name = coalesce(nullif(btrim(v_item->>'last_name'), ''), customer.last_name),
          lifetime_value = coalesce(nullif(v_item->>'lifetime_value', '')::numeric, customer.lifetime_value),
          first_purchase_date = coalesce(nullif(v_item->>'first_purchase_date', '')::date, customer.first_purchase_date),
          last_purchase_date = coalesce(nullif(v_item->>'last_purchase_date', '')::date, customer.last_purchase_date),
          external_id = coalesce(v_external_id, customer.external_id),
          persona = coalesce(nullif(btrim(v_item->>'persona'), ''), customer.persona),
          tags = CASE
            WHEN jsonb_typeof(v_item->'tags') = 'array' THEN ARRAY(
              SELECT DISTINCT tag
              FROM unnest(coalesce(customer.tags, ARRAY[]::text[]) ||
                ARRAY(SELECT jsonb_array_elements_text(v_item->'tags'))) AS tag
              WHERE nullif(btrim(tag), '') IS NOT NULL
              ORDER BY tag
            )
            ELSE customer.tags
          END,
          custom_fields = coalesce(customer.custom_fields, '{}'::jsonb) ||
            CASE WHEN jsonb_typeof(v_item->'custom_fields') = 'object'
              THEN v_item->'custom_fields' ELSE '{}'::jsonb END,
          email_opt_in = v_effective_email_opt_in,
          email_consent = v_effective_email_opt_in,
          email_opt_in_at = CASE
            WHEN v_effective_email_opt_in THEN coalesce(
              nullif(v_item->>'email_opt_in_at', '')::timestamptz,
              customer.email_opt_in_at,
              v_now
            )
            ELSE customer.email_opt_in_at
          END,
          email_opt_out_at = CASE
            WHEN v_email_explicit AND NOT v_requested_email_opt_in THEN v_now
            ELSE customer.email_opt_out_at
          END,
          email_consent_source = v_email_source,
          email_consent_method = v_email_method,
          sms_opt_in = v_effective_sms_opt_in,
          sms_consent = v_effective_sms_opt_in,
          sms_opt_in_at = CASE
            WHEN v_sms_explicit AND v_effective_sms_opt_in
              THEN coalesce(customer.sms_opt_in_at, v_now)
            ELSE customer.sms_opt_in_at
          END,
          sms_opt_out_at = CASE
            WHEN v_sms_explicit AND NOT v_requested_sms_opt_in THEN v_now
            ELSE customer.sms_opt_out_at
          END,
          updated_at = v_now
      WHERE customer.id = v_customer_id
        AND customer.tenant_id = v_tenant_id;

      IF v_email_explicit AND NOT v_requested_email_opt_in THEN
        INSERT INTO public.suppression_list (
          tenant_id, customer_id, email, suppression_type, channel,
          reason, auto_suppressed, suppressed_at, lifted_at, updated_at
        ) VALUES (
          v_tenant_id, v_customer_id, v_email, 'unsubscribed', 'email',
          'csv_import_unsubscribed', false, v_now, NULL, v_now
        )
        ON CONFLICT (tenant_id, email, channel, suppression_type)
        DO UPDATE SET customer_id = excluded.customer_id,
          reason = excluded.reason, auto_suppressed = false,
          suppressed_at = v_now, lifted_at = NULL, lifted_by = NULL,
          updated_at = v_now;
      END IF;

      IF v_sms_explicit AND NOT v_requested_sms_opt_in AND v_phone IS NOT NULL THEN
        INSERT INTO public.suppression_list (
          tenant_id, customer_id, phone, suppression_type, channel,
          reason, auto_suppressed, suppressed_at, lifted_at, updated_at
        ) VALUES (
          v_tenant_id, v_customer_id, v_phone, 'unsubscribed', 'sms',
          'csv_import_unsubscribed', false, v_now, NULL, v_now
        )
        ON CONFLICT (tenant_id, phone, channel, suppression_type)
          WHERE phone IS NOT NULL
        DO UPDATE SET customer_id = excluded.customer_id,
          reason = excluded.reason, auto_suppressed = false,
          suppressed_at = v_now, lifted_at = NULL, lifted_by = NULL,
          updated_at = v_now;
      END IF;

      INSERT INTO public.crm_email_consent_events (
        tenant_id, customer_id, email, event_type, source,
        actor_user_id, consent_basis, attestation_id, evidence
      ) VALUES (
        v_tenant_id, v_customer_id, v_email,
        CASE v_attestation_type
          WHEN 'express' THEN 'imported_attested_express'
          WHEN 'implied' THEN 'imported_attested_implied'
          ELSE 'imported_attested_unsure'
        END,
        CASE WHEN v_attestation_type = 'unsure'
          THEN 'csv_import_pending' ELSE 'import_attested' END,
        v_actor,
        CASE
          WHEN NOT v_effective_email_opt_in THEN NULL
          WHEN v_attestation_type IN ('express', 'implied') THEN v_attestation_type
          ELSE 'express'
        END,
        p_attestation_id,
        jsonb_build_object(
          'created', v_created,
          'explicit_csv_value', v_email_explicit,
          'suppression_protected', v_email_protected,
          'effective_opt_in', v_effective_email_opt_in
        )
      );

      INSERT INTO public.customer_consents (
        customer_id, channel, status, consent_timestamp, created_at, updated_at
      ) VALUES (
        v_customer_id, 'email',
        CASE WHEN v_effective_email_opt_in THEN 'opted_in' ELSE 'opted_out' END,
        v_now, v_now, v_now
      )
      ON CONFLICT (customer_id, channel) DO UPDATE
      SET status = excluded.status,
          consent_timestamp = excluded.consent_timestamp,
          updated_at = v_now;

      IF v_sms_explicit AND v_phone IS NOT NULL THEN
        INSERT INTO public.crm_sms_consent_events (
          tenant_id, customer_id, phone, event_type, source,
          actor_user_id, consent_basis, evidence
        ) VALUES (
          v_tenant_id, v_customer_id, v_phone,
          CASE WHEN v_effective_sms_opt_in THEN 'opt_in' ELSE 'opt_out' END,
          'csv_import', v_actor,
          CASE WHEN v_effective_sms_opt_in THEN 'express' ELSE 'revoked' END,
          jsonb_build_object(
            'explicit_csv_value', true,
            'suppression_protected', v_sms_protected,
            'effective_opt_in', v_effective_sms_opt_in,
            'attestation_id', p_attestation_id
          )
        );

        INSERT INTO public.customer_consents (
          customer_id, channel, status, consent_timestamp, created_at, updated_at
        ) VALUES (
          v_customer_id, 'sms',
          CASE WHEN v_effective_sms_opt_in THEN 'opted_in' ELSE 'opted_out' END,
          v_now, v_now, v_now
        )
        ON CONFLICT (customer_id, channel) DO UPDATE
        SET status = excluded.status,
            consent_timestamp = excluded.consent_timestamp,
            updated_at = v_now;
      END IF;

      v_imported := v_imported + 1;
      IF v_created THEN
        v_created_count := v_created_count + 1;
      ELSE
        v_updated_count := v_updated_count + 1;
      END IF;
      v_customers := v_customers || jsonb_build_array(jsonb_build_object(
        'id', v_customer_id,
        'email', v_email,
        'created', v_created,
        'matchMethod', v_identity->>'match_method',
        'consentProtected', v_email_protected OR v_sms_protected
      ));
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number,
        'email', coalesce(v_email, v_item->>'email'),
        'message', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'total', jsonb_array_length(p_customers),
    'imported', v_imported,
    'created', v_created_count,
    'updated', v_updated_count,
    'customers', v_customers,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_customer_csv_import(text, integer, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_customer_csv_import(text, integer, text, text)
TO authenticated;

REVOKE ALL ON FUNCTION public.import_crm_customer_batch(jsonb, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_crm_customer_batch(jsonb, uuid)
TO authenticated;

COMMENT ON FUNCTION public.import_crm_customer_batch(jsonb, uuid) IS
  'Identity-safe, suppression-preserving CSV customer import with atomic consent evidence.';
