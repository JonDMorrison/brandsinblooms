-- Complete the Ideal report ingestion contract.
-- Raw report-specific facts are retained alongside normalized purchase facts so
-- loyalty/coupon history is not forced into unrelated CRM tables.

CREATE TABLE IF NOT EXISTS public.customer_intelligence_source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  import_id uuid NOT NULL REFERENCES public.customer_intelligence_imports(id) ON DELETE CASCADE,
  source text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('customer_spending','points','coupon_issued','coupon_redeemed')),
  external_customer_code text,
  external_transaction_id text,
  coupon_code text,
  points_delta numeric,
  amount numeric,
  occurred_at timestamptz,
  expires_at timestamptz,
  source_fingerprint text NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, source_fingerprint)
);
CREATE INDEX IF NOT EXISTS customer_intelligence_source_events_customer_idx
  ON public.customer_intelligence_source_events(tenant_id, customer_id, occurred_at DESC);
ALTER TABLE public.customer_intelligence_source_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_intelligence_source_events FROM PUBLIC, anon;
GRANT SELECT ON public.customer_intelligence_source_events TO authenticated;
GRANT ALL ON public.customer_intelligence_source_events TO service_role;
CREATE POLICY customer_intelligence_source_events_select
ON public.customer_intelligence_source_events FOR SELECT TO authenticated
USING (public.has_tenant_permission(tenant_id,'customer.read',NULL));

CREATE OR REPLACE FUNCTION public.recalculate_customer_intelligence_after_import(
  p_tenant_id uuid,
  p_import_id uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_customer uuid; v_count integer:=0;
BEGIN
  FOR v_customer IN
    SELECT DISTINCT customer_id FROM public.customer_purchase_line_items
    WHERE tenant_id=p_tenant_id AND import_id=p_import_id AND customer_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_purchase_metrics(v_customer);
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_customer_intelligence_after_import(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_intelligence_after_import(uuid,uuid) TO service_role;
