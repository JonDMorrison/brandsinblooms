-- VMX customers use the shared POS connection/customer tables. Resolve every
-- immutable VMX customer number through that ledger, including customers with
-- no email, while keeping marketing consent entirely untouched.

CREATE OR REPLACE FUNCTION public.resolve_vmx_customer_identity_batch(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_user_id uuid,
  p_customers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_connection public.pos_connections%ROWTYPE;
  v_customer jsonb;
  v_pos_customer_id uuid;
  v_crm_customer_id uuid;
  v_tags text[];
  v_total integer := 0;
  v_resolved integer := 0;
  v_ambiguous integer := 0;
  v_failed integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_customers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'customers must be a JSON array';
  END IF;

  SELECT * INTO v_connection
  FROM public.pos_connections
  WHERE id = p_connection_id
    AND tenant_id = p_tenant_id
    AND platform = 'vmx';

  IF v_connection.id IS NULL THEN
    RAISE EXCEPTION 'VMX connection does not belong to tenant';
  END IF;

  IF p_user_id IS DISTINCT FROM v_connection.user_id THEN
    RAISE EXCEPTION 'VMX connection does not belong to user';
  END IF;

  FOR v_customer IN SELECT value FROM jsonb_array_elements(p_customers)
  LOOP
    v_total := v_total + 1;
    BEGIN
      IF nullif(btrim(v_customer->>'external_id'), '') IS NULL THEN
        RAISE EXCEPTION 'external_id is required';
      END IF;

      v_tags := ARRAY(
        SELECT jsonb_array_elements_text(
          coalesce(v_customer->'tags', '[]'::jsonb)
        )
      );

      INSERT INTO public.pos_customers (
        pos_connection_id, external_id, name, email, phone, tags,
        pos_source, raw_data
      ) VALUES (
        p_connection_id,
        btrim(v_customer->>'external_id'),
        nullif(btrim(concat_ws(
          ' ', v_customer->>'first_name', v_customer->>'last_name'
        )), ''),
        nullif(lower(btrim(v_customer->>'email')), ''),
        nullif(btrim(v_customer->>'phone'), ''),
        v_tags,
        'vmx',
        v_customer
      )
      ON CONFLICT (pos_connection_id, external_id) DO UPDATE
      SET name = excluded.name,
          email = excluded.email,
          phone = excluded.phone,
          tags = excluded.tags,
          raw_data = excluded.raw_data,
          updated_at = now()
      RETURNING id INTO v_pos_customer_id;

      SELECT link.crm_customer_id INTO v_crm_customer_id
      FROM public.crm_customer_identity_links link
      WHERE link.tenant_id = p_tenant_id
        AND link.pos_customer_id = v_pos_customer_id;

      IF v_crm_customer_id IS NULL THEN
        v_ambiguous := v_ambiguous + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'external_id', v_customer->>'external_id',
          'status', 'ambiguous'
        ));
        CONTINUE;
      END IF;

      UPDATE public.crm_customers c
      SET loyalty_member = coalesce(
            (v_customer->>'loyalty_member')::boolean,
            c.loyalty_member,
            false
          ),
          loyalty_rewards_balance = coalesce(
            nullif(v_customer->>'loyalty_rewards_balance', '')::numeric,
            c.loyalty_rewards_balance,
            0
          ),
          tags = ARRAY(
            SELECT DISTINCT tag
            FROM unnest(coalesce(c.tags, '{}'::text[]) || v_tags) tag
            WHERE tag IS NOT NULL AND tag <> ''
          ),
          custom_fields = coalesce(c.custom_fields, '{}'::jsonb) ||
            coalesce(v_customer->'custom_fields', '{}'::jsonb),
          pos_source = coalesce(c.pos_source, 'vmx'),
          updated_at = now()
      WHERE c.id = v_crm_customer_id
        AND c.tenant_id = p_tenant_id;

      v_resolved := v_resolved + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'external_id', v_customer->>'external_id',
        'status', 'resolved',
        'customer_id', v_crm_customer_id
      ));
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'external_id', v_customer->>'external_id',
        'status', 'failed',
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'resolved', v_resolved,
    'ambiguous', v_ambiguous,
    'failed', v_failed,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_vmx_customer_identity_batch(
  uuid, uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_vmx_customer_identity_batch(
  uuid, uuid, uuid, jsonb
) TO service_role;

