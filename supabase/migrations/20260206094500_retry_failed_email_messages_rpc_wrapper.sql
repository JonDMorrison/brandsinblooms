-- Wrapper overload for PostgREST schema cache compatibility.
-- Some environments can be picky about default parameters when calling RPC.

CREATE OR REPLACE FUNCTION public.retry_failed_email_messages(
  p_campaign_id UUID
)
RETURNS TABLE (
  count_reset INT,
  jobs_created INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use dynamic SQL so function creation doesn't depend on the 2-arg overload existing yet.
  RETURN QUERY
  EXECUTE 'SELECT * FROM public.retry_failed_email_messages($1, 200)'
  USING p_campaign_id;
EXCEPTION
  WHEN undefined_function THEN
    RAISE EXCEPTION
      'Base RPC public.retry_failed_email_messages(uuid,int) is missing. Apply migration 20260206090000_retry_failed_email_messages_rpc.sql first.'
      USING ERRCODE = '42883';
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_failed_email_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_email_messages(UUID) TO service_role;
