-- Subject tokens are hints for review, never evidence that two requests match.
-- p_number is retained for gateway compatibility and intentionally ignored.
-- The caller must still authenticate the sender and require ticket access.
CREATE OR REPLACE FUNCTION bloom_support.match_email_thread(p_refs text[], p_number bigint)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH RECURSIVE candidates AS (
    SELECT o.ticket_id AS id FROM bloom_support.outbound_emails o
      WHERE o.rfc_message_id=ANY(p_refs) AND o.ticket_id IS NOT NULL AND o.status IN ('sent','delivered')
    UNION SELECT m.ticket_id FROM bloom_support.messages m WHERE m.email_message_id=ANY(p_refs) AND m.ticket_id IS NOT NULL
    UNION SELECT t.id FROM bloom_support.conversations c JOIN bloom_support.tickets t ON t.conversation_id=c.id
      WHERE c.email_thread_root=ANY(p_refs)
  ), walk AS (
    SELECT t.id AS root,t.id,t.merged_into,(t.spam OR t.redacted_at IS NOT NULL) AS blocked,ARRAY[t.id] AS path,1 AS depth
      FROM candidates c JOIN bloom_support.tickets t ON t.id=c.id
    UNION ALL
    SELECT w.root,t.id,t.merged_into,(w.blocked OR t.spam OR t.redacted_at IS NOT NULL),w.path||t.id,w.depth+1
      FROM walk w JOIN bloom_support.tickets t ON t.id=w.merged_into
      WHERE w.depth<20 AND NOT t.id=ANY(w.path)
  ), terminal AS (
    SELECT * FROM walk WHERE merged_into IS NULL AND NOT blocked
  )
  SELECT CASE WHEN cardinality(p_refs) BETWEEN 1 AND 50
    AND NOT EXISTS (SELECT 1 FROM unnest(p_refs) ref WHERE ref IS NULL OR length(ref)>998)
    AND count(DISTINCT root)=(SELECT count(*) FROM candidates)
    AND count(DISTINCT id)=1 THEN (array_agg(id))[1] END FROM terminal
$$;
