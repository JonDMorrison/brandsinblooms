
-- Create a function to opt-in Perks Program members
CREATE OR REPLACE FUNCTION public.optin_perks_members()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE crm_customers c
  SET email_opt_in = true, updated_at = now()
  FROM customer_segments cs
  WHERE cs.customer_id = c.id
    AND cs.segment_id = '99761a58-1692-4885-898f-781486ca48ad'
    AND (c.email_opt_in IS NULL OR c.email_opt_in = false);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
