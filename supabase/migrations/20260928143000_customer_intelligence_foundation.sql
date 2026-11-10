-- BloomSuite Customer Intelligence foundation.
-- Normalizes line-item purchase facts independently of POS provider and makes
-- Ideal POS imports idempotent/auditable without weakening existing POS ledgers.

CREATE TABLE public.customer_intelligence_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  report_type text NOT NULL,
  source_filename text,
  source_period_start date,
  source_period_end date,
  source_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','completed','completed_with_errors','failed')),
  source_row_count integer NOT NULL DEFAULT 0,
  accepted_row_count integer NOT NULL DEFAULT 0,
  duplicate_row_count integer NOT NULL DEFAULT 0,
  rejected_row_count integer NOT NULL DEFAULT 0,
  reconciliation jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, report_type, source_sha256)
);

CREATE INDEX customer_intelligence_imports_tenant_created_idx
  ON public.customer_intelligence_imports (tenant_id, created_at DESC);

CREATE TABLE public.customer_purchase_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  import_id uuid REFERENCES public.customer_intelligence_imports(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_transaction_id text,
  external_line_id text,
  external_customer_code text,
  product_code text,
  product_name text,
  sales_category text,
  department text,
  quantity numeric NOT NULL DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  purchased_at timestamptz,
  source_period_start date,
  source_period_end date,
  source_fingerprint text NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, source_fingerprint)
);

CREATE INDEX customer_purchase_line_items_customer_date_idx
  ON public.customer_purchase_line_items (tenant_id, customer_id, purchased_at DESC)
  WHERE customer_id IS NOT NULL;
CREATE INDEX customer_purchase_line_items_category_idx
  ON public.customer_purchase_line_items (tenant_id, sales_category, purchased_at DESC);
CREATE INDEX customer_purchase_line_items_department_idx
  ON public.customer_purchase_line_items (tenant_id, department, purchased_at DESC);
CREATE INDEX customer_purchase_line_items_product_idx
  ON public.customer_purchase_line_items (tenant_id, product_code, purchased_at DESC);

CREATE TABLE public.customer_intelligence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(weights) = 'object'),
  CHECK (jsonb_typeof(filters) = 'object')
);

CREATE INDEX customer_intelligence_scores_tenant_idx
  ON public.customer_intelligence_scores (tenant_id, is_active, created_at DESC);

ALTER TABLE public.customer_intelligence_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchase_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intelligence_scores ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customer_intelligence_imports, public.customer_purchase_line_items,
  public.customer_intelligence_scores FROM PUBLIC, anon;
GRANT SELECT ON public.customer_intelligence_imports, public.customer_purchase_line_items,
  public.customer_intelligence_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_intelligence_imports,
  public.customer_purchase_line_items, public.customer_intelligence_scores TO service_role;

CREATE POLICY customer_intelligence_imports_select
ON public.customer_intelligence_imports FOR SELECT TO authenticated
USING (public.has_tenant_permission(tenant_id, 'reports.read', NULL));

CREATE POLICY customer_purchase_line_items_select
ON public.customer_purchase_line_items FOR SELECT TO authenticated
USING (public.has_tenant_permission(tenant_id, 'customer.read', NULL));

CREATE POLICY customer_intelligence_scores_select
ON public.customer_intelligence_scores FOR SELECT TO authenticated
USING (public.has_tenant_permission(tenant_id, 'segments.manage', NULL)
    OR public.has_tenant_permission(tenant_id, 'reports.read', NULL));

CREATE POLICY customer_intelligence_scores_insert
ON public.customer_intelligence_scores FOR INSERT TO authenticated
WITH CHECK (public.has_tenant_permission(tenant_id, 'segments.manage', NULL));

CREATE POLICY customer_intelligence_scores_update
ON public.customer_intelligence_scores FOR UPDATE TO authenticated
USING (public.has_tenant_permission(tenant_id, 'segments.manage', NULL))
WITH CHECK (public.has_tenant_permission(tenant_id, 'segments.manage', NULL));

CREATE OR REPLACE VIEW public.customer_purchase_intelligence
WITH (security_invoker = true)
AS
SELECT
  customer.tenant_id,
  customer.id AS customer_id,
  customer.email,
  customer.first_name,
  customer.last_name,
  metrics.total_purchases,
  metrics.lifetime_value,
  metrics.average_order_value,
  metrics.purchase_frequency,
  metrics.days_since_last_purchase,
  metrics.purchase_velocity,
  metrics.customer_tier,
  metrics.top_product_categories,
  metrics.favorite_products,
  coalesce(line_rollup.total_quantity, 0) AS total_quantity,
  coalesce(line_rollup.category_spend, '{}'::jsonb) AS category_spend,
  coalesce(line_rollup.department_spend, '{}'::jsonb) AS department_spend,
  coalesce(line_rollup.category_quantity, '{}'::jsonb) AS category_quantity,
  coalesce(line_rollup.department_quantity, '{}'::jsonb) AS department_quantity,
  coalesce(line_rollup.departments_shopped, 0) AS departments_shopped,
  coalesce(line_rollup.categories_shopped, 0) AS categories_shopped,
  line_rollup.last_line_item_purchase_at
