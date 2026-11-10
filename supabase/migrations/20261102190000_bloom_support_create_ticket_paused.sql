-- Bloom chat tickets: create them already paused, so no triage job is ever
-- queued for them.
--
-- bloom-assist used to create the ticket (which queues triage) and then pause
-- it. A worker that claimed the triage job in between could send the requester
-- an acknowledgement or open an engineering issue. create_ticket now accepts an
-- optional automation mode ('paused' or 'human'). Any caller may only lower
-- automation on the ticket it is creating, so no permission check is needed.
-- When a mode is given the ticket is inserted with it and triage is not queued.
-- Everything else in create_ticket is unchanged; this rewrites the live body by
-- exact anchors and fails loudly if an anchor is missing.

DO $mig$
DECLARE
  def text;
  a_decl text := E'  msg_id uuid;\n';
  a_insert_cols text := E'INSERT INTO bloom_support.tickets(conversation_id, account_id, requester_id, product, channel, kind, priority, subject, summary, context, dedupe_key, stage, status)';
  a_insert_vals text := E'v_channel, v_kind, v_priority, v_subject, v_body, coalesce(p->''context'',''{}''::jsonb), v_dedupe, ''intake'', ''new'')';
  a_enqueue text := E'  PERFORM bloom_support.enqueue_job(''triage'', t.id, NULL, ''account:'' || coalesce(acct::text, ''none:'' || t.id::text),\n    jsonb_build_object(''reason'',''new_ticket''), ''triage:'' || t.id::text);';
BEGIN
  SELECT pg_get_functiondef('bloom_support.create_ticket(uuid,jsonb)'::regprocedure) INTO def;
  IF position('v_automation' in def) > 0 THEN RETURN; END IF;
  IF position(a_decl in def) = 0 OR position(a_insert_cols in def) = 0
     OR position(a_insert_vals in def) = 0 OR position(a_enqueue in def) = 0 THEN
    RAISE EXCEPTION 'create_ticket anchors not found; body changed since this migration was written';
  END IF;

  def := replace(def, a_decl, a_decl ||
    E'  v_automation text := CASE WHEN p->>''automation'' IN (''paused'', ''human'') THEN p->>''automation'' END;\n');
  def := replace(def, a_insert_cols, replace(a_insert_cols, 'stage, status)', 'stage, status, automation)'));
  def := replace(def, a_insert_vals, replace(a_insert_vals, '''intake'', ''new'')', '''intake'', ''new'', coalesce(v_automation, ''auto''))'));
  def := replace(def, a_enqueue, E'  IF v_automation IS NULL THEN\n' || a_enqueue || E'\n  END IF;');
  EXECUTE def;
END $mig$;
