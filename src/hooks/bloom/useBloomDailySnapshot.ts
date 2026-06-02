import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SNAPSHOT_STALE_TIME_MS = 60 * 1000;
const ACTIVE_CAMPAIGN_STATUSES = [
  "active",
  "scheduled",
  "queued",
  "partially_queued",
  "sending",
  "paused",
] as const;

export interface DailySnapshot {
  revenueToday: number;
  newCustomersToday: number;
  activeCampaignsCount: number;
  pendingOrdersCount: number;
  topInsight: string | null;
}

export const EMPTY_BLOOM_DAILY_SNAPSHOT: DailySnapshot = {
  revenueToday: 0,
  newCustomersToday: 0,
  activeCampaignsCount: 0,
  pendingOrdersCount: 0,
  topInsight: null,
};

interface OrderMetrics {
  orderCount: number;
  revenue: number;
}

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function todayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: now.toISOString() };
}

function last24HourRange(now = new Date()) {
  return {
    start: new Date(now.getTime() - 86_400_000).toISOString(),
    end: now.toISOString(),
  };
}

async function loadConnectedPosConnectionIds(tenantId: string) {
  const [posConnections, squareConnections, cloverConnections] =
    await Promise.all([
      supabase
        .from("pos_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      supabase
        .from("square_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "connected"]),
      supabase
        .from("clover_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "connected"]),
    ]);

  if (posConnections.error) {
    throw posConnections.error;
  }
  if (squareConnections.error) {
    throw squareConnections.error;
  }
  if (cloverConnections.error) {
    throw cloverConnections.error;
  }

  return [
    ...(posConnections.data ?? []).map((connection) => connection.id),
    ...(squareConnections.data ?? []).map((connection) => connection.id),
    ...(cloverConnections.data ?? []).map((connection) => connection.id),
  ];
}

async function loadOrderMetrics(
  tenantId: string,
  connectionIds: string[],
  range: { start: string; end: string },
): Promise<OrderMetrics> {
  const [posOrders, shopifyOrders, lightspeedSales] = await Promise.all([
    connectionIds.length > 0
      ? supabase
          .from("pos_orders")
          .select("total_amount, refund_amount, order_date")
          .in("pos_connection_id", connectionIds)
          .gte("order_date", range.start)
          .lt("order_date", range.end)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("shopify_orders")
      .select("total_price, order_date, created_at")
      .eq("tenant_id", tenantId)
      .or(
        `and(order_date.gte.${range.start},order_date.lt.${range.end}),and(order_date.is.null,created_at.gte.${range.start},created_at.lt.${range.end})`,
      ),
    supabase
      .from("lightspeed_sales")
      .select("total_amount, sale_date")
      .eq("tenant_id", tenantId)
      .gte("sale_date", range.start)
      .lt("sale_date", range.end),
  ]);

  if (posOrders.error) {
    throw posOrders.error;
  }
  if (shopifyOrders.error) {
    throw shopifyOrders.error;
  }
  if (lightspeedSales.error) {
    throw lightspeedSales.error;
  }

  const posRevenue = (posOrders.data ?? []).reduce(
    (sum, order) =>
      sum +
      toFiniteNumber(order.total_amount) -
      toFiniteNumber(order.refund_amount),
    0,
  );
  const shopifyRevenue = (shopifyOrders.data ?? []).reduce(
    (sum, order) => sum + toFiniteNumber(order.total_price),
    0,
  );
  const lightspeedRevenue = (lightspeedSales.data ?? []).reduce(
    (sum, sale) => sum + toFiniteNumber(sale.total_amount),
    0,
  );

  return {
    orderCount:
      (posOrders.data ?? []).length +
      (shopifyOrders.data ?? []).length +
      (lightspeedSales.data ?? []).length,
    revenue: posRevenue + shopifyRevenue + lightspeedRevenue,
  };
}

async function countNewCustomersToday(
  tenantId: string,
  range: { start: string; end: string },
) {
  const { count, error } = await supabase
    .from("crm_customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .gte("created_at", range.start)
    .lt("created_at", range.end);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function countActiveCampaigns(tenantId: string) {
  const { count, error } = await supabase
    .from("crm_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("status", [...ACTIVE_CAMPAIGN_STATUSES]);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function buildTopInsight(snapshot: Omit<DailySnapshot, "topInsight">) {
  if (snapshot.revenueToday > 0 && snapshot.pendingOrdersCount > 0) {
    return `${snapshot.pendingOrdersCount} order${snapshot.pendingOrdersCount === 1 ? "" : "s"} have generated $${Math.round(snapshot.revenueToday).toLocaleString()} today.`;
  }

  if (snapshot.newCustomersToday > 0) {
    return `${snapshot.newCustomersToday} new customer${snapshot.newCustomersToday === 1 ? "" : "s"} joined today.`;
  }

  if (snapshot.activeCampaignsCount > 0) {
    return `${snapshot.activeCampaignsCount} campaign${snapshot.activeCampaignsCount === 1 ? " is" : "s are"} active or scheduled.`;
  }

  return null;
}

export async function fetchBloomDailySnapshot(
  tenantId: string,
): Promise<DailySnapshot> {
  const now = new Date();
  const today = todayRange(now);
  const last24Hours = last24HourRange(now);
  const connectionIds = await loadConnectedPosConnectionIds(tenantId);
  const [todayOrders, newCustomersToday, activeCampaignsCount, recentOrders] =
    await Promise.all([
      loadOrderMetrics(tenantId, connectionIds, today),
      countNewCustomersToday(tenantId, today),
      countActiveCampaigns(tenantId),
      loadOrderMetrics(tenantId, connectionIds, last24Hours),
    ]);
  const metrics = {
    revenueToday: todayOrders.revenue,
    newCustomersToday,
    activeCampaignsCount,
    pendingOrdersCount: recentOrders.orderCount,
  };

  return {
    ...metrics,
    topInsight: buildTopInsight(metrics),
  };
}

export function useBloomDailySnapshot(tenantId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["bloom-daily-snapshot", tenantId],
    queryFn: () =>
      tenantId
        ? fetchBloomDailySnapshot(tenantId)
        : Promise.resolve(EMPTY_BLOOM_DAILY_SNAPSHOT),
    enabled: Boolean(tenantId),
    staleTime: SNAPSHOT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data ?? EMPTY_BLOOM_DAILY_SNAPSHOT,
    isLoading: query.isLoading,
  };
}
