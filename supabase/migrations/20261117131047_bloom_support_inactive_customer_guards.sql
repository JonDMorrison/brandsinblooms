-- Restore the live-group guard lost in pre-breach alerting. All other watchdog behavior is preserved.
CREATE OR REPLACE FUNCTION bloom_support.watchdog()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lim jsonb := coalesce(bloom_support.setting('limits'), '{}'); enabled boolean := coalesce((bloom_support.setting('automation_enabled'))::text::boolean, false);
  last_ok timestamptz; stale_queue int; dead int; findings jsonb := '[]'; f jsonb; hour text := to_char(now(), 'YYYY-MM-DD"T"HH24'); key text; resend_key text; recipients jsonb; inserted boolean;
  today text := to_char(now(), 'YYYY-MM-DD'); check_rows jsonb; summary text; total int; tenants_hit int;
BEGIN
  PERFORM bloom_support.sweep_deadlines();
  IF to_regprocedure('bloom_support.sweep_operational()') IS NOT NULL THEN EXECUTE 'SELECT bloom_support.sweep_operational()'; END IF;
  SELECT max(finished_at) INTO last_ok FROM bloom_support.worker_runs;
  IF enabled AND (last_ok IS NULL OR last_ok < now() - make_interval(mins => coalesce((lim->>'worker_stale_minutes')::int, 10))) THEN
    findings := findings || jsonb_build_object('condition', 'worker_not_running', 'last_finished_at', last_ok);
  END IF;
  SELECT count(*) INTO stale_queue FROM bloom_support.jobs WHERE status = 'queued' AND run_after < now() - make_interval(mins => coalesce((lim->>'queue_stale_minutes')::int, 15));
  IF enabled AND stale_queue > 0 THEN findings := findings || jsonb_build_object('condition', 'queue_backlog', 'jobs', stale_queue); END IF;
  SELECT count(*) INTO dead FROM bloom_support.jobs WHERE status = 'dead' AND updated_at > now() - interval '1 hour';
  IF dead > 0 THEN findings := findings || jsonb_build_object('condition', 'dead_jobs', 'jobs', dead); END IF;
  IF EXISTS (SELECT 1 FROM bloom_support.outbound_emails WHERE status = 'failed' AND created_at > now() - interval '1 hour') THEN
    findings := findings || jsonb_build_object('condition', 'email_failures');
  END IF;

  -- approaching_deadline: tickets at >= 80% of first-response window, not yet breached, no reply yet.
  -- Fires before the breach so the team has time to respond.
  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number, 'subject', x.subject, 'due_at', x.due_at, 'percent_elapsed', x.pct) ORDER BY x.pct DESC), '[]'),
           count(*)::int,
           string_agg(format('#%s (%s%% elapsed, due %s)', x.number, x.pct, to_char(x.due_at, 'Mon DD HH24:MI')), '; ' ORDER BY x.pct DESC)
      INTO check_rows, total, summary
      FROM (
        SELECT t.id, t.number, t.subject, t.due_at,
               round(100.0 * extract(epoch FROM now() - t.created_at)
                           / extract(epoch FROM t.due_at - t.created_at))::int AS pct
          FROM bloom_support.tickets t
         WHERE t.first_response_at IS NULL
           AND t.due_at IS NOT NULL
           AND t.due_at > now()
           AND t.status NOT IN ('resolved', 'waiting')
           AND NOT t.spam
           AND t.merged_into IS NULL
           AND extract(epoch FROM t.due_at - t.created_at) > 0
           AND extract(epoch FROM now() - t.created_at)
               >= 0.8 * extract(epoch FROM t.due_at - t.created_at)
         ORDER BY t.due_at
         LIMIT 50
      ) x;
    IF total > 0 THEN
      findings := findings || jsonb_build_object('condition', 'approaching_deadline', 'tickets', check_rows, 'count', total,
        'summary', format('%s request%s %s nearly past the response deadline without a reply: %s.',
          total, CASE WHEN total = 1 THEN '' ELSE 's' END,
          CASE WHEN total = 1 THEN 'is' ELSE 'are' END,
          left(summary, 400)));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    findings := findings || jsonb_build_object('condition', 'watchdog_check_failed', 'check', 'approaching_deadline', 'error', SQLERRM,
      'summary', 'The Bloom watchdog could not run its pre-breach alerting check: ' || SQLERRM);
  END;

  -- bloom_tool_failures: one tool failing for one tenant (>= 5 calls, >= 50% failed, last hour).
  BEGIN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.failed DESC), '[]'),
           string_agg(format('%s failed %s of %s calls for %s', x.tool_name, x.failed, x.calls, coalesce(x.tenant_name, x.tenant_id::text)), '; ' ORDER BY x.failed DESC)
      INTO check_rows, summary
      FROM (
        SELECT e.tenant_id, t.name AS tenant_name, e.tool_name, count(*) AS calls,
               count(*) FILTER (WHERE e.status = 'failed') AS failed
          FROM public.bloom_tool_executions e
          LEFT JOIN public.tenants t ON t.id = e.tenant_id
         WHERE e.created_at > now() - interval '1 hour'
         GROUP BY e.tenant_id, t.name, e.tool_name
        HAVING count(*) >= 5 AND count(*) FILTER (WHERE e.status = 'failed') * 2 >= count(*)
         ORDER BY count(*) FILTER (WHERE e.status = 'failed') DESC
         LIMIT 20
      ) x;
    IF jsonb_array_length(check_rows) > 0 THEN
      findings := findings || jsonb_build_object('condition', 'bloom_tool_failures', 'tools', check_rows,
        'summary', 'Bloom tools are failing in the last hour: ' || summary || '.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    findings := findings || jsonb_build_object('condition', 'watchdog_check_failed', 'check', 'bloom_tool_failures', 'error', SQLERRM,
      'summary', 'The Bloom watchdog could not run its tool failure check: ' || SQLERRM);
  END;

  -- bloom_tool_timeouts: one tool timing out >= 3 times for one tenant in the last hour.
  BEGIN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.timeouts DESC), '[]'),
           string_agg(format('%s timed out %s times for %s', x.tool_name, x.timeouts, coalesce(x.tenant_name, x.tenant_id::text)), '; ' ORDER BY x.timeouts DESC)
      INTO check_rows, summary
      FROM (
        SELECT e.tenant_id, t.name AS tenant_name, e.tool_name, count(*) AS timeouts
          FROM public.bloom_tool_executions e
          LEFT JOIN public.tenants t ON t.id = e.tenant_id
         WHERE e.created_at > now() - interval '1 hour'
           AND coalesce(e.error_message, e.tool_output->>'error') = 'timeout_error'
         GROUP BY e.tenant_id, t.name, e.tool_name
        HAVING count(*) >= 3
         ORDER BY count(*) DESC
         LIMIT 20
      ) x;
    IF jsonb_array_length(check_rows) > 0 THEN
      findings := findings || jsonb_build_object('condition', 'bloom_tool_timeouts', 'tools', check_rows,
        'summary', 'Bloom data lookups are timing out in the last hour: ' || summary || '.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    findings := findings || jsonb_build_object('condition', 'watchdog_check_failed', 'check', 'bloom_tool_timeouts', 'error', SQLERRM,
      'summary', 'The Bloom watchdog could not run its tool timeout check: ' || SQLERRM);
  END;

  -- bloom_request_errors: >= 5 Bloom error events for one tenant in the last hour.
  BEGIN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.errors DESC), '[]'),
           string_agg(format('%s errors for %s (%s access denied)', x.errors, coalesce(x.tenant_name, x.tenant_id::text), x.access_denied), '; ' ORDER BY x.errors DESC)
      INTO check_rows, summary
      FROM (
        SELECT a.tenant_id, t.name AS tenant_name, count(*) AS errors,
               count(*) FILTER (WHERE a.event_data->>'stage' = 'access_denied') AS access_denied,
               count(DISTINCT a.user_id) AS users
          FROM public.bloom_audit_log a
          LEFT JOIN public.tenants t ON t.id = a.tenant_id
         WHERE a.event_type = 'error'
           AND a.created_at > now() - interval '1 hour'
         GROUP BY a.tenant_id, t.name
        HAVING count(*) >= 5
         ORDER BY count(*) DESC
         LIMIT 20
      ) x;
    IF jsonb_array_length(check_rows) > 0 THEN
      findings := findings || jsonb_build_object('condition', 'bloom_request_errors', 'tenants', check_rows,
        'summary', 'Bloom requests are failing in the last hour: ' || summary || '.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    findings := findings || jsonb_build_object('condition', 'watchdog_check_failed', 'check', 'bloom_request_errors', 'error', SQLERRM,
      'summary', 'The Bloom watchdog could not run its request error check: ' || SQLERRM);
  END;

  -- bloom_negative_feedback: >= 3 thumbs-down answers in the last 24 hours.
  BEGIN
    SELECT coalesce(sum(x.answers), 0)::int,
           coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.answers DESC), '[]'),
           string_agg(format('%s for %s', x.answers, coalesce(x.tenant_name, x.tenant_id::text)), '; ' ORDER BY x.answers DESC)
      INTO total, check_rows, summary
      FROM (
        SELECT m.tenant_id, t.name AS tenant_name, count(*) AS answers
          FROM public.bloom_messages m
          LEFT JOIN public.tenants t ON t.id = m.tenant_id
         WHERE m.role = 'assistant'
           AND m.metadata->>'feedback' = 'negative'
           AND m.created_at > now() - interval '24 hours'
         GROUP BY m.tenant_id, t.name
      ) x;
    IF total >= 3 THEN
      findings := findings || jsonb_build_object('condition', 'bloom_negative_feedback', 'answers', total, 'tenants', check_rows,
        'dedupe_window', 'day',
        'summary', format('Staff gave %s Bloom answers a thumbs down in the last 24 hours: %s.', total, summary));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    findings := findings || jsonb_build_object('condition', 'watchdog_check_failed', 'check', 'bloom_negative_feedback', 'error', SQLERRM,
      'summary', 'The Bloom watchdog could not run its negative feedback check: ' || SQLERRM);
  END;

  -- duplicate_system_segments: a tenant has more than one live built-in group with the same name.
  BEGIN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.copies DESC), '[]'),
           string_agg(format('"%s" x%s for %s', x.group_name, x.copies, coalesce(x.tenant_name, x.tenant_id::text)), '; ' ORDER BY x.copies DESC)
      INTO check_rows, summary
      FROM (
        SELECT s.tenant_id, t.name AS tenant_name, min(s.name) AS group_name, count(*) AS copies,
               jsonb_agg(s.id ORDER BY s.created_at) AS segment_ids
          FROM public.crm_segments s
          LEFT JOIN public.tenants t ON t.id = s.tenant_id
         WHERE s.is_system_segment
           AND s.deleted_at IS NULL
         GROUP BY s.tenant_id, t.name, lower(s.name)
        HAVING count(*) > 1
         ORDER BY count(*) DESC
         LIMIT 20
      ) x;
    IF jsonb_array_length(check_rows) > 0 THEN
      findings := findings || jsonb_build_object('condition', 'duplicate_system_segments', 'groups', check_rows,
        'dedupe_window', 'day',
        'summary', 'Some companies have the same built-in customer group more than once: ' || summary || '.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    findings := findings || jsonb_build_object('condition', 'watchdog_check_failed', 'check', 'duplicate_system_segments', 'error', SQLERRM,
      'summary', 'The Bloom watchdog could not run its duplicate group check: ' || SQLERRM);
  END;

  -- orphan_segment_memberships: memberships that still point at deleted or merged customers.
  BEGIN
    SELECT count(*)::int, count(DISTINCT o.tenant_id)::int
      INTO total, tenants_hit
      FROM (
        SELECT c.tenant_id
          FROM public.crm_customers c
         WHERE (c.deleted_at IS NOT NULL OR c.merged_into_customer_id IS NOT NULL)
           AND EXISTS (SELECT 1 FROM public.customer_segments cs JOIN public.crm_segments live_s ON live_s.id = cs.segment_id AND live_s.deleted_at IS NULL WHERE cs.customer_id = c.id)
         LIMIT 1000
      ) o;
    IF total > 0 THEN
      findings := findings || jsonb_build_object('condition', 'orphan_segment_memberships', 'customers', total, 'tenants', tenants_hit,
        'capped', total >= 1000, 'dedupe_window', 'day',
        'summary', format('%s%s deleted or merged customers are still in customer groups across %s companies. Group counts and campaign audiences may be wrong.',
          total, CASE WHEN total >= 1000 THEN '+' ELSE '' END, tenants_hit));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    findings := findings || jsonb_build_object('condition', 'watchdog_check_failed', 'check', 'orphan_segment_memberships', 'error', SQLERRM,
      'summary', 'The Bloom watchdog could not run its orphan group membership check: ' || SQLERRM);
  END;

  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''bloom_support_alert_resend_key'' LIMIT 1' INTO resend_key;
  END IF;
  recipients := coalesce(bloom_support.setting('owners')->'jon', '[]') || coalesce(bloom_support.setting('owners')->'jeff', '[]');
  FOR f IN SELECT * FROM jsonb_array_elements(findings) LOOP
    key := (f->>'condition') || coalesce(':' || (f->>'check'), '') || ':' || CASE WHEN f->>'dedupe_window' = 'day' THEN today ELSE hour END;
    INSERT INTO bloom_support.alerts(condition, detail, dedupe_key) VALUES (f->>'condition', f, key) ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING true INTO inserted;
    IF coalesce(inserted, false) THEN
      PERFORM bloom_support.notify_staff(NULL, 'alert.' || (f->>'condition'), coalesce('Bloom alert: ' || left(f->>'summary', 240), 'Bloom alert: ' || replace(f->>'condition', '_', ' ')), 'both');
      IF resend_key IS NOT NULL AND jsonb_array_length(recipients) > 0 AND to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NOT NULL THEN
        EXECUTE 'SELECT net.http_post(url := $1, headers := $2, body := $3)' USING
          'https://api.resend.com/emails',
          jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
          jsonb_build_object('from', coalesce(bloom_support.setting('support_inbox')->>'alert_from', 'Bloom Alerts <alerts@bloomsuite.app>'),
            'to', recipients, 'subject', '[Bloom alert] ' || replace(f->>'condition', '_', ' '), 'text', 'Bloom Support watchdog: ' || coalesce((f->>'summary') || E'\n\nDetails: ', '') || f::text || E'\n\nOpen Bloom Support → Settings → Readiness.');
        UPDATE bloom_support.alerts SET delivered = 'email_requested' WHERE dedupe_key = key;
      ELSE
        UPDATE bloom_support.alerts SET delivered = 'no_channel' WHERE dedupe_key = key;
      END IF;
    END IF;
    inserted := NULL;
  END LOOP;
  RETURN jsonb_build_object('findings', findings, 'checked_at', now());
