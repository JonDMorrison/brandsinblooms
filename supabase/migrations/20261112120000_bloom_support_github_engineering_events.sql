-- Verified webhook hints reuse the existing engineering lane and policy worker.
-- Receipts contain identifiers only, never webhook bodies or release authority.
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
CREATE TABLE bloom_support.github_engineering_receipts (
  repository text NOT NULL,
  delivery text NOT NULL,
  engineering_issue_id uuid NOT NULL REFERENCES bloom_support.engineering_issues(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repository, delivery, engineering_issue_id)
);
ALTER TABLE bloom_support.github_engineering_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.github_engineering_receipts FROM PUBLIC, anon, authenticated;
CREATE INDEX github_engineering_receipts_recent ON bloom_support.github_engineering_receipts(engineering_issue_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_github_engineering(
  p_delivery text, p_repository text, p_pr integer, p_sha text, p_deployment boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  issue bloom_support.engineering_issues;
  active_job bloom_support.jobs;
  wanted_step text;
  ticket_id uuid;
  inserted integer;
  queued integer := 0;
BEGIN
  IF p_delivery IS NULL OR p_delivery !~ '^[0-9a-fA-F-]{30,50}$'
    OR p_sha IS NULL OR p_sha !~ '^[0-9a-f]{40}$'
    OR p_repository IS NULL OR p_repository NOT IN (
      'JonDMorrison/brandsinblooms','Brands-In-Blooms/cms-brandsinblooms','Brands-In-Blooms/bloomtill')
    OR p_deployment IS NULL OR (NOT p_deployment AND (p_pr IS NULL OR p_pr <= 0))
  THEN RAISE EXCEPTION 'invalid event identifiers' USING ERRCODE='22023'; END IF;

  -- Share reconciliation's lock so its fallback cannot race an event insert.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bloom_support:engineering-release-reconcile', 0));
  FOR issue IN SELECT e.* FROM bloom_support.engineering_issues e
    WHERE e.repository = p_repository AND e.pr_number IS NOT NULL
      AND ((NOT p_deployment AND e.pr_number = p_pr AND e.head_sha = p_sha
            AND e.status IN ('in_review','awaiting_approval','approved'))
        OR (p_deployment AND e.status = 'deploying'
            AND (e.merge_sha = p_sha OR e.deployment->>'production_sha' = p_sha)))
    FOR UPDATE
  LOOP
    -- Never clear a human handoff or reset attempt/deployment counters. Polling
    -- may still observe a human's release through its existing guarded path.
    IF EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id = issue.id
      AND (t.automation <> 'auto' OR t.executor = 'person')) THEN CONTINUE; END IF;
    IF issue.reproduction->>'needs_human' = 'true' AND issue.status <> 'approved' THEN CONTINUE; END IF;
    INSERT INTO bloom_support.github_engineering_receipts(repository, delivery, engineering_issue_id)
      VALUES(p_repository, p_delivery, issue.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted = 0 THEN CONTINUE; END IF;
    -- Burst coalescing bounds wakeups without resetting retry/backoff budgets.
    IF EXISTS (SELECT 1 FROM bloom_support.github_engineering_receipts r
      WHERE r.engineering_issue_id = issue.id AND r.delivery <> p_delivery
        AND r.created_at > now() - interval '1 minute') THEN CONTINUE; END IF;
    wanted_step := CASE WHEN p_deployment THEN 'deploy' ELSE 'evaluate' END;
    SELECT * INTO active_job FROM bloom_support.jobs j
      WHERE j.engineering_issue_id = issue.id AND j.kind IN ('investigate','engineering_step')
        AND j.status IN ('queued','running')
      ORDER BY (j.status = 'running') DESC, j.created_at LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      -- A running owner consumes the freshest GitHub facts; recovery polls
      -- cover an event that arrives after that read. Never add a second chain.
      IF active_job.status = 'queued' AND active_job.attempts = 0
        AND active_job.payload->>'step' = wanted_step THEN
        UPDATE bloom_support.jobs SET run_after = least(run_after, now()) WHERE id = active_job.id;
        queued := queued + 1;
      END IF;
      CONTINUE;
    END IF;
    -- Exhausted/failed jobs require the existing operator recovery path, not
    -- a fresh event key with a fresh retry budget.
    IF (SELECT j.status FROM bloom_support.jobs j
      WHERE j.engineering_issue_id = issue.id AND j.kind = 'engineering_step'
        AND j.payload->>'step' = wanted_step
      ORDER BY j.created_at DESC, j.id DESC LIMIT 1) IN ('dead','failed','cancelled') THEN CONTINUE; END IF;
    SELECT t.id INTO ticket_id FROM bloom_support.tickets t WHERE t.engineering_issue_id = issue.id ORDER BY t.created_at LIMIT 1;
    PERFORM bloom_support.enqueue_job('engineering_step', ticket_id, issue.id,
      'engineering:' || issue.id::text, jsonb_build_object('step',wanted_step,'reason','verified_github_event'),
      'github-engineering:' || p_delivery || ':' || issue.id::text, now(), 3, 300);
    queued := queued + 1;
  END LOOP;
  RETURN queued;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_enqueue_github_engineering(text,text,integer,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_github_engineering(text,text,integer,text,boolean) TO service_role;
