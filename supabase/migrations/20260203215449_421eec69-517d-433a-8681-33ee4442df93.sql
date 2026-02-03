-- Create a function to bulk opt-in customers to SMS for a specific tenant
CREATE OR REPLACE FUNCTION public.bulk_sms_opt_in(p_tenant_id uuid, p_batch_size int DEFAULT 1000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  WITH to_update AS (
    SELECT id FROM crm_customers
    WHERE tenant_id = p_tenant_id
      AND (sms_opt_in = false OR sms_opt_in IS NULL)
    LIMIT p_batch_size
  )
  UPDATE crm_customers c
  SET sms_opt_in = true, updated_at = now()
  FROM to_update
  WHERE c.id = to_update.id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;