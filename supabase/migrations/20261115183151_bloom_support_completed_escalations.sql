-- Retire only obsolete machine engineering episodes backed by current closure proof.
-- No ticket, engineering state, approval, or customer communication is changed.
CREATE OR REPLACE FUNCTION bloom_support.completed_engineering_escalation(p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE x bloom_support.escalations; i bloom_support.engineering_issues; checked timestamptz;
BEGIN
  SELECT * INTO x FROM bloom_support.escalations WHERE id=p_id;
  IF x.reason NOT IN ('engineering_escalated','engineering_failed','engineering_awaiting_approval') OR x.ticket_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO i FROM bloom_support.engineering_issues WHERE id=x.engineering_issue_id;
  IF i.id IS NULL OR i.status <> 'verified' OR i.deployment->>'state' IS DISTINCT FROM 'success'
    OR i.verification->>'scope' IS DISTINCT FROM 'ticket_flow' OR i.verification->'passed' IS DISTINCT FROM 'true'::jsonb
    OR coalesce(i.merge_sha,'')='' THEN RETURN false; END IF;
  BEGIN
    checked := (i.verification->>'started_at')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false; END;
  -- A new failure/approval after verification is a new decision, never stale.
  IF checked IS NULL OR NOT isfinite(checked) OR checked > now() OR x.created_at >= checked THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM bloom_support.tickets WHERE id=x.ticket_id AND engineering_issue_id=i.id)
    OR NOT EXISTS (SELECT 1 FROM bloom_support.tickets WHERE engineering_issue_id=i.id) THEN RETURN false; END IF;
  RETURN NOT EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id=i.id AND (
    t.status <> 'resolved' OR NOT t.resolution_verified OR t.pending_review IS NOT NULL
    OR t.spam OR t.merged_into IS NOT NULL OR t.resolved_at IS NULL OR t.resolved_at < checked
    OR NOT coalesce(i.verification->'ticket_ids' @> jsonb_build_array(t.id::text),false)
    OR t.resolution_evidence->>'engineering_issue_id' IS DISTINCT FROM i.id::text
    OR t.resolution_evidence->>'merge_sha' IS DISTINCT FROM i.merge_sha
    OR t.resolution_evidence->'verification' IS DISTINCT FROM i.verification
    OR t.resolution_evidence->'deployment' IS DISTINCT FROM i.deployment));
