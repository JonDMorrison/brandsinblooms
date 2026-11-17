-- Approval queue for Bloom Support.
--
-- When a Bloom-prepared reply requires human review before sending (escalated
-- ticket, sensitive keyword in next_action, needs_owner status) and Gmail is
-- not configured, the proposed reply is stored here instead of auto-sending.
-- Staff reviews and approves or rejects in the Bloom Support dashboard.
-- Approved replies create a new send_email job with approved_queue_id set so
-- the worker skips the hold check.

CREATE TABLE bloom_support.approval_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES bloom_support.tickets(id) ON DELETE CASCADE,
  original_job_id text NOT NULL,
  message_id      text,                                          -- job.payload.message_id if set
  to_email        text NOT NULL CHECK (char_length(to_email) BETWEEN 3 AND 320),
  subject         text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 998),
  text_body       text NOT NULL,
  html_body       text,
  hold_reason     text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     text,                                          -- principal_id of reviewer
  sent_at         timestamptz,
  idempotency_key text UNIQUE
);

ALTER TABLE bloom_support.approval_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.approval_queue FROM PUBLIC, anon, authenticated;
GRANT ALL  ON bloom_support.approval_queue TO service_role;

CREATE INDEX ON bloom_support.approval_queue (ticket_id, status);
CREATE INDEX ON bloom_support.approval_queue (status, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: insert_approval_queue_entry
-- Called from the worker (service_role) to hold a reply durably.
-- Returns {id, created}: created=false when idempotency_key already exists.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloom_support_insert_approval_queue_entry(
  p_ticket_id      uuid,
  p_original_job_id text,
  p_message_id     text,
  p_to_email       text,
  p_subject        text,
  p_text_body      text,
  p_html_body      text,
  p_hold_reason    text,
  p_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO bloom_support.approval_queue
    (ticket_id, original_job_id, message_id, to_email, subject, text_body, html_body, hold_reason, idempotency_key)
  VALUES
    (p_ticket_id, p_original_job_id, p_message_id, p_to_email, p_subject, p_text_body, p_html_body, p_hold_reason, p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM bloom_support.approval_queue WHERE idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object('id', v_id, 'created', false);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'created', true);
END $$;

REVOKE ALL    ON FUNCTION public.bloom_support_insert_approval_queue_entry(uuid,text,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_insert_approval_queue_entry(uuid,text,text,text,text,text,text,text,text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: list_approval_queue
-- Called from the API (staff session). p_status 'all' returns every status.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloom_support_list_approval_queue(
  p_actor  text,
  p_status text DEFAULT 'pending'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.principals
    WHERE id = p_actor
      AND role IN ('platform_admin', 'platform_operator', 'support')
  ) THEN
    RAISE EXCEPTION 'Access denied — staff only' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id',              aq.id,
        'ticket_id',       aq.ticket_id,
        'original_job_id', aq.original_job_id,
        'message_id',      aq.message_id,
        'to_email',        aq.to_email,
        'subject',         aq.subject,
        'text_body',       aq.text_body,
        'hold_reason',     aq.hold_reason,
        'status',          aq.status,
        'created_at',      aq.created_at,
        'reviewed_at',     aq.reviewed_at,
        'reviewed_by',     aq.reviewed_by,
        'ticket',          jsonb_build_object(
                             'number',  t.number,
                             'subject', t.subject,
                             'status',  t.status
                           )
      ) ORDER BY aq.created_at DESC
    ), '[]')
    FROM bloom_support.approval_queue aq
    JOIN bloom_support.tickets t ON t.id = aq.ticket_id
    WHERE (p_status = 'all' OR aq.status = p_status)
  );
END $$;

REVOKE ALL    ON FUNCTION public.bloom_support_list_approval_queue(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_list_approval_queue(text, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: review_queued_reply
-- Called from the API to approve or reject an entry.
-- Returns the entry data so the caller can enqueue a send_email job on approve.
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

  RETURN jsonb_build_object(
    'id',          v_entry.id,
    'ticket_id',   v_entry.ticket_id,
    'message_id',  v_entry.message_id,
    'status',      p_action,
    'reviewed_at', now()
  );
END $$;

REVOKE ALL    ON FUNCTION public.bloom_support_review_queued_reply(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_review_queued_reply(text, uuid, text, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron: schedule the overnight maintenance sweep at 02:00 UTC every night.
-- The maintain() handler scans stale tickets and unresponded requests and posts
-- a summary to the #alerts Slack channel. It was registered in the HANDLERS map
-- in PR #537 but was never scheduled.
--
-- Uses bloom_support.enqueue_job() so the maintain job appears in the jobs table
-- and the existing worker picks it up on the next minute tick.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bloom-support-maintain';
    PERFORM cron.schedule(
      'bloom-support-maintain',
      '0 2 * * *',
      $cron$
        SELECT bloom_support.enqueue_job(
          'maintain', NULL, NULL, 'auto',
          '{}'::jsonb,
          'maintain:nightly:' || to_char(now()::date, 'YYYYMMDD'),
          now(), 1, 300
        )
        WHERE coalesce((bloom_support.setting('automation_enabled'))::text::boolean, false);
      $cron$
    );
  END IF;
END $$;
