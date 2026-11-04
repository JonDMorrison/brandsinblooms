-- Durable Ask Bloom chat plans on the Bloom Support job queue.
--
-- Each approved step of a multi-step chat plan becomes one bloom_support.jobs
-- row (kind 'chat_plan_step'). The job holds the exact approved tool call, the
-- lease, the attempt count, the retry time and the dead letter. Steps run
-- inside the person's own bloom-assist request (their session, their
-- permissions), never in the background worker, so claim_jobs skips this kind.
-- Exactly-once execution stays with public.bloom_action_claims
-- (mutation_id 'plan:<plan_id>:<task_id>').
--
-- Every function is scoped to the plan's tenant and user, which bloom-assist
-- derives from the session. Only service_role can call the gateway.

-- ---------------------------------------------------------------------------
-- 1. New job kind and scope
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.jobs DROP CONSTRAINT jobs_kind_check;
ALTER TABLE bloom_support.jobs ADD CONSTRAINT jobs_kind_check CHECK (kind IN (
  'triage','answer','operate','investigate','engineering_step','send_email','verify_resolution',
  'escalate','notify','post_resolution_reply','digest','chat_plan_step'));

ALTER TABLE bloom_support.jobs ALTER COLUMN scope SET EXPRESSION AS (
  CASE kind WHEN 'triage' THEN 'triage' WHEN 'answer' THEN 'answer' WHEN 'post_resolution_reply' THEN 'triage'
    WHEN 'send_email' THEN 'email' WHEN 'escalate' THEN 'email' WHEN 'notify' THEN 'email' WHEN 'digest' THEN 'email'
    WHEN 'operate' THEN 'operations' WHEN 'verify_resolution' THEN 'triage' WHEN 'chat_plan_step' THEN 'chat'
    ELSE 'engineering' END);

CREATE INDEX IF NOT EXISTS jobs_chat_plan ON bloom_support.jobs ((payload->>'plan_id')) WHERE kind = 'chat_plan_step';

-- ---------------------------------------------------------------------------
-- 2. The worker never claims chat plan steps (they need the person's session).
--    Body copied from 20261031150000_bloom_support_desk.sql; only the kind
--    filter is new. Expired leases are still swept for every kind.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.claim_jobs(p_worker text, p_limit integer DEFAULT 5)
RETURNS SETOF bloom_support.jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs; n int := 0; scopes jsonb := coalesce(bloom_support.setting('automation_scopes'), '{}'); repo text;
BEGIN
  UPDATE bloom_support.jobs SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
    last_error = coalesce(last_error || ' | ', '') || 'lease expired', lease_until = NULL, locked_by = NULL,
    run_after = now() + make_interval(secs => least(600, 15 * power(2, attempts)::int)), updated_at = now()
  WHERE status = 'running' AND lease_until < now();
  IF NOT coalesce((bloom_support.setting('automation_enabled'))::text::boolean, false) THEN RETURN; END IF;
  FOR j IN
    SELECT q.* FROM bloom_support.jobs q
    LEFT JOIN bloom_support.tickets t ON t.id = q.ticket_id
    LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
    WHERE q.status = 'queued' AND q.run_after <= now()
      AND q.kind <> 'chat_plan_step'
      AND coalesce((scopes->>q.scope)::boolean, true)
      AND NOT coalesce(a.automation_paused, false)
      AND NOT EXISTS (SELECT 1 FROM bloom_support.jobs r WHERE r.lane = q.lane AND r.status = 'running')
    ORDER BY q.run_after, q.created_at
    FOR UPDATE OF q SKIP LOCKED
  LOOP
    EXIT WHEN n >= p_limit;
    CONTINUE WHEN EXISTS (SELECT 1 FROM bloom_support.jobs r WHERE r.lane = j.lane AND r.status = 'running');
    IF j.scope = 'engineering' AND j.engineering_issue_id IS NOT NULL THEN
      SELECT repository INTO repo FROM bloom_support.engineering_issues WHERE id = j.engineering_issue_id;
      CONTINUE WHEN repo IS NOT NULL AND EXISTS (
        SELECT 1 FROM bloom_support.jobs r JOIN bloom_support.engineering_issues e ON e.id = r.engineering_issue_id
        WHERE r.status = 'running' AND r.scope = 'engineering' AND e.repository = repo AND e.id <> j.engineering_issue_id);
    END IF;
    UPDATE bloom_support.jobs SET status = 'running', attempts = attempts + 1, locked_by = p_worker,
      lease_until = now() + make_interval(secs => timeout_seconds), updated_at = now()
    WHERE id = j.id RETURNING * INTO j;
    n := n + 1;
    RETURN NEXT j;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Chat plan step functions (owner-scoped)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.chat_plan_step_json(j bloom_support.jobs)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'job_id', j.id, 'task_id', j.payload->>'task_id', 'tool_name', j.payload->>'tool_name',
    'tool_params', j.payload->'tool_params', 'status', j.status, 'attempts', j.attempts,
    'max_attempts', j.max_attempts, 'run_after', j.run_after, 'lease_until', j.lease_until,
    'last_error', j.last_error, 'result', j.result)
