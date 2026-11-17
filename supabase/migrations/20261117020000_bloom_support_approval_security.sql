-- Security hardening for the approval queue:
--
-- 1. bloom_support_fetch_approval_entry: worker pre-send validation and frozen
--    content fetch. Returns full entry so sendEmail uses stored text/html instead
--    of re-rendering, and can verify ticket_id, to_email, status, and sent_at.
--
-- 2. Update bloom_support_review_queued_reply to atomically enqueue the
--    send_email job when action='approved', preventing the state where an entry
--    is marked approved but no job exists to deliver it.
--
-- 3. bloom_support_mark_approval_sent: worker calls this after confirmed delivery
--    to close the audit trail (status=sent, sent_at=now()).

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: fetch_approval_entry
-- Called by the worker (service_role) to validate an approved entry and obtain
-- the frozen email content before delivery.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloom_support_fetch_approval_entry(p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v bloom_support.approval_queue;
BEGIN
  SELECT * INTO v FROM bloom_support.approval_queue WHERE id = p_entry_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id',          v.id,
    'ticket_id',   v.ticket_id,
    'message_id',  v.message_id,
    'to_email',    v.to_email,
    'subject',     v.subject,
    'text_body',   v.text_body,
    'html_body',   v.html_body,
    'status',      v.status,
    'sent_at',     v.sent_at
  );
END $$;

REVOKE ALL    ON FUNCTION public.bloom_support_fetch_approval_entry(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_fetch_approval_entry(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: review_queued_reply (replace — adds atomic enqueue on approve)
-- Transitions pending→approved/rejected and, on approve, inserts the
-- send_email job in the same transaction so they cannot diverge.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloom_support_review_queued_reply(
  p_actor    text,
  p_entry_id uuid,
  p_action   text,  -- 'approved' | 'rejected'
  p_reason   text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_entry bloom_support.approval_queue;
  v_job_id uuid;
BEGIN
  IF p_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'p_action must be approved or rejected' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.principals
    WHERE id = p_actor AND role IN ('platform_admin', 'platform_operator')
  ) THEN
    RAISE EXCEPTION 'Access denied — admin or operator required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_entry
  FROM bloom_support.approval_queue
  WHERE id = p_entry_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found or not pending' USING ERRCODE = '02000';
  END IF;

  UPDATE bloom_support.approval_queue
  SET
    status      = p_action,
    reviewed_at = now(),
    reviewed_by = p_actor
  WHERE id = p_entry_id;

  -- Atomically enqueue the delivery job so the entry never sits approved without
  -- a corresponding job. The approved_queue_id payload field bypasses the hold
  -- check in sendEmail and signals the worker to use frozen content.
  IF p_action = 'approved' THEN
    v_job_id := bloom_support.enqueue_job(
      'send_email',
      v_entry.ticket_id,
      NULL,
      'auto',
      jsonb_build_object(
        'message_id',       v_entry.message_id,
        'approved_queue_id', v_entry.id::text
      ),
      'approved_reply:' || v_entry.id::text,
      now(),
      3,
      60
    );
  END IF;

  RETURN jsonb_build_object(
    'id',          v_entry.id,
    'ticket_id',   v_entry.ticket_id,
    'message_id',  v_entry.message_id,
    'status',      p_action,
    'reviewed_at', now(),
    'job_id',      v_job_id
  );
END $$;

REVOKE ALL    ON FUNCTION public.bloom_support_review_queued_reply(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_review_queued_reply(text, uuid, text, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: mark_approval_sent
-- Worker calls this after confirmed delivery to close the audit trail.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloom_support_mark_approval_sent(p_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE bloom_support.approval_queue
  SET status = 'sent', sent_at = now()
  WHERE id = p_entry_id AND status = 'approved';
END $$;

REVOKE ALL    ON FUNCTION public.bloom_support_mark_approval_sent(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_mark_approval_sent(uuid) TO service_role;
