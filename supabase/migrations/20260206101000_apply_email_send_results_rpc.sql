-- Bulk-apply send results for claimed email_messages.
-- This avoids 1 HTTP roundtrip per message from the Edge Function worker.

CREATE OR REPLACE FUNCTION public.apply_email_send_results(
  p_claim_token TEXT,
  p_results JSONB,
  p_max_attempts INT DEFAULT 3
)
RETURNS TABLE (
  updated_sent INT,
  updated_failed INT,
  updated_queued INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_sent INT := 0;
  v_updated_failed INT := 0;
  v_updated_queued INT := 0;
BEGIN
  IF p_claim_token IS NULL OR length(p_claim_token) < 10 THEN
    RETURN;
  END IF;

  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RETURN;
  END IF;

  IF p_max_attempts IS NULL OR p_max_attempts < 1 THEN
    p_max_attempts := 3;
  END IF;

  WITH r AS (
    SELECT *
    FROM jsonb_to_recordset(p_results) AS x(
      msg_id UUID,
      resend_id TEXT,
      error_message TEXT,
      attempts INT,
      is_rate_limited BOOLEAN
    )
  ),
  u AS (
    UPDATE public.email_messages m
    SET
      status = CASE
        WHEN r.resend_id IS NOT NULL THEN 'sent'
        WHEN (NOT COALESCE(r.is_rate_limited, FALSE)) AND COALESCE(r.attempts, 1) >= p_max_attempts THEN 'failed'
        ELSE 'queued'
      END,
      attempts = CASE
        WHEN r.resend_id IS NOT NULL THEN COALESCE(m.attempts, 0)
        WHEN COALESCE(r.is_rate_limited, FALSE) THEN GREATEST(0, COALESCE(r.attempts, 1) - 1)
        ELSE COALESCE(r.attempts, 1)
      END,
      resend_id = CASE WHEN r.resend_id IS NOT NULL THEN r.resend_id ELSE m.resend_id END,
      sent_at = CASE WHEN r.resend_id IS NOT NULL THEN now() ELSE m.sent_at END,
      error_message = CASE WHEN r.resend_id IS NOT NULL THEN NULL ELSE LEFT(COALESCE(r.error_message, 'Send failed'), 500) END,
      last_attempt_at = CASE WHEN r.resend_id IS NOT NULL THEN m.last_attempt_at ELSE now() END,
      updated_at = now(),
      claim_token = NULL,
      claimed_at = NULL,
      claimed_by = NULL
    FROM r
    WHERE m.id = r.msg_id
      AND m.claim_token = p_claim_token
      AND m.resend_id IS NULL
    RETURNING m.status
  )
  SELECT
    COUNT(*) FILTER (WHERE status = 'sent')::INT,
    COUNT(*) FILTER (WHERE status = 'failed')::INT,
    COUNT(*) FILTER (WHERE status = 'queued')::INT
  INTO v_updated_sent, v_updated_failed, v_updated_queued
  FROM u;

  updated_sent := COALESCE(v_updated_sent, 0);
  updated_failed := COALESCE(v_updated_failed, 0);
  updated_queued := COALESCE(v_updated_queued, 0);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_email_send_results(TEXT, JSONB, INT) TO service_role;
