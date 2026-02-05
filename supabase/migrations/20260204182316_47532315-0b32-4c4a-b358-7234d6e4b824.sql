-- Create a function to un-suppress incorrectly flagged customers in batches
CREATE OR REPLACE FUNCTION unsuppress_incorrectly_flagged_customers(batch_limit INT DEFAULT 5000)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT;
BEGIN
  WITH to_unsuppress AS (
    SELECT c.id
    FROM crm_customers c
    WHERE c.suppressed = true
      AND NOT EXISTS (
        SELECT 1 FROM suppression_list sl 
        WHERE sl.customer_id = c.id 
        AND sl.lifted_at IS NULL
      )
    LIMIT batch_limit
  )
  UPDATE crm_customers
  SET 
    suppressed = false,
    suppressed_at = NULL,
    suppressed_reason = NULL
  WHERE id IN (SELECT id FROM to_unsuppress);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;