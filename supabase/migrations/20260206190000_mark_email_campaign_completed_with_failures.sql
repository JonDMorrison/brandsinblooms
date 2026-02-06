-- Allow users to mark an email campaign as completed even if some recipients failed.
-- Keeps existing metrics as-is (does not recompute totals).

CREATE OR REPLACE FUNCTION public.mark_email_campaign_completed_with_failures(
  p_campaign_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  new_status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_has_inflight BOOLEAN;
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign id is required'::TEXT;
    RETURN;
  END IF;

  -- Lock campaign row to avoid races with other updates.
  SELECT status INTO v_status
  FROM public.crm_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;

  -- Do not allow completion while there is still sendable work in-flight.
  SELECT EXISTS (
    SELECT 1
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.status IN ('queued', 'sending', 'paused')
      AND m.resend_id IS NULL
      AND m.dead_lettered_at IS NULL
  ) INTO v_has_inflight;

  IF v_has_inflight THEN
    RETURN QUERY SELECT FALSE, v_status, 'Campaign still has queued/sending messages'::TEXT;
    RETURN;
  END IF;

  UPDATE public.crm_campaigns
  SET
    status = 'sent',
    sent_at = COALESCE(sent_at, NOW()),
    send_error = NULL,
    send_blocked_reason = NULL,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  RETURN QUERY SELECT TRUE, 'sent'::TEXT, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_email_campaign_completed_with_failures(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_campaign_completed_with_failures(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
