-- Signed Slack/GitHub/CMS ingress only queues restricted internal notices.
-- Requires service_role credentials in already signature-verifying Edge functions.
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';

CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_slack_external(
 p_source text, p_event_id text, p_kind text, p_url text DEFAULT NULL, p_project_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 j uuid;
 supported boolean;
 enabled boolean := coalesce(bloom_support.setting('slack')->>'enabled','false')='true';
BEGIN
 IF p_event_id !~ '^[A-Za-z0-9_-]{8,100}$' OR char_length(p_kind)>80
 THEN RAISE EXCEPTION 'invalid event' USING ERRCODE='22023'; END IF;
 supported := (p_source='github' AND p_kind IN (
   'github.pr_merged','github.pr_closed','github.checks_failed',
   'github.checks_passed','github.deployment_succeeded','github.deployment_failed'
 )) OR (p_source='cms' AND p_project_id IS NOT NULL AND p_kind IN (
   'major_project.created','major_project.stage_changed',
   'major_project.accepted','major_project.onboarding'
 ));
 IF NOT supported THEN RAISE EXCEPTION 'unsupported event' USING ERRCODE='22023'; END IF;
 IF NOT enabled THEN RETURN jsonb_build_object('queued',false,'reason','Slack integration disabled'); END IF;
 j := bloom_support.enqueue_job(
   'notify',NULL,NULL,'slack:external:'||p_source,
   jsonb_build_object('slack',true,'kind',p_kind,'github_url',
                     CASE WHEN p_source='github' THEN left(coalesce(p_url,''),250) ELSE NULL END,
                     'project_id', CASE WHEN p_source='cms' THEN p_project_id::text ELSE NULL END),
   'slack:external:'||p_source||':'||p_event_id,now(),3,30
 );
 RETURN jsonb_build_object('queued',true,'job_id',j);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_enqueue_slack_external(text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_slack_external(text,text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_slack_question(
 p_event_id text, p_channel text, p_user_id text, p_question text, p_thread_ts text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j uuid; n bigint;
BEGIN
 IF coalesce(bloom_support.setting('slack')->>'enabled','false')<>'true'
 THEN RETURN jsonb_build_object('queued',false,'reason','disabled'); END IF;
 IF p_channel<>'C0CFUG4LFLJ' OR p_event_id !~ '^[A-Za-z0-9_-]{8,100}$'
 OR p_user_id !~ '^[UW][A-Z0-9]{8,24}$' OR p_thread_ts !~ '^[0-9]{10}[.][0-9]{6}$'
 OR length(p_question) NOT BETWEEN 3 AND 1000
 THEN RAISE EXCEPTION 'invalid Slack question' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM bloom_support.jobs
  WHERE lane='slack:ask:'||p_user_id AND created_at>now()-interval '1 hour';
 IF n>=6 THEN RETURN jsonb_build_object('queued',false,'reason','staff rate limit'); END IF;
 j := bloom_support.enqueue_job(
   'notify',NULL,NULL,'slack:ask:'||p_user_id,
   jsonb_build_object('slack_question',true,'question',p_question,'thread_ts',p_thread_ts),
   'slack:ask:'||p_event_id,now(),2,30);
 RETURN jsonb_build_object('queued',true,'job_id',j);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_enqueue_slack_question(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_slack_question(text,text,text,text,text) TO service_role;

-- One tiny daily job for yesterday/today's platform Stripe payouts, not an
-- additional AI agent or a high-frequency network monitor. Guarded by flags.
SELECT cron.schedule('bloom-support-slack-finance-daily','0 16 * * *',$cron$
SELECT bloom_support.enqueue_job(
 'notify',NULL,NULL,'slack:finance',
 '{"finance_daily":true}'::jsonb,
 'slack:finance:daily:'||to_char((now() at time zone 'America/Vancouver')::date,'YYYYMMDD'),
 now(),3,45)
WHERE coalesce(bloom_support.setting('slack')->>'enabled','false')='true'
  AND coalesce(bloom_support.setting('slack')->>'finance_enabled','false')='true';
$cron$);
