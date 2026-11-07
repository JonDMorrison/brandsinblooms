-- Keep clients informed when a repair reaches a meaningful new stage. Internal
-- transitions such as approval and merging stay internal so one repair does
-- not turn into a burst of near-duplicate customer emails.
-- The trigger queues work only; the worker applies the current automation,
-- ownership, escalation and resolution checks before Bloom may speak.

CREATE OR REPLACE FUNCTION bloom_support.queue_engineering_progress_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ticket record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN (
       'investigating',
       'reproduced',
       'not_reproduced',
       'in_review',
       'deploying',
       'verifying',
       'failed',
       'rolled_back',
       'escalated'
     ) THEN
    RETURN NEW;
  END IF;

  FOR ticket IN
    SELECT id, account_id
    FROM bloom_support.tickets
    WHERE engineering_issue_id = NEW.id
      AND status <> 'resolved'
      AND merged_into IS NULL
  LOOP
    PERFORM bloom_support.enqueue_job(
      'answer',
      ticket.id,
      NEW.id,
      'account:' || coalesce(ticket.account_id::text, 'none:' || ticket.id::text),
      jsonb_build_object('mode', 'engineering_progress', 'status', NEW.status),
      'engineering-progress:' || NEW.id::text || ':' || ticket.id::text || ':' || NEW.status || ':' || NEW.version::text
    );
  END LOOP;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS bloom_support_engineering_progress_email
  ON bloom_support.engineering_issues;
CREATE TRIGGER bloom_support_engineering_progress_email
AFTER UPDATE OF status
ON bloom_support.engineering_issues
FOR EACH ROW
EXECUTE FUNCTION bloom_support.queue_engineering_progress_email();

REVOKE ALL ON FUNCTION bloom_support.queue_engineering_progress_email()
  FROM PUBLIC, anon, authenticated;