FROM public.crm_customers AS customer
LEFT JOIN public.customer_purchase_metrics AS metrics
  ON metrics.customer_id = customer.id AND metrics.tenant_id = customer.tenant_id
LEFT JOIN LATERAL (
  SELECT
    sum(item.quantity) AS total_quantity,
    count(DISTINCT nullif(item.department, '')) AS departments_shopped,
    count(DISTINCT nullif(item.sales_category, '')) AS categories_shopped,
    max(item.purchased_at) AS last_line_item_purchase_at,
    (SELECT coalesce(jsonb_object_agg(x.sales_category, x.amount), '{}'::jsonb)
       FROM (SELECT sales_category, round(sum(net_amount),2) amount
             FROM public.customer_purchase_line_items
             WHERE tenant_id=customer.tenant_id AND customer_id=customer.id
               AND nullif(sales_category,'') IS NOT NULL GROUP BY sales_category) x) AS category_spend,
    (SELECT coalesce(jsonb_object_agg(x.department, x.amount), '{}'::jsonb)
       FROM (SELECT department, round(sum(net_amount),2) amount
             FROM public.customer_purchase_line_items
             WHERE tenant_id=customer.tenant_id AND customer_id=customer.id
               AND nullif(department,'') IS NOT NULL GROUP BY department) x) AS department_spend,
    (SELECT coalesce(jsonb_object_agg(x.sales_category, x.qty), '{}'::jsonb)
       FROM (SELECT sales_category, sum(quantity) qty
             FROM public.customer_purchase_line_items
             WHERE tenant_id=customer.tenant_id AND customer_id=customer.id
               AND nullif(sales_category,'') IS NOT NULL GROUP BY sales_category) x) AS category_quantity,
    (SELECT coalesce(jsonb_object_agg(x.department, x.qty), '{}'::jsonb)
       FROM (SELECT department, sum(quantity) qty
             FROM public.customer_purchase_line_items
             WHERE tenant_id=customer.tenant_id AND customer_id=customer.id
               AND nullif(department,'') IS NOT NULL GROUP BY department) x) AS department_quantity
  FROM public.customer_purchase_line_items AS item
  WHERE item.tenant_id = customer.tenant_id AND item.customer_id = customer.id
) AS line_rollup ON true
WHERE customer.deleted_at IS NULL AND customer.merged_into_customer_id IS NULL;

GRANT SELECT ON public.customer_purchase_intelligence TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.customer_period_comparison(
  p_customer_id uuid,
  p_dimension text DEFAULT 'overall',
  p_dimension_value text DEFAULT NULL,
  p_current_start date DEFAULT NULL,
  p_current_end date DEFAULT NULL,
  p_baseline_start date DEFAULT NULL,
  p_baseline_end date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_tenant uuid; v_current numeric := 0; v_baseline numeric := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.crm_customers
  WHERE id=p_customer_id AND deleted_at IS NULL AND merged_into_customer_id IS NULL;
  IF v_tenant IS NULL OR NOT public.has_tenant_permission(v_tenant,'customer.read',NULL) THEN
    RAISE EXCEPTION 'Customer intelligence access denied' USING ERRCODE='42501';
  END IF;
  IF p_current_start IS NULL OR p_current_end IS NULL OR
     p_baseline_start IS NULL OR p_baseline_end IS NULL THEN
    RAISE EXCEPTION 'Explicit comparable periods are required';
  END IF;
  IF p_dimension NOT IN ('overall','category','department','product') THEN
    RAISE EXCEPTION 'Unsupported comparison dimension';
  END IF;

  SELECT coalesce(sum(net_amount),0) INTO v_current
  FROM public.customer_purchase_line_items
  WHERE tenant_id=v_tenant AND customer_id=p_customer_id
    AND purchased_at::date BETWEEN p_current_start AND p_current_end
    AND (p_dimension='overall'
      OR (p_dimension='category' AND sales_category=p_dimension_value)
      OR (p_dimension='department' AND department=p_dimension_value)
      OR (p_dimension='product' AND (product_code=p_dimension_value OR product_name=p_dimension_value)));

  SELECT coalesce(sum(net_amount),0) INTO v_baseline
  FROM public.customer_purchase_line_items
  WHERE tenant_id=v_tenant AND customer_id=p_customer_id
    AND purchased_at::date BETWEEN p_baseline_start AND p_baseline_end
    AND (p_dimension='overall'
      OR (p_dimension='category' AND sales_category=p_dimension_value)
      OR (p_dimension='department' AND department=p_dimension_value)
      OR (p_dimension='product' AND (product_code=p_dimension_value OR product_name=p_dimension_value)));

  RETURN jsonb_build_object(
    'customer_id',p_customer_id,'dimension',p_dimension,'dimension_value',p_dimension_value,
    'current',round(v_current,2),'baseline',round(v_baseline,2),
    'change',round(v_current-v_baseline,2),
    'change_percent',CASE WHEN v_baseline<>0 THEN round(((v_current-v_baseline)/v_baseline)*100,2) END,
    'current_period',jsonb_build_object('start',p_current_start,'end',p_current_end),
    'baseline_period',jsonb_build_object('start',p_baseline_start,'end',p_baseline_end)
  );
END $$;
