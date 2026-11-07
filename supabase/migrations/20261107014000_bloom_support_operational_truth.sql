-- Bloom Support enterprise operational truth.
--
-- * Customer-visible client actions get deterministic, threaded confirmation.
-- * Acknowledged escalations are owned work, not falsely counted as open.
-- * Preview/test jobs stay in history without polluting production health.
-- * Abandoned effect claims are reconciled by a bounded maintenance schedule.

CREATE OR REPLACE FUNCTION bloom_support.is_test_job(p_job bloom_support.jobs)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_job.idempotency_key ~* '^(preview|test|e2e)(:|$)', false)
      OR lower(coalesce(p_job.payload->>'test_traffic', 'false')) = 'true'
$$;

REVOKE ALL ON FUNCTION bloom_support.is_test_job(bloom_support.jobs)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.is_test_job(bloom_support.jobs)
  TO service_role;

CREATE OR REPLACE FUNCTION bloom_support.queue_summary(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  RETURN jsonb_build_object(
    'by_status', (
      SELECT coalesce(jsonb_object_agg(status, n), '{}')
      FROM (SELECT status, count(*) n FROM bloom_support.tickets GROUP BY status) s
    ),
    'mine', (
      SELECT count(*) FROM bloom_support.tickets
      WHERE owner_id = p_actor AND status <> 'resolved'
    ),
    'human', (
      SELECT count(*) FROM bloom_support.tickets
      WHERE automation = 'human' AND status <> 'resolved'
    ),
    'open_escalations', (
      SELECT count(*) FROM bloom_support.escalations WHERE status = 'open'
    ),
    'acknowledged_escalations', (
      SELECT count(*) FROM bloom_support.escalations WHERE status = 'acknowledged'
    ),
    'features_awaiting', (
      SELECT count(*) FROM bloom_support.feature_requests WHERE status = 'awaiting_decision'
    ),
    'jobs', (
      SELECT coalesce(jsonb_object_agg(status, n), '{}')
      FROM (
        SELECT status, count(*) n
        FROM bloom_support.jobs j
        WHERE updated_at > now() - interval '7 days'
          AND NOT bloom_support.is_test_job(j)
        GROUP BY status
      ) s
    ),
    'queued', (
      SELECT count(*) FROM bloom_support.jobs j
      WHERE status = 'queued' AND NOT bloom_support.is_test_job(j)
    ),
    'running', (
      SELECT count(*) FROM bloom_support.jobs j
      WHERE status = 'running' AND NOT bloom_support.is_test_job(j)
    ),
    'oldest_ready_queued_at', (
      SELECT min(run_after) FROM bloom_support.jobs j
      WHERE status = 'queued' AND run_after <= now()
        AND NOT bloom_support.is_test_job(j)
    ),
    'failed_retrying', (
      SELECT count(*) FROM bloom_support.jobs j
      WHERE status = 'queued' AND attempts > 0
        AND NOT bloom_support.is_test_job(j)
    ),
    'dead_jobs', (
      SELECT count(*) FROM bloom_support.jobs j
      WHERE status = 'dead'
        AND updated_at > now() - interval '7 days'
        AND NOT bloom_support.is_test_job(j)
    ),
    'dead_jobs_24h', (
      SELECT count(*) FROM bloom_support.jobs j
      WHERE status = 'dead'
        AND updated_at > now() - interval '1 day'
        AND NOT bloom_support.is_test_job(j)
    ),
    'test_jobs', (
      SELECT count(*) FROM bloom_support.jobs j
      WHERE updated_at > now() - interval '7 days'
        AND bloom_support.is_test_job(j)
    ),
    'stale_effect_claims', (
      SELECT count(*) FROM bloom_support.operations
      WHERE status IN ('executing', 'undoing')
        AND updated_at <= now() - interval '5 minutes'
    ),
    'reconciliation_needed', (
      SELECT count(*) FROM bloom_support.operations
      WHERE status = 'reconciliation_needed'
    ),
    'last_claim_reconciled_at', (
      SELECT max(created_at) FROM bloom_support.activity
      WHERE action = 'operation.reconciliation_needed'
    ),
    'last_repair_report_at', (
      SELECT max(created_at) FROM bloom_support.activity
      WHERE action IN ('engineering.reproduced', 'engineering.not_reproduced')
    ),
    'last_ticket_flow_verified_at', (
      SELECT max(updated_at) FROM bloom_support.engineering_issues
      WHERE status = 'verified'
        AND verification->>'scope' = 'ticket_flow'
        AND coalesce((verification->>'passed')::boolean, false)
    ),
    'automation_enabled', bloom_support.setting('automation_enabled'),
    'client_email_enabled', bloom_support.setting('client_email_enabled'),
    'auto_release_enabled', bloom_support.setting('auto_release_enabled'),
    'unread', (
      SELECT count(*) FROM bloom_support.notifications
      WHERE principal_id = p_actor AND read_at IS NULL
    )
  );
END
$$;

REVOKE ALL ON FUNCTION bloom_support.queue_summary(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.queue_summary(uuid)
  TO service_role;

-- Preserve the known historical preview failure, but retire it from the live
-- production alarm. The exact key and exact legacy error signature make this
-- a surgical backfill rather than a blanket cleanup of dead jobs.
WITH candidates AS (
  SELECT id, ticket_id, engineering_issue_id, last_error
  FROM bloom_support.jobs
  WHERE kind = 'notify'
    AND status = 'dead'
    AND idempotency_key = 'preview:emails:1'
    AND last_error ILIKE '%replace%'
    AND last_error ILIKE '%undefined%'
  FOR UPDATE
), retired AS (
  UPDATE bloom_support.jobs j
  SET status = 'cancelled',
      lease_until = NULL,
      locked_by = NULL,
      last_error = 'retired known preview artifact; original error is in activity',
      updated_at = now()
  FROM candidates c
  WHERE j.id = c.id
  RETURNING j.id, j.ticket_id, c.engineering_issue_id, c.last_error
)
INSERT INTO bloom_support.activity(ticket_id, account_id, actor_id, action, detail)
SELECT retired.ticket_id, ticket.account_id, NULL,
       'job.preview_artifact_retired',
       jsonb_build_object(
         'job_id', retired.id,
         'engineering_issue_id', retired.engineering_issue_id,
         'idempotency_key', 'preview:emails:1',
         'previous_error', retired.last_error
       )
FROM retired
LEFT JOIN bloom_support.tickets ticket ON ticket.id = retired.ticket_id;

-- The cleanup primitive uses SKIP LOCKED and a 250-row bound. Run it even
-- when no MCP client happens to reconnect, without expanding its authority.
DO $$
DECLARE scheduled record;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron is unavailable; bloom-support-reconcile-claims was not scheduled';
    RETURN;
  END IF;
  FOR scheduled IN
    SELECT jobid FROM cron.job WHERE jobname = 'bloom-support-reconcile-claims'
  LOOP
    PERFORM cron.unschedule(scheduled.jobid);
  END LOOP;
  PERFORM cron.schedule(
    'bloom-support-reconcile-claims',
    '*/5 * * * *',
    'SELECT bloom_support.cleanup_mcp_idempotency()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule bloom-support-reconcile-claims: %', SQLERRM;
END
$$;

-- Client actions: confirm a fix, report that it continues, or ask for a
-- person. Request-person and fixed/close acknowledgements are deliberately
-- deterministic; they never ask a model to invent a promise or an identity.
CREATE OR REPLACE FUNCTION bloom_support.client_action(
  p_actor uuid,
  p_ticket uuid,
  p_action text,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t bloom_support.tickets;
  acknowledgement_id uuid;
  acknowledgement_body text;
  acknowledgement_key text;
  did_close boolean := false;
BEGIN
  t := bloom_support.require_ticket(p_actor, p_ticket);
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket FOR UPDATE;
  PERFORM set_config('bloom.actor', p_actor::text, true);

  -- Save optional client context before the deterministic response so the
  -- conversation remains in natural order.
  IF coalesce(btrim(p_message), '') <> '' AND p_action <> 'confirm_resolved' THEN
    INSERT INTO bloom_support.messages(
      conversation_id, ticket_id, author_id, author_kind,
      visibility, direction, body
    )
    VALUES (
      t.conversation_id, t.id, p_actor, 'client',
      'public', 'inbound', left(p_message, 20000)
    );
  END IF;

  IF p_action = 'confirm_resolved' THEN
    IF t.status <> 'resolved' THEN
      RAISE EXCEPTION 'invalid: this request is not resolved yet' USING ERRCODE = '22023';
    END IF;
    did_close := coalesce(
      (bloom_support.setting('closure')->>'close_on_client_confirm')::boolean,
      true
    );
    UPDATE bloom_support.tickets
    SET pending_review = NULL,
        closed_at = CASE WHEN did_close THEN now() ELSE closed_at END,
        resolution_evidence = coalesce(resolution_evidence, '{}') ||
          jsonb_build_object('client_confirmed_at', now()),
        updated_at = now()
    WHERE id = t.id;
    acknowledgement_key := 'client-action:confirm-resolved:' || t.id::text || ':' || t.reopen_count::text;
    acknowledgement_body := CASE WHEN did_close THEN
      'Thanks for confirming it’s fixed. I’ve closed this request. If it comes back, reply to this email and we’ll pick it up from the same thread. — Bloom, the BloomSuite support agent'
    ELSE
      'Thanks for confirming it’s fixed. I’ve recorded your confirmation on this request. If it comes back, reply to this email and we’ll pick it up from the same thread. — Bloom, the BloomSuite support agent'
    END;
  ELSIF p_action = 'still_broken' THEN
    IF t.status = 'resolved' THEN
      UPDATE bloom_support.tickets
      SET status = 'working', stage = 'triage', reopen_count = reopen_count + 1,
          resolution_verified = false, resolved_at = NULL, pending_review = NULL,
          version = version + 1, updated_at = now()
      WHERE id = t.id;
      PERFORM bloom_support.notify_staff(
        t.id, 'ticket.reopened',
        'Client says #' || t.number || ' is still not fixed', 'both'
      );
      PERFORM bloom_support.enqueue_job(
        'triage', t.id, NULL,
        'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
        jsonb_build_object('reason', 'client_reopened'),
        'triage:reopen:' || t.id::text || ':' || (t.reopen_count + 1)
      );
    END IF;
  ELSIF p_action = 'request_person' THEN
    UPDATE bloom_support.tickets
    SET executor = 'person', automation = 'human', executor_id = NULL,
        next_action = 'Client asked for a person — reply personally',
        next_action_due_at = bloom_support.add_business_seconds(now(), 4 * 3600),
        version = version + 1, updated_at = now()
    WHERE id = t.id;
    PERFORM bloom_support.invalidate_planned(t.id, 'client asked for a person');
    PERFORM bloom_support.notify_staff(
      t.id, 'ticket.person_requested',
      'Client asked for a person on #' || t.number, 'both'
    );
    acknowledgement_key := 'client-action:request-person:' || t.id::text || ':' || t.reopen_count::text;
    acknowledgement_body :=
      'Absolutely — I’ve handed this to a person on the BloomSuite support team. I’m Bloom, the BloomSuite support agent, and I’ll keep everything together here so you won’t need to repeat yourself.';
  ELSE
    RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023';
  END IF;

  IF acknowledgement_body IS NOT NULL THEN
    INSERT INTO bloom_support.messages(
      conversation_id, ticket_id, author_id, author_kind, visibility,
      direction, body, idempotency_key, delivery, purpose,
      meaningful, notify_client
    )
    VALUES (
      t.conversation_id, t.id, NULL, 'system', 'public', 'outbound',
      acknowledgement_body, acknowledgement_key, 'queued',
      'acknowledgement', false, true
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO acknowledgement_id;

    IF acknowledgement_id IS NULL THEN
      SELECT id INTO acknowledgement_id
      FROM bloom_support.messages
      WHERE idempotency_key = acknowledgement_key;
    END IF;
    PERFORM bloom_support.enqueue_job(
      'send_email', t.id, NULL, 'email:' || t.id::text,
      jsonb_build_object(
        'purpose', 'acknowledgement',
        'message_id', acknowledgement_id,
        'client_action', p_action
      ),
      'email:message:' || acknowledgement_id::text
    );
  END IF;

  PERFORM bloom_support.log(
    t.id, t.account_id, p_actor, 'client.' || p_action,
    jsonb_strip_nulls(jsonb_build_object(
      'acknowledgement_message_id', acknowledgement_id,
      'closed', CASE WHEN p_action = 'confirm_resolved' THEN did_close END
    ))
  );
  RETURN jsonb_build_object(
    'ok', true,
    'action', p_action,
    'acknowledgement_message_id', acknowledgement_id
  );
END
$$;

REVOKE ALL ON FUNCTION bloom_support.client_action(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.client_action(uuid, uuid, text, text)
  TO service_role;
