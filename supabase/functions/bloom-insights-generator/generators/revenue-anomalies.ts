import type { GeneratedInsight, ServiceClient } from "../types.ts";
import {
  buildExpiresAt,
  formatCurrencyValue,
  REVENUE_INSIGHT_EXPIRY_DAYS,
  toFiniteNumber,
} from "../utils.ts";

interface RevenueRange {
  start: string;
  end: string;
}

function buildRange(start: Date, end: Date): RevenueRange {
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function shiftDays(source: Date, days: number) {
  return new Date(source.getTime() + days * 86_400_000);
}

async function loadConnectedPosConnectionIds(
  serviceClient: ServiceClient,
  tenantId: string,
) {
  const [posConnections, squareConnections, cloverConnections] =
    await Promise.all([
      serviceClient
        .from("pos_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      serviceClient
        .from("square_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "connected"]),
      serviceClient
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

async function loadRevenueForRange(
  serviceClient: ServiceClient,
  tenantId: string,
  connectionIds: string[],
  range: RevenueRange,
) {
  const [posOrders, shopifyOrders, lightspeedSales] = await Promise.all([
    connectionIds.length > 0
      ? serviceClient
          .from("pos_orders")
          .select("total_amount, refund_amount")
          .in("pos_connection_id", connectionIds)
          .gte("order_date", range.start)
          .lt("order_date", range.end)
      : Promise.resolve({ data: [], error: null }),
    serviceClient
      .from("shopify_orders")
      .select("total_price")
      .eq("tenant_id", tenantId)
      .or(
        `and(order_date.gte.${range.start},order_date.lt.${range.end}),and(order_date.is.null,created_at.gte.${range.start},created_at.lt.${range.end})`,
      ),
    serviceClient
      .from("lightspeed_sales")
      .select("total_amount")
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

  return posRevenue + shopifyRevenue + lightspeedRevenue;
}

export async function generateInsights(
  serviceClient: ServiceClient,
  tenantId: string,
  now = new Date(),
): Promise<GeneratedInsight[]> {
  const connectionIds = await loadConnectedPosConnectionIds(
    serviceClient,
    tenantId,
  );
  const currentRange = buildRange(shiftDays(now, -7), now);
  const previousRanges = [4, 3, 2, 1].map((offset) =>
    buildRange(
      shiftDays(now, -(7 * (offset + 1))),
      shiftDays(now, -(7 * offset)),
    ),
  );

  const [currentRevenue, ...previousRevenues] = await Promise.all([
    loadRevenueForRange(serviceClient, tenantId, connectionIds, currentRange),
    ...previousRanges.map((range) =>
      loadRevenueForRange(serviceClient, tenantId, connectionIds, range),
    ),
  ]);

  const movingAverage =
    previousRevenues.reduce((sum, value) => sum + value, 0) /
    previousRevenues.length;

  if (movingAverage <= 0) {
    return [];
  }

  const deviationRatio = (currentRevenue - movingAverage) / movingAverage;
  if (Math.abs(deviationRatio) <= 0.3) {
    return [];
  }

  const deviationPercent = Math.round(Math.abs(deviationRatio) * 100);
  const positiveAnomaly = deviationRatio > 0;

  return [
    {
      insightType: "revenue_anomaly",
      title: positiveAnomaly
        ? `Revenue is up ${deviationPercent}% this week — ${formatCurrencyValue(currentRevenue)} vs ${formatCurrencyValue(movingAverage)} average`
        : `Revenue dropped ${deviationPercent}% this week`,
      description: positiveAnomaly
        ? "Bloom compared the last 7 days against your prior four weekly revenue windows and found a positive spike."
        : `This week brought in ${formatCurrencyValue(currentRevenue)} versus a ${formatCurrencyValue(movingAverage)} 4-week average.`,
      actionPrompt:
        "Break down this week's revenue by channel and identify what changed",
      entityType: null,
      entityId: null,
      severity: positiveAnomaly ? "info" : "warning",
      expiresAt: buildExpiresAt(REVENUE_INSIGHT_EXPIRY_DAYS, now),
    },
  ];
}
