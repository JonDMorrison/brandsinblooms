BEGIN;
-- Read-only diagnostics: a receipt proves durable retention, not complete history.
CREATE FUNCTION public.bloomsuite_pos_purchase_health(p_expected_tenant uuid)
RETURNS TABLE(connection_id uuid,connection_name text,missing_original_sales bigint,orphan_returns bigint,orphan_voids bigint,oldest_received_at timestamptz,latest_receipt_at timestamptz,missing_sale_references jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=bloom_pos_private.preference_reviewer();
BEGIN
 IF p_expected_tenant IS DISTINCT FROM t THEN RAISE EXCEPTION 'Current business scope changed' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH scoped AS(
  SELECT c.key_id,c.pos_connection_id,p.name FROM bloom_pos_private.connections c
  JOIN public.pos_connections p ON p.id=c.pos_connection_id AND p.tenant_id=c.crm_tenant_id
  WHERE c.crm_tenant_id=t
 ), missing AS(
  SELECT s.pos_connection_id,i.subject_id,i.event_type,min(i.received_at) first_received
  FROM scoped s JOIN bloom_pos_private.inbox i ON i.key_id=s.key_id
  WHERE i.event_type IN('ReturnCompleted','VoidCompleted') AND i.subject_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM bloom_pos_private.inbox sale WHERE sale.key_id=i.key_id AND sale.event_type='SaleCompleted' AND sale.subject_id=i.subject_id)
  GROUP BY s.pos_connection_id,i.subject_id,i.event_type
 )
 SELECT s.pos_connection_id,s.name,
  (SELECT count(DISTINCT m.subject_id) FROM missing m WHERE m.pos_connection_id=s.pos_connection_id),
  (SELECT count(*) FROM bloom_pos_private.return_events r WHERE r.key_id=s.key_id AND NOT EXISTS(SELECT 1 FROM bloom_pos_private.inbox sale WHERE sale.key_id=r.key_id AND sale.event_type='SaleCompleted' AND sale.subject_id=r.original_sale_id)),
  (SELECT count(*) FROM missing m WHERE m.pos_connection_id=s.pos_connection_id AND m.event_type='VoidCompleted'),
  (SELECT min(m.first_received) FROM missing m WHERE m.pos_connection_id=s.pos_connection_id),
  (SELECT max(i.received_at) FROM bloom_pos_private.inbox i WHERE i.key_id=s.key_id),
  coalesce((SELECT jsonb_agg(x) FROM(SELECT m.subject_id AS "saleReference",m.event_type AS "eventType",m.first_received AS "receivedAt" FROM missing m WHERE m.pos_connection_id=s.pos_connection_id ORDER BY m.first_received,m.subject_id,m.event_type LIMIT 50)x),'[]'::jsonb)
 FROM scoped s ORDER BY s.name,s.pos_connection_id LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.bloomsuite_pos_purchase_health(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.bloomsuite_pos_purchase_health(uuid) TO authenticated;
COMMIT;
