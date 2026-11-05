-- Bloom Support emails people can act on.
--
-- 1. The email ledger keeps the HTML body next to the text body, so a retry
--    resends exactly what the first attempt recorded (the provider rejects a
--    changed payload under the same idempotency key).
-- 2. One conversation per ticket: the first email for a ticket takes a stable
--    per-ticket Message-ID (thread_root) when it is still unused.
-- 3. Coalescing: an email can cover several queued Bloom messages; all of them
--    get the email's delivery status, so their own send jobs skip.
-- 4. Watchdog: health alerts that must work without the worker still go out
--    from SQL, now as a designed email with a link. Every other alert goes to
--    the worker as one job per watchdog run, where tool failures and timeouts
--    for the same company and tool are merged into one email. A tool alert
--    whose sibling (failures vs timeouts) already emailed this hour is merged
--    and not emailed again.
-- 5. Daily digest: a read-only report of what Bloom did and said, for staff.
--    The daily digest is turned on; recipients default to platform staff and
--    anyone can opt out with digest.opt_out.

-- ---------------------------------------------------------------------------
-- 1-3. Email ledger
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.outbound_emails ADD COLUMN IF NOT EXISTS html text;
ALTER TABLE bloom_support.outbound_emails ADD COLUMN IF NOT EXISTS covered_message_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION bloom_support.queue_outbound_email(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.outbound_emails; t bloom_support.tickets; v_blocked boolean; v_rfc text := p->>'rfc_message_id';
BEGIN
  -- Addresses that bounced (30 days) or complained (ever) are not emailed again.
  v_blocked := EXISTS (SELECT 1 FROM bloom_support.outbound_emails b WHERE lower(b.to_email) = lower(p->>'to')
                         AND (b.status = 'complained' OR (b.status = 'bounced' AND b.created_at > now() - interval '30 days')));
  IF p->>'ticket_id' IS NOT NULL THEN SELECT * INTO t FROM bloom_support.tickets WHERE id = (p->>'ticket_id')::uuid; END IF;
  -- The first email of a ticket's conversation uses the stable thread root as its Message-ID.
  IF p->>'thread_root' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bloom_support.outbound_emails x WHERE x.rfc_message_id = p->>'thread_root')
     AND NOT EXISTS (SELECT 1 FROM bloom_support.outbound_emails x WHERE x.idempotency_key = p->>'idempotency_key') THEN
    v_rfc := p->>'thread_root';
  END IF;
  INSERT INTO bloom_support.outbound_emails(ticket_id, message_id, purpose, to_email, subject, body, html, rfc_message_id, in_reply_to, idempotency_key, cc, covered_message_ids, status)
  VALUES ((p->>'ticket_id')::uuid, (p->>'message_id')::uuid, p->>'purpose', lower(p->>'to'), p->>'subject', p->>'body', p->>'html', v_rfc, p->>'in_reply_to', p->>'idempotency_key',
    coalesce(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'cc') = 'array' THEN p->'cc' ELSE '[]'::jsonb END) x), '{}'),
    -- Only messages of the same ticket can be covered by one email.
    coalesce(ARRAY(SELECT m.id FROM bloom_support.messages m
                   WHERE m.id IN (SELECT (x)::uuid FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'covered_message_ids') = 'array' THEN p->'covered_message_ids' ELSE '[]'::jsonb END) x)
                     AND m.ticket_id = (p->>'ticket_id')::uuid AND m.id IS DISTINCT FROM (p->>'message_id')::uuid), '{}'),
    CASE WHEN v_blocked THEN 'suppressed'
         WHEN coalesce((p->>'bloom_initiated')::boolean, false) AND t.automation <> 'auto' THEN 'suppressed' ELSE 'queued' END)
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING * INTO o;
  IF o.id IS NOT NULL AND o.status = 'suppressed' THEN
    UPDATE bloom_support.outbound_emails SET error = CASE WHEN v_blocked THEN 'recipient bounced or complained' ELSE 'ticket under human control' END
    WHERE id = o.id RETURNING * INTO o;
    IF NOT v_blocked AND o.message_id IS NOT NULL THEN
      UPDATE bloom_support.messages SET withdrawn_at = coalesce(withdrawn_at, now())
       WHERE (id = o.message_id OR id = ANY(o.covered_message_ids)) AND author_kind = 'bloom';
    END IF;
  END IF;
  IF o.id IS NULL THEN
    SELECT * INTO o FROM bloom_support.outbound_emails WHERE idempotency_key = p->>'idempotency_key';
    -- A retry of any send the provider never accepted is re-checked against bounces and
    -- complaints recorded since the first attempt.
    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND EXISTS (SELECT 1 FROM bloom_support.outbound_emails b WHERE lower(b.to_email) = lower(o.to_email) AND b.id <> o.id
                     AND (b.status = 'complained' OR (b.status = 'bounced' AND b.created_at > now() - interval '30 days'))) THEN
      UPDATE bloom_support.outbound_emails SET status = 'suppressed', error = 'recipient bounced or complained' WHERE id = o.id RETURNING * INTO o;
      RETURN to_jsonb(o) || '{"duplicate":true}';
    END IF;
    -- A retry of a Bloom-initiated send that the provider never accepted is re-checked against
    -- human takeover, so a retry can never send after a person took the ticket over.
    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND coalesce((p->>'bloom_initiated')::boolean, false) AND t.id IS NOT NULL AND t.automation <> 'auto' THEN
      UPDATE bloom_support.outbound_emails SET status = 'suppressed', error = 'ticket under human control' WHERE id = o.id RETURNING * INTO o;
      UPDATE bloom_support.messages SET withdrawn_at = coalesce(withdrawn_at, now())
       WHERE (id = o.message_id OR id = ANY(o.covered_message_ids)) AND author_kind = 'bloom';
    END IF;
    RETURN to_jsonb(o) || '{"duplicate":true}';
  END IF;
  RETURN to_jsonb(o) || '{"duplicate":false}';
