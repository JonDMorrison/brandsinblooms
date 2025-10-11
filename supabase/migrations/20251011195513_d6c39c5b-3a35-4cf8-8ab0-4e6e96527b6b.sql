-- Delete all customers for the tenant EXCEPT the one to keep
-- First, let's verify the target email exists
DO $$
DECLARE
  target_tenant_id UUID;
  target_email TEXT := 'furqanhameedjutt.311@gmail.com';
  keep_customer_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Get the tenant_id for the user
  SELECT u.tenant_id INTO target_tenant_id
  FROM users u
  JOIN auth.users au ON au.id = u.id
  WHERE au.email = target_email;
  
  IF target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', target_email;
  END IF;
  
  -- Get the customer ID to keep (if exists)
  SELECT id INTO keep_customer_id
  FROM crm_customers
  WHERE tenant_id = target_tenant_id
  AND email = target_email;
  
  -- Delete all customers for this tenant EXCEPT the one to keep
  IF keep_customer_id IS NOT NULL THEN
    -- Keep the customer with matching email
    DELETE FROM crm_customers
    WHERE tenant_id = target_tenant_id
    AND id != keep_customer_id;
  ELSE
    -- No customer with that email exists, delete all
    DELETE FROM crm_customers
    WHERE tenant_id = target_tenant_id;
  END IF;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % customers from tenant %', deleted_count, target_tenant_id;
  IF keep_customer_id IS NOT NULL THEN
    RAISE NOTICE 'Kept customer with email % (ID: %)', target_email, keep_customer_id;
  ELSE
    RAISE NOTICE 'No customer with email % was found to keep', target_email;
  END IF;
END $$;