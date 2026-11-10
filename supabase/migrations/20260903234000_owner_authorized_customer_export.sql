-- Customer exports contain the complete tenant contact database and remain an
-- owner/admin-only operation. Use the canonical CRM access resolver so legacy
-- database roles `owner` and `admin` receive the same owner_admin capability.

CREATE OR REPLACE FUNCTION public.get_customer_export_page(
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Export page size must be between 1 and 1000';
  END IF;

  v_access := public.get_current_crm_access();
  IF v_access->>'role' IS DISTINCT FROM 'owner_admin' THEN
    RAISE EXCEPTION 'Customer exports require owner or administrator access'
      USING ERRCODE = '42501';
  END IF;

  v_tenant_id := nullif(v_access->>'tenantId', '')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant access required' USING ERRCODE = '42501';
  END IF;

  WITH page_rows AS (
    SELECT
      customer.id,
      jsonb_build_object(
        'id', customer.id,
        'first_name', customer.first_name,
        'last_name', customer.last_name,
        'email', customer.email,
        'phone', customer.phone,
        'city', customer.city,
        'state_region', customer.state_region,
        'postal_code', customer.postal_code,
        'country_code', customer.country_code,
        'timezone', customer.timezone,
        'store_id', customer.store_id,
        'store_name', customer.store_name,
        'signup_source', customer.signup_source,
        'preferred_channel', customer.preferred_channel,
        'tags', coalesce(to_jsonb(customer.tags), '[]'::jsonb),
        'product_tags', coalesce(to_jsonb(customer.product_tags), '[]'::jsonb),
        'custom_fields', coalesce(customer.custom_fields, '{}'::jsonb),
        'email_opt_in', customer.email_opt_in,
        'email_consent', customer.email_consent,
        'email_opt_in_at', customer.email_opt_in_at,
        'email_opt_out_at', customer.email_opt_out_at,
        'email_consent_source', customer.email_consent_source,
        'email_consent_method', customer.email_consent_method,
        'sms_opt_in', customer.sms_opt_in,
        'sms_consent', customer.sms_consent,
        'sms_opt_in_at', customer.sms_opt_in_at,
        'sms_opt_out_at', customer.sms_opt_out_at,
        'sms_consent_source', customer.sms_consent_source,
        'sms_consent_method', customer.sms_consent_method,
        'is_vip', customer.is_vip,
        'lifetime_value', customer.lifetime_value,
        'total_spent', customer.total_spent,
        'first_purchase_date', customer.first_purchase_date,
        'last_purchase_date', customer.last_purchase_date,
        'pos_order_count', customer.pos_order_count,
        'pos_total_spent', customer.pos_total_spent,
        'pos_source', customer.pos_source,
        'external_id', customer.external_id,
        'square_customer_id', customer.square_customer_id,
        'clover_customer_id', customer.clover_customer_id,
        'linked_pos_identities', coalesce((
          SELECT jsonb_agg(
            jsonb_build_object(
              'provider', identity_link.provider,
              'external_id', identity_link.external_id,
              'link_method', identity_link.link_method,
              'confidence_score', identity_link.confidence_score,
              'first_seen_at', identity_link.first_seen_at,
              'last_seen_at', identity_link.last_seen_at
            )
            ORDER BY identity_link.provider, identity_link.external_id
          )
          FROM public.crm_customer_identity_links AS identity_link
          WHERE identity_link.crm_customer_id = customer.id
            AND identity_link.tenant_id = customer.tenant_id
        ), '[]'::jsonb),
        'segments', coalesce((
          SELECT jsonb_agg(segment.name ORDER BY segment.name)
          FROM public.customer_segments AS membership
          JOIN public.crm_segments AS segment ON segment.id = membership.segment_id
          WHERE membership.customer_id = customer.id
            AND segment.tenant_id = customer.tenant_id
        ), '[]'::jsonb),
        'loyalty_member', coalesce(loyalty.is_perks_member, false),
        'loyalty_tier', loyalty.current_loyalty_tier,
        'loyalty_points_balance', loyalty.current_points_balance,
        'loyalty_points_earned', loyalty.total_points_earned,
        'loyalty_points_redeemed', loyalty.total_points_redeemed,
        'loyalty_enrolled_at', loyalty.perks_enrolled_at,
        'created_at', customer.created_at,
        'updated_at', customer.updated_at
      ) AS item
    FROM public.crm_customers AS customer
    LEFT JOIN public.customer_loyalty_metrics AS loyalty
      ON loyalty.customer_id = customer.id
     AND loyalty.tenant_id = customer.tenant_id
    WHERE customer.tenant_id = v_tenant_id
      AND customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND (p_after_id IS NULL OR customer.id > p_after_id)
    ORDER BY customer.id
    LIMIT p_limit + 1
  ), export_rows AS (
    SELECT id, item
    FROM page_rows
    ORDER BY id
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'items', coalesce(jsonb_agg(export.item ORDER BY export.id), '[]'::jsonb),
    'nextCursor', (
      SELECT cursor_row.id
      FROM export_rows AS cursor_row
      ORDER BY cursor_row.id DESC
      LIMIT 1
    ),
    'hasMore', (SELECT count(*) > p_limit FROM page_rows),
    'pageSize', count(*)
  )
  INTO v_result
  FROM export_rows AS export;

  RETURN coalesce(
    v_result,
    jsonb_build_object(
      'items', '[]'::jsonb,
      'nextCursor', NULL,
      'hasMore', false,
      'pageSize', 0
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_export_page(uuid, integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_export_page(uuid, integer)
TO authenticated;

COMMENT ON FUNCTION public.get_customer_export_page(uuid, integer) IS
  'Returns one owner-authorized, tenant-scoped customer export page including custom fields, segments, consent, POS summaries, and loyalty balances.';
