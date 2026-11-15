CREATE TABLE bloom_support.github_release_receipts (
 event_id text PRIMARY KEY,
 kind text NOT NULL,
 source_url text,
 category text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bloom_support.github_release_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.github_release_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX github_release_receipts_recent ON bloom_support.github_release_receipts(created_at DESC);

-- Correlate signed release notices using existing recorded provider identities.
-- This observes links; it never advances engineering/ticket state or approves work.
CREATE OR REPLACE FUNCTION bloom_support.release_matches_engineering(p_url text,p_issue uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
   SELECT 1 FROM bloom_support.engineering_issues e,
     LATERAL regexp_match(p_url,'^https://github[.]com/(JonDMorrison/brandsinblooms|Brands-In-Blooms/cms-brandsinblooms|Brands-In-Blooms/bloomtill)/(pull|deployments)/([1-9][0-9]*)$') parts
   WHERE e.id=p_issue AND e.repository=parts[1] AND (
     (parts[2]='pull' AND e.pr_number::text=parts[3]) OR
     (parts[2]='deployments' AND (e.deployment->>'deployment_id'=parts[3] OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.deployment->'deployments')='array' THEN e.deployment->'deployments' ELSE '[]'::jsonb END) d
       WHERE d->>'deployment_id'=parts[3])))))
