
-- Delete all customers for this tenant except the one with specified email
DELETE FROM crm_customers 
WHERE tenant_id = '89ff9f89-ba73-4843-9e4a-733440314168' 
AND email != 'furqanhameedjutt.311@gmail.com';
