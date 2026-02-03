-- Create a function to delete nameless customers in batches
CREATE OR REPLACE FUNCTION delete_nameless_customers(p_tenant_id uuid, p_limit int DEFAULT 500)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  WITH to_delete AS (
    SELECT id 
    FROM crm_customers 
    WHERE tenant_id = p_tenant_id
      AND (first_name IS NULL OR TRIM(first_name) = '')
      AND (last_name IS NULL OR TRIM(last_name) = '')
    LIMIT p_limit
  )
  DELETE FROM crm_customers 
  WHERE id IN (SELECT id FROM to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create a function to delete phone duplicates (keeping most recent)
CREATE OR REPLACE FUNCTION delete_phone_duplicates(p_tenant_id uuid, p_limit int DEFAULT 500)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  WITH phone_ranked AS (
    SELECT id, phone,
      ROW_NUMBER() OVER (
        PARTITION BY REGEXP_REPLACE(phone, '\D', '', 'g') 
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
      ) as rn
    FROM crm_customers 
    WHERE tenant_id = p_tenant_id
      AND phone IS NOT NULL 
      AND TRIM(phone) != ''
  ),
  to_delete AS (
    SELECT id FROM phone_ranked WHERE rn > 1 LIMIT p_limit
  )
  DELETE FROM crm_customers 
  WHERE id IN (SELECT id FROM to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;