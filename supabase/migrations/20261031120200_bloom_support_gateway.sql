-- Bloom Support — single PostgREST entry point.
-- The bloom_support schema is not exposed through the Data API. Edge Functions
-- reach it through this allow-listed dispatcher, which is executable by
-- service_role only. The dispatcher does no authorization itself: every
-- target function re-checks the principal's authority.

CREATE OR REPLACE FUNCTION public.bloom_support_rpc(p_fn text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid := nullif(p->>'actor','')::uuid; r jsonb;
BEGIN
  CASE p_fn
    WHEN 'resolve_crm_user' THEN r := to_jsonb(bloom_support.resolve_crm_user((p->>'auth_user_id')::uuid, p->>'email', p->>'name', (p->>'tenant_id')::uuid, p->>'tenant_name'));
    WHEN 'resolve_product_user' THEN r := bloom_support.resolve_product_user(p->>'product', p->>'external_user_id', p->>'email', p->>'name', p->>'external_account_id', p->>'account_name');
    WHEN 'resolve_email_sender' THEN r := bloom_support.resolve_email_sender(p->>'email', p->>'name');
    WHEN 'authenticate_api_key' THEN r := bloom_support.authenticate_api_key(p->>'hash');
    WHEN 'whoami' THEN r := bloom_support.whoami(a);
    WHEN 'has_permission' THEN r := to_jsonb(bloom_support.has_permission(a, p->>'permission'));
    WHEN 'create_ticket' THEN r := bloom_support.create_ticket(a, p->'ticket');
    WHEN 'get_ticket' THEN r := bloom_support.get_ticket(a, (p->>'ticket_id')::uuid);
    WHEN 'list_tickets' THEN r := bloom_support.list_tickets(a, coalesce(p->'filters','{}'::jsonb));
    WHEN 'queue_summary' THEN r := bloom_support.queue_summary(a);
    WHEN 'list_accounts' THEN r := bloom_support.list_accounts(a, p->>'q', coalesce((p->>'limit')::int, 50));
    WHEN 'get_account' THEN r := bloom_support.get_account(a, (p->>'account_id')::uuid);
    WHEN 'update_account' THEN r := bloom_support.update_account(a, (p->>'account_id')::uuid, p->'patch');
    WHEN 'add_message' THEN r := bloom_support.add_message(a, (p->>'ticket_id')::uuid, p->'message');
    WHEN 'update_ticket' THEN r := bloom_support.update_ticket(a, (p->>'ticket_id')::uuid, p->'patch');
    WHEN 'set_automation' THEN r := bloom_support.set_automation(a, (p->>'ticket_id')::uuid, p->>'mode', p->>'reason');
    WHEN 'link_tickets' THEN PERFORM bloom_support.link_tickets(a, (p->>'from')::uuid, (p->>'to')::uuid, p->>'kind'); r := '{"ok":true}';
    WHEN 'related_tickets' THEN r := bloom_support.related_tickets(a, (p->>'ticket_id')::uuid);
    WHEN 'open_engineering_issue' THEN r := bloom_support.open_engineering_issue(a, (p->>'ticket_id')::uuid, coalesce(p->'issue','{}'::jsonb));
    WHEN 'update_engineering_issue' THEN r := bloom_support.update_engineering_issue(a, (p->>'issue_id')::uuid, p->'update');
    WHEN 'list_engineering' THEN r := bloom_support.list_engineering(a, p->>'status');
    WHEN 'route_feature_request' THEN r := bloom_support.route_feature_request(a, (p->>'ticket_id')::uuid, coalesce(p->'feature','{}'::jsonb));
    WHEN 'decide_feature_request' THEN r := bloom_support.decide_feature_request(a, (p->>'feature_request_id')::uuid, p->>'decision', p->>'note');
    WHEN 'list_features' THEN r := bloom_support.list_features(a, p->>'status');
    WHEN 'escalate' THEN r := bloom_support.escalate(a, (p->>'ticket_id')::uuid, p->>'audience', p->>'reason', p->>'detail', p->>'dedupe_key');
    WHEN 'resolve_escalation' THEN r := bloom_support.resolve_escalation(a, (p->>'escalation_id')::uuid, p->>'decision');
    WHEN 'list_escalations' THEN r := bloom_support.list_escalations(a, coalesce((p->>'open_only')::boolean, true));
    WHEN 'record_operation_preview' THEN r := bloom_support.record_operation_preview(a, p->'operation');
    WHEN 'claim_operation' THEN r := bloom_support.claim_operation(a, (p->>'operation_id')::uuid);
    WHEN 'finish_operation' THEN r := bloom_support.finish_operation(a, (p->>'operation_id')::uuid, p->'outcome');
    WHEN 'get_operation' THEN r := bloom_support.get_operation(a, (p->>'operation_id')::uuid);
    WHEN 'claim_jobs' THEN r := (SELECT coalesce(jsonb_agg(to_jsonb(j)), '[]') FROM bloom_support.claim_jobs(p->>'worker', coalesce((p->>'limit')::int, 5)) j);
    WHEN 'complete_job' THEN PERFORM bloom_support.complete_job((p->>'job_id')::uuid, p->>'worker', p->'result'); r := '{"ok":true}';
    WHEN 'fail_job' THEN r := to_jsonb(bloom_support.fail_job((p->>'job_id')::uuid, p->>'worker', p->>'error', coalesce((p->>'permanent')::boolean, false), (p->>'retry_in')::int));
    WHEN 'enqueue_job' THEN
      -- Only automation/staff principals may enqueue directly.
      IF NOT (bloom_support.has_permission(a, 'tickets.write') OR bloom_support.has_permission(a, 'engineering.investigate') OR bloom_support.has_permission(a, 'engineering.release')) THEN
        RAISE EXCEPTION 'forbidden: enqueue' USING ERRCODE = '42501';
      END IF;
      r := to_jsonb(bloom_support.enqueue_job(p->>'kind', (p->>'ticket_id')::uuid, (p->>'engineering_issue_id')::uuid, p->>'lane', coalesce(p->'payload','{}'::jsonb),
        p->>'idempotency_key', coalesce((p->>'run_after')::timestamptz, now()), coalesce((p->>'max_attempts')::int, 5), coalesce((p->>'timeout')::int, 120)));
    WHEN 'control_job' THEN r := bloom_support.control_job(a, (p->>'job_id')::uuid, p->>'action');
    WHEN 'list_jobs' THEN r := bloom_support.list_jobs(a, p->>'status');
    WHEN 'set_setting' THEN r := bloom_support.set_setting(a, p->>'key', p->'value');
    WHEN 'get_settings' THEN r := bloom_support.get_settings(a);
    WHEN 'setting' THEN r := bloom_support.setting(p->>'key');
    WHEN 'set_principal_role' THEN r := bloom_support.set_principal_role(a, p->'principal');
    WHEN 'list_staff' THEN r := bloom_support.list_staff(a);
    WHEN 'create_service_principal' THEN r := to_jsonb(bloom_support.create_service_principal(a, p->>'name', ARRAY(SELECT jsonb_array_elements_text(p->'grants'))));
    WHEN 'create_api_key' THEN r := to_jsonb(bloom_support.create_api_key(a, (p->>'principal_id')::uuid, p->>'label', p->>'prefix', p->>'hash',
        ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'scopes','[]'::jsonb))), (p->>'expires_at')::timestamptz));
    WHEN 'revoke_api_key' THEN PERFORM bloom_support.revoke_api_key(a, (p->>'key_id')::uuid); r := '{"ok":true}';
    WHEN 'list_api_keys' THEN r := bloom_support.list_api_keys(a);
    WHEN 'list_notifications' THEN r := bloom_support.list_notifications(a, coalesce((p->>'mark_read')::boolean, false));
    WHEN 'issue_tracking_token' THEN PERFORM bloom_support.issue_tracking_token((p->>'ticket_id')::uuid, p->>'hash'); r := '{"ok":true}';
    WHEN 'ticket_by_tracking_token' THEN r := bloom_support.ticket_by_tracking_token(p->>'hash');
    WHEN 'record_email_event' THEN r := to_jsonb(bloom_support.record_email_event(p->>'provider', p->>'event_id', p->>'message_id', p->>'outcome', (p->>'ticket_id')::uuid));
    WHEN 'finish_email_event' THEN PERFORM bloom_support.finish_email_event(p->>'provider', p->>'event_id', p->>'outcome', (p->>'ticket_id')::uuid); r := '{"ok":true}';
    WHEN 'match_email_thread' THEN r := to_jsonb(bloom_support.match_email_thread(ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'refs','[]'::jsonb))), (p->>'number')::bigint));
    WHEN 'append_inbound_email' THEN r := bloom_support.append_inbound_email(a, (p->>'ticket_id')::uuid, p->>'body', p->>'message_id', p->>'in_reply_to');
    WHEN 'queue_outbound_email' THEN r := bloom_support.queue_outbound_email(p->'email');
    WHEN 'mark_outbound_email' THEN PERFORM bloom_support.mark_outbound_email((p->>'id')::uuid, p->>'status', p->>'provider_id', p->>'error'); r := '{"ok":true}';
    WHEN 'search_knowledge' THEN r := bloom_support.search_knowledge(p->>'product', p->>'q', coalesce((p->>'limit')::int, 5));
    WHEN 'upsert_knowledge' THEN r := bloom_support.upsert_knowledge(a, p->'article');
    WHEN 'list_knowledge' THEN r := bloom_support.list_knowledge(a);
    WHEN 'consume_usage' THEN r := to_jsonb(bloom_support.consume_usage(p->>'bucket', p->>'subject', (p->>'limit')::int));
    WHEN 'add_attachment' THEN
      PERFORM bloom_support.require_ticket(a, (p->>'ticket_id')::uuid);
      INSERT INTO bloom_support.attachments(ticket_id, message_id, account_id, storage_path, file_name, content_type, size_bytes, sha256, visibility)
      SELECT t.id, (p->>'message_id')::uuid, t.account_id, p->>'storage_path', p->>'file_name', p->>'content_type', (p->>'size_bytes')::bigint, p->>'sha256',
             CASE WHEN bloom_support.is_staff(a) THEN coalesce(p->>'visibility','public') ELSE 'public' END
      FROM bloom_support.tickets t WHERE t.id = (p->>'ticket_id')::uuid
      ON CONFLICT (storage_path) DO NOTHING
      RETURNING to_jsonb(bloom_support.attachments.*) INTO r;
    WHEN 'get_attachment' THEN
      SELECT to_jsonb(x) INTO r FROM bloom_support.attachments x WHERE x.id = (p->>'attachment_id')::uuid;
      IF r IS NULL THEN RAISE EXCEPTION 'not_found: attachment' USING ERRCODE = 'P0002'; END IF;
      PERFORM bloom_support.require_ticket(a, (r->>'ticket_id')::uuid);
      IF r->>'visibility' = 'internal' AND NOT bloom_support.has_permission(a, 'tickets.internal') THEN RAISE EXCEPTION 'forbidden: attachment' USING ERRCODE = '42501'; END IF;
    WHEN 'log' THEN
      PERFORM bloom_support.require_permission(a, 'tickets.internal');
      PERFORM bloom_support.log((p->>'ticket_id')::uuid, (p->>'account_id')::uuid, a, p->>'action', coalesce(p->'detail','{}'::jsonb)); r := '{"ok":true}';
    WHEN 'job_context' THEN
      -- Worker-only bundle: the ticket (full), related candidates, and account links.
      PERFORM bloom_support.require_permission(a, 'tickets.read_all');
      r := jsonb_build_object('ticket', bloom_support.get_ticket(a, (p->>'ticket_id')::uuid),
             'related', bloom_support.related_tickets(a, (p->>'ticket_id')::uuid),
             'links', (SELECT coalesce(jsonb_agg(jsonb_build_object('product', l.product, 'external_id', l.external_id)), '[]')
                       FROM bloom_support.account_links l JOIN bloom_support.tickets t ON t.account_id = l.account_id WHERE t.id = (p->>'ticket_id')::uuid),
             'requester_email', (SELECT coalesce(c.reply_to_email, pr.email) FROM bloom_support.tickets t JOIN bloom_support.conversations c ON c.id = t.conversation_id
                       LEFT JOIN bloom_support.principals pr ON pr.id = t.requester_id WHERE t.id = (p->>'ticket_id')::uuid),
             'thread', (SELECT jsonb_build_object('root', c.email_thread_root,
                         'last_inbound', (SELECT m.email_message_id FROM bloom_support.messages m WHERE m.conversation_id = c.id AND m.email_message_id IS NOT NULL ORDER BY m.created_at DESC LIMIT 1),
                         'last_outbound', (SELECT o.rfc_message_id FROM bloom_support.outbound_emails o JOIN bloom_support.tickets t2 ON t2.id = o.ticket_id
                                           WHERE t2.conversation_id = c.id AND o.status = 'sent' ORDER BY o.created_at DESC LIMIT 1))
                       FROM bloom_support.tickets t JOIN bloom_support.conversations c ON c.id = t.conversation_id WHERE t.id = (p->>'ticket_id')::uuid));
    ELSE RAISE EXCEPTION 'unknown bloom_support function %', p_fn USING ERRCODE = '42883';
  END CASE;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_rpc(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_rpc(text, jsonb) TO service_role;

-- Private storage bucket for support attachments (signed URLs only).
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id, name, public, file_size_limit)
    VALUES ('bloom-support', 'bloom-support', false, 15728640)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Worker heartbeat: pg_cron calls the bloom-support-worker Edge Function every
-- minute with the project's internal key stored in Vault as
-- 'bloom_support_worker_key'. If the secret is absent, nothing is scheduled
-- and the handover lists it as missing configuration.
DO $$ DECLARE has_key boolean := false; BEGIN
  IF to_regclass('cron.job') IS NOT NULL AND to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ''bloom_support_worker_key'')' INTO has_key;
  END IF;
  IF has_key THEN
    EXECUTE $sched$SELECT cron.schedule('bloom-support-worker', '* * * * *', $cron$
      SELECT net.http_post(
        url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-worker',
        headers := jsonb_build_object('Content-Type','application/json','apikey',
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bloom_support_worker_key')),
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 55000)
    $cron$)$sched$;
  END IF;
END $$;
