-- One private Slack thread per internal support ticket, with replies authorized
-- by the existing Slack HMAC, staff-ID allowlist and Bloom Support permissions.
-- No Slack message is allowed to change a ticket, approve a repair or send email.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE IF NOT EXISTS bloom_support.slack_ticket_threads (
  ticket_id uuid PRIMARY KEY REFERENCES bloom_support.tickets(id) ON DELETE CASCADE,
  channel_id text NOT NULL DEFAULT 'C0CFNEQBS2X' CHECK (channel_id = 'C0CFNEQBS2X'),
  root_ts text NOT NULL CHECK (root_ts ~ '^[0-9]{10}[.][0-9]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, root_ts)
);
ALTER TABLE bloom_support.slack_ticket_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bloom_support.slack_ticket_threads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE bloom_support.slack_ticket_threads TO service_role;

-- Read or bind a verified root message. The trusted worker can bind a real
-- Slack chat.postMessage receipt; callbacks cannot forge links from Slack text.
CREATE OR REPLACE FUNCTION public.bloom_support_slack_ticket_thread(
  p_ticket uuid, p_root_ts text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_root text;
BEGIN
  IF p_ticket IS NULL THEN
    RAISE EXCEPTION 'invalid ticket' USING ERRCODE = '22023';
  END IF;
  IF p_root_ts IS NOT NULL THEN
    IF p_root_ts !~ '^[0-9]{10}[.][0-9]{6}$' THEN
      RAISE EXCEPTION 'invalid Slack timestamp' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM bloom_support.tickets WHERE id = p_ticket AND spam = false AND redacted_at IS NULL) THEN
      RAISE EXCEPTION 'ticket unavailable' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO bloom_support.slack_ticket_threads (ticket_id,root_ts)
    VALUES (p_ticket,p_root_ts)
    ON CONFLICT (ticket_id) DO NOTHING;
  END IF;
  SELECT root_ts INTO v_root FROM bloom_support.slack_ticket_threads
    WHERE ticket_id=p_ticket AND channel_id='C0CFNEQBS2X';
  RETURN pg_catalog.jsonb_build_object('thread_ts',v_root);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_slack_ticket_thread(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_ticket_thread(uuid,text)
  TO service_role;

-- Only signed, allowlisted user mentions in an existing #bloom-tickets thread
-- are accepted. The authenticated principal must still be authorized to read
-- the specific ticket. No raw ticket text leaves the database via this RPC.
CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_slack_ticket_question(
  p_event_id text, p_channel text, p_user_id text,
  p_question text, p_root_ts text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ticket uuid; v_actor uuid; v_count bigint; v_job uuid;
BEGIN
  IF coalesce(bloom_support.setting('slack')->>'enabled','false')<>'true' THEN
    RETURN pg_catalog.jsonb_build_object('queued',false,'reason','disabled');
  END IF;
  IF p_channel <> 'C0CFNEQBS2X'
     OR p_event_id !~ '^[A-Za-z0-9_-]{8,100}$'
     OR p_user_id !~ '^[UW][A-Z0-9]{8,24}$'
     OR p_root_ts !~ '^[0-9]{10}[.][0-9]{6}$'
     OR length(p_question) NOT BETWEEN 3 AND 800
  THEN RAISE EXCEPTION 'invalid ticket question' USING ERRCODE='22023'; END IF;

  SELECT pr.id INTO v_actor
  FROM bloom_support.slack_staff_principals m
  JOIN bloom_support.principals pr ON pr.id=m.principal_id
  WHERE m.slack_user_id=p_user_id AND m.enabled AND pr.active
    AND pr.role IN ('platform_admin','platform_operator','support')
    AND bloom_support.has_permission(pr.id,'tickets.read_all')
  LIMIT 1;
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('queued',false,'reason','unauthorized');
  END IF;
  SELECT th.ticket_id INTO v_ticket
  FROM bloom_support.slack_ticket_threads th
  WHERE th.channel_id=p_channel AND th.root_ts=p_root_ts
  LIMIT 1;
  IF v_ticket IS NULL OR NOT bloom_support.can_read_ticket(v_actor,v_ticket) THEN
    RETURN pg_catalog.jsonb_build_object('queued',false,'reason','unknown_thread');
  END IF;

  SELECT count(*) INTO v_count
  FROM bloom_support.jobs
  WHERE (lane = 'slack:ask:'||p_user_id OR lane LIKE 'slack:ask:%:'||p_user_id)
    AND created_at>now()-interval '1 hour';
  IF v_count>=12 THEN
    RETURN pg_catalog.jsonb_build_object('queued',false,'reason','staff rate limit');
  END IF;
  v_job:=bloom_support.enqueue_job(
    'notify',v_ticket,NULL,'slack:ask:tickets:'||p_user_id,
    pg_catalog.jsonb_build_object(
      'slack_question',true,'slack_question_route','tickets',
      'question',p_question,'thread_ts',p_root_ts
    ),
    'slack:ask:'||p_event_id,now(),2,30
  );
  RETURN pg_catalog.jsonb_build_object('queued',true,'job_id',v_job);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_enqueue_slack_ticket_question(text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_slack_ticket_question(text,text,text,text,text)
  TO service_role;

-- Thread follow-up notifications are queued by changes to the canonical ticket,
-- never by Slack messages. Kept separate from customer email notifications.
CREATE OR REPLACE FUNCTION bloom_support.slack_ticket_change_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(bloom_support.setting('slack')->>'enabled','false')<>'true'
    OR NEW.spam OR NEW.redacted_at IS NOT NULL OR NEW.merged_into IS NOT NULL
  THEN RETURN NEW; END IF;
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id
    OR OLD.executor IS DISTINCT FROM NEW.executor
    OR OLD.executor_id IS DISTINCT FROM NEW.executor_id
    OR OLD.automation IS DISTINCT FROM NEW.automation
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.stage IS DISTINCT FROM NEW.stage
    OR OLD.next_action IS DISTINCT FROM NEW.next_action
    OR OLD.pending_review IS DISTINCT FROM NEW.pending_review
    OR OLD.resolution_verified IS DISTINCT FROM NEW.resolution_verified
  THEN
    BEGIN
      PERFORM bloom_support.enqueue_job(
        'notify',NEW.id,NULL,'slack:ticket:'||NEW.id::text,
        pg_catalog.jsonb_build_object('slack_ticket_changed',true,'kind','ticket.changed'),
        'slack:ticket:version:'||NEW.id::text||':'||NEW.version::text,
        now(),3,30
      );
    EXCEPTION WHEN OTHERS THEN
      -- Optional notifications must never roll back a support edit.
      RAISE WARNING 'Slack ticket change notice could not be queued (SQLSTATE %)',SQLSTATE;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bloom_support.slack_ticket_change_notice()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bloom_support_slack_ticket_change ON bloom_support.tickets;
CREATE TRIGGER bloom_support_slack_ticket_change
AFTER UPDATE OF owner_id, executor, executor_id, automation, status, stage,
  next_action, pending_review, resolution_verified
ON bloom_support.tickets FOR EACH ROW
EXECUTE FUNCTION bloom_support.slack_ticket_change_notice();
