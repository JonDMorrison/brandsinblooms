import { supabase } from "@/integrations/supabase/client";
import { readAllPages } from "../../../supabase/functions/_shared/customer-intelligence/query-pages";

/** A lightweight, tenant-scoped join avoids the expensive per-customer lateral view. */
export interface IntelligenceCustomer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}
export interface IntelligenceMetric {
  customer_id: string;
  lifetime_value: number | null;
  purchase_velocity: number | null;
  days_since_last_purchase: number | null;
  customer_tier: string | null;
  top_product_categories: string[] | null;
}
export type IntelligenceRow = Omit<IntelligenceCustomer, "id"> &
  IntelligenceMetric;

/** A missing metric is unknown, not a numerical zero or an inferred lapse. */
export function joinIntelligenceHome(
  customers: IntelligenceCustomer[],
  metrics: IntelligenceMetric[],
): IntelligenceRow[] {
  const metricById = new Map<string, IntelligenceMetric>();
  for (const metric of metrics) {
    if (metricById.has(metric.customer_id))
      throw new Error(
        "Conflicting customer intelligence metrics must be reconciled.",
      );
    metricById.set(metric.customer_id, metric);
  }
  const seenCustomers = new Set<string>();
  return customers.map((customer) => {
    if (seenCustomers.has(customer.id))
      throw new Error("Duplicate customer profiles must be reconciled.");
    seenCustomers.add(customer.id);
    const data = metricById.get(customer.id);
    return {
      customer_id: customer.id,
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      lifetime_value: data?.lifetime_value ?? null,
      purchase_velocity: data?.purchase_velocity ?? null,
      days_since_last_purchase: data?.days_since_last_purchase ?? null,
      customer_tier: data?.customer_tier ?? null,
      top_product_categories: data?.top_product_categories ?? null,
    };
  });
}

/** Both sources enforce their own customer/location RLS plus an explicit company ID. */
export async function loadIntelligenceHome(
  tenantId: string,
): Promise<IntelligenceRow[]> {
  if (!tenantId)
    throw new Error("Select a company before loading customer intelligence.");
  const [customers, metrics] = await Promise.all([
    readAllPages<IntelligenceCustomer>((from, to) =>
      supabase
        .from("crm_customers")
        .select("id,first_name,last_name,email")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .is("merged_into_customer_id", null)
        .order("id")
        .range(from, to),
    ),
    readAllPages<IntelligenceMetric>((from, to) =>
      supabase
        .from("customer_purchase_metrics")
        .select(
          "customer_id,lifetime_value,purchase_velocity,days_since_last_purchase,customer_tier,top_product_categories",
        )
        .eq("tenant_id", tenantId)
        .order("customer_id")
        .range(from, to),
    ),
  ]);
  return joinIntelligenceHome(customers, metrics);
}
