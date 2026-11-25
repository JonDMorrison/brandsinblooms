-- get_tenant_customer_summary counted soft-deleted customers. Northfield
-- showed 9,507 customers on Reports > Sales while every other surface
-- (Contacts, audience totals) shows the 9,500 live records. Same
-- definition, plus deleted_at IS NULL. Grants are unchanged by REPLACE.
CREATE OR REPLACE FUNCTION public.get_tenant_customer_summary(target_tenant_id uuid)
 RETURNS TABLE(total_customers bigint, active_customers bigint, total_revenue numeric, lifetime_revenue numeric, new_customers_30d bigint, revenue_30d numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT
    COUNT(*) AS total_customers,
    COUNT(*) FILTER (
      WHERE last_purchase_date >= (now() - interval '12 months')::date
    ) AS active_customers,
    ROUND(GREATEST(COALESCE(SUM(total_spent), 0), 0)::numeric, 2) AS total_revenue,
    ROUND(GREATEST(COALESCE(SUM(lifetime_value), 0), 0)::numeric, 2) AS lifetime_revenue,
    COUNT(*) FILTER (
      WHERE created_at >= now() - interval '30 days'
    ) AS new_customers_30d,
    ROUND(
      COALESCE(
        SUM(total_spent) FILTER (
          WHERE last_purchase_date >= (now() - interval '30 days')::date
        ),
        0
      )::numeric,
      2
    ) AS revenue_30d
  FROM public.crm_customers
  WHERE tenant_id = target_tenant_id
    AND deleted_at IS NULL;
$function$;
