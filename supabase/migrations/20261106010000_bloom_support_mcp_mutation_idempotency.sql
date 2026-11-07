-- Durable MCP request identity and exactly-once mutation receipts.
--
-- JSON-RPC ids are only unique inside an MCP session. The server therefore
-- registers its own unpredictable session ids and refuses implicit write
-- idempotency without one. Each mutation and its receipt run in the same
-- database transaction, so concurrent retries wait for and return one result;
-- a failed transaction leaves no poisoned "pending" receipt.

CREATE TABLE IF NOT EXISTS bloom_support.mcp_sessions (
  session_id text PRIMARY KEY CHECK (session_id ~ '^[A-Za-z0-9._~-]{16,160}$'),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS mcp_sessions_expiry ON bloom_support.mcp_sessions(expires_at);

CREATE TABLE IF NOT EXISTS bloom_support.mcp_mutation_receipts (
  request_key text PRIMARY KEY CHECK (request_key ~ '^mcp:[0-9a-f]{64}$'),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id) ON DELETE CASCADE,
  tool text NOT NULL CHECK (length(tool) BETWEEN 1 AND 100),
  function_name text NOT NULL CHECK (length(function_name) BETWEEN 1 AND 100),
  arguments_hash text NOT NULL CHECK (arguments_hash ~ '^[0-9a-f]{64}$'),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS mcp_mutation_receipts_created ON bloom_support.mcp_mutation_receipts(created_at);
CREATE INDEX IF NOT EXISTS mcp_mutation_receipts_cleanup
  ON bloom_support.mcp_mutation_receipts(completed_at)
  WHERE completed_at IS NOT NULL;

ALTER TABLE bloom_support.mcp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_support.mcp_mutation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bloom_support.mcp_sessions, bloom_support.mcp_mutation_receipts FROM PUBLIC, anon, authenticated;

-- Undo needs the same atomic claim that execution already has. Without an
-- undoing state, two confirmations can both observe succeeded and call the
-- product twice before either records undone.
ALTER TABLE bloom_support.operations DROP CONSTRAINT IF EXISTS operations_status_check;
ALTER TABLE bloom_support.operations ADD CONSTRAINT operations_status_check CHECK (
  status IN ('previewed','confirmed','executing','succeeded','failed','expired','undoing','reconciliation_needed','undone','cancelled')
);
ALTER TABLE bloom_support.operations ADD COLUMN IF NOT EXISTS idempotency_fingerprint text
  CHECK (idempotency_fingerprint IS NULL OR idempotency_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE bloom_support.operations ADD COLUMN IF NOT EXISTS reconciliation jsonb;
-- The original global key could replay another principal's operation. A
-- composite unique index fixes that without rewriting live keys, so a retry
-- created before this migration still finds the original preview.
ALTER TABLE bloom_support.operations DROP CONSTRAINT IF EXISTS operations_idempotency_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS operations_actor_idempotency_key
  ON bloom_support.operations(actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- A signed-in staff member records a verified resolution of an ambiguous
-- remote outcome. The pending action constrains the only valid terminal
-- states, so this cannot be used as a general operation-state override.
CREATE OR REPLACE FUNCTION bloom_support.reconcile_operation(
  p_actor uuid,
  p_operation uuid,
  p_outcome text,
  p_verification jsonb,
  p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o bloom_support.operations;
  action text;
  target_status text;
  resolved_result jsonb;
  resolved_undo jsonb;
  resolved_verification jsonb;
  reconciliation_evidence jsonb;
  receipt_result jsonb;
  site_result jsonb;
  site_id text;
  linked_account uuid;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF NOT bloom_support.is_staff(p_actor)
     OR NOT EXISTS (SELECT 1 FROM bloom_support.principals WHERE id=p_actor AND active AND kind='user') THEN
    RAISE EXCEPTION 'forbidden: a signed-in person must reconcile product changes' USING ERRCODE = '42501';
  END IF;
  IF NOT bloom_support.can_access_account(p_actor, o.account_id) THEN
    RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
  END IF;
  IF o.status <> 'reconciliation_needed' THEN
    RAISE EXCEPTION 'invalid: operation is not awaiting reconciliation' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_verification) IS DISTINCT FROM 'object'
     OR p_verification->'passed' IS DISTINCT FROM 'true'::jsonb
     OR octet_length(p_verification::text) > 20000 THEN
    RAISE EXCEPTION 'invalid: reconciliation needs bounded verification with passed=true' USING ERRCODE = '22023';
  END IF;
  IF p_note IS NULL OR btrim(p_note) = '' OR length(p_note) > 2000 THEN
    RAISE EXCEPTION 'invalid: reconciliation note must be 1 to 2000 characters' USING ERRCODE = '22023';
  END IF;

  action := o.reconciliation->>'action';
  IF action = 'execute' AND p_outcome IN ('applied','not_applied') THEN
    target_status := CASE p_outcome WHEN 'applied' THEN 'succeeded' ELSE 'failed' END;
  ELSIF action = 'undo' AND p_outcome IN ('undone','not_undone') THEN
    target_status := CASE p_outcome WHEN 'undone' THEN 'undone' ELSE 'succeeded' END;
  ELSE
    RAISE EXCEPTION 'invalid: reconciliation outcome does not match the pending action' USING ERRCODE = '22023';
  END IF;

  resolved_result := CASE WHEN p_verification ? 'result' THEN p_verification->'result' ELSE o.result END;
  -- Evidence never supplies an executable undo plan. Preserve a previously
  -- recorded plan or derive the one safe plan whose semantics are local.
  resolved_undo := o.undo;
  IF action = 'execute' AND p_outcome = 'applied' AND o.kind = 'campaign.schedule' THEN
    resolved_undo := jsonb_build_object('kind','campaign.unschedule','campaign_id',o.inputs->'campaign_id');
  END IF;

  -- Recovering site.create_draft also recovers the durable client link. Accept
  -- only the reviewed client/creator and an unpublished website-only draft.
  IF action = 'execute' AND p_outcome = 'applied' AND o.kind = 'site.create_draft' THEN
    site_result := p_verification->'result';
    site_id := site_result->'site'->>'id';
    IF jsonb_typeof(site_result) IS DISTINCT FROM 'object'
       OR jsonb_typeof(site_result->'site') IS DISTINCT FROM 'object'
       OR o.inputs->>'expected_account_id' IS DISTINCT FROM o.account_id::text
       OR coalesce(o.inputs->>'expected_creator_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       OR coalesce(o.inputs->>'expected_creator_email','') = ''
       OR NOT (o.inputs ? 'expected_tenant_id' AND o.inputs ? 'expected_anchor_site_id')
       OR site_result->>'account_id' IS DISTINCT FROM o.account_id::text
       OR coalesce(site_id,'') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       OR coalesce(site_result->'site'->>'tenant_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       OR site_result->'site'->>'created_by' IS DISTINCT FROM o.inputs->>'expected_creator_id'
       OR site_result->'site'->'is_published' IS DISTINCT FROM 'false'::jsonb
       OR site_result->'site'->'commerce_enabled' IS DISTINCT FROM 'false'::jsonb
       OR (o.inputs->>'expected_tenant_id' IS NOT NULL
           AND site_result->'site'->>'tenant_id' IS DISTINCT FROM o.inputs->>'expected_tenant_id') THEN
      RAISE EXCEPTION 'invalid: recovered site draft does not match the reviewed client and creator' USING ERRCODE = '22023';
    END IF;
    SELECT account_id INTO linked_account FROM bloom_support.account_links
     WHERE product='cms' AND external_id=site_id;
    IF linked_account IS NOT NULL AND linked_account IS DISTINCT FROM o.account_id THEN
      RAISE EXCEPTION 'invalid: recovered site draft belongs to another client' USING ERRCODE = '22023';
    END IF;
    INSERT INTO bloom_support.account_links(account_id,product,external_id,label)
    VALUES (o.account_id,'cms',site_id,left(coalesce(o.inputs->>'name','Reconciled draft'),200))
    ON CONFLICT (product,external_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM bloom_support.account_links
                    WHERE account_id=o.account_id AND product='cms' AND external_id=site_id) THEN
      RAISE EXCEPTION 'invalid: recovered site draft could not be linked to its client' USING ERRCODE = '22023';
    END IF;
    resolved_result := site_result;
    resolved_undo := NULL;
  END IF;

  reconciliation_evidence := (p_verification - 'result' - 'undo') || jsonb_build_object(
    'reconciled',true,
    'reconciliation_action',action,
    'reconciliation_outcome',p_outcome,
    'reconciliation_note',left(p_note,2000),
    'reconciled_by',p_actor,
    'reconciled_at',now()
  );
  IF action='undo' AND p_outcome='not_undone' THEN
    -- The original effect remains in place, so retain its successful execution
    -- verification and attach the separately verified failed-undo evidence.
    resolved_verification := coalesce(o.verification,'{}'::jsonb)
      || jsonb_build_object('undo_reconciliation',reconciliation_evidence);
  ELSE
    resolved_verification := reconciliation_evidence;
  END IF;
  UPDATE bloom_support.operations
     SET status = target_status,
         result = resolved_result,
         verification = resolved_verification,
         undo = resolved_undo,
         error = CASE
           WHEN p_outcome = 'not_applied' THEN left('Person verified the product change was not applied: ' || p_note,1000)
           WHEN p_outcome = 'not_undone' THEN left('Person verified the undo was not applied: ' || p_note,1000)
           ELSE NULL
         END,
         reconciliation = NULL,
         updated_at = now()
   WHERE id = o.id
   RETURNING * INTO o;

  receipt_result := CASE
    WHEN action='execute' AND p_outcome='not_applied' THEN jsonb_build_object(
      'mcp_error',jsonb_build_object('status',409,'code','operation_failed','message','A person verified that the product change was not applied.'),
      'operation',to_jsonb(o))
    WHEN action='undo' AND p_outcome='not_undone' THEN jsonb_build_object(
      'mcp_error',jsonb_build_object('status',409,'code','undo_failed','message','A person verified that the undo was not applied; the original change remains in place.'),
      'operation',to_jsonb(o))
    ELSE to_jsonb(o)
  END;
  UPDATE bloom_support.mcp_mutation_receipts
     SET result=receipt_result, completed_at=now()
   WHERE tool=CASE action WHEN 'execute' THEN 'execute_change' ELSE 'undo_change' END
     AND coalesce(result->'operation'->>'id',result->>'id')=o.id::text;

  PERFORM bloom_support.log(o.ticket_id,o.account_id,p_actor,'operation.reconciled',jsonb_build_object(
    'operation_id',o.id,'kind',o.kind,'action',action,'outcome',p_outcome,
    'note',left(p_note,2000),'verification',p_verification - 'result' - 'undo'));
  RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.fail_operation_undo(p_actor uuid, p_operation uuid, p_error text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF o.status <> 'undoing' THEN RETURN to_jsonb(o); END IF;
  UPDATE bloom_support.operations SET status = 'succeeded', error = left(p_error, 1000), updated_at = now()
  WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.undo_failed', jsonb_build_object('operation_id', o.id, 'kind', o.kind, 'error', o.error));
  RETURN to_jsonb(o);
END $$;

-- A timeout, lost response, 5xx or failed verification after a product call
-- starts cannot prove whether the product committed. Keep that uncertainty as
-- durable state; never rewrite it as a definite failure or reapply blindly.
CREATE OR REPLACE FUNCTION bloom_support.mark_operation_reconciliation(
  p_actor uuid, p_operation uuid, p_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations; expected_status text;
BEGIN
  IF p_action NOT IN ('execute','undo') THEN RAISE EXCEPTION 'invalid: reconciliation action' USING ERRCODE = '22023'; END IF;
  expected_status := CASE p_action WHEN 'execute' THEN 'executing' ELSE 'undoing' END;
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  -- This records uncertainty after the product request was already sent. It
  -- is internal ledger finalization, not a new product action: a permission
  -- revocation racing the remote response must not leave the row executing.
  -- Claim and person-verified resolution remain authorized independently.
  IF o.status = 'reconciliation_needed' THEN RETURN to_jsonb(o); END IF;
  IF o.status <> expected_status THEN
    RAISE EXCEPTION 'invalid: operation is not awaiting % reconciliation', p_action USING ERRCODE = '22023';
  END IF;
  UPDATE bloom_support.operations
     SET status = 'reconciliation_needed',
         reconciliation = jsonb_build_object('action', p_action, 'reason', 'ambiguous_remote_outcome', 'recorded_at', now()),
         error = 'The product outcome is uncertain and needs reconciliation.',
         updated_at = now()
   WHERE id = o.id
   RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.reconciliation_needed',
    jsonb_build_object('operation_id', o.id, 'kind', o.kind, 'action', p_action));
  RETURN to_jsonb(o);
END $$;

-- Replace the legacy site.create_draft retry exception. Once an operation has
-- been executing for five minutes, a missing ledger update is indistinguishable
-- from a committed product call whose response was lost. Never resend it: move
-- every stale execute claim to a person-verifiable reconciliation state.
CREATE OR REPLACE FUNCTION bloom_support.claim_operation(p_actor uuid, p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF NOT bloom_support.is_staff(p_actor) THEN
    RAISE EXCEPTION 'forbidden: a person must confirm this change' USING ERRCODE = '42501';
  END IF;
  IF NOT bloom_support.can_access_account(p_actor, o.account_id) THEN
    RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
  END IF;

  IF o.status = 'executing' AND o.updated_at <= now() - interval '5 minutes' THEN
    UPDATE bloom_support.operations
       SET status = 'reconciliation_needed',
           reconciliation = jsonb_build_object('action','execute','reason','stale_effect_claim','recorded_at',now()),
           error = 'The product outcome is uncertain and needs reconciliation.',
           updated_at = now()
     WHERE id = o.id
     RETURNING * INTO o;
    PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.reconciliation_needed',
      jsonb_build_object('operation_id',o.id,'kind',o.kind,'action','execute','reason','stale_effect_claim'));
    RETURN to_jsonb(o) || '{"already":true}'::jsonb;
  END IF;
  IF o.status <> 'previewed' THEN RETURN to_jsonb(o) || '{"already":true}'::jsonb; END IF;

  IF o.kind = 'site.create_draft' THEN
    IF o.inputs->>'expected_account_id' IS DISTINCT FROM o.account_id::text
       OR coalesce(o.inputs->>'expected_creator_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       OR coalesce(o.inputs->>'expected_creator_email','') = ''
       OR NOT (o.inputs ? 'expected_tenant_id' AND o.inputs ? 'expected_anchor_site_id') THEN
      RAISE EXCEPTION 'invalid: site creation needs a fresh client and owner preview' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF o.expires_at < now() THEN
    UPDATE bloom_support.operations SET status = 'expired', updated_at = now()
     WHERE id = o.id RETURNING * INTO o;
    RETURN to_jsonb(o);
  END IF;
  UPDATE bloom_support.operations
     SET status = 'executing', confirmed_by = p_actor, updated_at = now()
   WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.confirmed',
    jsonb_build_object('operation_id',o.id,'kind',o.kind,'resume_only',false));
  RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.claim_operation_undo(p_actor uuid, p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF NOT bloom_support.is_staff(p_actor) THEN
    RAISE EXCEPTION 'forbidden: a person must confirm this undo' USING ERRCODE = '42501';
  END IF;
  IF NOT bloom_support.can_access_account(p_actor, o.account_id) THEN
    RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
  END IF;

  IF o.status = 'undoing' AND o.updated_at <= now() - interval '5 minutes' THEN
    UPDATE bloom_support.operations
       SET status = 'reconciliation_needed',
           reconciliation = jsonb_build_object('action','undo','reason','stale_effect_claim','recorded_at',now()),
           error = 'The product outcome is uncertain and needs reconciliation.',
           updated_at = now()
     WHERE id = o.id
     RETURNING * INTO o;
    PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.reconciliation_needed',
      jsonb_build_object('operation_id',o.id,'kind',o.kind,'action','undo','reason','stale_effect_claim'));
    RETURN to_jsonb(o) || '{"already":true}'::jsonb;
  END IF;
  IF o.status IN ('undoing','reconciliation_needed','undone') THEN RETURN to_jsonb(o) || '{"already":true}'::jsonb; END IF;
  IF o.status <> 'succeeded' OR o.undo IS NULL THEN
    RAISE EXCEPTION 'invalid: this operation has no supported undo' USING ERRCODE = '22023';
  END IF;
  UPDATE bloom_support.operations SET status = 'undoing', error = NULL, updated_at = now()
   WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.undo_confirmed',
    jsonb_build_object('operation_id',o.id,'kind',o.kind));
  RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_claim_operation_undo(p_actor uuid, p_operation uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT bloom_support.claim_operation_undo(p_actor, p_operation)
$$;

CREATE OR REPLACE FUNCTION public.bloom_support_fail_operation_undo(p_actor uuid, p_operation uuid, p_error text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT bloom_support.fail_operation_undo(p_actor, p_operation, p_error)
$$;

CREATE OR REPLACE FUNCTION public.bloom_support_mark_operation_reconciliation(p_actor uuid, p_operation uuid, p_action text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT bloom_support.mark_operation_reconciliation(p_actor, p_operation, p_action)
$$;

CREATE OR REPLACE FUNCTION bloom_support.cleanup_mcp_idempotency()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sessions_deleted integer; receipts_deleted integer; operations_reconciled integer;
BEGIN
  -- Recover abandoned product-effect claims without waiting for a caller to
  -- retry. The batch and SKIP LOCKED keep initialize latency bounded and never
  -- interfere with an active operation transaction.
  WITH stale AS (
    SELECT id,status
      FROM bloom_support.operations
     WHERE status IN ('executing','undoing')
       AND updated_at <= now() - interval '5 minutes'
     ORDER BY updated_at,id
     LIMIT 250
     FOR UPDATE SKIP LOCKED
  ), changed AS (
    UPDATE bloom_support.operations o
       SET status='reconciliation_needed',
           reconciliation=jsonb_build_object(
             'action',CASE s.status WHEN 'undoing' THEN 'undo' ELSE 'execute' END,
             'reason','stale_effect_claim','recorded_at',now()),
           error='The product outcome is uncertain and needs reconciliation.',
           updated_at=now()
      FROM stale s
     WHERE o.id=s.id
     RETURNING o.id,o.ticket_id,o.account_id,o.kind,s.status AS prior_status
  )
  INSERT INTO bloom_support.activity(ticket_id,account_id,actor_id,action,detail)
  SELECT ticket_id,account_id,NULL,'operation.reconciliation_needed',
    jsonb_build_object('operation_id',id,'kind',kind,
      'action',CASE prior_status WHEN 'undoing' THEN 'undo' ELSE 'execute' END,
      'reason','stale_effect_claim')
    FROM changed;
  GET DIAGNOSTICS operations_reconciled = ROW_COUNT;

  -- Initialization is latency-sensitive. Reclaim a modest batch rather than
  -- turning a reconnect into an unbounded maintenance transaction.
  DELETE FROM bloom_support.mcp_sessions
   WHERE ctid IN (
     SELECT ctid FROM bloom_support.mcp_sessions
      WHERE expires_at <= now()
      ORDER BY expires_at, session_id
      LIMIT 250
   );
  GET DIAGNOSTICS sessions_deleted = ROW_COUNT;
  -- Thirty days is the documented explicit-key retry window. Never remove an
  -- incomplete or in-flight operation receipt: it signals a state that needs
  -- an operator, not replay.
  DELETE FROM bloom_support.mcp_mutation_receipts
   WHERE ctid IN (
     SELECT ctid FROM bloom_support.mcp_mutation_receipts
      WHERE completed_at IS NOT NULL
        AND completed_at < now() - interval '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM bloom_support.operations o
           WHERE o.id::text = coalesce(
                   bloom_support.mcp_mutation_receipts.result->>'id',
                   bloom_support.mcp_mutation_receipts.result->'operation'->>'id'
                 )
             AND o.status IN ('executing', 'undoing', 'reconciliation_needed')
        )
      ORDER BY completed_at, request_key
      LIMIT 250
   );
  GET DIAGNOSTICS receipts_deleted = ROW_COUNT;
  RETURN jsonb_build_object('operations',operations_reconciled,'sessions',sessions_deleted,'receipts',receipts_deleted);
END $$;

-- The native operation ledger predates the MCP receipt. Compare a fingerprint
-- made before any volatile remote preview fields are added. This protects REST
-- callers too while replaying the originally stored preview.
CREATE OR REPLACE FUNCTION bloom_support.record_operation_preview(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o bloom_support.operations;
  acct uuid := (p->>'account_id')::uuid;
  raw_key text := p->>'idempotency_key';
  incoming_fingerprint text := p->>'idempotency_fingerprint';
BEGIN
  PERFORM bloom_support.require_permission(p_actor, p->>'permission');
  IF NOT bloom_support.can_access_account(p_actor, acct) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
  IF p->>'ticket_id' IS NOT NULL THEN PERFORM bloom_support.require_ticket(p_actor, (p->>'ticket_id')::uuid); END IF;
  IF raw_key IS NOT NULL AND (btrim(raw_key) = '' OR length(raw_key) > 200) THEN
    RAISE EXCEPTION 'invalid: idempotency key must be 1 to 200 characters' USING ERRCODE = '22023';
  END IF;
  IF incoming_fingerprint IS NOT NULL AND incoming_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid: operation idempotency fingerprint' USING ERRCODE = '22023';
  END IF;
  INSERT INTO bloom_support.operations(ticket_id, account_id, actor_id, kind, permission, inputs, preview, idempotency_key, idempotency_fingerprint)
  VALUES ((p->>'ticket_id')::uuid, acct, p_actor, p->>'kind', p->>'permission', p->'inputs', p->'preview', raw_key, incoming_fingerprint)
  ON CONFLICT (actor_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING * INTO o;
  IF o.id IS NULL THEN
    SELECT * INTO o FROM bloom_support.operations WHERE actor_id = p_actor AND idempotency_key = raw_key;
    IF o.account_id IS DISTINCT FROM acct
       OR o.ticket_id IS DISTINCT FROM (p->>'ticket_id')::uuid
       OR o.kind IS DISTINCT FROM p->>'kind'
       OR o.permission IS DISTINCT FROM p->>'permission'
       OR (o.idempotency_fingerprint IS NOT NULL AND incoming_fingerprint IS NOT NULL
           AND o.idempotency_fingerprint IS DISTINCT FROM incoming_fingerprint)
       OR ((o.idempotency_fingerprint IS NULL OR incoming_fingerprint IS NULL)
           AND o.inputs IS DISTINCT FROM p->'inputs') THEN
      RAISE EXCEPTION 'invalid: idempotency key was already used for a different operation preview' USING ERRCODE = '22023';
    END IF;
    IF o.idempotency_fingerprint IS NULL AND incoming_fingerprint IS NOT NULL THEN
      UPDATE bloom_support.operations SET idempotency_fingerprint = incoming_fingerprint WHERE id = o.id RETURNING * INTO o;
    END IF;
  END IF;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.previewed', jsonb_build_object('operation_id', o.id, 'kind', o.kind));
  RETURN to_jsonb(o);
END $$;

-- A duplicate escalation is only an active handoff while its stored row is
-- still open/acknowledged. Return that state and reject cross-ticket or
-- changed-payload key reuse instead of leaking the other escalation id.
CREATE OR REPLACE FUNCTION bloom_support.escalate(p_actor uuid, p_ticket uuid, p_audience text, p_reason text, p_detail text, p_dedupe text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; x bloom_support.escalations;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  IF p_dedupe IS NOT NULL AND (length(p_dedupe) = 0 OR length(p_dedupe) > 200) THEN
    RAISE EXCEPTION 'invalid: escalation dedupe key must be 1 to 200 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO bloom_support.escalations(ticket_id, engineering_issue_id, audience, reason, detail, dedupe_key)
  VALUES (t.id, t.engineering_issue_id, coalesce(p_audience,'both'), p_reason, p_detail, p_dedupe)
  ON CONFLICT (dedupe_key) DO NOTHING RETURNING * INTO x;
  IF x.id IS NULL THEN
    SELECT * INTO x FROM bloom_support.escalations WHERE dedupe_key = p_dedupe;
    IF x.ticket_id IS DISTINCT FROM t.id
       OR x.audience IS DISTINCT FROM coalesce(p_audience, 'both')
       OR x.reason IS DISTINCT FROM p_reason
       OR x.detail IS DISTINCT FROM p_detail THEN
      RAISE EXCEPTION 'invalid: escalation dedupe key was already used for a different escalation' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('escalation_id', x.id, 'duplicate', true, 'status', x.status);
  END IF;
  UPDATE bloom_support.tickets SET status = 'needs_owner', stage = 'escalated', next_action = 'Admin: ' || left(p_reason, 200), version = version + 1, updated_at = now() WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.escalated', jsonb_build_object('audience', p_audience, 'reason', p_reason));
  PERFORM bloom_support.notify_staff(t.id, 'escalation', 'Escalated #' || t.number || ': ' || left(p_reason, 80), coalesce(p_audience,'both'));
  PERFORM bloom_support.enqueue_job('escalate', t.id, NULL, 'email:escalation', jsonb_build_object('escalation_id', x.id), 'escalate:' || x.id::text);
  RETURN jsonb_build_object('escalation_id', x.id, 'duplicate', false, 'status', x.status);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_mcp_open_session(p_actor uuid, p_session text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.cleanup_mcp_idempotency();
  IF p_session IS NULL OR p_session !~ '^[A-Za-z0-9._~-]{16,160}$' THEN
    RAISE EXCEPTION 'invalid: MCP session id' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bloom_support.principals WHERE id = p_actor AND active) THEN
    RAISE EXCEPTION 'forbidden: inactive MCP principal' USING ERRCODE = '42501';
  END IF;
  INSERT INTO bloom_support.mcp_sessions(session_id, principal_id)
  VALUES (p_session, p_actor)
  ON CONFLICT (session_id) DO UPDATE
    SET last_seen_at = now(), expires_at = now() + interval '30 days'
    WHERE bloom_support.mcp_sessions.principal_id = p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden: MCP session belongs to another principal' USING ERRCODE = '42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_mcp_touch_session(p_actor uuid, p_session text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE bloom_support.mcp_sessions
     SET last_seen_at = now(), expires_at = now() + interval '30 days'
   WHERE session_id = p_session AND principal_id = p_actor AND expires_at > now();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_mcp_close_session(p_actor uuid, p_session text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM bloom_support.mcp_sessions WHERE session_id = p_session AND principal_id = p_actor
$$;

-- Cached mutation results are still protected data. Re-check the current
-- authority that the trusted tool/function pair needs before either executing
-- or replaying it. Unknown pairs fail closed so a newly added write tool cannot
-- accidentally inherit replay without an explicit authorization rule.
CREATE OR REPLACE FUNCTION bloom_support.authorize_mcp_mutation(
  p_actor uuid, p_tool text, p_fn text, p jsonb
) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE account_id uuid; operation jsonb; conversation bloom_support.conversations;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bloom_support.principals WHERE id = p_actor AND active) THEN
    RAISE EXCEPTION 'forbidden: inactive MCP principal' USING ERRCODE = '42501';
  END IF;
  CASE p_tool
    WHEN 'create_ticket' THEN
      IF p_fn <> 'create_ticket' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'tickets.create');
      account_id := nullif(p->'ticket'->>'account_id','')::uuid;
      IF account_id IS NOT NULL
         AND NOT bloom_support.can_access_account(p_actor, account_id)
         AND NOT bloom_support.has_permission(p_actor, 'intake.email') THEN
        RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
      END IF;
      IF p->'ticket'->>'conversation_id' IS NOT NULL THEN
        SELECT * INTO conversation FROM bloom_support.conversations
         WHERE id = (p->'ticket'->>'conversation_id')::uuid;
        IF NOT FOUND THEN RAISE EXCEPTION 'not_found: conversation' USING ERRCODE = 'P0002'; END IF;
        IF NOT bloom_support.has_permission(p_actor, 'tickets.read_all')
           AND bloom_support.principal_role(p_actor) <> 'service'
           AND conversation.requester_id IS DISTINCT FROM p_actor
           AND NOT (conversation.account_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM bloom_support.account_members m
              WHERE m.account_id = conversation.account_id
                AND m.principal_id = p_actor AND m.verified
           )) THEN
          RAISE EXCEPTION 'forbidden: conversation' USING ERRCODE = '42501';
        END IF;
      END IF;
    WHEN 'reply_to_ticket' THEN
      IF p_fn <> 'add_message' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_ticket(p_actor, (p->>'ticket_id')::uuid);
      IF p->'message'->>'visibility' = 'internal' THEN PERFORM bloom_support.require_permission(p_actor, 'tickets.internal'); END IF;
    WHEN 'update_ticket' THEN
      IF p_fn <> 'update_ticket' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
      PERFORM bloom_support.require_ticket(p_actor, (p->>'ticket_id')::uuid);
    WHEN 'take_over_ticket' THEN
      IF p_fn <> 'set_automation' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
      PERFORM bloom_support.require_ticket(p_actor, (p->>'ticket_id')::uuid);
      IF bloom_support.principal_role(p_actor) = 'service' AND p->>'mode' = 'auto' THEN
        RAISE EXCEPTION 'forbidden: Bloom cannot reclaim a ticket' USING ERRCODE = '42501';
      END IF;
    WHEN 'link_tickets' THEN
      IF p_fn <> 'link_tickets' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
      PERFORM bloom_support.require_ticket(p_actor, (p->>'from')::uuid);
      PERFORM bloom_support.require_ticket(p_actor, (p->>'to')::uuid);
    WHEN 'start_investigation' THEN
      IF p_fn <> 'open_engineering_issue' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'engineering.start');
      PERFORM bloom_support.require_ticket(p_actor, (p->>'ticket_id')::uuid);
    WHEN 'start_repair' THEN
      IF p_fn <> 'update_engineering_issue' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'engineering.dispatch');
      IF bloom_support.principal_role(p_actor) = 'service' THEN
        RAISE EXCEPTION 'forbidden: a person must start an automated repair' USING ERRCODE = '42501';
      END IF;
    WHEN 'approve_fix' THEN
      IF p_fn <> 'update_engineering_issue' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'engineering.approve');
      IF bloom_support.principal_role(p_actor) = 'service' THEN
        RAISE EXCEPTION 'forbidden: a person must approve a fix' USING ERRCODE = '42501';
      END IF;
    WHEN 'acknowledge_escalation', 'record_decision' THEN
      IF (p_tool = 'acknowledge_escalation' AND p_fn <> 'acknowledge_escalation')
         OR (p_tool = 'record_decision' AND p_fn <> 'resolve_escalation') THEN
        RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501';
      END IF;
      PERFORM bloom_support.require_permission(p_actor, 'escalations.resolve');
    WHEN 'decide_feature_request' THEN
      IF p_fn <> 'decide_feature_request' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'features.decide');
    WHEN 'route_feature_request', 'escalate_ticket', 'link_problem', 'decide_reply_after_resolution' THEN
      IF (p_tool = 'route_feature_request' AND p_fn <> 'route_feature_request')
         OR (p_tool = 'escalate_ticket' AND p_fn <> 'escalate')
         OR (p_tool = 'link_problem' AND p_fn <> 'link_problem')
         OR (p_tool = 'decide_reply_after_resolution' AND p_fn <> 'resolve_post_reply') THEN
        RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501';
      END IF;
      PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
      PERFORM bloom_support.require_ticket(p_actor, (p->>'ticket_id')::uuid);
    WHEN 'merge_tickets' THEN
      IF p_fn <> 'merge_tickets' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
      PERFORM bloom_support.require_ticket(p_actor, (p->>'source_id')::uuid);
      PERFORM bloom_support.require_ticket(p_actor, (p->>'target_id')::uuid);
    WHEN 'create_problem' THEN
      IF p_fn <> 'create_problem' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
    WHEN 'preview_change' THEN
      IF p_fn <> 'record_operation_preview' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      operation := p->'operation';
      PERFORM bloom_support.require_permission(p_actor, operation->>'permission');
      account_id := (operation->>'account_id')::uuid;
      IF NOT bloom_support.can_access_account(p_actor, account_id) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
      IF operation->>'ticket_id' IS NOT NULL THEN PERFORM bloom_support.require_ticket(p_actor, (operation->>'ticket_id')::uuid); END IF;
    WHEN 'record_reconciliation' THEN
      IF p_fn <> 'reconcile_operation' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      SELECT to_jsonb(o) INTO operation FROM bloom_support.operations o WHERE o.id=(p->>'operation_id')::uuid;
      IF operation IS NULL THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
      PERFORM bloom_support.require_permission(p_actor, operation->>'permission');
      IF NOT bloom_support.is_staff(p_actor)
         OR NOT EXISTS (SELECT 1 FROM bloom_support.principals WHERE id=p_actor AND active AND kind='user') THEN
        RAISE EXCEPTION 'forbidden: a signed-in person must reconcile product changes' USING ERRCODE = '42501';
      END IF;
      account_id := (operation->>'account_id')::uuid;
      IF NOT bloom_support.can_access_account(p_actor,account_id) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
    WHEN 'automation_switch' THEN
      IF p_fn <> 'set_setting' OR p->>'key' <> 'automation_enabled' THEN
        RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501';
      END IF;
      PERFORM bloom_support.require_permission(p_actor, 'automation.control');
      IF bloom_support.principal_role(p_actor) = 'service' THEN RAISE EXCEPTION 'forbidden: service identities cannot change policy' USING ERRCODE = '42501'; END IF;
    WHEN 'retry_or_cancel_job' THEN
      IF p_fn <> 'control_job' THEN RAISE EXCEPTION 'forbidden: invalid MCP mutation route' USING ERRCODE = '42501'; END IF;
      PERFORM bloom_support.require_permission(p_actor, 'automation.control');
    ELSE
      RAISE EXCEPTION 'forbidden: unknown MCP mutation route' USING ERRCODE = '42501';
  END CASE;
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_mcp_mutation(
  p_actor uuid,
  p_fn text,
  p jsonb,
  p_request_key text,
  p_tool text,
  p_arguments_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE receipt bloom_support.mcp_mutation_receipts; outcome jsonb;
BEGIN
  IF p_request_key IS NULL OR p_request_key !~ '^mcp:[0-9a-f]{64}$'
     OR p_arguments_hash IS NULL OR p_arguments_hash !~ '^[0-9a-f]{64}$'
     OR p_tool IS NULL OR length(p_tool) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid: MCP mutation identity' USING ERRCODE = '22023';
  END IF;
  IF (p->>'actor')::uuid IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'forbidden: MCP actor mismatch' USING ERRCODE = '42501';
  END IF;
  PERFORM bloom_support.authorize_mcp_mutation(p_actor, p_tool, p_fn, p);

  -- A conflicting insert waits for the winner's transaction. If the winner
  -- rolls back, this insert succeeds; if it commits, its result is read below.
  INSERT INTO bloom_support.mcp_mutation_receipts(request_key, principal_id, tool, function_name, arguments_hash)
  VALUES (p_request_key, p_actor, p_tool, p_fn, p_arguments_hash)
  ON CONFLICT (request_key) DO NOTHING
  RETURNING * INTO receipt;

  IF receipt.request_key IS NULL THEN
    SELECT * INTO receipt FROM bloom_support.mcp_mutation_receipts WHERE request_key = p_request_key;
    IF receipt.principal_id IS DISTINCT FROM p_actor OR receipt.tool IS DISTINCT FROM p_tool
       OR receipt.function_name IS DISTINCT FROM p_fn
       OR receipt.arguments_hash IS DISTINCT FROM p_arguments_hash THEN
      RAISE EXCEPTION 'invalid: idempotency key was already used for a different MCP mutation' USING ERRCODE = '22023';
    END IF;
    -- The conflicting INSERT may have waited for another transaction. Check
    -- current authority again after that wait and before exposing its result.
    PERFORM bloom_support.authorize_mcp_mutation(p_actor, p_tool, p_fn, p);
    IF receipt.completed_at IS NULL THEN
      -- This cannot be committed by this function: receipt + mutation + result
      -- are one transaction. Fail closed if an operator inserted a bad row.
      RAISE EXCEPTION 'conflict: incomplete MCP mutation receipt' USING ERRCODE = '40001';
    END IF;
    RETURN receipt.result;
  END IF;

  IF p_fn = 'reconcile_operation' THEN
    outcome := bloom_support.reconcile_operation(
      p_actor,
      (p->>'operation_id')::uuid,
      p->>'outcome',
      p->'verification',
      p->>'note'
    );
  ELSE
    outcome := coalesce(public.bloom_support_rpc(p_fn, p), 'null'::jsonb);
  END IF;
  UPDATE bloom_support.mcp_mutation_receipts
     SET result = outcome, completed_at = now()
   WHERE request_key = p_request_key;
  RETURN outcome;
END $$;

-- Product execution spans a database claim, a remote effect, verification and
-- a database finish. The operation row is the durable effect ledger; this
-- wrapper atomically binds the MCP request receipt to its execute/undo claim.
CREATE OR REPLACE FUNCTION public.bloom_support_mcp_claim_operation(
  p_actor uuid,
  p_operation uuid,
  p_action text,
  p_request_key text,
  p_tool text,
  p_arguments_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE receipt bloom_support.mcp_mutation_receipts; outcome jsonb; current_op bloom_support.operations;
BEGIN
  IF p_action NOT IN ('execute','undo') THEN RAISE EXCEPTION 'invalid: operation action' USING ERRCODE = '22023'; END IF;
  IF (p_action = 'execute' AND p_tool <> 'execute_change')
     OR (p_action = 'undo' AND p_tool <> 'undo_change') THEN
    RAISE EXCEPTION 'forbidden: invalid MCP operation route' USING ERRCODE = '42501';
  END IF;
  IF p_request_key IS NULL OR p_request_key !~ '^mcp:[0-9a-f]{64}$'
     OR p_arguments_hash IS NULL OR p_arguments_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid: MCP operation identity' USING ERRCODE = '22023';
  END IF;
  INSERT INTO bloom_support.mcp_mutation_receipts(request_key, principal_id, tool, function_name, arguments_hash)
  VALUES (
    p_request_key,
    p_actor,
    p_tool,
    CASE p_action WHEN 'execute' THEN 'claim_operation' ELSE 'claim_operation_undo' END,
    p_arguments_hash
  )
  ON CONFLICT (request_key) DO NOTHING RETURNING * INTO receipt;
  IF receipt.request_key IS NULL THEN
    SELECT * INTO receipt FROM bloom_support.mcp_mutation_receipts WHERE request_key = p_request_key;
    IF receipt.principal_id IS DISTINCT FROM p_actor OR receipt.tool IS DISTINCT FROM p_tool
       OR receipt.function_name IS DISTINCT FROM (CASE p_action WHEN 'execute' THEN 'claim_operation' ELSE 'claim_operation_undo' END)
       OR receipt.arguments_hash IS DISTINCT FROM p_arguments_hash THEN
      RAISE EXCEPTION 'invalid: idempotency key was already used for a different MCP mutation' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO current_op FROM bloom_support.operations WHERE id = p_operation;
    IF current_op.id IS NULL THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
    PERFORM bloom_support.require_permission(p_actor, current_op.permission);
    IF NOT bloom_support.is_staff(p_actor) THEN
      RAISE EXCEPTION 'forbidden: a person must confirm product changes' USING ERRCODE = '42501';
    END IF;
    IF NOT bloom_support.can_access_account(p_actor, current_op.account_id) THEN
      RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
    END IF;
    IF receipt.result ? 'mcp_error' THEN
      outcome := receipt.result;
    ELSIF current_op.status = 'reconciliation_needed' THEN
      outcome := jsonb_build_object(
        'mcp_error', jsonb_build_object(
          'status', 502,
          'code', 'operation_reconciliation_needed',
          'message', CASE coalesce(current_op.reconciliation->>'action', p_action)
            WHEN 'undo' THEN 'The undo may have completed, but Bloom did not receive a conclusive response. Verify the product state before taking another action.'
            ELSE 'The product change may have completed, but Bloom did not receive a conclusive response. Verify the product state before taking another action.'
          END
        ),
        'operation', to_jsonb(current_op));
      UPDATE bloom_support.mcp_mutation_receipts SET result = outcome, completed_at = now() WHERE request_key = p_request_key;
    ELSIF p_action = 'execute' AND current_op.status = 'failed' THEN
      outcome := jsonb_build_object(
        'mcp_error', jsonb_build_object('status', 409, 'code', 'operation_failed', 'message', 'The product change failed. Review the operation before trying again.'),
        'operation', to_jsonb(current_op));
      UPDATE bloom_support.mcp_mutation_receipts SET result = outcome, completed_at = now() WHERE request_key = p_request_key;
    ELSIF p_action = 'undo' AND current_op.status = 'succeeded' AND current_op.error IS NOT NULL THEN
      outcome := jsonb_build_object(
        'mcp_error', jsonb_build_object('status', 409, 'code', 'undo_failed', 'message', 'The undo failed and the original change remains in place.'),
        'operation', to_jsonb(current_op));
      UPDATE bloom_support.mcp_mutation_receipts SET result = outcome, completed_at = now() WHERE request_key = p_request_key;
    ELSIF (p_action = 'execute' AND current_op.status IN ('succeeded','expired','undone'))
       OR (p_action = 'undo' AND current_op.status = 'undone') THEN
      outcome := to_jsonb(current_op);
      UPDATE bloom_support.mcp_mutation_receipts SET result = outcome, completed_at = now() WHERE request_key = p_request_key;
    ELSE
      outcome := receipt.result;
    END IF;
    RETURN coalesce(outcome, '{}'::jsonb) || '{"already":true}'::jsonb;
  END IF;

  outcome := CASE p_action
    WHEN 'execute' THEN bloom_support.claim_operation(p_actor, p_operation)
    ELSE bloom_support.claim_operation_undo(p_actor, p_operation)
  END;
  IF outcome->>'status' = 'reconciliation_needed' THEN
    outcome := jsonb_build_object(
      'mcp_error',jsonb_build_object(
        'status',502,
        'code','operation_reconciliation_needed',
        'message',CASE coalesce(outcome->'reconciliation'->>'action',p_action)
          WHEN 'undo' THEN 'The undo may have completed, but Bloom did not receive a conclusive response. Verify the product state before taking another action.'
          ELSE 'The product change may have completed, but Bloom did not receive a conclusive response. Verify the product state before taking another action.'
        END),
      'operation',outcome
    );
  END IF;
  UPDATE bloom_support.mcp_mutation_receipts SET result = outcome, completed_at = now() WHERE request_key = p_request_key;
  RETURN outcome;
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_mcp_complete_operation(
  p_actor uuid,
  p_operation uuid,
  p_request_key text,
  p_tool text,
  p_arguments_hash text,
  p_result jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bloom_support.operations WHERE id = p_operation) THEN
    RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002';
  END IF;
  UPDATE bloom_support.mcp_mutation_receipts
     SET result = p_result, completed_at = now()
   WHERE request_key = p_request_key
     AND principal_id = p_actor
     AND tool = p_tool
     AND function_name = CASE p_tool
       WHEN 'execute_change' THEN 'claim_operation'
       WHEN 'undo_change' THEN 'claim_operation_undo'
       ELSE ''
     END
     AND arguments_hash = p_arguments_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid: MCP operation receipt mismatch' USING ERRCODE = '22023'; END IF;
END $$;

-- finish_operation previously allowed undone directly from succeeded. Require
-- the undo claim so no caller can bypass the exactly-once state transition.
CREATE OR REPLACE FUNCTION bloom_support.finish_operation(p_actor uuid, p_operation uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF p->>'status' NOT IN ('succeeded','failed','undone') THEN RAISE EXCEPTION 'invalid operation status' USING ERRCODE = '22023'; END IF;
  IF p->>'status' = 'undone' AND o.status <> 'undoing' THEN RAISE EXCEPTION 'invalid: operation undo was not claimed' USING ERRCODE = '22023'; END IF;
  IF p->>'status' IN ('succeeded','failed') AND o.status <> 'executing' THEN RAISE EXCEPTION 'invalid: operation not executing' USING ERRCODE = '22023'; END IF;
  UPDATE bloom_support.operations SET status = p->>'status', result = coalesce(p->'result', result), verification = coalesce(p->'verification', verification),
    undo = coalesce(p->'undo', undo), error = p->>'error', reconciliation = NULL, updated_at = now() WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.' || o.status, jsonb_build_object('operation_id', o.id, 'kind', o.kind, 'verified', o.verification IS NOT NULL, 'error', o.error));
  RETURN to_jsonb(o);
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_mcp_open_session(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_mcp_touch_session(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_mcp_close_session(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_mcp_mutation(uuid,text,jsonb,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_claim_operation_undo(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_fail_operation_undo(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_mark_operation_reconciliation(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_mcp_claim_operation(uuid,uuid,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloom_support_mcp_complete_operation(uuid,uuid,text,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION bloom_support.claim_operation_undo(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION bloom_support.fail_operation_undo(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION bloom_support.mark_operation_reconciliation(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION bloom_support.reconcile_operation(uuid,uuid,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION bloom_support.authorize_mcp_mutation(uuid,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION bloom_support.cleanup_mcp_idempotency() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_open_session(uuid,text) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_touch_session(uuid,text) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_close_session(uuid,text) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_mutation(uuid,text,jsonb,text,text,text) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_claim_operation_undo(uuid,uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_fail_operation_undo(uuid,uuid,text) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_mark_operation_reconciliation(uuid,uuid,text) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_claim_operation(uuid,uuid,text,text,text,text) FROM anon;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_complete_operation(uuid,uuid,text,text,text,jsonb) FROM anon;
    REVOKE ALL ON FUNCTION bloom_support.reconcile_operation(uuid,uuid,text,jsonb,text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_open_session(uuid,text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_touch_session(uuid,text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_close_session(uuid,text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_mutation(uuid,text,jsonb,text,text,text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_claim_operation_undo(uuid,uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_fail_operation_undo(uuid,uuid,text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_mark_operation_reconciliation(uuid,uuid,text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_claim_operation(uuid,uuid,text,text,text,text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.bloom_support_mcp_complete_operation(uuid,uuid,text,text,text,jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION bloom_support.reconcile_operation(uuid,uuid,text,jsonb,text) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.bloom_support_mcp_open_session(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_mcp_touch_session(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_mcp_close_session(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_mcp_mutation(uuid,text,jsonb,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_claim_operation_undo(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_fail_operation_undo(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_mark_operation_reconciliation(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_mcp_claim_operation(uuid,uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_mcp_complete_operation(uuid,uuid,text,text,text,jsonb) TO service_role;
