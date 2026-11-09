-- Route only from existing verified account records, never email prose or a
-- model-selected repository. This grants no membership or release authority.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

CREATE OR REPLACE FUNCTION bloom_support.verified_email_product(p_account uuid, p_requester uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN count(DISTINCT l.product) = 1 THEN min(l.product) END
  FROM bloom_support.account_links l
  JOIN bloom_support.accounts a ON a.id = l.account_id AND a.merged_into IS NULL
  WHERE l.account_id = p_account
    AND EXISTS (
      SELECT 1 FROM bloom_support.account_members m
      JOIN bloom_support.principals p ON p.id = m.principal_id
      WHERE m.account_id = a.id AND m.principal_id = p_requester
        AND m.verified AND p.active AND p.role = 'client'
        AND (p.product = l.product OR p.product = 'email')
    )
    -- A multi-product account is ambiguous even if this identity came from one
    -- product. A sender may be reporting another product on the same account.
    AND (SELECT count(DISTINCT other.product) FROM bloom_support.account_links other
         WHERE other.account_id = a.id) = 1
$$;
REVOKE ALL ON FUNCTION bloom_support.verified_email_product(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION bloom_support.route_new_email_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE routed text;
BEGIN
  IF NEW.channel <> 'email' OR NEW.product <> 'unknown'
     OR NEW.context->>'email_match' IS DISTINCT FROM 'membership' THEN RETURN NEW; END IF;
  routed := bloom_support.verified_email_product(NEW.account_id, NEW.requester_id);
  IF routed IS NOT NULL THEN
    NEW.product := routed;
    NEW.context := NEW.context || jsonb_build_object('product_routing', jsonb_build_object(
      'source', 'verified_single_product_account', 'product', routed,
      'account_id', NEW.account_id, 'requester_id', NEW.requester_id));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bloom_support.route_new_email_product() FROM PUBLIC;
CREATE TRIGGER route_new_email_product BEFORE INSERT ON bloom_support.tickets
FOR EACH ROW EXECUTE FUNCTION bloom_support.route_new_email_product();

-- Existing unknown-product reports recover only when an admin explicitly
-- starts the same repair through the normal permission-checked operation.
-- Never reroute a dispatched repair, overwrite an explicit classification,
-- or start a job here. The existing start_repair operation owns the job.
CREATE OR REPLACE FUNCTION bloom_support.route_started_email_repair()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tk record; routed text; candidate text; ticket_ids uuid[] := '{}';
BEGIN
  IF NEW.repair_started_at IS NOT DISTINCT FROM OLD.repair_started_at
     OR NEW.repair_started_by IS NULL OR NEW.product <> 'unknown'
     OR NEW.repository IS NOT NULL OR NEW.branch IS NOT NULL OR NEW.pr_number IS NOT NULL
     OR NEW.head_sha IS NOT NULL OR NEW.merge_sha IS NOT NULL OR NEW.attempts <> 0
     OR coalesce((NEW.evidence->>'dispatches')::int, 0) <> 0
     OR coalesce((NEW.evidence->>'dispatch_pending')::boolean, false)
     OR NEW.status NOT IN ('open','failed','not_reproduced') THEN RETURN NEW; END IF;
  IF NOT bloom_support.has_permission(NEW.repair_started_by, 'engineering.dispatch')
     OR bloom_support.principal_role(NEW.repair_started_by) = 'service' THEN RETURN NEW; END IF;

  FOR tk IN SELECT * FROM bloom_support.tickets WHERE engineering_issue_id = NEW.id ORDER BY id FOR UPDATE LOOP
    IF tk.channel <> 'email' OR tk.product <> 'unknown'
       OR tk.status = 'resolved' OR tk.merged_into IS NOT NULL
       OR tk.context->>'email_match' IS DISTINCT FROM 'membership'
       OR tk.automation <> 'auto' OR tk.executor = 'person' THEN RETURN NEW; END IF;
    candidate := bloom_support.verified_email_product(tk.account_id, tk.requester_id);
    IF candidate IS NULL OR (routed IS NOT NULL AND candidate <> routed) THEN RETURN NEW; END IF;
    routed := candidate;
    ticket_ids := array_append(ticket_ids, tk.id);
  END LOOP;
  IF routed IS NULL OR cardinality(ticket_ids) = 0 THEN RETURN NEW; END IF;

  NEW.product := routed;
  NEW.evidence := NEW.evidence || jsonb_build_object('product_routing', jsonb_build_object(
    'source', 'verified_single_product_account', 'product', routed,
    'ticket_ids', ticket_ids, 'actor', NEW.repair_started_by,
    'at', NEW.repair_started_at, 'owner_assisted_restart', true));
  UPDATE bloom_support.tickets SET product = routed,
    context = context || jsonb_build_object('product_routing', NEW.evidence->'product_routing'),
    version = version + 1, updated_at = now() WHERE id = ANY(ticket_ids);
  FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE id = ANY(ticket_ids) LOOP
    PERFORM bloom_support.log(tk.id, tk.account_id, NEW.repair_started_by,
      'engineering.product_routed', NEW.evidence->'product_routing');
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bloom_support.route_started_email_repair() FROM PUBLIC;
CREATE TRIGGER route_started_email_repair BEFORE UPDATE OF repair_started_at ON bloom_support.engineering_issues
FOR EACH ROW EXECUTE FUNCTION bloom_support.route_started_email_repair();
