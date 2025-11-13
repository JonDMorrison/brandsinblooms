-- Delete all customers except furqanhameedjutt.311@gmail.com from tenant
-- Tenant: 89ff9f89-ba73-4843-9e4a-733440314168
-- This will delete 1,557 customers and keep 1

DELETE FROM crm_customers
WHERE tenant_id = '89ff9f89-ba73-4843-9e4a-733440314168'
  AND email != 'furqanhameedjutt.311@gmail.com';

-- Verify the cleanup
DO $$
DECLARE
  remaining_count INTEGER;
  kept_email TEXT;
BEGIN
  SELECT COUNT(*), MAX(email) INTO remaining_count, kept_email
  FROM crm_customers 
  WHERE tenant_id = '89ff9f89-ba73-4843-9e4a-733440314168';
  
  RAISE NOTICE 'Customers remaining in tenant: %', remaining_count;
  RAISE NOTICE 'Kept customer email: %', kept_email;
END $$;