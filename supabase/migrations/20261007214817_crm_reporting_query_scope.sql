-- Keep the existing authorization guard and execution privileges unchanged.
-- Materialize each tenant's segment membership once rather than performing an
-- index lookup for every customer before the seven system segments are counted.
DO $migration$
DECLARE definition text; patched text;
BEGIN
  SELECT pg_get_functiondef('public.get_crm_dashboard_snapshot(uuid,uuid)'::regprocedure) INTO definition;
  patched:=definition;
  IF strpos(patched,'manual_segments AS MATERIALIZED (')=0 THEN
    IF strpos(patched,'manual_segments AS (')=0
       OR strpos(patched,E'\t\tJOIN scoped_customers sc ON sc.id = cs.customer_id\n')=0
       OR strpos(patched,E'SELECT customer_id, segment_key\n\t\tFROM manual_segments\n\t\tWHERE segment_key IS NOT NULL')=0 THEN
      RAISE EXCEPTION 'Expected dashboard membership query was not found; review before modifying';
    END IF;
    patched:=replace(patched,'manual_segments AS (','manual_segments AS MATERIALIZED (');
    patched:=replace(patched,E'\t\tJOIN scoped_customers sc ON sc.id = cs.customer_id\n','');
    patched:=replace(patched,'WHERE s.name IN (','WHERE (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id) AND s.name IN (');
    patched:=replace(patched,E'SELECT customer_id, segment_key\n\t\tFROM manual_segments\n\t\tWHERE segment_key IS NOT NULL',
      E'SELECT ms.customer_id, ms.segment_key\n\t\tFROM manual_segments ms JOIN scoped_customers sc ON sc.id = ms.customer_id\n\t\tWHERE ms.segment_key IS NOT NULL');
    IF split_part(patched,'WITH bounds AS',1) IS DISTINCT FROM split_part(definition,'WITH bounds AS',1) THEN
      RAISE EXCEPTION 'Dashboard authorization guard unexpectedly changed';
    END IF;
    EXECUTE patched;
  END IF;
END $migration$;

-- Support the explicitly tenant-scoped, bounded list-health query. No RLS or
-- grants change, and no customer, consent or campaign records are modified.
SET LOCAL lock_timeout='3s';
CREATE INDEX IF NOT EXISTS idx_email_tracking_tenant_health_window
  ON public.email_tracking_events(tenant_id,created_at,id)
  INCLUDE(event_type,customer_email)
  WHERE event_type IN ('sent','bounced','bounce','complained','complaint');
