-- Bloom watchdog: make Bloom and core CRM data failures visible to staff.
--
-- Extends bloom_support.watchdog() (defined in
-- 20261031140000_bloom_support_operations_hardening.sql). Every existing check,
-- the alert dedupe, notify_staff and the Resend email path are kept as they
-- were. New checks:
--   * bloom_tool_failures      one tool failing >= 50% of >= 5 calls for a tenant in the last hour
--   * bloom_tool_timeouts      one tool timing out >= 3 times for a tenant in the last hour
--   * bloom_request_errors     >= 5 Bloom 'error' audit events for a tenant in the last hour
--                              (stream errors and pre-stream 403/500 rejections)
--   * bloom_negative_feedback  >= 3 thumbs-down answers in the last 24 hours
--   * duplicate_system_segments a tenant has two live built-in groups with the same name
--   * orphan_segment_memberships group memberships that still point at deleted or merged customers
--
-- Findings may carry:
--   summary         plain-language text used for the staff notification and email
--   dedupe_window   'day' for slow-moving data problems; default stays hourly
-- Findings without these keys behave exactly as before (same dedupe key, title and email text).
--
-- New checks run inside their own exception block, so a failing check reports
-- watchdog_check_failed instead of stopping the existing checks.

-- ---------------------------------------------------------------------------
-- Indexes that keep the new checks cheap when run every five minutes
-- ---------------------------------------------------------------------------
-- Existing indexes lead with tenant_id; the watchdog scans all tenants by time.
CREATE INDEX IF NOT EXISTS idx_bloom_tool_executions_recent
  ON public.bloom_tool_executions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_audit_log_recent_errors
  ON public.bloom_audit_log (created_at DESC)
  WHERE event_type = 'error';

CREATE INDEX IF NOT EXISTS idx_bloom_messages_negative_feedback
  ON public.bloom_messages (created_at DESC)
  WHERE role = 'assistant' AND metadata->>'feedback' = 'negative';

-- Small partial index (deleted or merged customers only). The orphan check
-- walks it and probes customer_segments through idx_customer_segments_customer_id.
CREATE INDEX IF NOT EXISTS idx_crm_customers_inactive
  ON public.crm_customers (id)
  WHERE deleted_at IS NOT NULL OR merged_into_customer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Watchdog
-- ---------------------------------------------------------------------------
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
  -- Covers stream errors and pre-stream rejections (403 access denied, 500 request failed).
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
  -- The Bloom panel stores metadata.feedback = 'negative' (useBloomMessageMutations.ts).
  -- The window uses the answer's created_at; feedback has no timestamp of its own.
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
  -- Bounded: walks idx_crm_customers_inactive, probes customer_segments by customer_id, stops at 1000.
  BEGIN
    SELECT count(*)::int, count(DISTINCT o.tenant_id)::int
      INTO total, tenants_hit
      FROM (
        SELECT c.tenant_id
          FROM public.crm_customers c
         WHERE (c.deleted_at IS NOT NULL OR c.merged_into_customer_id IS NOT NULL)
           AND EXISTS (SELECT 1 FROM public.customer_segments cs WHERE cs.customer_id = c.id)
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
