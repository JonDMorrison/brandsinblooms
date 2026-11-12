-- A suggested closing reply relies on engineering evidence even when a person
-- clicks Send. Keep deliberate manual resolution separate from this contract.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
CREATE OR REPLACE FUNCTION bloom_support.require_reviewed_closure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e bloom_support.engineering_issues; latest_client timestamptz; checked timestamptz;
BEGIN
  IF NEW.status <> 'resolved' OR OLD.status = 'resolved'
    OR NEW.resolution_evidence->>'via' IS DISTINCT FROM 'send-and-solve' THEN RETURN NEW; END IF;

  -- update_ticket already holds the ticket lock. Engineering updates take the
  -- opposite order, so never wait for their lock: fail safely and ask for review.
  BEGIN
    SELECT * INTO e FROM bloom_support.engineering_issues
      WHERE id = NEW.engineering_issue_id FOR SHARE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'conflict: engineering evidence is changing; review before closing' USING ERRCODE = '40001';
  END;
  IF e.id IS NULL OR NEW.engineering_issue_id IS DISTINCT FROM OLD.engineering_issue_id
    OR NEW.resolution_evidence->>'engineering_issue_id' IS DISTINCT FROM e.id::text
    OR NEW.resolution_evidence->>'engineering_version' IS DISTINCT FROM e.version::text THEN
    RAISE EXCEPTION 'conflict: reviewed engineering evidence changed' USING ERRCODE = '40001';
  END IF;

  IF e.status = 'verified' THEN
    IF e.verification->'passed' IS DISTINCT FROM 'true'::jsonb
      OR jsonb_typeof(e.verification->'started_at') IS DISTINCT FROM 'string'
      OR e.verification->>'scope' IS DISTINCT FROM 'ticket_flow'
      OR NOT coalesce(e.verification->'ticket_ids' @> jsonb_build_array(NEW.id::text), false)
      OR e.deployment->>'state' IS DISTINCT FROM 'success'
      OR NEW.resolution_evidence->'verification' IS DISTINCT FROM e.verification
      OR NEW.resolution_evidence->'deployment' IS DISTINCT FROM e.deployment
      OR coalesce(btrim(NEW.resolution_evidence->>'no_deploy_reason'), '') <> '' THEN
      RAISE EXCEPTION 'blocked: reviewed fix needs current ticket-bound production evidence' USING ERRCODE = '23514';
    END IF;
    BEGIN
      checked := (e.verification->>'started_at')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN checked := NULL; END;
  ELSIF e.status = 'not_reproduced' OR (e.status = 'open' AND e.reproduction->>'result' = 'not_reproduced') THEN
    IF coalesce(btrim(NEW.resolution_evidence->>'no_deploy_reason'), '') = ''
      OR jsonb_typeof(e.reproduction->'checked_at') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'blocked: investigation closure needs its no-deployment reason' USING ERRCODE = '23514';
    END IF;
    BEGIN
      checked := (e.reproduction->>'checked_at')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN checked := NULL; END;

  ELSE
    RAISE EXCEPTION 'blocked: engineering outcome no longer supports this closing reply' USING ERRCODE = '23514';
  END IF;

  WITH RECURSIVE sources(id, created_at) AS (
    SELECT id, created_at FROM bloom_support.tickets WHERE id = NEW.id
    UNION
    SELECT source.id, source.created_at FROM bloom_support.tickets source
      JOIN sources target ON source.merged_into = target.id
  )
  SELECT greatest(max(m.created_at), max(s.created_at)) INTO latest_client
  FROM sources s LEFT JOIN bloom_support.messages m ON m.ticket_id = s.id AND m.author_kind = 'client';
  IF checked IS NULL OR NOT isfinite(checked) OR checked > statement_timestamp() OR latest_client IS NULL OR checked < latest_client THEN
    RAISE EXCEPTION 'blocked: current client evidence requires a fresh investigation or verification' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bloom_support.require_reviewed_closure() FROM PUBLIC;
DROP TRIGGER IF EXISTS bloom_support_reviewed_closure ON bloom_support.tickets;
CREATE TRIGGER bloom_support_reviewed_closure BEFORE UPDATE ON bloom_support.tickets
FOR EACH ROW EXECUTE FUNCTION bloom_support.require_reviewed_closure();
