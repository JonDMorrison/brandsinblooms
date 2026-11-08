-- Mention-based, read-only questions in the two staff context channels.
-- The app still receives only app_mention events and cannot read ordinary chatter.
CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_slack_question(
 p_event_id text, p_channel text, p_user_id text, p_question text, p_thread_ts text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j uuid; n bigint; route text;
BEGIN
 IF coalesce(bloom_support.setting('slack')->>'enabled','false')<>'true'
 THEN RETURN jsonb_build_object('queued',false,'reason','disabled'); END IF;
 route := CASE p_channel
   WHEN 'C0CFUG4LFLJ' THEN 'ask'
   WHEN 'C0CFWJDUQU9' THEN 'features'
   WHEN 'C0CFUHJ5ESW' THEN 'projects'
   ELSE NULL END;
 IF route IS NULL OR p_event_id !~ '^[A-Za-z0-9_-]{8,100}$'
 OR p_user_id !~ '^[UW][A-Z0-9]{8,24}$' OR p_thread_ts !~ '^[0-9]{10}[.][0-9]{6}$'
 OR length(p_question) NOT BETWEEN 3 AND 1000
 THEN RAISE EXCEPTION 'invalid Slack question' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM bloom_support.jobs
  WHERE (lane='slack:ask:'||p_user_id OR lane LIKE 'slack:ask:%:'||p_user_id)
    AND created_at>now()-interval '1 hour';
 IF n>=12 THEN RETURN jsonb_build_object('queued',false,'reason','staff rate limit'); END IF;
 j := bloom_support.enqueue_job(
   'notify',NULL,NULL,'slack:ask:'||route||':'||p_user_id,
   jsonb_build_object('slack_question',true,'slack_question_route',route,
     'question',p_question,'thread_ts',p_thread_ts),
   'slack:ask:'||p_event_id,now(),2,30);
 RETURN jsonb_build_object('queued',true,'job_id',j);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_enqueue_slack_question(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_slack_question(text,text,text,text,text) TO service_role;