$$;

CREATE OR REPLACE FUNCTION bloom_support.chat_plan_steps(p_tenant uuid, p_user uuid, p_plan uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(bloom_support.chat_plan_step_json(j) ORDER BY j.created_at, j.payload->>'task_id'), '[]'::jsonb)
  FROM bloom_support.jobs j
  WHERE j.kind = 'chat_plan_step' AND j.payload->>'plan_id' = p_plan::text
    AND j.payload->>'tenant_id' = p_tenant::text AND j.payload->>'user_id' = p_user::text
$$;

-- Idempotent: one job per plan step for life. A step owned by someone else is refused.
CREATE OR REPLACE FUNCTION bloom_support.chat_plan_enqueue(
  p_tenant uuid, p_user uuid, p_conversation uuid, p_message uuid, p_plan uuid, p_steps jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s jsonb; k text; owner jsonb;
BEGIN
  IF p_conversation IS NULL OR p_message IS NULL THEN
    RAISE EXCEPTION 'invalid: conversation_id and message_id are required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_steps) IS DISTINCT FROM 'array' OR jsonb_array_length(p_steps) > 50 THEN
    RAISE EXCEPTION 'invalid: steps must be an array of at most 50' USING ERRCODE = '22023';
  END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(p_steps) LOOP
    IF coalesce(s->>'task_id', '') !~ '^task_[0-9]+$' OR coalesce(s->>'tool_name', '') = ''
       OR jsonb_typeof(s->'tool_params') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'invalid: step needs task_id, tool_name and tool_params' USING ERRCODE = '22023';
    END IF;
    k := 'chat-plan:' || p_plan::text || ':' || (s->>'task_id');
    INSERT INTO bloom_support.jobs(kind, lane, payload, idempotency_key, max_attempts, timeout_seconds)
    VALUES ('chat_plan_step', 'chat-plan:' || p_plan::text,
      jsonb_build_object('tenant_id', p_tenant, 'user_id', p_user, 'conversation_id', p_conversation,
        'message_id', p_message, 'plan_id', p_plan, 'task_id', s->>'task_id',
        'tool_name', s->>'tool_name', 'tool_params', s->'tool_params'),
      k, 3, 120)
    ON CONFLICT (idempotency_key) DO NOTHING;
    SELECT payload INTO owner FROM bloom_support.jobs WHERE idempotency_key = k;
    IF owner->>'tenant_id' IS DISTINCT FROM p_tenant::text OR owner->>'user_id' IS DISTINCT FROM p_user::text THEN
      RAISE EXCEPTION 'forbidden: plan' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN bloom_support.chat_plan_steps(p_tenant, p_user, p_plan);
END $$;

-- Leases one step: a queued step whose retry time has come, or a step whose
-- earlier lease expired (the request that held it died). NULL if not claimable.
CREATE OR REPLACE FUNCTION bloom_support.chat_plan_claim_step(p_tenant uuid, p_user uuid, p_plan uuid, p_task text, p_worker text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs;
BEGIN
  IF coalesce(p_worker, '') = '' THEN RAISE EXCEPTION 'invalid: worker required' USING ERRCODE = '22023'; END IF;
  UPDATE bloom_support.jobs SET status = 'running', attempts = attempts + 1, locked_by = p_worker,
    lease_until = now() + make_interval(secs => timeout_seconds), updated_at = now()
  WHERE idempotency_key = 'chat-plan:' || p_plan::text || ':' || p_task
    AND kind = 'chat_plan_step'
    AND payload->>'tenant_id' = p_tenant::text AND payload->>'user_id' = p_user::text
    AND ((status = 'queued' AND run_after <= now())
      OR (status = 'running' AND lease_until < now() AND attempts < max_attempts))
  RETURNING * INTO j;
  IF j.id IS NULL THEN RETURN NULL; END IF;
  RETURN bloom_support.chat_plan_step_json(j);
END $$;

-- Records a step outcome through the shared complete_job / fail_job.
CREATE OR REPLACE FUNCTION bloom_support.chat_plan_finish_step(
  p_tenant uuid, p_user uuid, p_plan uuid, p_job uuid, p_worker text, p_outcome text,
  p_error text DEFAULT NULL, p_permanent boolean DEFAULT false, p_retry_in integer DEFAULT NULL, p_result jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bloom_support.jobs WHERE id = p_job AND kind = 'chat_plan_step'
      AND payload->>'plan_id' = p_plan::text
      AND payload->>'tenant_id' = p_tenant::text AND payload->>'user_id' = p_user::text) THEN
    RAISE EXCEPTION 'forbidden: plan step' USING ERRCODE = '42501';
  END IF;
  IF p_outcome = 'succeeded' THEN
    PERFORM bloom_support.complete_job(p_job, p_worker, coalesce(p_result, '{}'::jsonb));
    RETURN 'succeeded';
  ELSIF p_outcome = 'failed' THEN
    RETURN bloom_support.fail_job(p_job, p_worker, coalesce(p_error, 'step failed'), coalesce(p_permanent, false), p_retry_in);
  END IF;
  RAISE EXCEPTION 'invalid: outcome' USING ERRCODE = '22023';
END $$;

-- Cancels pending steps only. A running step is left to finish. A step whose
-- lease expired counts as pending only when its exactly-once claim shows it
-- never started (no claim, or a failed claim that changed nothing).
CREATE OR REPLACE FUNCTION bloom_support.chat_plan_cancel(p_tenant uuid, p_user uuid, p_plan uuid, p_tasks jsonb DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ids jsonb;
BEGIN
  WITH hit AS (
    UPDATE bloom_support.jobs j SET status = 'cancelled', last_error = left(coalesce(p_reason, 'cancelled by person'), 500),
      lease_until = NULL, locked_by = NULL, updated_at = now()
    WHERE j.kind = 'chat_plan_step' AND j.payload->>'plan_id' = p_plan::text
      AND j.payload->>'tenant_id' = p_tenant::text AND j.payload->>'user_id' = p_user::text
      AND (p_tasks IS NULL OR j.payload->>'task_id' IN (SELECT jsonb_array_elements_text(p_tasks)))
      AND (j.status = 'queued' OR (j.status = 'running' AND j.lease_until < now() AND NOT EXISTS (
        SELECT 1 FROM public.bloom_action_claims c
        WHERE c.mutation_id = 'plan:' || p_plan::text || ':' || (j.payload->>'task_id')
          AND c.status IN ('executing', 'completed'))))
    RETURNING j.payload->>'task_id' AS task_id)
  SELECT coalesce(jsonb_agg(task_id ORDER BY task_id), '[]'::jsonb) INTO ids FROM hit;
  RETURN ids;
END $$;

-- The person retries a failed, dead-lettered or blocked step: a fresh attempt budget.
CREATE OR REPLACE FUNCTION bloom_support.chat_plan_requeue_step(p_tenant uuid, p_user uuid, p_plan uuid, p_task text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs;
BEGIN
  UPDATE bloom_support.jobs SET status = 'queued', attempts = 0, run_after = now(), lease_until = NULL, locked_by = NULL,
    last_error = left(coalesce(last_error || ' | ', '') || 'retried by person', 2000), updated_at = now()
  WHERE idempotency_key = 'chat-plan:' || p_plan::text || ':' || p_task AND kind = 'chat_plan_step'
    AND payload->>'tenant_id' = p_tenant::text AND payload->>'user_id' = p_user::text
    AND status IN ('failed', 'dead', 'cancelled')
  RETURNING * INTO j;
  IF j.id IS NULL THEN RETURN NULL; END IF;
  RETURN bloom_support.chat_plan_step_json(j);
END $$;

REVOKE ALL ON FUNCTION bloom_support.chat_plan_step_json(bloom_support.jobs) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bloom_support.chat_plan_steps(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bloom_support.chat_plan_enqueue(uuid, uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bloom_support.chat_plan_claim_step(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bloom_support.chat_plan_finish_step(uuid, uuid, uuid, uuid, text, text, text, boolean, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bloom_support.chat_plan_cancel(uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bloom_support.chat_plan_requeue_step(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Gateway for bloom-assist (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloom_chat_plan_rpc(p_fn text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid := nullif(p->>'tenant_id', '')::uuid; u uuid := nullif(p->>'user_id', '')::uuid; pl uuid := nullif(p->>'plan_id', '')::uuid;
BEGIN
  IF t IS NULL OR u IS NULL OR pl IS NULL THEN
    RAISE EXCEPTION 'invalid: tenant_id, user_id and plan_id are required' USING ERRCODE = '22023';
  END IF;
  CASE p_fn
    WHEN 'enqueue' THEN RETURN bloom_support.chat_plan_enqueue(t, u, nullif(p->>'conversation_id', '')::uuid,
      nullif(p->>'message_id', '')::uuid, pl, coalesce(p->'steps', '[]'::jsonb));
    WHEN 'steps' THEN RETURN bloom_support.chat_plan_steps(t, u, pl);
    WHEN 'claim' THEN RETURN bloom_support.chat_plan_claim_step(t, u, pl, p->>'task_id', p->>'worker');
    WHEN 'finish' THEN RETURN to_jsonb(bloom_support.chat_plan_finish_step(t, u, pl, (p->>'job_id')::uuid, p->>'worker',
      p->>'outcome', p->>'error', coalesce((p->>'permanent')::boolean, false), (p->>'retry_in')::int, p->'result'));
    WHEN 'cancel' THEN RETURN bloom_support.chat_plan_cancel(t, u, pl,
      CASE WHEN jsonb_typeof(p->'task_ids') = 'array' THEN p->'task_ids' END, p->>'reason');
    WHEN 'requeue' THEN RETURN bloom_support.chat_plan_requeue_step(t, u, pl, p->>'task_id');
    ELSE RAISE EXCEPTION 'invalid: unknown chat plan function %', p_fn USING ERRCODE = '22023';
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public.bloom_chat_plan_rpc(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_chat_plan_rpc(text, jsonb) TO service_role;
