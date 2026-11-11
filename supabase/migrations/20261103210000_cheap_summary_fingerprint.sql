-- Cheap change detector for a fully verified report import.
--
-- The first version hashed the whole report (13 MB for West Coast) on every
-- product search. Under load it ran past the 8 second statement limit
-- alongside the search itself. This version reads only row counts and each
-- row's xmin (the transaction that last wrote it). Any insert, update or
-- delete of a report row, or of a customer it is reconciled against, changes
-- the result, so the full verification runs again whenever anything changed.
CREATE OR REPLACE FUNCTION public.customer_intelligence_summary_fingerprint(
  p_tenant_id uuid,
  p_import_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH ev AS (
    SELECT e.customer_id, e.external_customer_code, e.xmin::text::bigint AS x
    FROM public.customer_intelligence_source_events e
    WHERE e.tenant_id = p_tenant_id
      AND e.import_id = p_import_id
  ),
  codes AS (
    SELECT DISTINCT ev.external_customer_code AS code FROM ev WHERE ev.external_customer_code IS NOT NULL
  ),
  -- Every customer a report row points to, and every customer that shares one of its codes.
  cust AS (
    SELECT c.xmin::text::bigint AS x
    FROM public.crm_customers c
    WHERE c.tenant_id = p_tenant_id
      AND (c.id IN (SELECT ev.customer_id FROM ev) OR c.external_id IN (SELECT codes.code FROM codes))
  )
  SELECT 'v2:' || (SELECT count(*) FROM ev) || ':' || coalesce((SELECT max(ev.x) FROM ev), 0)
      || ':' || (SELECT count(*) FROM cust) || ':' || coalesce((SELECT max(cust.x) FROM cust), 0);
$$;
