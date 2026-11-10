-- Preserve engineering and human ownership while announcing product decisions.
-- No table, permission, release-policy or customer-data changes.
-- Rollback: restore decide_feature_request from 20261106110933 after rolling
-- back the worker; restore update_engineering_issue from 20261105230000.
-- Existing feature shipment generations remain untouched.
-- The migration runner owns the transaction, including its history record.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
CREATE OR REPLACE FUNCTION bloom_support.decide_feature_request(
  p_actor uuid,
  p_feature uuid,
  p_decision text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tk record;
  sub record;
  previous bloom_support.feature_requests;
  changed boolean;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'features.decide');
  IF p_decision NOT IN ('accepted', 'declined', 'planned', 'shipped') THEN
    RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO previous
  FROM bloom_support.feature_requests
  WHERE id = p_feature
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002'; END IF;
  changed := previous.status IS DISTINCT FROM p_decision;

  UPDATE bloom_support.feature_requests
  SET status = p_decision,
      decision_note = p_note,
      decided_by = p_actor,
      decided_at = now(),
      updated_at = now()
  WHERE id = p_feature;

  UPDATE bloom_support.escalations
  SET status = 'resolved',
      decision = p_decision || coalesce(': ' || p_note, ''),
      decided_by = p_actor,
      resolved_at = now()
  WHERE feature_request_id = p_feature AND status <> 'resolved';

  IF changed AND previous.status = 'shipped' AND p_decision <> 'shipped' THEN
    PERFORM bloom_support.retract_feature_shipment_generation(
      p_feature,
      'feature changed from shipped to ' || p_decision
    );
  END IF;

  IF changed THEN
    -- A later decision supersedes any older decision that has not reached the
    -- provider. Prevent both the old answer job and an already-rendered old
    -- email from arriving after the current outcome.
    UPDATE bloom_support.messages m
    SET delivery = 'suppressed', withdrawn_at = coalesce(withdrawn_at, now())
    WHERE m.delivery IN ('queued','failed','uncertain')
      AND EXISTS (
        SELECT 1
        FROM bloom_support.jobs old_decision
        JOIN bloom_support.tickets linked ON linked.id = old_decision.ticket_id
        WHERE linked.feature_request_id = p_feature
          AND old_decision.kind = 'answer'
          AND old_decision.payload->>'mode' = 'feature_decision'
          AND old_decision.payload->>'decision' IS DISTINCT FROM p_decision
          AND m.idempotency_key = 'feature-decision:' || old_decision.id::text
      );

    UPDATE bloom_support.jobs email_job
    SET status = 'cancelled', last_error = 'superseded by a newer feature decision', updated_at = now()
    WHERE email_job.kind = 'send_email' AND email_job.status = 'queued'
      AND EXISTS (
        SELECT 1
        FROM bloom_support.messages m
        JOIN bloom_support.jobs old_decision
          ON m.idempotency_key = 'feature-decision:' || old_decision.id::text
        JOIN bloom_support.tickets linked ON linked.id = old_decision.ticket_id
        WHERE linked.feature_request_id = p_feature
          AND old_decision.kind = 'answer'
          AND old_decision.payload->>'mode' = 'feature_decision'
          AND old_decision.payload->>'decision' IS DISTINCT FROM p_decision
          AND m.id::text = email_job.payload->>'message_id'
      );

    UPDATE bloom_support.jobs old_decision
    SET status = 'cancelled', last_error = 'superseded by a newer feature decision', updated_at = now()
    WHERE old_decision.kind = 'answer' AND old_decision.status = 'queued'
      AND old_decision.payload->>'mode' = 'feature_decision'
      AND old_decision.payload->>'decision' IS DISTINCT FROM p_decision
      AND EXISTS (
        SELECT 1 FROM bloom_support.tickets linked
        WHERE linked.id = old_decision.ticket_id AND linked.feature_request_id = p_feature
      );
  END IF;

  IF NOT changed THEN
    FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE feature_request_id = p_feature LOOP
      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'feature.decision_note_updated',
        jsonb_build_object('decision', p_decision, 'note', p_note));
    END LOOP;
  ELSIF p_decision = 'shipped' THEN
    -- Pick up evidence that predates this table as well as newly-routed tickets.
    INSERT INTO bloom_support.feature_shipment_subscriptions(feature_request_id, ticket_id, account_id, requester_id)
    SELECT e.feature_request_id, e.ticket_id, coalesce(e.account_id, t.account_id), t.requester_id
    FROM bloom_support.feature_evidence e
    JOIN bloom_support.tickets t ON t.id = e.ticket_id
    WHERE e.feature_request_id = p_feature
    ON CONFLICT (feature_request_id, ticket_id) DO NOTHING;

    FOR sub IN
      SELECT id FROM bloom_support.feature_shipment_subscriptions
      WHERE feature_request_id = p_feature AND cancelled_at IS NULL
    LOOP
      PERFORM bloom_support.begin_feature_shipment_generation(sub.id, false);
    END LOOP;

    FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE feature_request_id = p_feature LOOP
      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'feature.shipped',
        jsonb_build_object('decision', p_decision, 'note', p_note));
    END LOOP;
  ELSE
    FOR tk IN
      SELECT id, account_id, automation, executor, status, merged_into, spam, redacted_at
      FROM bloom_support.tickets
      WHERE feature_request_id = p_feature
    LOOP
      IF tk.status <> 'resolved' AND tk.merged_into IS NULL AND NOT tk.spam
         AND tk.redacted_at IS NULL AND tk.automation = 'auto' AND tk.executor = 'bloom' THEN
        UPDATE bloom_support.tickets
        SET stage = 'answering',
            status = 'working',
            waiting_reason = NULL,
            waiting_since = NULL,
            next_action = 'Tell the client the decision: ' || p_decision,
            version = version + 1,
            updated_at = now()
        -- Feature news must not replace engineering status or a concurrent
        -- human takeover. The row predicate is rechecked after acquiring its lock.
        WHERE id = tk.id
          AND engineering_issue_id IS NULL
          AND automation = 'auto' AND executor = 'bloom'
          AND status <> 'resolved' AND merged_into IS NULL;

        PERFORM bloom_support.enqueue_job(
          'answer', tk.id, NULL,
          'account:' || coalesce(tk.account_id::text, 'none:' || tk.id::text),
          jsonb_build_object('mode', 'feature_decision', 'decision', p_decision),
          'feature-decision:' || p_feature::text || ':' || tk.id::text || ':' || previous.status || '->' || p_decision || ':' || previous.updated_at::text
        );
      END IF;

      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'feature.decided',
        jsonb_build_object(
          'decision', p_decision,
          'note', p_note,
          'client_followup_queued',
          tk.status <> 'resolved' AND tk.merged_into IS NULL AND NOT tk.spam
            AND tk.redacted_at IS NULL AND tk.automation = 'auto' AND tk.executor = 'bloom'
        ));
    END LOOP;
  END IF;

  RETURN (SELECT to_jsonb(feature) FROM bloom_support.feature_requests feature WHERE feature.id = p_feature);