END $$;

-- A provider attempt may have succeeded without a receipt. Ordinary retry
-- must not clear that hold or generate a different batch idempotency key.
ALTER TABLE public.email_messages ADD COLUMN delivery_reconciliation_required boolean NOT NULL DEFAULT false;
-- Ensure the base retry_failed_email_messages(uuid,int) RPC exists.
-- Some environments can end up with migration history drift where the wrapper exists but the base overload is missing.

CREATE OR REPLACE FUNCTION public.retry_failed_email_messages(
  p_campaign_id UUID,
  p_batch_size INT DEFAULT 200
)
RETURNS TABLE (
  count_reset INT,
  jobs_created INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;

  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_domain_id UUID;

  v_base_batch_index INT;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  -- Derive tenant_id from owner if missing.
  IF v_effective_tenant_id IS NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  -- Derive tenant_id from segment linkages if still missing.
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  -- Authorization: owner or same tenant.
  IF v_campaign_user_id = v_actor_user_id THEN
    -- ok
  ELSIF v_actor_tenant_id IS NOT NULL AND v_effective_tenant_id IS NOT NULL AND v_actor_tenant_id = v_effective_tenant_id THEN
    -- ok
  ELSE
    RETURN;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 THEN
    p_batch_size := 200;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1)
  INTO v_base_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  WITH failed AS (
    SELECT m.id, m.customer_id, m.email
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.status = 'failed'
      AND NOT m.delivery_reconciliation_required
  ),
  updated AS (
    UPDATE public.email_messages m
    SET
      status = 'queued',
      attempts = 0,
      resend_id = NULL,
      error_message = NULL,
      last_attempt_at = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      claim_token = NULL,
      dead_lettered_at = NULL,
      updated_at = now()
    FROM failed f
    WHERE m.id = f.id
    RETURNING m.id, m.customer_id, m.email
  ),
  numbered AS (
    SELECT
      u.id,
      u.customer_id,
      u.email,
      row_number() OVER (ORDER BY u.id) AS rn
    FROM updated u
  ),
  batches AS (
    SELECT
      floor((rn - 1) / p_batch_size)::INT AS batch_group,
      jsonb_agg(
        jsonb_build_object('customerId', customer_id, 'email', email)
        ORDER BY rn
      ) AS recipient_emails,
      array_agg(id ORDER BY rn)::UUID[] AS recipient_message_ids
    FROM numbered
    GROUP BY 1
  ),
  inserted AS (
    INSERT INTO public.email_send_jobs (
      campaign_id,
      tenant_id,
      domain_id,
      status,
      recipient_emails,
      recipient_message_ids,
      batch_index,
      error_message,
      attempts,
      emails_sent,
      emails_failed,
      created_at,
      updated_at
    )
    SELECT
      p_campaign_id,
      v_effective_tenant_id,
      v_domain_id,
      'pending',
      b.recipient_emails,
      b.recipient_message_ids,
      v_base_batch_index + b.batch_group + 1,
      NULL,
      0,
      0,
      0,
      now(),
      now()
    FROM batches b
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM updated)::INT,
    (SELECT COUNT(*) FROM inserted)::INT
  INTO count_reset, jobs_created;

  IF count_reset > 0 THEN
    UPDATE public.crm_campaigns c
    SET
      status = 'sending',
      send_error = NULL,
      send_blocked_reason = NULL,
      sent_at = NULL,
      send_started_at = COALESCE(c.send_started_at, now()),
      updated_at = now()
    WHERE c.id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT count_reset, jobs_created;
