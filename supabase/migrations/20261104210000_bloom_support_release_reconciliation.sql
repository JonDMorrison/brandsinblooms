-- A release evaluation can observe a merged pull request before the Edge
-- Function version that persists merge_sha has finished deploying.  The
-- original one-shot migration job then succeeds, so nothing naturally retries
-- it.  Reconcile stale release states from the minute worker instead.  The
-- active-job guard, recent-job cooldown and time-bucketed key make this safe
-- under concurrent worker invocations without creating a hot loop.

CREATE INDEX IF NOT EXISTS jobs_engineering_active
  ON bloom_support.jobs(engineering_issue_id, kind)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS jobs_engineering_history
  ON bloom_support.jobs(engineering_issue_id, created_at DESC)
  WHERE kind = 'engineering_step';

CREATE OR REPLACE FUNCTION public.bloom_support_enqueue_engineering_recoveries(p_actor uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_count integer;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'engineering.release');

  WITH candidates AS (
    SELECT
      issue.id,
      issue.status,
      CASE WHEN issue.status = 'awaiting_approval' THEN 3600 ELSE 600 END AS cooldown_seconds,
      (
        SELECT ticket.id
        FROM bloom_support.tickets AS ticket
        WHERE ticket.engineering_issue_id = issue.id
        ORDER BY ticket.created_at
        LIMIT 1
      ) AS ticket_id
    FROM bloom_support.engineering_issues AS issue
    WHERE issue.status IN ('in_review', 'approved', 'awaiting_approval')
      AND issue.repository IS NOT NULL
      AND issue.pr_number IS NOT NULL
      AND issue.merge_sha IS NULL
      AND issue.updated_at <= now() - interval '5 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM bloom_support.jobs AS active_job
        WHERE active_job.engineering_issue_id = issue.id
          AND active_job.kind = 'engineering_step'
          AND active_job.status IN ('queued', 'running')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM bloom_support.jobs AS recent_job
        WHERE recent_job.engineering_issue_id = issue.id
          AND recent_job.kind = 'engineering_step'
          AND recent_job.idempotency_key LIKE 'engineering-release-reconcile:' || issue.id::text || ':%'
          AND recent_job.created_at > now() - CASE
            WHEN issue.status = 'awaiting_approval' THEN interval '1 hour'
            ELSE interval '10 minutes'
          END
      )
  ), inserted AS (
    INSERT INTO bloom_support.jobs(
      kind,
      ticket_id,
      engineering_issue_id,
      lane,
      payload,
      idempotency_key,
      run_after,
      max_attempts,
      timeout_seconds
    )
    SELECT
      'engineering_step',
      candidate.ticket_id,
      candidate.id,
      'engineering:' || candidate.id::text,
      jsonb_build_object('step', 'evaluate', 'reason', 'release_state_reconcile'),
      'engineering-release-reconcile:' || candidate.id::text || ':' ||
        floor(extract(epoch FROM now()) / candidate.cooldown_seconds)::bigint::text,
      now(),
      5,
      300
    FROM candidates AS candidate
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted_count FROM inserted;

  RETURN inserted_count;
END
$$;

REVOKE ALL ON FUNCTION public.bloom_support_enqueue_engineering_recoveries(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_enqueue_engineering_recoveries(uuid) TO service_role;
