-- Bloom Support: a failed staff-only job never escalates a client's request.
--
-- Before: any dead job with a ticket_id raised an "automation failed"
-- escalation, moved the ticket to needs_owner and paged both owners. A staff
-- email PREVIEW enqueued against #1011 only to render a sample died on a
-- rendering bug, and the client's real request was escalated as if Bloom had
-- failed them.
--
-- After: only jobs whose failure affects what the client gets (triage,
-- answers, client emails, verification, repairs, ...) escalate. Previews and
-- staff-only work (notifications, digests, escalation emails) are recorded in
-- the activity log and still count in the watchdog's dead-job alert and the
-- daily digest, but they never escalate, never change the ticket and never
-- page anyone. A preview's failure is not written to the ticket's history at
-- all: the ticket was only borrowed to render a sample.

CREATE OR REPLACE FUNCTION bloom_support.job_failure_affects_client(j bloom_support.jobs)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT j.ticket_id IS NOT NULL
     AND coalesce(j.payload->>'preview', 'false') <> 'true'
     AND j.kind NOT IN ('notify', 'digest', 'escalate');
$$;
REVOKE ALL ON FUNCTION bloom_support.job_failure_affects_client(bloom_support.jobs) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bloom_support.fail_job(p_job uuid, p_worker text, p_error text, p_permanent boolean DEFAULT false, p_retry_in integer DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs; v_status text; v_preview boolean;
BEGIN
  SELECT * INTO j FROM bloom_support.jobs WHERE id = p_job AND status = 'running' AND locked_by = p_worker FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conflict: job lease lost' USING ERRCODE = '40001'; END IF;
  v_status := CASE WHEN p_permanent OR j.attempts >= j.max_attempts THEN 'dead' ELSE 'queued' END;
  UPDATE bloom_support.jobs SET status = v_status, last_error = left(p_error, 2000), lease_until = NULL, locked_by = NULL,
    run_after = now() + make_interval(secs => coalesce(p_retry_in, least(1800, 15 * power(2, j.attempts)::int))), updated_at = now()
  WHERE id = p_job;
  IF v_status <> 'dead' THEN RETURN v_status; END IF;

  IF bloom_support.job_failure_affects_client(j) THEN
    INSERT INTO bloom_support.escalations(ticket_id, engineering_issue_id, audience, reason, detail, dedupe_key)
    VALUES (j.ticket_id, j.engineering_issue_id, 'both', 'automation_failed', j.kind || ': ' || left(p_error, 500), 'job-dead:' || j.id::text)
    ON CONFLICT (dedupe_key) DO NOTHING;
    UPDATE bloom_support.tickets SET status = CASE WHEN status = 'resolved' THEN status ELSE 'needs_owner' END,
      stage = CASE WHEN status = 'resolved' THEN stage ELSE 'escalated' END,
      next_action = 'Bloom could not finish ' || j.kind || ' — review the error', updated_at = now()
    WHERE id = j.ticket_id;
    PERFORM bloom_support.log(j.ticket_id, NULL, NULL, 'job.dead', jsonb_build_object('job_id', j.id, 'kind', j.kind, 'error', left(p_error, 500)));
    PERFORM bloom_support.notify_staff(j.ticket_id, 'job.dead', 'Bloom failed: ' || j.kind, 'both');
  ELSE
    -- Staff-only or preview work: recorded, counted by the watchdog and the digest, never escalated.
    v_preview := coalesce(j.payload->>'preview', 'false') = 'true';
    PERFORM bloom_support.log(CASE WHEN v_preview THEN NULL ELSE j.ticket_id END, NULL, NULL, 'job.dead',
      jsonb_build_object('job_id', j.id, 'kind', j.kind, 'error', left(p_error, 500), 'escalated', false,
                         'why', CASE WHEN v_preview THEN 'preview' ELSE 'staff-only job' END));
  END IF;
  RETURN v_status;
END $$;
