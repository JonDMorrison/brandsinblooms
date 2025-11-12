-- Create atomic sequence generator function for ai_assistant_messages
CREATE OR REPLACE FUNCTION public.get_next_message_sequence(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  -- Atomically get the next sequence number for this session
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO next_seq
  FROM public.ai_assistant_messages
  WHERE session_id = p_session_id
  FOR UPDATE; -- Lock to prevent race conditions
  
  RETURN next_seq;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_next_message_sequence(UUID) IS 
'Atomically generates the next sequence number for messages in a given session. Used to prevent race conditions when saving multiple messages in parallel.';