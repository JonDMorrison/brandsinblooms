import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SegmentDataAvailability } from "@/lib/crm/systemSegmentDataAvailability";

type ExistsResult = { data: unknown[] | null; error: unknown };

const toExists = async (request: PromiseLike<ExistsResult>) => {
  const { data, error } = await request;
  if (error) {
    throw error;
  }
  return (data?.length ?? 0) > 0;
};

/**
 * Whether the tenant has any customer with the data each built-in group's
 * rule reads. One tiny tenant-scoped "exists" query (limit 1) per field.
 * Numeric columns default to 0, so "has data" means > 0 there.
 */
export async function fetchSystemSegmentDataAvailability(
  tenantId: string,
): Promise<SegmentDataAvailability> {
  const liveCustomers = () =>
    supabase
      .from("crm_customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

  const [
    firstPurchaseDate,
    lastPurchaseDate,
    totalSpent,
    posOrderCount,
    tags,
    perks,
  ] = await Promise.all([
    toExists(liveCustomers().not("first_purchase_date", "is", null).limit(1)),
    toExists(liveCustomers().not("last_purchase_date", "is", null).limit(1)),
    toExists(liveCustomers().gt("total_spent", 0).limit(1)),
    toExists(liveCustomers().gt("pos_order_count", 0).limit(1)),
    toExists(
      liveCustomers().not("tags", "is", null).neq("tags", "{}").limit(1),
    ),
    toExists(
      supabase
        .from("customer_loyalty_metrics")
        .select("customer_id")
        .eq("tenant_id", tenantId)
        .eq("is_perks_member", true)
        .limit(1),
    ),
  ]);

  return {
    first_purchase_date: firstPurchaseDate,
    last_purchase_date: lastPurchaseDate,
    total_spent: totalSpent,
    pos_order_count: posOrderCount,
    tags,
    is_perks_member: perks,
  };
}

export function useSystemSegmentDataAvailability(tenantId: string | null) {
  return useQuery({
    queryKey: ["system-segment-data-availability", tenantId],
    enabled: Boolean(tenantId),
    queryFn: () => {
      if (!tenantId) {
        throw new Error("Tenant is required");
      }
      return fetchSystemSegmentDataAvailability(tenantId);
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
