-- Create atomic rate limit upsert function
-- This function atomically increments the counter, preventing race conditions

CREATE OR REPLACE FUNCTION upsert_rate_limit(
  p_tenant_id uuid,
  p_form_id uuid,
  p_ip_hash text,
  p_window_start timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
BEGIN
  -- Atomic upsert with increment
  -- ON CONFLICT triggers when (form_id, ip_hash, window_start) already exists
  INSERT INTO form_rate_limits (tenant_id, form_id, ip_hash, window_start, count)
  VALUES (p_tenant_id, p_form_id, p_ip_hash, p_window_start, 1)
  ON CONFLICT (form_id, ip_hash, window_start) 
  DO UPDATE SET 
    count = form_rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO v_new_count;
  
  RETURN v_new_count;
END;
$$;

-- Grant execute to service role (edge functions use this)
GRANT EXECUTE ON FUNCTION upsert_rate_limit TO service_role;

-- Comment explaining the function
COMMENT ON FUNCTION upsert_rate_limit IS 
'Atomic rate limit counter increment. Uses ON CONFLICT DO UPDATE to prevent race conditions in burst traffic. Returns the new count after increment.';