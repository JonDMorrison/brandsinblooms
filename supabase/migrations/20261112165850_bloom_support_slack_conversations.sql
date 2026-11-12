-- Staff-only conversations. Slack remains a read-only explanation surface.
-- No new Slack scopes, principals, ticket permissions or action authority.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE bloom_support.slack_conversations (
 channel_id text NOT NULL,
 root_ts text NOT NULL CHECK(root_ts ~ '^[0-9]{10}[.][0-9]{6}$'),
 slack_user_id text NOT NULL,
 route text NOT NULL CHECK(route IN ('ask','features','projects','tickets','alerts','finance','releases','clients')),
 ticket_id uuid REFERENCES bloom_support.tickets(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(channel_id,root_ts,slack_user_id)
);
CREATE TABLE bloom_support.slack_conversation_replies (
 job_id uuid PRIMARY KEY REFERENCES bloom_support.jobs(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','progress','final','unknown')),
 reply_ts text CHECK(reply_ts ~ '^[0-9]{10}[.][0-9]{6}$'),
 -- Only the sanitized answer actually sent, never raw API responses or errors.
 answer text CHECK(length(answer)<=2400),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bloom_support.slack_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_support.slack_conversation_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bloom_support.slack_conversations,bloom_support.slack_conversation_replies FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE bloom_support.slack_conversations,bloom_support.slack_conversation_replies TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_slack_conversation(
 p_event_id text,p_channel text,p_user_id text,p_question text,p_root_ts text,p_message_ts text,p_is_mention boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_route text; v_actor uuid; v_role text; v_ticket uuid; v_job uuid; v_n bigint;
BEGIN
 IF coalesce(bloom_support.setting('slack')->>'enabled','false')<>'true' THEN
  RETURN jsonb_build_object('queued',false,'reason','disabled'); END IF;
 v_route := CASE p_channel
  WHEN 'C0CFUG4LFLJ' THEN 'ask' WHEN 'C0CFWJDUQU9' THEN 'features'
  WHEN 'C0CFUHJ5ESW' THEN 'projects' WHEN 'C0CFNEQBS2X' THEN 'tickets'
  WHEN 'C0CFUG4STS6' THEN 'alerts' WHEN 'C0CGP4GPG8G' THEN 'finance'
  WHEN 'C0CFYDVE4A0' THEN 'releases' WHEN 'C0CFDBT8JAK' THEN 'clients' END;
 IF v_route IS NULL OR p_event_id IS NULL OR p_event_id !~ '^[A-Za-z0-9_-]{8,100}$'
 OR p_user_id IS NULL OR p_user_id !~ '^[UW][A-Z0-9]{8,24}$'
 OR p_root_ts IS NULL OR p_root_ts !~ '^[0-9]{10}[.][0-9]{6}$'
 OR p_message_ts IS NULL OR p_message_ts !~ '^[0-9]{10}[.][0-9]{6}$'
 OR p_question IS NULL OR length(p_question) NOT BETWEEN 1 AND 1000 OR p_is_mention IS NULL
 THEN RETURN jsonb_build_object('queued',false,'reason','invalid'); END IF;
 SELECT pr.id,pr.role INTO v_actor,v_role FROM bloom_support.slack_staff_principals m
 JOIN bloom_support.principals pr ON pr.id=m.principal_id
 WHERE m.slack_user_id=p_user_id AND m.enabled AND pr.active
 AND pr.role IN ('platform_admin','platform_operator','support');
 IF v_actor IS NULL OR (v_route='finance' AND v_role NOT IN ('platform_admin','platform_operator')) THEN
  RETURN jsonb_build_object('queued',false,'reason','unauthorized'); END IF;
 -- Serialize rate accounting and duplicate creation for this staff member.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('slack-conversation:'||p_user_id,0));
 SELECT id INTO v_job FROM bloom_support.jobs WHERE idempotency_key='slack:conversation:'||p_channel||':'||p_message_ts;
 IF v_job IS NOT NULL THEN RETURN jsonb_build_object('queued',false,'reason','duplicate','job_id',v_job); END IF;
 IF v_route='tickets' THEN
  SELECT th.ticket_id INTO v_ticket FROM bloom_support.slack_ticket_threads th
  JOIN bloom_support.tickets t ON t.id=th.ticket_id
  WHERE th.channel_id=p_channel AND th.root_ts=p_root_ts
  AND t.spam=false AND t.redacted_at IS NULL AND t.merged_into IS NULL;
  IF v_ticket IS NOT NULL AND (NOT bloom_support.has_permission(v_actor,'tickets.read_all')
    OR bloom_support.can_read_ticket(v_actor,v_ticket) IS DISTINCT FROM true) THEN
   RETURN jsonb_build_object('queued',false,'reason','unauthorized'); END IF;
 END IF;
 -- A plain message may continue only this user's known conversation or an
 -- established bot ticket root. Ordinary channel chatter is never ingested.
 IF NOT p_is_mention AND v_ticket IS NULL AND NOT EXISTS(
  SELECT 1 FROM bloom_support.slack_conversations WHERE channel_id=p_channel
   AND root_ts=p_root_ts AND slack_user_id=p_user_id
 ) THEN RETURN jsonb_build_object('queued',false,'reason','unknown_thread'); END IF;
 SELECT count(*) INTO v_n FROM bloom_support.jobs
 WHERE (lane='slack:ask:'||p_user_id OR lane LIKE 'slack:ask:%:'||p_user_id)
 AND created_at>now()-interval '1 hour';
 IF v_n>=30 THEN RETURN jsonb_build_object('queued',false,'reason','staff rate limit'); END IF;
 INSERT INTO bloom_support.slack_conversations(channel_id,root_ts,slack_user_id,route,ticket_id)
 VALUES(p_channel,p_root_ts,p_user_id,v_route,v_ticket) ON CONFLICT DO NOTHING;
 v_job:=bloom_support.enqueue_job('notify',v_ticket,NULL,'slack:ask:'||v_route||':'||p_user_id,
  jsonb_build_object('slack_question',true,'slack_conversation',true,'slack_question_route',v_route,
   'question',p_question,'thread_ts',p_root_ts,'channel_id',p_channel,'slack_user_id',p_user_id,'message_ts',p_message_ts),
  'slack:conversation:'||p_channel||':'||p_message_ts,now(),2,60);
 INSERT INTO bloom_support.slack_conversation_replies(job_id) VALUES(v_job) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('queued',true,'job_id',v_job);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_slack_conversation_context(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE j bloom_support.jobs; c bloom_support.slack_conversations; r bloom_support.slack_conversation_replies;
 v_actor uuid; v_role text; v_history jsonb;
BEGIN
 SELECT * INTO j FROM bloom_support.jobs WHERE id=p_job AND payload->>'slack_conversation'='true';
 IF NOT FOUND OR coalesce(bloom_support.setting('slack')->>'enabled','false')<>'true' THEN
  RETURN jsonb_build_object('allowed',false); END IF;
 SELECT * INTO c FROM bloom_support.slack_conversations WHERE channel_id=j.payload->>'channel_id'
 AND root_ts=j.payload->>'thread_ts' AND slack_user_id=j.payload->>'slack_user_id';
 IF NOT FOUND OR c.route IS DISTINCT FROM j.payload->>'slack_question_route' OR c.ticket_id IS DISTINCT FROM j.ticket_id THEN
  RETURN jsonb_build_object('allowed',false); END IF;
 SELECT pr.id,pr.role INTO v_actor,v_role FROM bloom_support.slack_staff_principals m
 JOIN bloom_support.principals pr ON pr.id=m.principal_id WHERE m.slack_user_id=c.slack_user_id
 AND m.enabled AND pr.active AND pr.role IN ('platform_admin','platform_operator','support');
 IF v_actor IS NULL OR (c.route='finance' AND v_role NOT IN ('platform_admin','platform_operator')) THEN
  RETURN jsonb_build_object('allowed',false); END IF;
 IF c.ticket_id IS NOT NULL AND (NOT bloom_support.has_permission(v_actor,'tickets.read_all')
  OR bloom_support.can_read_ticket(v_actor,c.ticket_id) IS DISTINCT FROM true OR NOT EXISTS(
   SELECT 1 FROM bloom_support.slack_ticket_threads th JOIN bloom_support.tickets t ON t.id=th.ticket_id
   WHERE th.ticket_id=c.ticket_id AND th.channel_id=c.channel_id AND th.root_ts=c.root_ts
   AND NOT t.spam AND t.redacted_at IS NULL AND t.merged_into IS NULL)) THEN
  RETURN jsonb_build_object('allowed',false); END IF;
 SELECT * INTO r FROM bloom_support.slack_conversation_replies WHERE job_id=p_job;
 SELECT coalesce(jsonb_agg(jsonb_build_object('question',q.question,'answer',q.answer) ORDER BY q.created_at),'[]') INTO v_history
 FROM (SELECT left(old.payload->>'question',1000) question,reply.answer,old.created_at
  FROM bloom_support.jobs old JOIN bloom_support.slack_conversation_replies reply ON reply.job_id=old.id
  WHERE old.payload->>'slack_conversation'='true' AND old.payload->>'channel_id'=c.channel_id
   AND old.payload->>'thread_ts'=c.root_ts AND old.payload->>'slack_user_id'=c.slack_user_id
   AND old.ticket_id IS NOT DISTINCT FROM c.ticket_id AND old.created_at<j.created_at
   AND reply.state='final' AND reply.answer IS NOT NULL
  ORDER BY old.created_at DESC LIMIT 6) q;
 RETURN jsonb_build_object('allowed',true,'principal_id',v_actor,'role',v_role,'channel',c.channel_id,
  'route',c.route,'root_ts',c.root_ts,'user_id',c.slack_user_id,'ticket_id',c.ticket_id,
  'history',v_history,'delivery_state',r.state,'reply_ts',r.reply_ts);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_claim_slack_reply(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r bloom_support.slack_conversation_replies;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM bloom_support.jobs WHERE id=p_job AND status='running')
 OR public.bloom_support_slack_conversation_context(p_job)->>'allowed' IS DISTINCT FROM 'true' THEN
  RETURN jsonb_build_object('claimed',false,'state','unauthorized'); END IF;
 SELECT * INTO r FROM bloom_support.slack_conversation_replies WHERE job_id=p_job FOR UPDATE;
 IF r.state='pending' THEN
  UPDATE bloom_support.slack_conversation_replies SET state='sending',updated_at=now() WHERE job_id=p_job;
  RETURN jsonb_build_object('claimed',true,'state','sending','reply_ts',NULL); END IF;
 RETURN jsonb_build_object('claimed',false,'state',r.state,'reply_ts',r.reply_ts);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_record_slack_reply(p_job uuid,p_reply_ts text,p_answer text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r bloom_support.slack_conversation_replies;
BEGIN
 IF p_reply_ts IS NULL OR p_reply_ts !~ '^[0-9]{10}[.][0-9]{6}$' OR length(p_answer)>2400 THEN
  RETURN jsonb_build_object('recorded',false); END IF;
 SELECT * INTO r FROM bloom_support.slack_conversation_replies WHERE job_id=p_job FOR UPDATE;
 IF NOT FOUND OR r.state NOT IN ('sending','progress','final')
 OR (r.reply_ts IS NOT NULL AND r.reply_ts<>p_reply_ts) OR
 (r.state='final' AND (p_answer IS NULL OR p_answer IS DISTINCT FROM r.answer)) THEN
  RETURN jsonb_build_object('recorded',false); END IF;
 UPDATE bloom_support.slack_conversation_replies SET reply_ts=p_reply_ts,
  answer=p_answer,state=CASE WHEN p_answer IS NULL THEN 'progress' ELSE 'final' END,updated_at=now() WHERE job_id=p_job;
 RETURN jsonb_build_object('recorded',true);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_mark_slack_reply_unknown(p_job uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE bloom_support.slack_conversation_replies SET state='unknown',updated_at=now()
 WHERE job_id=p_job AND state='sending' AND reply_ts IS NULL;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_enqueue_slack_conversation(text,text,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bloom_support_slack_conversation_context(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bloom_support_claim_slack_reply(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bloom_support_record_slack_reply(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bloom_support_mark_slack_reply_unknown(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_slack_conversation(text,text,text,text,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_conversation_context(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_claim_slack_reply(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_record_slack_reply(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_mark_slack_reply_unknown(uuid) TO service_role;
