-- Function to delete all customers except one for a tenant
CREATE OR REPLACE FUNCTION delete_customers_except(
  p_keep_email TEXT,
  p_tenant_id UUID
)
RETURNS TABLE(deleted_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_tenant_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Verify the calling user belongs to the tenant
  SELECT tenant_id INTO v_user_tenant_id
  FROM users
  WHERE id = auth.uid();
  
  IF v_user_tenant_id IS NULL OR v_user_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'User does not have access to this tenant';
  END IF;
  
  -- Delete all customers except the one to keep
  WITH deleted AS (
    DELETE FROM crm_customers
    WHERE tenant_id = p_tenant_id
    AND email != p_keep_email
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count FROM deleted;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$;