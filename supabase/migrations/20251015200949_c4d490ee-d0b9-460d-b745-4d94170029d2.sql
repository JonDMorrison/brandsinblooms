
-- Delete all customers and related records for christine@dwntoearth.com's tenant
-- Tenant ID: 13b62ff0-4dc0-4451-a851-bb142a25ea62

-- First, delete related records from junction tables
DELETE FROM customer_personas 
WHERE customer_id IN (
  SELECT id FROM crm_customers 
  WHERE tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62'
);

DELETE FROM customer_segments 
WHERE customer_id IN (
  SELECT id FROM crm_customers 
  WHERE tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62'
);

-- Delete SMS messages related to these customers
DELETE FROM sms_messages 
WHERE customer_id IN (
  SELECT id FROM crm_customers 
  WHERE tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62'
);

-- Delete all customers from the tenant
DELETE FROM crm_customers 
WHERE tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62';