END
$$;
CREATE OR REPLACE FUNCTION bloom_support.update_engineering_issue(p_actor uuid, p_issue uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e bloom_support.engineering_issues; n bloom_support.engineering_issues; perm text; tk record; x jsonb := coalesce(p->'patch','{}'::jsonb);
  v_report_only boolean; v_start boolean := coalesce((p->>'start_repair')::boolean, false);
  v_report_outcome text; v_force_human_review boolean := false;
BEGIN
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = p_issue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  IF p ? 'version' AND (p->>'version')::int <> e.version THEN RAISE EXCEPTION 'conflict: issue changed' USING ERRCODE = '40001'; END IF;
  v_report_only := NOT bloom_support.has_permission(p_actor, 'engineering.investigate')
    AND NOT bloom_support.has_permission(p_actor, 'engineering.release')
    AND NOT bloom_support.has_permission(p_actor, 'engineering.approve')
    AND bloom_support.has_permission(p_actor, 'engineering.report');
  IF v_report_only THEN
    IF v_start OR NOT (p ? 'status') OR p->>'status' NOT IN ('reproduced','not_reproduced','escalated','failed')
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(x) k WHERE k <> 'reproduction') THEN
      RAISE EXCEPTION 'forbidden: a repair report may only record the outcome and reproduction' USING ERRCODE = '42501';
    END IF;
    v_report_outcome := p->>'status';
    x := jsonb_set(
      x,
      '{reproduction}',
      coalesce(e.reproduction, '{}'::jsonb)
        || bloom_support.normalize_repair_reproduction(x->'reproduction'),
      true
    );
    v_force_human_review := (
      e.status = 'approved'
      AND x->'reproduction' IS DISTINCT FROM e.reproduction
    ) OR (
      e.status IN ('in_review','awaiting_approval')
      AND (
        v_report_outcome IN ('failed','escalated')
        OR coalesce((x->'reproduction'->>'needs_human')::boolean, false)
      )
    );
    IF e.status NOT IN ('investigating','fixing','reproduced') THEN
      p := p - 'status';
    END IF;
  END IF;
  IF v_start THEN
    IF NOT bloom_support.has_permission(p_actor, 'engineering.dispatch') OR bloom_support.principal_role(p_actor) = 'service' THEN
      RAISE EXCEPTION 'forbidden: only an admin can start an automated repair' USING ERRCODE = '42501';
    END IF;
    IF e.status NOT IN ('open','failed','not_reproduced','escalated') THEN
      RAISE EXCEPTION 'invalid: a repair can start only from open, failed, not_reproduced or escalated (now %)', e.status USING ERRCODE = '22023';
    END IF;
    IF p ? 'status' OR x <> '{}'::jsonb THEN
      RAISE EXCEPTION 'invalid: start_repair cannot be combined with other changes' USING ERRCODE = '22023';
    END IF;
    IF coalesce((e.reproduction->>'needs_human')::boolean, false) THEN
      RAISE EXCEPTION 'blocked: automatic repair requires human review; take ownership and choose an authorized engineering path instead of retrying' USING ERRCODE = '22023';
    END IF;
    IF coalesce((e.evidence->>'dispatches')::int, 0) >= coalesce((bloom_support.setting('limits')->>'max_repair_attempts')::int, 2) THEN
      RAISE EXCEPTION 'blocked: automatic repair attempts are exhausted; take ownership and review the existing work instead of retrying' USING ERRCODE = '22023';
    END IF;
    UPDATE bloom_support.engineering_issues SET repair_started_by = p_actor, repair_started_at = now(), version = version + 1, updated_at = now(),
      status = CASE WHEN status = 'escalated' THEN 'open' ELSE status END
    WHERE id = p_issue RETURNING * INTO n;
    PERFORM bloom_support.enqueue_job('investigate', (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
      p_issue, 'engineering:' || p_issue::text, jsonb_build_object('step','investigate'), 'investigate:' || p_issue::text || ':' || n.version, now(), 3, 900);
    FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue LOOP
      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'engineering.repair_started', jsonb_build_object('engineering_issue_id', p_issue));
    END LOOP;
    UPDATE bloom_support.escalations SET status = 'resolved', resolved_at = now(), decided_by = p_actor
    WHERE engineering_issue_id = p_issue AND reason = 'engineering_start_requested' AND status <> 'resolved';
    RETURN to_jsonb(n);
  END IF;
  IF p ? 'status' AND p->>'status' <> e.status THEN
    perm := bloom_support.engineering_transition_permission(e.status, p->>'status');
    IF perm IS NULL THEN RAISE EXCEPTION 'invalid transition % -> %', e.status, p->>'status' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(string_to_array(perm, '|')) AS needed(name) WHERE bloom_support.has_permission(p_actor, needed.name)) THEN
      RAISE EXCEPTION 'forbidden: % required', perm USING ERRCODE = '42501';
    END IF;
    IF p->>'status' = 'merging' AND e.status <> 'approved' AND NOT coalesce((coalesce(x->'eligibility', e.eligibility)->>'eligible')::boolean, false) THEN
      RAISE EXCEPTION 'blocked: not eligible for automatic release and not approved' USING ERRCODE = '42501';
    END IF;
    IF p->>'status' = 'merging' AND e.status = 'approved'
       AND (e.approved_head_sha IS NULL OR coalesce(x->>'head_sha', e.head_sha) IS DISTINCT FROM e.approved_head_sha) THEN
      RAISE EXCEPTION 'blocked: the pull request changed after approval' USING ERRCODE = '42501';
    END IF;
    IF p->>'status' = 'approved' AND (coalesce(x->>'head_sha', e.head_sha) IS NULL OR e.pr_number IS NULL) THEN
      RAISE EXCEPTION 'invalid: approve a fix only once its pull request and head commit are recorded' USING ERRCODE = '22023';
    END IF;
    IF p->>'status' = 'verified' AND coalesce((coalesce(x->'verification', e.verification)->>'passed')::boolean, false) = false THEN
      RAISE EXCEPTION 'blocked: verification evidence required' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF NOT (v_report_only OR bloom_support.has_permission(p_actor, 'engineering.investigate') OR bloom_support.has_permission(p_actor, 'engineering.release')
            OR bloom_support.has_permission(p_actor, 'engineering.approve')) THEN
      RAISE EXCEPTION 'forbidden: engineering update' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF x ? 'eligibility' AND NOT bloom_support.has_permission(p_actor, 'engineering.release') AND NOT bloom_support.has_permission(p_actor, 'engineering.approve') THEN
    RAISE EXCEPTION 'forbidden: eligibility is evaluated by the release identity' USING ERRCODE = '42501';
  END IF;

  UPDATE bloom_support.engineering_issues SET
    status = CASE WHEN v_force_human_review THEN 'awaiting_approval' ELSE coalesce(p->>'status', status) END,
    repository = coalesce(x->>'repository', repository),
    reproduction = coalesce(x->'reproduction', reproduction), risk = coalesce(x->'risk', risk), eligibility = coalesce(x->'eligibility', eligibility),
    branch = coalesce(x->>'branch', branch), pr_number = coalesce((x->>'pr_number')::int, pr_number), pr_url = coalesce(x->>'pr_url', pr_url),
    head_sha = coalesce(x->>'head_sha', head_sha), merge_sha = coalesce(x->>'merge_sha', merge_sha), deployment = coalesce(x->'deployment', deployment),
    verification = coalesce(x->'verification', verification), rollback = coalesce(x->'rollback', rollback),
    evidence = CASE WHEN x ? 'evidence' THEN evidence || (x->'evidence') ELSE evidence END,
    approved_by = CASE WHEN p->>'status' = 'approved' THEN p_actor ELSE approved_by END,
    approved_at = CASE WHEN p->>'status' = 'approved' THEN now() ELSE approved_at END,
    approved_head_sha = CASE WHEN p->>'status' = 'approved' THEN coalesce(x->>'head_sha', head_sha)
                             WHEN p->>'status' = 'awaiting_approval' OR v_force_human_review THEN NULL ELSE approved_head_sha END,
    attempts = attempts + CASE WHEN p->>'status' = 'fixing' THEN 1 ELSE 0 END,
    version = version + 1, updated_at = now()
  WHERE id = p_issue RETURNING * INTO n;

  -- AFTER triggers may conservatively close no-deploy work. Re-read before
  -- emitting side effects so a stale failed/escalated RETURNING row cannot
  -- reopen an escalation or misreport the persisted status.
  SELECT * INTO n FROM bloom_support.engineering_issues WHERE id = p_issue;

  FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue LOOP
    PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'engineering.' || n.status, jsonb_strip_nulls(jsonb_build_object('from', e.status, 'note', p->>'note', 'pr_url', n.pr_url)));
    UPDATE bloom_support.tickets SET updated_at = now(),
      stage = CASE WHEN status = 'resolved' THEN stage
                   WHEN n.status IN ('fixing','in_review') THEN 'fixing'
                   WHEN n.status IN ('approved','merging','merged','deploying','deployed') THEN 'releasing'
                   WHEN n.status IN ('verifying','verified') THEN 'verifying'
                   WHEN n.status IN ('awaiting_approval','escalated','failed','rolled_back') THEN 'escalated'
                   ELSE stage END,
      status = CASE WHEN status = 'resolved' THEN status
                    WHEN n.status IN ('awaiting_approval','escalated','failed','rolled_back') THEN 'needs_owner' ELSE 'working' END,
      next_action = CASE WHEN status <> 'resolved' AND n.status IN ('awaiting_approval','escalated','failed','rolled_back')
        THEN 'Admin: review the stopped repair, choose the next step, and keep existing release holds in place' ELSE next_action END,
      next_action_due_at = CASE WHEN status <> 'resolved' AND n.status IN ('awaiting_approval','escalated','failed','rolled_back')
        THEN coalesce(next_action_due_at, now() + interval '24 hours') ELSE next_action_due_at END,
      owner_id = CASE WHEN status <> 'resolved' AND n.status IN ('awaiting_approval','escalated','failed','rolled_back')
        THEN coalesce(owner_id, bloom_support.owner_principal('jon'), bloom_support.owner_principal('jeff')) ELSE owner_id END
    WHERE id = tk.id AND automation = 'auto' AND executor = 'bloom';
    IF n.status = 'verified' AND e.status <> 'verified' THEN
      PERFORM bloom_support.enqueue_job('verify_resolution', tk.id, p_issue, 'account:' || coalesce(tk.account_id::text, 'none:' || tk.id::text),
        jsonb_build_object('engineering_issue_id', p_issue), 'verify_resolution:' || tk.id::text || ':' || p_issue::text);
    END IF;
  END LOOP;
  IF v_report_only
    AND n.status IN ('in_review', 'approved', 'awaiting_approval')
    AND n.reproduction IS DISTINCT FROM e.reproduction
  THEN
    PERFORM bloom_support.enqueue_job(
      'engineering_step',
      (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
      p_issue,
      'engineering:' || p_issue::text,
      jsonb_build_object('step', 'evaluate', 'reason', 'late_repair_report'),
      'eng:' || p_issue::text || ':evaluate:repair-report:' || n.version,
      now(),
      3,
      300
    );
  END IF;
  IF n.status = 'approved' AND e.status <> 'approved' THEN
    PERFORM bloom_support.enqueue_job('engineering_step', (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
      p_issue, 'engineering:' || p_issue::text, jsonb_build_object('step','evaluate','reason','approved'),
      'eng:' || p_issue::text || ':evaluate:approved:' || n.version, now(), 3, 300);
  END IF;
  IF n.status IN ('awaiting_approval','escalated','failed','rolled_back') AND n.status <> e.status THEN
    INSERT INTO bloom_support.escalations(engineering_issue_id, ticket_id, audience, reason, detail, dedupe_key)
    VALUES (p_issue, (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
            CASE WHEN n.status = 'awaiting_approval' THEN 'jon' ELSE 'both' END,
            'engineering_' || n.status, p->>'note', 'eng:' || p_issue::text || ':' || n.status || ':' || n.version)
    ON CONFLICT (dedupe_key) DO NOTHING;
    PERFORM bloom_support.notify_staff(NULL, 'engineering.' || n.status, 'Fix ' || n.status || ': ' || left(n.title, 80), CASE WHEN n.status = 'awaiting_approval' THEN 'jon' ELSE 'both' END);
  END IF;
  RETURN to_jsonb(n);
END $$;
