import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useTenant } from "@/hooks/useTenant";

// Non-secret columns only: never select the encrypted tokens into the browser.
const LIGHTSPEED_SUMMARY_COLUMNS =
  "id, status, retailer_name, domain_prefix, connected_at, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, customers_synced, products_synced, sales_synced" as const;

export type LightspeedConnectionSummary = Pick<
  Tables<"lightspeed_connections">,
  | "id"
  | "status"
  | "retailer_name"
  | "domain_prefix"
  | "connected_at"
  | "last_synced_at"
  | "last_customer_sync"
  | "last_product_sync"
  | "last_sales_sync"
  | "customers_synced"
  | "products_synced"
  | "sales_synced"
>;

/** The tenant's most recent Lightspeed X-Series connection, if any. */
export const useLightspeedConnectionSummary = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  const query = useQuery({
    queryKey: ["lightspeed-connection-summary", tenantId],
    queryFn: async (): Promise<LightspeedConnectionSummary | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("lightspeed_connections")
        .select(LIGHTSPEED_SUMMARY_COLUMNS)
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });

  return {
    connection: query.data ?? null,
    isLoading: query.isLoading && Boolean(tenantId),
    isError: query.isError,
    refetch: query.refetch,
  };
};
