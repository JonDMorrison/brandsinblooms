-- The atomic consent writer previously verified only same-tenant membership.
-- Put a canonical role/location authorization boundary in front of it and
-- revoke direct browser execution of the lower-level writer.

CREATE OR REPLACE FUNCTION public.set_customer_marketing_consent_authorized(
  p_customer_id uuid,
  p_channel text,
  p_opt_in boolean,
  p_source text,
  p_consent_basis text DEFAULT NULL,
  p_evidence text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_role text;
  v_tenant_id uuid;
  v_customer_tenant_id uuid;
  v_primary_location_id uuid;
  v_location_allowed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_access := public.get_current_crm_access();
  v_role := v_access->>'role';
  v_tenant_id := nullif(v_access->>'tenantId', '')::uuid;

  IF v_role IS NULL
     OR v_role NOT IN ('owner_admin', 'marketing', 'store_manager') THEN
    RAISE EXCEPTION 'Customer consent changes require customer write access'
      USING ERRCODE = '42501';
  END IF;

  SELECT customer.tenant_id, customer.primary_location_id
  INTO v_customer_tenant_id, v_primary_location_id
  FROM public.crm_customers AS customer
  WHERE customer.id = p_customer_id
    AND customer.deleted_at IS NULL
    AND customer.merged_into_customer_id IS NULL;

  IF v_customer_tenant_id IS NULL OR v_customer_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'Customer not found or access denied' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'store_manager' THEN
    v_location_allowed := (
      v_primary_location_id IS NOT NULL
      AND coalesce(v_access->'locationIds', '[]'::jsonb)
        ? v_primary_location_id::text
    ) OR EXISTS (
      SELECT 1
      FROM public.customer_location_activity AS activity
      WHERE activity.tenant_id = v_tenant_id
        AND activity.customer_id = p_customer_id
        AND coalesce(v_access->'locationIds', '[]'::jsonb)
          ? activity.location_id::text
    );

    IF NOT v_location_allowed THEN
      RAISE EXCEPTION 'Customer is outside the assigned store locations'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN public.set_customer_marketing_consent(
    p_customer_id,
    p_channel,
    p_opt_in,
    p_source,
    p_consent_basis,
    p_evidence,
    p_ip_address,
    p_user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_marketing_consent(
  uuid, text, boolean, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_customer_marketing_consent_authorized(
  uuid, text, boolean, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_marketing_consent_authorized(
  uuid, text, boolean, text, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.set_customer_marketing_consent_authorized(
  uuid, text, boolean, text, text, text, text, text
) IS 'Authorizes owner/admin, marketing, or assigned-store manager access before atomically changing customer consent.';