END $$;
REVOKE ALL ON FUNCTION bloom_support.completed_engineering_escalation(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION bloom_support.reconcile_completed_engineering_escalations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x record; i bloom_support.engineering_issues; n integer:=0; tickets integer;
BEGIN
  FOR x IN SELECT * FROM bloom_support.escalations WHERE status IN ('open','acknowledged')
    AND reason IN ('engineering_escalated','engineering_failed','engineering_awaiting_approval')
    AND bloom_support.completed_engineering_escalation(id)
    ORDER BY created_at LIMIT 200 FOR UPDATE SKIP LOCKED LOOP
    IF NOT bloom_support.completed_engineering_escalation(x.id) THEN CONTINUE; END IF;
    BEGIN
      -- Lock issue against updates and newly linked tickets (FK KEY SHARE).
      -- NOWAIT avoids lock-order deadlocks with ticket/engineering transitions.
      SELECT * INTO i FROM bloom_support.engineering_issues WHERE id=x.engineering_issue_id FOR UPDATE NOWAIT;
      PERFORM id FROM bloom_support.tickets WHERE engineering_issue_id=i.id ORDER BY id FOR SHARE NOWAIT;
      GET DIAGNOSTICS tickets=ROW_COUNT;
      IF tickets=0 OR tickets>50 OR NOT bloom_support.completed_engineering_escalation(x.id) THEN CONTINUE; END IF;
      UPDATE bloom_support.escalations SET status='resolved',resolved_at=now(),
        decision='Superseded by current ticket-bound production verification and verified resolution of every linked ticket.' WHERE id=x.id;
      -- Claimed jobs keep their lease: the worker rechecks open escalations and
      -- live ticket status and completes these as no-ops. Never steal a lease.
      UPDATE bloom_support.jobs SET status='cancelled',updated_at=now() WHERE status='queued'
        AND kind='escalate' AND payload->>'escalation_id'=x.id::text;
      PERFORM bloom_support.log(x.ticket_id,NULL,NULL,'escalation.engineering_completed',
        jsonb_build_object('escalation_id',x.id,'engineering_issue_id',i.id,'engineering_version',i.version,
          'merge_sha',i.merge_sha,'verification_started_at',i.verification->>'started_at',
          'ticket_versions',(SELECT jsonb_object_agg(id::text,version) FROM bloom_support.tickets WHERE engineering_issue_id=i.id)));
      n:=n+1;
    EXCEPTION WHEN lock_not_available THEN CONTINUE;
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION bloom_support.reconcile_completed_engineering_escalations() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION bloom_support.sweep_deadlines()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x record; t record; reminder_key text; new_level integer; reconciled int := 0; moved int := 0; overdue int := 0; fb numeric := coalesce((bloom_support.setting('sla')->>'fallback_hours')::numeric, 4);
  jon uuid := bloom_support.owner_principal('jon'); jeff uuid := bloom_support.owner_principal('jeff'); next_owner uuid;
BEGIN
  reconciled := bloom_support.reconcile_completed_engineering_escalations();
  -- Reconcile only machine-generated deadline escalations. A reply does not
  -- close customer work, engineering blockers, or human decisions.
  FOR x IN SELECT e.* FROM bloom_support.escalations e
    JOIN bloom_support.tickets ticket_row ON ticket_row.id = e.ticket_id
    WHERE e.status IN ('open','acknowledged') AND e.reason = 'ticket_overdue'
      AND (ticket_row.status = 'resolved' OR ticket_row.spam OR ticket_row.merged_into IS NOT NULL
        OR ticket_row.due_at IS NULL OR ticket_row.due_at >= now()
        OR coalesce(ticket_row.waiting_reason, '') IN ('customer','third_party','scheduled'))
    FOR UPDATE OF e, ticket_row SKIP LOCKED LOOP
    UPDATE bloom_support.escalations SET status = 'resolved', resolved_at = now(),
      decision = 'The ticket deadline no longer applies. Customer work remains in its current state.'
      WHERE id = x.id;
    UPDATE bloom_support.jobs SET status = 'cancelled', updated_at = now()
      WHERE status = 'queued' AND kind = 'escalate' AND payload->>'escalation_id' = x.id::text;
    PERFORM bloom_support.log(x.ticket_id, NULL, NULL, 'escalation.deadline_reconciled',
      jsonb_build_object('escalation_id', x.id));
    reconciled := reconciled + 1;
  END LOOP;
  FOR x IN SELECT * FROM bloom_support.escalations WHERE status = 'open' AND due_at < now() AND NOT bloom_support.completed_engineering_escalation(id) ORDER BY due_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    -- The first two misses retain the existing fallback. Each engineering escalation is a versioned episode; new failures and approvals
    -- keep their existing path. After both owners
    -- have been alerted, keep one daily reminder rather than an endless
    -- four-hour escalation ladder. The escalation remains open and actionable.
    new_level := CASE WHEN x.reason IN ('ticket_overdue','engineering_escalated') THEN least(x.fallback_level + 1, 2) ELSE x.fallback_level + 1 END;
    reminder_key := CASE WHEN x.reason NOT IN ('ticket_overdue','engineering_escalated') OR x.fallback_level < 2 THEN 'fallback:' || new_level
      ELSE 'reminder:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') END;
    next_owner := CASE WHEN x.reason IN ('ticket_overdue','engineering_escalated') AND x.fallback_level >= 2 THEN x.owner_id WHEN x.owner_id = jon THEN coalesce(jeff, jon) WHEN x.owner_id = jeff THEN coalesce(jon, jeff) ELSE coalesce(jon, jeff) END;
    UPDATE bloom_support.escalations SET fallback_level = new_level, audience = 'both', owner_id = next_owner,
      due_at = now() + CASE WHEN x.reason IN ('ticket_overdue','engineering_escalated') AND new_level >= 2 THEN interval '24 hours' ELSE make_interval(secs => (fb * 3600)::int) END WHERE id = x.id;
    -- The row lock serializes sweeps; the queue key also deduplicates a replay
    -- whose due time was restored without changing the escalation episode.
    IF EXISTS (SELECT 1 FROM bloom_support.jobs WHERE idempotency_key = 'escalate:' || x.id::text || ':' || reminder_key) THEN CONTINUE; END IF;
    PERFORM bloom_support.notify_staff(x.ticket_id, 'escalation.overdue', 'Still needs attention: ' || left(x.reason, 80), 'both');
    PERFORM bloom_support.enqueue_job('escalate', x.ticket_id, NULL, 'email:escalation', jsonb_build_object('escalation_id', x.id), 'escalate:' || x.id::text || ':' || reminder_key);
    IF new_level >= 2 THEN
      INSERT INTO bloom_support.alerts(condition, detail, dedupe_key) VALUES ('escalation_unanswered', jsonb_build_object('escalation_id', x.id, 'reason', x.reason), 'esc:' || x.id::text || ':' || reminder_key)
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
    PERFORM bloom_support.log(x.ticket_id, NULL, NULL, 'escalation.fallback', jsonb_build_object('escalation_id', x.id, 'level', new_level, 'owner', next_owner));
    moved := moved + 1;
  END LOOP;
  FOR t IN SELECT id, number, subject, due_at FROM bloom_support.tickets WHERE status <> 'resolved' AND due_at < now() AND NOT spam AND merged_into IS NULL
             AND coalesce(waiting_reason, '') NOT IN ('customer','third_party','scheduled')
             AND NOT EXISTS (SELECT 1 FROM bloom_support.escalations e WHERE e.ticket_id = tickets.id AND e.reason = 'ticket_overdue' AND e.status IN ('open','acknowledged')) LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    -- Another sweep may have committed after this SELECT's snapshot but
    -- before we acquired the ticket lock. Recheck with a fresh snapshot.
    IF EXISTS (SELECT 1 FROM bloom_support.escalations e WHERE e.ticket_id=t.id
      AND e.reason='ticket_overdue' AND e.status IN ('open','acknowledged')) THEN CONTINUE; END IF;
    INSERT INTO bloom_support.escalations(ticket_id, audience, reason, detail, dedupe_key)
    VALUES (t.id, 'both', 'ticket_overdue', '#' || t.number || ' ' || t.subject, 'overdue:' || t.id::text || ':' || extract(epoch FROM t.due_at)::text || ':episode:' || (SELECT count(*) FROM bloom_support.escalations prior WHERE prior.ticket_id=t.id AND prior.reason='ticket_overdue')::text) ON CONFLICT (dedupe_key) DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
    PERFORM bloom_support.notify_staff(t.id, 'ticket.overdue', 'Overdue #' || t.number || ': ' || left(t.subject, 80), 'both');
    overdue := overdue + 1;
  END LOOP;
  RETURN jsonb_build_object('escalations_moved', moved, 'tickets_overdue', overdue, 'escalations_reconciled', reconciled);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_digest_report(p_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN jsonb_build_object(
    'needs_you', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'since'), '[]') FROM (
        SELECT DISTINCT ON (t.id) jsonb_build_object('id', t.id, 'number', t.number, 'subject', t.subject, 'client', a.name,
               'reason', e.reason, 'since', e.created_at,
               'first_response_at',t.first_response_at,'communication',bloom_support.digest_communication(t.id)) x
          FROM bloom_support.escalations e
          JOIN bloom_support.tickets t ON t.id = e.ticket_id
          LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
         WHERE e.status IN ('open','acknowledged') AND t.status <> 'resolved' AND t.merged_into IS NULL AND NOT t.spam AND NOT t.internal_test
         ORDER BY t.id, (e.reason = 'ticket_overdue'), e.created_at DESC
         LIMIT 20) n),
    'resolved', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
                   'by_bloom', coalesce(pr.kind = 'service' OR pr.role = 'service', false), 'summary', t.resolution_summary) ORDER BY ev.at), '[]')
        FROM (SELECT DISTINCT ON (ticket_id) ticket_id, actor_id, at FROM bloom_support.ticket_events
               WHERE kind = 'status' AND to_value = 'resolved' AND at >= p_since ORDER BY ticket_id, at DESC) ev
        JOIN bloom_support.tickets t ON t.id = ev.ticket_id AND t.status = 'resolved' AND NOT t.spam AND NOT t.internal_test AND t.merged_into IS NULL
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        LEFT JOIN bloom_support.principals pr ON pr.id = ev.actor_id),
    'said', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
               'body', left(m.body, 600), 'at', m.created_at,'purpose',m.purpose,'delivery',m.delivery,'meaningful',m.meaningful) ORDER BY m.created_at), '[]')
        FROM bloom_support.messages m
        JOIN bloom_support.tickets t ON t.id = m.ticket_id AND NOT t.spam AND NOT t.internal_test
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        WHERE m.author_kind = 'bloom' AND m.visibility = 'public' AND m.withdrawn_at IS NULL AND m.delivery IN ('sent','delivered') AND m.created_at >= p_since),
    'repairs', (SELECT coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'status', e.status,
                  'client', (SELECT a.name FROM bloom_support.tickets t JOIN bloom_support.accounts a ON a.id = t.account_id
                              WHERE t.engineering_issue_id = e.id AND NOT t.internal_test ORDER BY t.created_at LIMIT 1)) ORDER BY e.updated_at DESC), '[]')
        FROM bloom_support.engineering_issues e
        WHERE e.status NOT IN ('open', 'verified', 'closed')
          -- Shared issues remain customer work if any linked ticket is a customer.
          AND (NOT EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id=e.id)
            OR EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id=e.id AND NOT t.internal_test))),
    'alerts', (SELECT coalesce(jsonb_agg(jsonb_build_object('condition', al.condition, 'detail', al.detail, 'at', al.created_at) ORDER BY al.created_at), '[]')
        FROM bloom_support.alerts al WHERE al.created_at >= p_since
          AND NOT EXISTS (SELECT 1 FROM bloom_support.escalations e JOIN bloom_support.tickets t ON t.id=e.ticket_id
            WHERE e.id::text=al.detail->>'escalation_id' AND (t.internal_test
              OR bloom_support.completed_engineering_escalation(e.id)
              OR (e.status='resolved' AND e.decision='Superseded by current ticket-bound production verification and verified resolution of every linked ticket.')))),
    'internal_tests', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id',t.id,'number',t.number,'subject',t.subject,'status',t.status,'stage',t.stage,
        'next_action',t.next_action,'engineering_status',e.status,
        'deployment_state',e.deployment->>'state',
        'verification_summary',CASE
          WHEN e.verification IS NULL OR e.verification IN ('null'::jsonb,'{}'::jsonb) THEN 'No check recorded'
          WHEN e.verification->'passed'='false'::jsonb THEN 'A failed check is recorded'
          WHEN e.verification->'passed'='true'::jsonb THEN 'A passing check is recorded; affected-flow coverage and release binding still require review'
          ELSE 'Check evidence recorded; outcome requires review' END,
        'first_response_at',t.first_response_at,'communication',bloom_support.digest_communication(t.id)
      ) ORDER BY t.created_at), '[]')
      FROM bloom_support.tickets t LEFT JOIN bloom_support.engineering_issues e ON e.id=t.engineering_issue_id
      WHERE t.internal_test AND NOT t.spam AND t.merged_into IS NULL
        AND (t.status <> 'resolved' OR t.resolved_at >= p_since)),
    'counts', jsonb_build_object(
      'open',(SELECT count(*) FROM bloom_support.tickets WHERE NOT internal_test AND NOT spam AND merged_into IS NULL AND status <> 'resolved'),
      'new',(SELECT count(*) FROM bloom_support.tickets WHERE NOT internal_test AND NOT spam AND merged_into IS NULL AND created_at >= p_since)),
    'staff', (SELECT coalesce(jsonb_agg(lower(pr.email)), '[]') FROM bloom_support.principals pr
        WHERE pr.kind = 'user' AND pr.active AND pr.email IS NOT NULL AND pr.role IN ('platform_admin', 'platform_operator')));
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_digest_report(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_digest_report(timestamptz) TO service_role;
