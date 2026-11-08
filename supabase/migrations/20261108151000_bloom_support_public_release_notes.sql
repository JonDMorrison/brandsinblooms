-- Keep signed GitHub releases plain-English and free of raw PR titles.
-- A PR title is untrusted; the webhook converts it to a fixed, pre-reviewed
-- public-safe category before it reaches Bloom Support or the public channel.
-- Preserve the original signed CMS and GitHub external-event functions.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_slack_github(
  p_event_id text, p_kind text, p_url text DEFAULT NULL, p_category text DEFAULT 'other'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  j uuid;
  enabled boolean := coalesce(bloom_support.setting('slack')->>'enabled','false') = 'true';
BEGIN
  IF p_event_id !~ '^[A-Za-z0-9_-]{8,100}$'
    OR p_kind NOT IN (
      'github.pr_merged', 'github.pr_closed', 'github.checks_failed',
      'github.checks_passed', 'github.deployment_succeeded', 'github.deployment_failed'
    ) THEN
    RAISE EXCEPTION 'invalid GitHub release event' USING ERRCODE = '22023';
  END IF;
  -- Fail closed for unknown classifications; never store the original PR text.
  IF p_category NOT IN (
    'support_tasks','integration_checks','checkout','delivery','newsletters',
    'catalogue','pos','website','security','performance','projects',
    'support','other'
  ) THEN
    RAISE EXCEPTION 'unsupported release category' USING ERRCODE = '22023';
  END IF;
  IF NOT enabled THEN
    RETURN pg_catalog.jsonb_build_object('queued',false,'reason','Slack integration disabled');
  END IF;
  j := bloom_support.enqueue_job(
    'notify',NULL,NULL,'slack:external:github',
    pg_catalog.jsonb_build_object(
      'slack',true,'kind',p_kind,
      'github_url',pg_catalog.left(pg_catalog.coalesce(p_url,''),250),
      'release_category',p_category
    ),
    'slack:external:github:' || p_event_id,pg_catalog.now(),3,30
  );
  RETURN pg_catalog.jsonb_build_object('queued',true,'job_id',j);
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_enqueue_slack_github(text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_slack_github(text,text,text,text)
  TO service_role;
