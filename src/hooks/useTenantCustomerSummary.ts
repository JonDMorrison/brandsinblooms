import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TenantCustomerSummary = {
  total_customers: number;
  active_customers: number;
  total_revenue: number;
  lifetime_revenue: number;
  new_customers_30d: number;
  revenue_30d: number;
};

interface TenantCustomerSummaryRpcRow {
  total_customers: unknown;
  active_customers: unknown;
  total_revenue: unknown;
  lifetime_revenue: unknown;
  new_customers_30d: unknown;
  revenue_30d: unknown;
}

const SUMMARY_STALE_TIME_MS = 60_000;

const EMPTY_SUMMARY: TenantCustomerSummary = {
  total_customers: 0,
  active_customers: 0,
  total_revenue: 0,
  lifetime_revenue: 0,
  new_customers_30d: 0,
  revenue_30d: 0,
};

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export async function fetchTenantCustomerSummary(
  tenantId: string,
): Promise<TenantCustomerSummary> {
  const { data, error } = await supabase.rpc(
    "get_tenant_customer_summary" as never,
    { target_tenant_id: tenantId } as never,
  );

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | TenantCustomerSummaryRpcRow
    | null
    | undefined;

  if (!row) {
    return EMPTY_SUMMARY;
  }

  return {
    total_customers: toFiniteNumber(row.total_customers),
    active_customers: toFiniteNumber(row.active_customers),
    total_revenue: toFiniteNumber(row.total_revenue),
    lifetime_revenue: toFiniteNumber(row.lifetime_revenue),
    new_customers_30d: toFiniteNumber(row.new_customers_30d),
    revenue_30d: toFiniteNumber(row.revenue_30d),
  };
}

export function useTenantCustomerSummary(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["tenant-customer-summary", tenantId],
    enabled: Boolean(tenantId),
    queryFn: () => fetchTenantCustomerSummary(tenantId as string),
    staleTime: SUMMARY_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
