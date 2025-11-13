-- One-time cleanup: Delete all customers except furqanhameedjutt.311@gmail.com
-- Tenant: 89ff9f89-ba73-4843-9e4a-733440314168
-- This will delete 1,557 customers and keep 1

DELETE FROM crm_customers
WHERE tenant_id = '89ff9f89-ba73-4843-9e4a-733440314168'
  AND email != 'furqanhameedjutt.311@gmail.com';

-- Verify the cleanup
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count 
  FROM crm_customers 
  WHERE tenant_id = '89ff9f89-ba73-4843-9e4a-733440314168';
  
  RAISE NOTICE 'Customers remaining in tenant: %', remaining_count;
END $$;