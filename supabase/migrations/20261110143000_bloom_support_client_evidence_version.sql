-- A new client message must invalidate work based on the old ticket snapshot,
-- even when the ticket was already working (rather than waiting for a reply).
-- Existing update_ticket optimistic locking then rejects stale closure/decisions.
CREATE OR REPLACE FUNCTION bloom_support.bump_client_evidence_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, bloom_support
AS $$
BEGIN
  IF NEW.author_kind = 'client' AND NEW.ticket_id IS NOT NULL THEN
    UPDATE bloom_support.tickets
    SET version = version + 1, updated_at = now()
    WHERE id = NEW.ticket_id OR id = (
      SELECT source.merged_into FROM bloom_support.tickets source WHERE source.id = NEW.ticket_id
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bloom_support.bump_client_evidence_version() FROM PUBLIC;
DROP TRIGGER IF EXISTS bloom_support_client_evidence_version ON bloom_support.messages;
CREATE TRIGGER bloom_support_client_evidence_version
AFTER INSERT ON bloom_support.messages
FOR EACH ROW EXECUTE FUNCTION bloom_support.bump_client_evidence_version();

-- A bounded staff timeline is useful for prompts, not authoritative closure.
-- Check the unbounded underlying evidence inside the ticket update transaction.
CREATE OR REPLACE FUNCTION bloom_support.require_fresh_client_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, bloom_support
AS $$
DECLARE latest_client timestamptz; started timestamptz;
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved'
     AND NEW.resolution_verified
     AND NEW.resolution_evidence->>'resolved_by' = 'bloom'
     AND NEW.resolution_evidence->>'engineering_issue_id' IS NOT NULL THEN
    SELECT max(m.created_at) INTO latest_client
    FROM bloom_support.messages m
    WHERE m.author_kind = 'client'
      AND (m.ticket_id = NEW.id OR m.ticket_id IN (
        SELECT t.id FROM bloom_support.tickets t WHERE t.merged_into = NEW.id
      ));
    BEGIN
      started := (NEW.resolution_evidence #>> '{verification,started_at}')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      started := NULL;
    END;
    IF started IS NULL OR latest_client IS NULL OR started < latest_client THEN
      RAISE EXCEPTION 'blocked: current client evidence requires fresh verification' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bloom_support.require_fresh_client_verification() FROM PUBLIC;
DROP TRIGGER IF EXISTS bloom_support_fresh_client_verification ON bloom_support.tickets;
CREATE TRIGGER bloom_support_fresh_client_verification
BEFORE UPDATE ON bloom_support.tickets
FOR EACH ROW EXECUTE FUNCTION bloom_support.require_fresh_client_verification();
