-- Delete all customers except the one with email 'furqanhameedjutt.311@gmail.com'
DELETE FROM crm_customers 
WHERE tenant_id = '89ff9f89-ba73-4843-9e4a-733440314168' 
AND email != 'furqanhameedjutt.311@gmail.com';