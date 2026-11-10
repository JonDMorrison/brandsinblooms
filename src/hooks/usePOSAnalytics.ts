import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export interface CurrencySales {
  currency: string;
  orders: number;
  revenue: number;
}

export interface DailyCurrencySales extends CurrencySales {
  date: string;
}

export interface POSAnalytics {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  loyaltyMembers: number;
  totalPointsEarned: number;
  hasIntegration: boolean;
  integrationName: string | null;
  customersSynced: boolean;
  ordersSynced: boolean;
  loyaltySynced: boolean;
  lastSyncedAt: string | null;
  needsOrderSync: boolean;
  needsLoyaltySync: boolean;
  revenueCurrency: string | null;
  revenueByCurrency: CurrencySales[];
  previousRevenueByCurrency: CurrencySales[];
  dailySales: DailyCurrencySales[];
  hasMixedCurrencies: boolean;
}

const asNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function readCurrencySales(value: unknown): CurrencySales[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    const item = asRecord(entry);
    const currency = item?.currency;
    if (typeof currency !== "string" || (!/^[A-Z]{3}$/.test(currency) && currency !== "UNKNOWN")) {
      return [];
    }
    return [{
      currency,
      orders: asNumber(item.orders),
      revenue: asNumber(item.revenue),
    }];
  });
}

function readDailySales(value: unknown): DailyCurrencySales[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    const item = asRecord(entry);
    if (typeof item?.date !== "string") return [];
    const sales = readCurrencySales([item]);
    return sales.map((sale) => ({ ...sale, date: item.date as string }));
  });
}

/**
 * Reports all normalized POS providers through one tenant- and location-scoped
 * Postgres aggregate. No client-side row limit and no summing distinct currencies.
 */
export const usePOSAnalytics = (
  days = 30,
  options?: { enabled?: boolean },
) => {
  const { tenant, loading: tenantLoading } = useTenant();
  const tenantId = tenant?.id;

  return useQuery<POSAnalytics>({
    queryKey: ["pos-analytics", tenantId, days],
    enabled: Boolean(tenantId) && !tenantLoading && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!tenantId) throw new Error("Select a business to view POS analytics.");

      const [
        summaryResult,
        customersResult,
        squareResult,
        cloverResult,
        lightspeedResult,
        genericResult,
      ] = await Promise.all([
        supabase.rpc("get_pos_analytics_summary" as never, {
          p_days: days,
        } as never),
        supabase.from("crm_customers").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        supabase.from("square_connections")
          .select("merchant_name, last_synced_at")
          .eq("tenant_id", tenantId)
          .in("status", ["active", "connected"])
          .limit(1),
        supabase.from("clover_connections")
          .select("merchant_name, last_synced_at")
          .eq("tenant_id", tenantId)
          .in("status", ["active", "connected"])
          .limit(1),
        supabase.from("lightspeed_connections")
          .select("retailer_name, last_synced_at")
          .eq("tenant_id", tenantId)
          .in("status", ["active", "connected"])
          .limit(1),
        supabase.from("pos_connections")
          .select("platform, name, last_sync_at")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .limit(20),
      ]);

      if (summaryResult.error) throw summaryResult.error;
      if (customersResult.error) throw customersResult.error;
      const summary = asRecord(summaryResult.data);
      if (!summary) throw new Error("The POS reporting service returned invalid data.");

      const revenueByCurrency = readCurrencySales(summary.revenueByCurrency);
      const previousRevenueByCurrency = readCurrencySales(summary.previousRevenueByCurrency);
      const dailySales = readDailySales(summary.dailySales);
      const hasMixedCurrencies = revenueByCurrency.length > 1;
      const singleCurrency = revenueByCurrency.length === 1
        ? revenueByCurrency[0]
        : null;
      const revenueCurrency = singleCurrency?.currency === "UNKNOWN"
        ? null : singleCurrency?.currency ?? null;
      const revenue = revenueCurrency ? singleCurrency?.revenue ?? 0 : 0;
      const totalOrders = asNumber(summary.totalOrders);

      const connections = [
        ...(squareResult.data ?? []).map((row) => ({
          name: row.merchant_name || "Square",
          lastSync: row.last_synced_at,
        })),
        ...(cloverResult.data ?? []).map((row) => ({
          name: row.merchant_name || "Clover",
          lastSync: row.last_synced_at,
        })),
        ...(lightspeedResult.data ?? []).map((row) => ({
          name: row.retailer_name || "Lightspeed",
          lastSync: row.last_synced_at,
        })),
        ...(genericResult.data ?? []).map((row) => ({
          name: row.name || row.platform || "POS",
          lastSync: row.last_sync_at,
        })),
      ];
      const sourceNames = Array.isArray(summary.providers)
        ? summary.providers.filter((item): item is string => typeof item === "string")
        : [];
      const hasIntegration = connections.length > 0 || sourceNames.length > 0;
      const lastSyncedAt = connections
        .map((connection) => connection.lastSync)
        .filter((value): value is string => typeof value === "string")
        .sort().pop() ?? null;

      return {
        totalCustomers: customersResult.count ?? 0,
        totalOrders,
        totalRevenue: revenue,
        avgOrderValue: revenueCurrency && totalOrders > 0
          ? revenue / totalOrders : 0,
        loyaltyMembers: asNumber(summary.loyaltyMembers),
        totalPointsEarned: asNumber(summary.totalPointsEarned),
        hasIntegration,
        integrationName: connections.length === 1
          ? connections[0].name
          : connections.length > 1
            ? "Multiple POS sources"
            : sourceNames.length === 1 ? sourceNames[0] : sourceNames.length > 1
              ? "Multiple POS sources" : null,
        customersSynced: (customersResult.count ?? 0) > 0,
        ordersSynced: totalOrders > 0,
        loyaltySynced: asNumber(summary.loyaltyMembers) > 0,
        lastSyncedAt,
        // No recent orders do not imply the integration is broken.
        needsOrderSync: hasIntegration && connections.length > 0 && !lastSyncedAt,
        needsLoyaltySync: false,
        revenueCurrency,
        revenueByCurrency,
        previousRevenueByCurrency,
        dailySales,
        hasMixedCurrencies,
      };
    },
  });
};
