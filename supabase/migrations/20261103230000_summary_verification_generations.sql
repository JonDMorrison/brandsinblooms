-- Constant-time change detection for verified report imports.
--
-- Bloom verifies each imported sales report in full once, then reuses that
-- verification while nothing it depends on has changed. The previous check
-- read every report row and every linked customer on each search. On a cold
-- cache that took over 10 seconds and hit the statement limit.
--
-- Triggers now bump a generation counter whenever a report row changes
-- (per import) or a customer's code, archive or merge state changes (per
-- company). The fingerprint is just those two counters, so any change still
-- forces a full re-verification, and checking costs one indexed read.

CREATE TABLE IF NOT EXISTS public.customer_intelligence_summary_generations (
  scope_key text PRIMARY KEY,
  generation bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_intelligence_summary_generations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_intelligence_summary_generations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.customer_intelligence_summary_generations TO service_role;

CREATE OR REPLACE FUNCTION public.bump_customer_intelligence_generation(p_keys text[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.customer_intelligence_summary_generations AS g (scope_key, generation, updated_at)
  SELECT DISTINCT k, 1, now() FROM unnest(p_keys) AS k
  WHERE k IS NOT NULL
    -- Customer changes only matter to companies with imported sales summaries.
    -- Skipping the rest keeps their customer writes free of this counter's row lock.
    AND (k NOT LIKE 'tenant:%' OR EXISTS (
      SELECT 1 FROM public.customer_intelligence_imports i
      WHERE i.tenant_id = substr(k, 8)::uuid AND i.report_type = 'customer_sales_summary'))
  ORDER BY k
  ON CONFLICT (scope_key) DO UPDATE SET generation = g.generation + 1, updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.bump_customer_intelligence_generation(text[]) FROM PUBLIC, anon, authenticated;

-- Report rows: one bump per changed import, per statement.
CREATE OR REPLACE FUNCTION public.customer_intelligence_events_generation_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_keys text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(DISTINCT 'import:' || n.import_id) INTO v_keys FROM new_rows n WHERE n.import_id IS NOT NULL;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(DISTINCT 'import:' || o.import_id) INTO v_keys FROM old_rows o WHERE o.import_id IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT k) INTO v_keys FROM (
      SELECT 'import:' || n.import_id AS k FROM new_rows n WHERE n.import_id IS NOT NULL
      UNION SELECT 'import:' || o.import_id FROM old_rows o WHERE o.import_id IS NOT NULL
    ) s;
  END IF;
  IF v_keys IS NOT NULL THEN PERFORM public.bump_customer_intelligence_generation(v_keys); END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS customer_intelligence_events_generation_ins ON public.customer_intelligence_source_events;
DROP TRIGGER IF EXISTS customer_intelligence_events_generation_upd ON public.customer_intelligence_source_events;
DROP TRIGGER IF EXISTS customer_intelligence_events_generation_del ON public.customer_intelligence_source_events;
CREATE TRIGGER customer_intelligence_events_generation_ins AFTER INSERT ON public.customer_intelligence_source_events
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.customer_intelligence_events_generation_trigger();
CREATE TRIGGER customer_intelligence_events_generation_upd AFTER UPDATE ON public.customer_intelligence_source_events
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.customer_intelligence_events_generation_trigger();
CREATE TRIGGER customer_intelligence_events_generation_del AFTER DELETE ON public.customer_intelligence_source_events
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.customer_intelligence_events_generation_trigger();

-- Customers: a report is reconciled against live customers' codes.
CREATE OR REPLACE FUNCTION public.crm_customers_identity_generation_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_keys text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(DISTINCT 'tenant:' || n.tenant_id) INTO v_keys FROM new_rows n WHERE n.external_id IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT 'tenant:' || o.tenant_id) INTO v_keys FROM old_rows o WHERE o.external_id IS NOT NULL;
  END IF;
  IF v_keys IS NOT NULL THEN PERFORM public.bump_customer_intelligence_generation(v_keys); END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_customers_identity_generation_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.bump_customer_intelligence_generation(ARRAY['tenant:' || NEW.tenant_id, 'tenant:' || OLD.tenant_id]);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS crm_customers_identity_generation_ins ON public.crm_customers;
DROP TRIGGER IF EXISTS crm_customers_identity_generation_del ON public.crm_customers;
DROP TRIGGER IF EXISTS crm_customers_identity_generation_upd ON public.crm_customers;
CREATE TRIGGER crm_customers_identity_generation_ins AFTER INSERT ON public.crm_customers
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.crm_customers_identity_generation_stmt();
CREATE TRIGGER crm_customers_identity_generation_del AFTER DELETE ON public.crm_customers
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.crm_customers_identity_generation_stmt();
CREATE TRIGGER crm_customers_identity_generation_upd
  AFTER UPDATE OF external_id, deleted_at, merged_into_customer_id, tenant_id ON public.crm_customers
  FOR EACH ROW
  WHEN (OLD.external_id IS DISTINCT FROM NEW.external_id
     OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
     OR OLD.merged_into_customer_id IS DISTINCT FROM NEW.merged_into_customer_id
     OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id)
  EXECUTE FUNCTION public.crm_customers_identity_generation_row();

-- The fingerprint: the two counters. Service role only (the edge function).
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
  SELECT 'g1:' || coalesce((SELECT g.generation FROM public.customer_intelligence_summary_generations g WHERE g.scope_key = 'import:' || p_import_id), 0)
      || ':' || coalesce((SELECT g.generation FROM public.customer_intelligence_summary_generations g WHERE g.scope_key = 'tenant:' || p_tenant_id), 0);
$$;
REVOKE ALL ON FUNCTION public.customer_intelligence_summary_fingerprint(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_intelligence_summary_fingerprint(uuid, uuid) TO service_role;
