-- Bloom Slack: "this ticket" outside a ticket thread, and unanswered questions in the digest.
--
-- bloom_support_slack_recent_ticket: when staff write "close this ticket" as a
-- new message under an alert, Bloom could not tell which ticket they meant.
-- This returns the request Bloom last posted about in that channel in the 24
-- hours before the message, if the asker may read it. Read-only.
--
-- bloom_support_slack_recent_answers: the Slack questions and Bloom's answers
-- since a given time, so the morning digest can list the ones Bloom did not
-- answer. Staff channels only; no customer contact details are stored in these
-- rows. Read-only.
--
-- Both are service_role only. No existing function or table is changed.

CREATE OR REPLACE FUNCTION public.bloom_support_slack_recent_ticket(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; v_actor uuid; v_route text; v_root text; v_channel text; r record;
BEGIN
 c := public.bloom_support_slack_conversation_context(p_job);
 IF coalesce(c->>'allowed','false')<>'true' OR c->>'ticket_id' IS NOT NULL THEN RETURN NULL; END IF;
 v_actor := (c->>'principal_id')::uuid; v_route := c->>'route';
 v_root := c->>'root_ts'; v_channel := c->>'channel';
 IF v_route NOT IN ('alerts','tickets') OR v_root !~ '^\d{10}\.\d{6}$' THEN RETURN NULL; END IF;
 SELECT t.id, t.number, t.subject, t.status INTO r FROM (
   SELECT th.ticket_id, th.root_ts AS ts FROM bloom_support.slack_ticket_threads th
   WHERE th.channel_id = v_channel
   UNION ALL
   SELECT j.ticket_id, substring(j.result->>'note' from 'Slack ts: (\d{10}\.\d{6})\)$')
   FROM bloom_support.jobs j
   WHERE j.ticket_id IS NOT NULL AND j.status = 'succeeded' AND j.payload->>'slack' = 'true'
     AND j.updated_at > now() - interval '2 days'
     AND j.result->>'note' LIKE 'delivered to ' || v_route || ' (Slack ts: %'
 ) x JOIN bloom_support.tickets t ON t.id = x.ticket_id
 WHERE x.ts ~ '^\d{10}\.\d{6}$' AND x.ts < v_root AND x.ts::numeric > v_root::numeric - 86400
   AND NOT t.spam AND t.redacted_at IS NULL AND t.merged_into IS NULL
   AND bloom_support.can_read_ticket(v_actor, t.id) IS TRUE
 ORDER BY x.ts DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('ticket_id', r.id, 'number', r.number, 'subject', r.subject, 'status', r.status);
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_slack_recent_ticket(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_recent_ticket(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_slack_recent_answers(p_since timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'route', x.route, 'question', x.question, 'answer', x.answer, 'at', x.at) ORDER BY x.at DESC), '[]'::jsonb)
 FROM (
   SELECT j.payload->>'slack_question_route' AS route, left(j.payload->>'question', 300) AS question,
          left(r.answer, 700) AS answer, r.updated_at AS at
   FROM bloom_support.slack_conversation_replies r
   JOIN bloom_support.jobs j ON j.id = r.job_id
   WHERE r.state = 'final' AND r.updated_at >= greatest(p_since, now() - interval '8 days')
     AND j.payload->>'slack_conversation' = 'true'
   ORDER BY r.updated_at DESC LIMIT 200
 ) x;
$$;

REVOKE ALL ON FUNCTION public.bloom_support_slack_recent_answers(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_recent_answers(timestamptz) TO service_role;
