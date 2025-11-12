-- Fix atomic sequence generator function for ai_assistant_messages
-- Replace incorrect FOR UPDATE on aggregate with proper row locking
CREATE OR REPLACE FUNCTION public.get_next_message_sequence(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_seq INTEGER;
  session_lock_acquired BOOLEAN;
BEGIN
  -- Lock the session row to ensure atomic sequence generation
  -- This prevents race conditions when multiple messages are saved simultaneously
  PERFORM 1 FROM public.ai_assistant_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  
  -- Now safely get the next sequence number
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO next_seq
  FROM public.ai_assistant_messages
  WHERE session_id = p_session_id;
  
  RETURN next_seq;
END;
$$;

-- Update comment for documentation
COMMENT ON FUNCTION public.get_next_message_sequence(UUID) IS 
'Atomically generates the next sequence number for messages in a given session. Locks the session row to prevent race conditions when saving multiple messages in parallel.';