END;
$$;


CREATE OR REPLACE FUNCTION public.retry_campaign_recipient_message(
  p_campaign_id UUID,
  p_recipient_id UUID
)
RETURNS TABLE (
  retry_message_id UUID,
  jobs_created INTEGER,
  blocked_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_domain_id UUID;
  v_base_message_id UUID;
  v_customer_id UUID;
  v_email TEXT;
  v_payload JSONB;
  v_last_status TEXT;
  v_retry_count INTEGER := 0;
  v_has_bounce BOOLEAN := FALSE;
  v_batch_index INTEGER := 0;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_found'::TEXT;
    RETURN;
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  IF NOT (
    v_campaign_user_id = v_actor_user_id
    OR (
      v_actor_tenant_id IS NOT NULL
      AND v_effective_tenant_id IS NOT NULL
      AND v_actor_tenant_id = v_effective_tenant_id
    )
  ) THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'forbidden'::TEXT;
    RETURN;
  END IF;

  SELECT
    m.id,
    m.customer_id,
    m.email,
    m.payload
  INTO v_base_message_id, v_customer_id, v_email, v_payload
  FROM public.email_messages m
  WHERE m.id = p_recipient_id
    AND m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.retry_sequence = 0
  LIMIT 1;

  IF v_base_message_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id AND m.tenant_id = v_effective_tenant_id
      AND m.customer_id = v_customer_id AND m.delivery_reconciliation_required) THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'delivery_reconciliation_required'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_retry_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.customer_id = v_customer_id
    AND m.retry_sequence > 0;

  IF v_retry_count > 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'already_retried'::TEXT;
    RETURN;
  END IF;

  SELECT m.status
  INTO v_last_status
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.customer_id = v_customer_id
  ORDER BY m.retry_sequence DESC, m.created_at DESC, m.id DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.email_tracking_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
      AND LOWER(e.customer_email) = LOWER(v_email)
      AND e.event_type IN ('bounce', 'bounced')
  )
  INTO v_has_bounce;

  IF COALESCE(v_last_status, '') <> 'failed' AND NOT v_has_bounce THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_retryable'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1) + 1
  INTO v_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  INSERT INTO public.email_messages (
    tenant_id,
    campaign_id,
    customer_id,
    domain_id,
    email,
    payload,
    status,
    resend_id,
    attempts,
    last_attempt_at,
    sent_at,
    error_message,
    claimed_at,
    claimed_by,
    claim_token,
    dead_lettered_at,
    retry_sequence,
    retry_of_message_id,
    retried_at
  )
  VALUES (
    v_effective_tenant_id,
    p_campaign_id,
    v_customer_id,
    v_domain_id,
    v_email,
    COALESCE(v_payload, '{}'::jsonb),
    'queued',
    NULL,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    v_base_message_id,
    NOW()
  )
  RETURNING id INTO retry_message_id;

  INSERT INTO public.email_send_jobs (
    campaign_id,
    tenant_id,
    domain_id,
    status,
    recipient_emails,
    recipient_message_ids,
    batch_index,
    error_message,
    attempts,
    emails_sent,
    emails_failed,
    created_at,
    updated_at
  )
  VALUES (
    p_campaign_id,
    v_effective_tenant_id,
    v_domain_id,
    'pending',
    jsonb_build_array(jsonb_build_object('customerId', v_customer_id, 'email', v_email)),
    ARRAY[retry_message_id],
    v_batch_index,
    NULL,
    0,
    0,
    0,
    NOW(),
    NOW()
  );

  UPDATE public.crm_campaigns c
  SET
    status = CASE WHEN c.status IN ('sent', 'failed', 'sent_with_errors') THEN 'sending' ELSE c.status END,
    send_error = NULL,
    send_blocked_reason = NULL,
    updated_at = NOW()
  WHERE c.id = p_campaign_id;

  jobs_created := 1;
  blocked_reason := NULL;
  RETURN NEXT;
END;
$$;
