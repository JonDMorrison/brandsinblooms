-- Read only, bounded to an already-authorized Slack conversation job.
CREATE OR REPLACE FUNCTION public.bloom_support_slack_release_evidence(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; asked_at timestamptz; exact_count integer; records jsonb;
BEGIN
 c:=public.bloom_support_slack_conversation_context(p_job);
 IF c->>'allowed' IS DISTINCT FROM 'true' OR c->>'ticket_id' IS NOT NULL THEN
   RAISE EXCEPTION 'forbidden: authorized unbound staff conversation required' USING ERRCODE='42501'; END IF;
 PERFORM bloom_support.require_permission((c->>'principal_id')::uuid,'tickets.read_all');
 SELECT created_at INTO asked_at FROM bloom_support.jobs WHERE id=p_job;
 WITH candidates AS (
   SELECT r.*, coalesce(j.status='succeeded' AND j.payload->>'kind'=r.kind
     AND j.payload->>'github_url'=r.source_url AND j.payload->>'slack'='true' AND j.ticket_id IS NULL
     AND j.result->'slack_delivery'->>'route'=c->>'route'
     AND j.result->'slack_delivery'->>'channel'=c->>'channel'
     AND j.result->'slack_delivery'->>'ts'=c->>'root_ts',false) exact
   FROM bloom_support.github_release_receipts r LEFT JOIN bloom_support.jobs j ON j.id::text=r.result->>'job_id'
   WHERE r.created_at BETWEEN asked_at-interval '7 days' AND asked_at
     AND r.kind IN ('github.pr_merged','github.deployment_succeeded','github.deployment_failed')
     AND r.source_url ~ '^https://github[.]com/(JonDMorrison/brandsinblooms|Brands-In-Blooms/cms-brandsinblooms|Brands-In-Blooms/bloomtill)/(pull|deployments)/[1-9][0-9]*$'
 ), ranked AS (
   SELECT *, row_number() OVER (PARTITION BY (kind='github.pr_merged') ORDER BY created_at DESC,event_id) ordinal,
     count(*) FILTER (WHERE exact) OVER () exact_n FROM candidates
 ), chosen AS (
   SELECT * FROM ranked WHERE (exact_n=1 AND exact)
     OR (exact_n<>1 AND created_at>=asked_at-interval '1 day' AND ordinal<=3)
 ) SELECT coalesce(max(exact_n),0),coalesce(jsonb_agg(jsonb_build_object('kind',kind,'url',source_url,'category',category,
     'received_at',created_at) ORDER BY created_at DESC,event_id),'[]') INTO exact_count,records FROM chosen;
 RETURN jsonb_build_object('principal_id',c->>'principal_id','role',c->>'role','channel',c->>'channel',
   'route',c->>'route','root_ts',c->>'root_ts','user_id',c->>'user_id',
   'scope',CASE WHEN exact_count=1 THEN 'notification' ELSE 'recent_sample' END,
   'as_of',asked_at,'records',records);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_slack_release_evidence(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_release_evidence(uuid) TO service_role;