$$;
REVOKE ALL ON FUNCTION bloom_support.release_matches_engineering(text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_slack_github(
 p_event_id text,p_kind text,p_url text DEFAULT NULL,p_category text DEFAULT 'other')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j uuid; t record; linked integer; matchable boolean; linkage text; matches jsonb; result jsonb; prior bloom_support.github_release_receipts; legacy bloom_support.jobs;
BEGIN
 IF p_event_id IS NULL OR p_event_id !~ '^[A-Za-z0-9_-]{8,100}$' OR p_kind IS NULL OR p_kind NOT IN (
   'github.pr_merged','github.pr_closed','github.checks_failed','github.checks_passed','github.deployment_succeeded','github.deployment_failed') THEN
   RAISE EXCEPTION 'invalid GitHub release event' USING ERRCODE='22023'; END IF;
 IF p_category IS NULL OR p_category NOT IN ('support_tasks','integration_checks','checkout','delivery','newsletters','catalogue','pos','website','security','performance','projects','support','other') THEN
   RAISE EXCEPTION 'unsupported release category' USING ERRCODE='22023'; END IF;
 IF coalesce(bloom_support.setting('slack')->>'enabled','false')<>'true' THEN
   RETURN jsonb_build_object('queued',false,'reason','Slack integration disabled'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('slack:github-release:'||p_event_id,0));
 SELECT * INTO prior FROM bloom_support.github_release_receipts WHERE event_id=p_event_id;
 IF FOUND THEN
   IF prior.kind IS DISTINCT FROM p_kind OR prior.source_url IS DISTINCT FROM p_url OR prior.category IS DISTINCT FROM p_category THEN
     RAISE EXCEPTION 'conflict: release event identity reused with different content' USING ERRCODE='23505'; END IF;
   RETURN prior.result;
 END IF;
 SELECT * INTO legacy FROM bloom_support.jobs WHERE idempotency_key='slack:external:github:'||p_event_id;
 IF FOUND THEN
   IF legacy.payload->>'kind' IS DISTINCT FROM p_kind OR coalesce(legacy.payload->>'github_url','') IS DISTINCT FROM coalesce(p_url,'')
     OR legacy.payload->>'release_category' IS DISTINCT FROM p_category THEN
     RAISE EXCEPTION 'conflict: legacy release identity reused' USING ERRCODE='23505'; END IF;
   result:=jsonb_build_object('queued',true,'job_id',legacy.id,'support_linkage','legacy_unchecked');
   INSERT INTO bloom_support.github_release_receipts(event_id,kind,source_url,category,result) VALUES(p_event_id,p_kind,p_url,p_category,result);
   RETURN result;
 END IF;
 matchable := coalesce((p_kind='github.pr_merged' AND p_url ~ '/pull/[1-9][0-9]*$') OR
   (p_kind IN ('github.deployment_succeeded','github.deployment_failed') AND p_url ~ '/deployments/[1-9][0-9]*$'),false)
   AND coalesce(p_url ~ '^https://github[.]com/(JonDMorrison/brandsinblooms|Brands-In-Blooms/cms-brandsinblooms|Brands-In-Blooms/bloomtill)/',false);
 SELECT coalesce(jsonb_agg(to_jsonb(candidate)),'[]'::jsonb) INTO matches FROM (
   SELECT id,engineering_issue_id FROM bloom_support.tickets ticket_row WHERE matchable
     AND ticket_row.engineering_issue_id IS NOT NULL AND NOT ticket_row.spam AND ticket_row.redacted_at IS NULL AND ticket_row.merged_into IS NULL
     AND bloom_support.release_matches_engineering(p_url,ticket_row.engineering_issue_id) LIMIT 51) candidate;
 linked:=jsonb_array_length(matches);
 IF linked BETWEEN 1 AND 50 THEN
   FOR t IN SELECT * FROM jsonb_to_recordset(matches) AS item(id uuid,engineering_issue_id uuid)
   LOOP
     j:=bloom_support.enqueue_job('notify',t.id,t.engineering_issue_id,'slack:'||t.id::text,
       jsonb_build_object('slack',true,'kind','engineering.release_observed','github_kind',p_kind,
         'github_url',p_url,'support_linkage','recorded'),
       'slack:external:github:'||p_event_id||':ticket:'||t.id::text,now(),3,30);
   END LOOP;
   result:=jsonb_build_object('queued',true,'linked_tickets',linked,'support_linkage','recorded');
   INSERT INTO bloom_support.github_release_receipts(event_id,kind,source_url,category,result) VALUES(p_event_id,p_kind,p_url,p_category,result);
   RETURN result;
 END IF;
 linkage:=CASE WHEN NOT matchable THEN 'not_checked' WHEN linked>50 THEN 'review_many_links' ELSE 'unmatched' END;
 j:=bloom_support.enqueue_job('notify',NULL,NULL,'slack:external:github',
   jsonb_build_object('slack',true,'kind',p_kind,'github_url',left(coalesce(p_url,''),250),'release_category',p_category,'support_linkage',linkage),
   'slack:external:github:'||p_event_id,now(),3,30);
 result:=jsonb_build_object('queued',true,'job_id',j,'support_linkage',linkage);
 INSERT INTO bloom_support.github_release_receipts(event_id,kind,source_url,category,result) VALUES(p_event_id,p_kind,p_url,p_category,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_enqueue_slack_github(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_slack_github(text,text,text,text) TO service_role;

-- Read-only operator audit: unlinked releases are candidates, not proof of missing
-- client intake. No ticket is created and no extra alert or customer mail is sent.
CREATE OR REPLACE FUNCTION bloom_support.unlinked_release_report(p_actor uuid,p_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM bloom_support.require_permission(p_actor,'tickets.read_all');
 IF NOT EXISTS(SELECT 1 FROM bloom_support.principals WHERE id=p_actor AND kind='user' AND active AND role IN ('platform_admin','platform_operator')) THEN
   RAISE EXCEPTION 'forbidden: operator audit required' USING ERRCODE='42501'; END IF;
 IF p_since IS NULL OR NOT isfinite(p_since) OR p_since>now() OR p_since<now()-interval '31 days' THEN
   RAISE EXCEPTION 'invalid bounded audit period' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('source',x.source_url,'event',x.kind,
   'linkage_at_reception',x.result->>'support_linkage','received_at',x.created_at) ORDER BY x.created_at DESC),'[]'::jsonb)
   FROM (SELECT r.* FROM bloom_support.github_release_receipts r WHERE r.created_at>=p_since
     AND r.result->>'support_linkage' IN ('unmatched','review_many_links')
     AND ((r.result->>'support_linkage'='unmatched' AND NOT EXISTS (
       SELECT 1 FROM bloom_support.tickets t WHERE NOT t.spam AND t.redacted_at IS NULL AND t.merged_into IS NULL
         AND bloom_support.release_matches_engineering(r.source_url,t.engineering_issue_id)))
       OR (r.result->>'support_linkage'='review_many_links' AND (SELECT count(*) FROM bloom_support.tickets t
         WHERE NOT t.spam AND t.redacted_at IS NULL AND t.merged_into IS NULL
           AND bloom_support.release_matches_engineering(r.source_url,t.engineering_issue_id))>50))
     ORDER BY r.created_at DESC LIMIT 100) x);
END $$;
REVOKE ALL ON FUNCTION bloom_support.unlinked_release_report(uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