END $$;

CREATE OR REPLACE FUNCTION bloom_support.mark_outbound_email(p_id uuid, p_status text, p_provider_id text, p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE bloom_support.outbound_emails SET status = p_status, provider_id = p_provider_id, error = p_error, sent_at = CASE WHEN p_status = 'sent' THEN now() END WHERE id = p_id;
  UPDATE bloom_support.messages SET delivery = CASE p_status WHEN 'sent' THEN 'sent' WHEN 'suppressed' THEN 'suppressed' WHEN 'not_configured' THEN 'failed' ELSE p_status END
  WHERE id = (SELECT message_id FROM bloom_support.outbound_emails WHERE id = p_id)
     OR id = ANY(coalesce((SELECT covered_message_ids FROM bloom_support.outbound_emails WHERE id = p_id), '{}'));
$$;

-- ---------------------------------------------------------------------------
-- 4. Watchdog alerts
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.alerts DROP CONSTRAINT IF EXISTS alerts_delivered_check;
ALTER TABLE bloom_support.alerts ADD CONSTRAINT alerts_delivered_check
  CHECK (delivered IN ('recorded','email_requested','no_channel','worker_email','merged'));

-- The SQL-only alert email (worker health), in the BloomSites botanical design
-- (premium-botanical.ts / _shared/bloom-support/botanical-email.ts).
CREATE OR REPLACE FUNCTION bloom_support.botanical_alert_html(p_title text, p_lines text[], p_impact text, p_doing text, p_button text, p_url text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  e_title text := replace(replace(replace(replace(coalesce(p_title, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
  icon text := 'https://bloomsites.app/email/premium-icons/';
  items text := '';
  l text;
  esc_l text;
BEGIN
  FOREACH l IN ARRAY coalesce(p_lines, '{}') LOOP
    esc_l := replace(replace(replace(l, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
    items := items || '<tr><td width="18" valign="top" style="width:18px;padding:2px 0 6px;color:#527566;font-size:15px;font-weight:700">&#8226;</td><td valign="top" style="padding:2px 0 6px;color:#536475;font-size:14px;line-height:1.6">' || esc_l || '</td></tr>';
  END LOOP;
  RETURN '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /><title>' || e_title || '</title></head>'
    || '<body style="margin:0;padding:0;background:#FAF9F6;font-family:Arial,Helvetica,sans-serif;color:#243D55">'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#FAF9F6" style="background:#FAF9F6"><tr><td align="center" style="padding:24px 12px">'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #DBE3DF;border-radius:15px;overflow:hidden">'
    || '<tr><td bgcolor="#1B3049" style="padding:22px 26px;background:#1B3049;color:#FFFFFF;font-size:21px;line-height:1.4;font-weight:700">Bloom Support</td></tr>'
    || '<tr><td style="padding:24px 24px 26px">'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;background:#F5F7F3;border:1px solid #DBE3DF;border-radius:16px"><tr><td style="padding:24px 20px 20px">'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td valign="top" style="padding-right:10px">'
    || '<p style="margin:0 0 9px;color:#527566;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Bloom alert</p>'
    || '<h1 style="margin:0;color:#1B3049;font-size:29px;line-height:1.2;letter-spacing:-.02em;font-weight:700">' || e_title || '</h1></td>'
    || '<td width="52" align="right" valign="top" style="width:52px"><img src="' || icon || 'alert.png" alt="" width="48" height="48" style="border:0;display:block;width:48px;height:48px" /></td></tr></table></td></tr></table>'
    || CASE WHEN items <> '' THEN '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px">' || items || '</table>' ELSE '' END
    || '<p style="margin:0 0 10px;color:#536475;font-size:15px;line-height:1.65"><strong style="color:#1B3049">Who is affected</strong> &nbsp;·&nbsp; ' || replace(replace(coalesce(p_impact, ''), '&', '&amp;'), '<', '&lt;') || '</p>'
    || '<p style="margin:0 0 10px;color:#536475;font-size:15px;line-height:1.65"><strong style="color:#1B3049">What Bloom is doing</strong> &nbsp;·&nbsp; ' || replace(replace(coalesce(p_doing, ''), '&', '&amp;'), '<', '&lt;') || '</p>'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px"><tr><td bgcolor="#1B3049" style="border-radius:8px;background:#1B3049">'
    || '<a href="' || replace(coalesce(p_url, ''), '"', '%22') || '" style="display:inline-block;padding:14px 22px;font-size:16px;font-weight:700;line-height:24px;color:#FFFFFF;text-decoration:none">' || replace(replace(coalesce(p_button, ''), '&', '&amp;'), '<', '&lt;') || '</a></td></tr></table>'
    || '</td></tr><tr><td style="padding:17px 24px;background:#F5F7F3;border-top:1px solid #DBE3DF;font-size:12px;line-height:1.5;color:#5B6B79">Sent by Bloom''s watchdog to Brands in Blooms staff.</td></tr>'
    || '</table></td></tr></table></body></html>';
END $$;
REVOKE ALL ON FUNCTION bloom_support.botanical_alert_html(text, text[], text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bloom_support.watchdog()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lim jsonb := coalesce(bloom_support.setting('limits'), '{}'); enabled boolean := coalesce((bloom_support.setting('automation_enabled'))::text::boolean, false);
  last_ok timestamptz; stale_queue int; dead int; findings jsonb := '[]'; f jsonb; hour text := to_char(now(), 'YYYY-MM-DD"T"HH24'); key text; resend_key text; recipients jsonb; inserted boolean;
  today text := to_char(now(), 'YYYY-MM-DD'); check_rows jsonb; summary text; total int; tenants_hit int;
  worker_alerts jsonb := '[]'; app_url text := coalesce(bloom_support.setting('support_inbox')->>'app_url', 'https://bloomsuite.app');
  a_title text; a_lines text[]; a_impact text; a_doing text;
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
      IF f->>'condition' IN ('bloom_tool_failures', 'bloom_tool_timeouts')
         AND EXISTS (SELECT 1 FROM bloom_support.alerts s WHERE s.condition IN ('bloom_tool_failures', 'bloom_tool_timeouts') AND s.dedupe_key <> key
                       AND s.created_at >= date_trunc('hour', now()) AND s.created_at < now() AND s.delivered IN ('email_requested', 'worker_email')) THEN
        -- Failures and timeouts of Bloom's tools are one problem: the sibling alert already emailed this hour.
        UPDATE bloom_support.alerts SET delivered = 'merged' WHERE dedupe_key = key;
      ELSIF f->>'condition' IN ('worker_not_running', 'queue_backlog', 'email_failures') THEN
        -- These must reach a person even when the worker (and its email path) is down.
        IF resend_key IS NOT NULL AND jsonb_array_length(recipients) > 0 AND to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NOT NULL THEN
          a_title := CASE f->>'condition' WHEN 'worker_not_running' THEN 'Bloom''s background worker has stopped'
                       WHEN 'queue_backlog' THEN 'Bloom''s work queue is backed up' ELSE 'Some support emails didn''t send' END;
          a_lines := CASE f->>'condition'
                       WHEN 'worker_not_running' THEN ARRAY['The worker last finished ' || coalesce(to_char((f->>'last_finished_at')::timestamptz AT TIME ZONE 'America/Toronto', 'Mon DD at HH12:MI AM'), 'never') || '.']
                       WHEN 'queue_backlog' THEN ARRAY[(f->>'jobs') || ' jobs have been waiting longer than they should.']
                       ELSE ARRAY['At least one email to a client or to staff failed in the last hour.'] END;
          a_impact := CASE f->>'condition' WHEN 'email_failures' THEN 'A client may not have received an update.'
                        ELSE 'New requests are not being handled and replies to clients are waiting.' END;
          a_doing := CASE f->>'condition' WHEN 'email_failures' THEN 'Bloom retries each email. The conversation is still visible in BloomSuite.'
                       ELSE 'Requests are safe in the queue and go out as soon as the worker runs again.' END;
          EXECUTE 'SELECT net.http_post(url := $1, headers := $2, body := $3)' USING
            'https://api.resend.com/emails',
            jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
            jsonb_build_object('from', coalesce(bloom_support.setting('support_inbox')->>'alert_from', 'Bloom Alerts <alerts@bloomsuite.app>'),
              'to', recipients, 'subject', 'Bloom alert: ' || a_title,
              'text', a_title || E'\n\n' || array_to_string(a_lines, E'\n') || E'\n\nWho is affected: ' || a_impact || E'\nWhat Bloom is doing: ' || a_doing
                      || E'\n\nCheck Bloom''s health: ' || app_url || '/admin/bloom-support?view=readiness',
              'html', bloom_support.botanical_alert_html(a_title, a_lines, a_impact, a_doing, 'Check Bloom''s health', app_url || '/admin/bloom-support?view=readiness'));
          UPDATE bloom_support.alerts SET delivered = 'email_requested' WHERE dedupe_key = key;
        ELSE
          UPDATE bloom_support.alerts SET delivered = 'no_channel' WHERE dedupe_key = key;
        END IF;
      ELSE
        worker_alerts := worker_alerts || (f || jsonb_build_object('alert_key', key));
        UPDATE bloom_support.alerts SET delivered = 'worker_email' WHERE dedupe_key = key;
      END IF;
    END IF;
    inserted := NULL;
  END LOOP;
  -- One designed email per watchdog run, rendered and deduplicated by the worker.
  IF jsonb_array_length(worker_alerts) > 0 THEN
    PERFORM bloom_support.enqueue_job('notify', NULL, NULL, 'email:notify', jsonb_build_object('kind', 'alerts', 'alerts', worker_alerts),
      'alerts:' || md5(worker_alerts::text));
  END IF;
  RETURN jsonb_build_object('findings', findings, 'checked_at', now());
END $$;

-- ---------------------------------------------------------------------------
-- 5. Daily digest report (read-only, service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloom_support_digest_report(p_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN jsonb_build_object(
    'needs_you', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'since'), '[]') FROM (
        SELECT DISTINCT ON (t.id) jsonb_build_object('id', t.id, 'number', t.number, 'subject', t.subject, 'client', a.name,
               'reason', e.reason, 'since', e.created_at) x
          FROM bloom_support.escalations e
          JOIN bloom_support.tickets t ON t.id = e.ticket_id
          LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
         WHERE e.status = 'open' AND t.status <> 'resolved' AND t.merged_into IS NULL AND NOT t.spam
         ORDER BY t.id, e.created_at DESC
         LIMIT 20) n),
    'resolved', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
                   'by_bloom', coalesce(pr.kind = 'service' OR pr.role = 'service', false), 'summary', t.resolution_summary) ORDER BY ev.at), '[]')
        FROM (SELECT DISTINCT ON (ticket_id) ticket_id, actor_id, at FROM bloom_support.ticket_events
               WHERE kind = 'status' AND to_value = 'resolved' AND at >= p_since ORDER BY ticket_id, at DESC) ev
        JOIN bloom_support.tickets t ON t.id = ev.ticket_id AND t.status = 'resolved' AND NOT t.spam AND t.merged_into IS NULL
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        LEFT JOIN bloom_support.principals pr ON pr.id = ev.actor_id),
    'said', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
               'body', left(m.body, 600), 'at', m.created_at) ORDER BY m.created_at), '[]')
        FROM bloom_support.messages m
        JOIN bloom_support.tickets t ON t.id = m.ticket_id AND NOT t.spam
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        WHERE m.author_kind = 'bloom' AND m.visibility = 'public' AND m.withdrawn_at IS NULL AND m.created_at >= p_since),
    'repairs', (SELECT coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'status', e.status,
                  'client', (SELECT a.name FROM bloom_support.tickets t JOIN bloom_support.accounts a ON a.id = t.account_id
                              WHERE t.engineering_issue_id = e.id ORDER BY t.created_at LIMIT 1)) ORDER BY e.updated_at DESC), '[]')
        FROM bloom_support.engineering_issues e
        WHERE e.status NOT IN ('open', 'verified', 'closed')),
    'alerts', (SELECT coalesce(jsonb_agg(jsonb_build_object('condition', al.condition, 'detail', al.detail, 'at', al.created_at) ORDER BY al.created_at), '[]')
        FROM bloom_support.alerts al WHERE al.created_at >= p_since),
    'staff', (SELECT coalesce(jsonb_agg(lower(pr.email)), '[]') FROM bloom_support.principals pr
        WHERE pr.kind = 'user' AND pr.active AND pr.email IS NOT NULL AND pr.role IN ('platform_admin', 'platform_operator')));
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_digest_report(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_digest_report(timestamptz) TO service_role;

-- Turn the daily digest on (8:00 business-hours time). Recipients: settings.digest.recipients
-- when set, otherwise platform staff; settings.digest.opt_out lists addresses that opted out.
UPDATE bloom_support.settings
   SET value = jsonb_set(jsonb_set(value, '{daily,enabled}', 'true'::jsonb, true), '{opt_out}', coalesce(value->'opt_out', '[]'::jsonb), true)
 WHERE key = 'digest' AND coalesce((value->'daily'->>'enabled')::boolean, false) = false;
