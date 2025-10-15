-- Delete all customers for christine@dwntoearth.com account (tenant_id: 13b62ff0-4dc0-4451-a851-bb142a25ea62)
-- This will also cascade delete related records in customer_personas and customer_segments tables

-- First delete from junction tables to avoid foreign key issues
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

-- Now delete all customers
DELETE FROM crm_customers 
WHERE tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62';