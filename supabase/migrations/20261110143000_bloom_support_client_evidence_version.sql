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
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bloom_support.bump_client_evidence_version() FROM PUBLIC;
DROP TRIGGER IF EXISTS bloom_support_client_evidence_version ON bloom_support.messages;
CREATE TRIGGER bloom_support_client_evidence_version
AFTER INSERT ON bloom_support.messages
FOR EACH ROW EXECUTE FUNCTION bloom_support.bump_client_evidence_version();
