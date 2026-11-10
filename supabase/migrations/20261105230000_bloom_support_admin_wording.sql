-- Bloom Support: server-written copy names roles, never people.
--
-- Jon (2026-11-05): "It should never say needs Jon or Jeff. It should say
-- something about Admin." Four functions wrote people's names into text staff
-- see: the needs_owner notification title and validation error (update_ticket),
-- the escalation next action (escalate), the feature-request next action
-- (route_feature_request) and the repair-permission error
-- (update_engineering_issue). Each is re-created from its latest definition
-- (20261031120100 and 20261104200000) with only those strings changed.
--
-- Internal identifiers are unchanged: the escalation audiences jon/jeff/both,
-- settings.owners.{jon,jeff}, role names and enums. Stored ticket text is
-- history and is not rewritten; staff views reword old next actions when they
-- render (humanizeNextAction). CREATE OR REPLACE keeps owners and grants.

CREATE OR REPLACE FUNCTION bloom_support.update_ticket(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; n bloom_support.tickets; svc boolean; v_stage text; v_status text; v_wait text; ev jsonb := coalesce(p->'resolution_evidence', '{}'::jsonb);
  answer_id uuid; op record; v_owner uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket FOR UPDATE;
  svc := bloom_support.principal_role(p_actor) = 'service';
  IF p ? 'version' AND (p->>'version')::int <> t.version THEN
    RAISE EXCEPTION 'conflict: ticket changed (version %)', t.version USING ERRCODE = '40001';
  END IF;
  IF t.merged_into IS NOT NULL THEN RAISE EXCEPTION 'invalid: ticket was merged; update the target ticket' USING ERRCODE = '22023'; END IF;
  IF svc AND (t.automation <> 'auto' OR t.executor = 'person') AND NOT coalesce((p->>'internal_only')::boolean, false) THEN
    RAISE EXCEPTION 'blocked: ticket is under human control' USING ERRCODE = '42501';
  END IF;

  v_stage := coalesce(p->>'stage', t.stage);
  v_status := p->>'status';
  IF v_status IS NULL THEN
    -- A stage change implies a status only when that is a valid move (e.g. re-triage keeps Working, never back to New).
    v_status := CASE WHEN p ? 'stage' AND bloom_support.valid_transition(t.status, bloom_support.status_for_stage(v_stage)) AND t.status <> 'resolved'
                     THEN bloom_support.status_for_stage(v_stage) ELSE t.status END;
  END IF;
  IF v_status = 'resolved' AND p ? 'status' AND NOT p ? 'stage' THEN v_stage := 'resolved'; END IF;
  IF v_status <> 'resolved' AND v_stage IN ('resolved','closed') THEN v_stage := 'triage'; END IF;
  IF v_status <> t.status AND NOT bloom_support.valid_transition(t.status, v_status) THEN
    RAISE EXCEPTION 'invalid transition % -> %', t.status, v_status USING ERRCODE = '22023';
  END IF;
  -- Waiting always carries a reason.
  v_wait := CASE WHEN v_status = 'waiting' THEN coalesce(p->>'waiting_reason', CASE WHEN t.status = 'waiting' THEN t.waiting_reason END,
                   CASE WHEN v_stage IN ('needs_info','awaiting_client') THEN 'customer' END) END;
  IF v_status = 'waiting' AND (v_wait IS NULL OR v_wait NOT IN ('customer','internal','third_party','deployment','scheduled')) THEN
    RAISE EXCEPTION 'invalid: waiting requires a reason (customer, internal, third_party, deployment, scheduled)' USING ERRCODE = '22023';
  END IF;
  -- Needs admin is an escalation: decision, accountable person and due time.
  IF v_status = 'needs_owner' AND t.status <> 'needs_owner' AND NOT coalesce((p->>'escalated')::boolean, false) THEN
    IF coalesce(btrim(p->>'decision_needed'), '') = '' THEN
      RAISE EXCEPTION 'invalid: Needs admin requires decision_needed' USING ERRCODE = '22023';
    END IF;
    INSERT INTO bloom_support.escalations(ticket_id, engineering_issue_id, audience, reason, detail, recommendation, evidence, due_at, dedupe_key)
    VALUES (t.id, t.engineering_issue_id, coalesce(p->>'accountable', 'both'), 'decision_needed', p->>'decision_needed', p->>'recommendation',
            coalesce(p->'evidence', '{}'::jsonb), (p->>'decision_due_at')::timestamptz, 'decision:' || t.id::text || ':' || t.version);
  END IF;

  -- Resolution needs a summary and evidence appropriate to the request type.
  IF v_status = 'resolved' AND t.status <> 'resolved' THEN
    IF svc AND NOT coalesce((p->>'resolution_verified')::boolean, false) THEN
      RAISE EXCEPTION 'blocked: Bloom may only resolve after verifying the outcome' USING ERRCODE = '42501';
    END IF;
    IF coalesce(btrim(coalesce(p->>'resolution_summary', t.resolution_summary)), '') = '' THEN
      RAISE EXCEPTION 'invalid: resolution summary required' USING ERRCODE = '22023';
    END IF;
    IF t.engineering_issue_id IS NOT NULL AND svc AND NOT EXISTS (
      SELECT 1 FROM bloom_support.engineering_issues e WHERE e.id = t.engineering_issue_id AND e.status IN ('verified','closed')) THEN
      RAISE EXCEPTION 'blocked: linked fix is not verified in production' USING ERRCODE = '42501';
    END IF;
    IF svc AND jsonb_typeof(p->'resolution_evidence') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'blocked: resolution evidence required' USING ERRCODE = '22023';
    END IF;
    CASE
      WHEN t.kind = 'question' THEN
        answer_id := coalesce((ev->>'answer_message_id')::uuid,
          (SELECT m.id FROM bloom_support.messages m WHERE m.ticket_id = t.id AND m.meaningful ORDER BY m.created_at DESC LIMIT 1));
        IF answer_id IS NULL THEN RAISE EXCEPTION 'invalid: answer the question before resolving it' USING ERRCODE = '22023'; END IF;
        ev := ev || jsonb_build_object('answer_message_id', answer_id);
      WHEN t.kind = 'change' THEN
        IF ev ? 'operation_id' THEN
          SELECT * INTO op FROM bloom_support.operations WHERE id = (ev->>'operation_id')::uuid AND ticket_id = t.id;
          IF op.id IS NULL OR op.status <> 'succeeded' OR coalesce((op.verification->>'passed')::boolean, false) = false THEN
            RAISE EXCEPTION 'invalid: the change operation has not succeeded with a passing verification' USING ERRCODE = '22023';
          END IF;
          ev := ev || jsonb_build_object('saved_result', op.result, 'verification', op.verification);
        ELSIF svc OR coalesce(btrim(ev->>'verified_note'), '') = '' THEN
          RAISE EXCEPTION 'invalid: a content/configuration change needs the saved result and its verification (operation_id or verified_note)' USING ERRCODE = '22023';
        END IF;
      WHEN t.kind IN ('bug','incident') THEN
        IF coalesce((ev->'verification'->>'passed')::boolean, false) = false THEN
          RAISE EXCEPTION 'invalid: a bug needs a passing affected-flow verification' USING ERRCODE = '22023';
        END IF;
        IF (svc OR t.engineering_issue_id IS NOT NULL) AND ev->'deployment'->>'state' IS DISTINCT FROM 'success'
           AND coalesce(btrim(ev->>'no_deploy_reason'), '') = '' THEN
          RAISE EXCEPTION 'invalid: resolution evidence must include a successful production deployment and a passing user-flow check' USING ERRCODE = '22023';
        END IF;
      WHEN t.kind = 'feature' THEN
        IF t.feature_request_id IS NULL THEN RAISE EXCEPTION 'invalid: route the feature request to the product decision queue first' USING ERRCODE = '22023'; END IF;
        ev := ev || jsonb_build_object('routed_feature_request_id', t.feature_request_id, 'delivered', false);
      ELSE NULL;
    END CASE;
  END IF;

  IF p ? 'owner_id' AND p->>'owner_id' IS NOT NULL THEN
    v_owner := (p->>'owner_id')::uuid;
    IF NOT bloom_support.is_staff(v_owner) THEN RAISE EXCEPTION 'invalid: the accountable owner must be a person on the support team' USING ERRCODE = '22023'; END IF;
  END IF;
  IF p->>'executor' IS NOT NULL AND p->>'executor' NOT IN ('bloom','person') THEN RAISE EXCEPTION 'invalid executor' USING ERRCODE = '22023'; END IF;
  IF svc AND p->>'executor' = 'bloom' AND t.executor = 'person' THEN RAISE EXCEPTION 'forbidden: Bloom cannot reclaim a ticket' USING ERRCODE = '42501'; END IF;

  UPDATE bloom_support.tickets SET
    status = v_status, stage = v_stage, waiting_reason = v_wait,
    priority = coalesce(p->>'priority', priority), kind = coalesce(p->>'kind', kind), category = coalesce(p->>'category', category),
    impact = coalesce(p->>'impact', impact), environment = coalesce(p->>'environment', environment),
    tags = CASE WHEN p ? 'tags' THEN ARRAY(SELECT DISTINCT lower(x) FROM jsonb_array_elements_text(p->'tags') x) ELSE tags END,
    owner_id = CASE WHEN p ? 'owner_id' THEN v_owner ELSE owner_id END,
    executor = coalesce(p->>'executor', executor),
    executor_id = CASE WHEN p->>'executor' = 'person' THEN coalesce((p->>'executor_id')::uuid, CASE WHEN svc THEN NULL ELSE p_actor END, executor_id)
                       WHEN p->>'executor' = 'bloom' THEN NULL ELSE executor_id END,
    automation = CASE WHEN p->>'executor' = 'person' AND automation = 'auto' THEN 'human' WHEN p->>'executor' = 'bloom' THEN 'auto' ELSE automation END,
    next_action = CASE WHEN p ? 'next_action' THEN p->>'next_action' ELSE next_action END,
    next_action_due_at = CASE WHEN p ? 'next_action_due_at' THEN (p->>'next_action_due_at')::timestamptz ELSE next_action_due_at END,
    resolution_summary = coalesce(p->>'resolution_summary', resolution_summary),
    resolution_verified = CASE WHEN v_status = 'resolved' THEN coalesce((p->>'resolution_verified')::boolean, resolution_verified) ELSE false END,
    resolved_at = CASE WHEN v_status = 'resolved' THEN coalesce(resolved_at, now()) ELSE NULL END,
    resolution_evidence = CASE WHEN v_status = 'resolved' AND t.status <> 'resolved'
      THEN ev || jsonb_build_object('resolved_by', CASE WHEN svc THEN 'bloom' ELSE 'person' END, 'actor', p_actor, 'type', t.kind, 'at', now())
      WHEN v_status <> 'resolved' THEN NULL ELSE resolution_evidence END,
    reopen_count = reopen_count + CASE WHEN t.status = 'resolved' AND v_status <> 'resolved' THEN 1 ELSE 0 END,
    pending_review = CASE WHEN t.status = 'resolved' AND v_status <> 'resolved' THEN NULL ELSE pending_review END,
    version = version + 1, updated_at = now()
  WHERE id = p_ticket RETURNING * INTO n;

  IF n.executor = 'person' AND t.executor = 'bloom' THEN PERFORM bloom_support.invalidate_planned(n.id, 'person assigned as executor'); END IF;
  PERFORM bloom_support.log(n.id, n.account_id, p_actor, 'ticket.updated', jsonb_strip_nulls(jsonb_build_object(
    'status', CASE WHEN n.status <> t.status THEN jsonb_build_array(t.status, n.status) END,
    'waiting_reason', CASE WHEN n.waiting_reason IS DISTINCT FROM t.waiting_reason THEN n.waiting_reason END,
    'priority', CASE WHEN n.priority <> t.priority THEN jsonb_build_array(t.priority, n.priority) END,
    'owner', CASE WHEN n.owner_id IS DISTINCT FROM t.owner_id THEN n.owner_id END,
    'executor', CASE WHEN n.executor <> t.executor THEN n.executor END,
    'next_action', CASE WHEN n.next_action IS DISTINCT FROM t.next_action THEN n.next_action END,
    'reason', p->>'reason')));
  IF n.status = 'resolved' AND t.status <> 'resolved' AND NOT n.spam THEN
    PERFORM bloom_support.enqueue_job('send_email', n.id, NULL, 'email:' || n.id::text,
      jsonb_build_object('purpose','resolution'), 'email:resolution:' || n.id::text || ':' || n.reopen_count);
  END IF;
  IF n.status = 'needs_owner' AND t.status <> 'needs_owner' THEN
    PERFORM bloom_support.notify_staff(n.id, 'ticket.needs_owner', 'Needs admin #' || n.number || ': ' || left(n.subject, 80), coalesce(p->>'accountable', 'both'));
  END IF;
  RETURN bloom_support.ticket_json(p_actor, n, false);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.escalate(p_actor uuid, p_ticket uuid, p_audience text, p_reason text, p_detail text, p_dedupe text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; v uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  INSERT INTO bloom_support.escalations(ticket_id, engineering_issue_id, audience, reason, detail, dedupe_key)
  VALUES (t.id, t.engineering_issue_id, coalesce(p_audience,'both'), p_reason, p_detail, p_dedupe)
  ON CONFLICT (dedupe_key) DO NOTHING RETURNING id INTO v;
  IF v IS NULL THEN SELECT id INTO v FROM bloom_support.escalations WHERE dedupe_key = p_dedupe; RETURN jsonb_build_object('escalation_id', v, 'duplicate', true); END IF;
  UPDATE bloom_support.tickets SET status = 'needs_owner', stage = 'escalated', next_action = 'Admin: ' || left(p_reason, 200), version = version + 1, updated_at = now() WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.escalated', jsonb_build_object('audience', p_audience, 'reason', p_reason));
  PERFORM bloom_support.notify_staff(t.id, 'escalation', 'Escalated #' || t.number || ': ' || left(p_reason, 80), coalesce(p_audience,'both'));
  PERFORM bloom_support.enqueue_job('escalate', t.id, NULL, 'email:escalation', jsonb_build_object('escalation_id', v), 'escalate:' || v::text);
  RETURN jsonb_build_object('escalation_id', v, 'duplicate', false);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.route_feature_request(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; f uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  f := coalesce((p->>'feature_request_id')::uuid, t.feature_request_id);
  IF f IS NULL THEN
    INSERT INTO bloom_support.feature_requests(title, description, product)
    VALUES (coalesce(p->>'title', t.subject), coalesce(p->>'description', t.summary), t.product) RETURNING id INTO f;
    INSERT INTO bloom_support.escalations(ticket_id, feature_request_id, audience, reason, detail, dedupe_key)
    VALUES (t.id, f, 'jon', 'feature_decision', coalesce(p->>'title', t.subject), 'feature:' || f::text);
    PERFORM bloom_support.notify_staff(t.id, 'feature.awaiting_decision', 'Feature decision: ' || left(coalesce(p->>'title', t.subject), 80), 'jon');
  END IF;
  INSERT INTO bloom_support.feature_evidence(feature_request_id, ticket_id, account_id, excerpt)
  VALUES (f, t.id, t.account_id, left(coalesce(p->>'excerpt', t.summary), 1000)) ON CONFLICT DO NOTHING;
  UPDATE bloom_support.tickets SET feature_request_id = f, kind = 'feature', stage = 'awaiting_decision', status = 'needs_owner',
    next_action = 'Admin decides on the feature request', version = version + 1, updated_at = now() WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'feature.routed', jsonb_build_object('feature_request_id', f));
  RETURN jsonb_build_object('feature_request_id', f);
END $$;

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
                    WHEN n.status IN ('awaiting_approval','escalated','failed','rolled_back') THEN 'needs_owner' ELSE 'working' END
    WHERE id = tk.id;
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
