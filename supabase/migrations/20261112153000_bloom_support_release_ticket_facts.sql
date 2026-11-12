-- Release evaluation needs classification, not the full support conversation.
-- Preserve the existing engineering.view boundary and summary contract; add
-- authoritative classification and exact linked feature decision eligibility.
-- No conversation, decision note, or extra ticket-read permission is exposed.
-- CREATE OR REPLACE preserves the existing function owner and execute grants.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

CREATE OR REPLACE FUNCTION bloom_support.list_engineering(p_actor uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'engineering.view');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('tickets',
            (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'id', t.id, 'number', t.number, 'subject', t.subject, 'account_id', t.account_id,
              'status', t.status, 'automation', t.automation, 'kind', t.kind, 'product', t.product,
              'feature_request_id', t.feature_request_id, 'feature_status', f.status,
              'feature_product_approved', coalesce(
                f.status IN ('accepted','planned','shipped') AND f.decided_at IS NOT NULL
                AND decider.kind <> 'service' AND decider.role <> 'service'
                AND bloom_support.has_permission(decider.id, 'features.decide')
                AND f.product = t.product AND f.product = e.product, false)
            )), '[]')
             FROM bloom_support.tickets t
             LEFT JOIN bloom_support.feature_requests f ON f.id = t.feature_request_id
             LEFT JOIN bloom_support.principals decider ON decider.id = f.decided_by
             WHERE t.engineering_issue_id = e.id)) ORDER BY e.updated_at DESC), '[]')
    FROM (SELECT * FROM bloom_support.engineering_issues WHERE p_status IS NULL OR status = ANY(string_to_array(p_status, ',')) ORDER BY updated_at DESC LIMIT 100) e);
END $$;

