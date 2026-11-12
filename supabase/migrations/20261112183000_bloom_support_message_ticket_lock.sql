-- A client reply that waits behind resolution must route from the committed
-- ticket state, not the pre-wait snapshot. Preserve the latest function body,
-- permissions and wrappers; change only its initial read/lock sequence.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $$
DECLARE definition text; anchor text := '  t := bloom_support.require_ticket(p_actor, p_ticket);';
BEGIN
  definition := pg_get_functiondef('bloom_support.add_message(uuid,uuid,jsonb)'::regprocedure);
  IF position(anchor IN definition) = 0 THEN
    RAISE EXCEPTION 'add_message initial ticket-read anchor not found';
  END IF;
  definition := replace(definition, anchor, $replacement$
  PERFORM bloom_support.require_ticket(p_actor, p_ticket);
  -- Match inbound email's existing advisory-before-ticket lock order.
  IF p->>'idempotency_key' IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('message:' || (p->>'idempotency_key'), 0)
    );
  END IF;
  PERFORM id FROM bloom_support.tickets WHERE id = p_ticket FOR UPDATE;
  -- Recheck visibility and all decisions after any wait, under the row lock.
  t := bloom_support.require_ticket(p_actor, p_ticket);$replacement$);
  EXECUTE definition;
END $$;
