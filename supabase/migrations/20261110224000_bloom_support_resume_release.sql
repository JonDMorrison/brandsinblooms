-- Resume the existing release verifier, never start a new repair or approve a merge.
-- Existing-policy rollback remains part of verification; no release authority is added.
-- Reuses the existing engineering lane, permissions, retry limits and release verifier.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
CREATE OR REPLACE FUNCTION public.bloom_support_resume_release(p_actor uuid, p_issue uuid, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e bloom_support.engineering_issues; j bloom_support.jobs; t bloom_support.tickets; step text; job_id uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'automation.control');
  PERFORM bloom_support.require_permission(p_actor, 'engineering.approve');
  IF bloom_support.principal_role(p_actor) = 'service' THEN
    RAISE EXCEPTION 'forbidden: a person must request release tracking' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = p_issue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  IF p_version IS NULL OR e.version <> p_version THEN
    RAISE EXCEPTION 'conflict: engineering issue changed' USING ERRCODE = '40001';
  END IF;
  step := CASE WHEN e.status IN ('merged','deploying') THEN 'deploy' WHEN e.status = 'verifying' THEN 'verify' END;
  IF step IS NULL OR e.repository IS NULL OR e.merge_sha IS NULL THEN
    RAISE EXCEPTION 'blocked: only a recorded merged release can resume tracking' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO t FROM bloom_support.tickets
  WHERE engineering_issue_id = e.id AND merged_into IS NULL AND status <> 'resolved' AND NOT spam AND redacted_at IS NULL
  ORDER BY created_at, id LIMIT 1;
  IF t.id IS NULL OR bloom_support.can_read_ticket(p_actor, t.id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'forbidden: no accessible active ticket' USING ERRCODE = '42501';
  END IF;
  -- The engineering row serializes repeat requests. Existing queue/lease ownership wins.
  SELECT * INTO j FROM bloom_support.jobs WHERE engineering_issue_id = e.id
    AND kind IN ('investigate','engineering_step') AND status IN ('queued','running')
    ORDER BY created_at, id LIMIT 1;
  IF j.id IS NOT NULL THEN
    RETURN jsonb_build_object('queued',false,'reason','already_tracking','job_id',j.id,'status',j.status);
  END IF;
  SELECT * INTO j FROM bloom_support.jobs
    WHERE idempotency_key = 'resume-release:' || e.id::text || ':' || e.version::text;
  IF j.id IS NOT NULL THEN
    RETURN jsonb_build_object('queued',false,'reason','already_requested','job_id',j.id,'status',j.status);
  END IF;
  job_id := bloom_support.enqueue_job('engineering_step',t.id,e.id,'engineering:' || e.id::text,
    jsonb_build_object('step',step,'reason','resume_existing_release'),
    'resume-release:' || e.id::text || ':' || e.version::text,now(),3,300);
  SELECT * INTO j FROM bloom_support.jobs WHERE id = job_id;
  -- Same-snapshot replay returns the original receipt, including exhausted/completed jobs.
  -- It never resets attempts. Staff can inspect and use the existing explicit retry action.
  PERFORM bloom_support.log(t.id,t.account_id,p_actor,'engineering.tracking_requested',
    jsonb_build_object('engineering_issue_id',e.id,'engineering_version',e.version,'job_id',j.id,'step',step));
  RETURN jsonb_build_object('queued',j.status = 'queued','reason','existing_release','job_id',j.id,'status',j.status);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_resume_release(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_resume_release(uuid,uuid,integer) TO service_role;
