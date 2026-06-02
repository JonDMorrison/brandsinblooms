import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  formatCurrency,
  getQueryClient,
  isRecord,
  toNumberOrNull,
  type BloomQueryClient,
} from "./shared.ts";

type SquareConnectionRow = Pick<
  Database["public"]["Tables"]["square_connections"]["Row"],
  "id"
>;
type CloverConnectionRow = Pick<
  Database["public"]["Tables"]["clover_connections"]["Row"],
  "id"
>;
type LightspeedConnectionRow = Pick<
  Database["public"]["Tables"]["lightspeed_connections"]["Row"],
  "id"
>;
type ShopifyConnectionRow = Pick<
  Database["public"]["Tables"]["shopify_connections"]["Row"],
  "id"
>;
type PosRevenueRow = Pick<
  Database["public"]["Tables"]["pos_orders"]["Row"],
  "id" | "currency" | "order_date" | "refund_amount" | "total_amount"
>;
type ShopifyRevenueRow = Pick<
  Database["public"]["Tables"]["shopify_orders"]["Row"],
  "id" | "created_at" | "currency" | "order_date" | "total_price"
>;
type LightspeedRevenueRow = Pick<
  Database["public"]["Tables"]["lightspeed_sales"]["Row"],
  "id" | "sale_date" | "total_amount"
>;
type CampaignSummaryRow = Pick<
  Database["public"]["Tables"]["crm_campaigns"]["Row"],
  | "id"
  | "metrics"
  | "name"
  | "open_rate"
  | "sent_at"
  | "status"
  | "subject_line"
>;
type DomainEmailStatsRow =
  Database["public"]["Functions"]["get_domain_email_stats_30d"]["Returns"][number];
type DeliverabilitySummaryRow =
  Database["public"]["Views"]["deliverability_summary_30d"]["Row"];
type EmailGovernanceEventRow = Pick<
  Database["public"]["Tables"]["email_governance_email_events"]["Row"],
  "event_type"
>;

type RevenueProvider = "square" | "clover" | "shopify" | "lightspeed";
type RevenueChannel = "pos" | "online" | "platform";
type RevenueBreakdown = "total" | "by_channel" | "by_provider" | "time_series";
type RevenuePeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "custom";
type ChangeDirection = "up" | "down" | "flat";
type TrendDirection = "improving" | "stable" | "declining";
type TimeSeriesInterval = "day" | "week" | "month";

type ProviderDiscovery = {
  squareConnectionIds: string[];
  cloverConnectionIds: string[];
  lightspeedConnected: boolean;
  shopifyConnected: boolean;
};

type DateRange = {
  end: string;
  label: string;
  period: RevenuePeriod;
  start: string;
};

type RevenueOrder = {
  channel: RevenueChannel;
  currency: string | null;
  netRevenue: number;
  occurredAt: string;
  orderId: string;
  provider: RevenueProvider;
  refunds: number;
  revenue: number;
};

type RevenueTotals = {
  averageOrderValue: number;
  currency: string;
  netRevenue: number;
  orderCount: number;
  refunds: number;
  revenue: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = "USD";
const ACTIVE_CAMPAIGN_STATUSES = ["active", "sending", "scheduled"] as const;
const REVENUE_PROVIDERS: readonly RevenueProvider[] = [
  "square",
  "clover",
  "shopify",
  "lightspeed",
];

function createResult(args: {
  blockType: ToolResult["block_type"];
  count?: number | null;
  data: JsonValue | null;
  message: string;
  success?: boolean;
  error?: string | null;
}): ToolResult {
  return {
    success: args.success ?? true,
    data: args.data,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType,
    confirmation_required: false,
    confirmation_details: null,
  };
}

function errorResult(message: string, error = "analytics_error"): ToolResult {
  return createResult({
    success: false,
    data: null,
    count: 0,
    message,
    error,
    blockType: "text",
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const numberValue = toNumberOrNull(value);
  if (numberValue !== null) {
    return numberValue;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function firstFiniteNumber(values: unknown[], fallback = 0): number {
  for (const value of values) {
    const parsed = finiteNumber(value, Number.NaN);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function nestedRecord(
  source: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!source) {
    return null;
  }

  const value = source[key];
  return isRecord(value) ? value : null;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatPercent(value: number | null): string | null {
  return value === null ? null : `${round(value, 1).toLocaleString("en-US")}%`;
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return round(((current - previous) / previous) * 100, 1);
}

function changeDirection(changePercentage: number | null): ChangeDirection {
  if (changePercentage === null || Math.abs(changePercentage) < 0.1) {
    return "flat";
  }

  return changePercentage > 0 ? "up" : "down";
}

function metricCard(args: {
  key: string;
  label: string;
  rawValue: number;
  value: string;
  previousValue?: number | null;
}): JsonObject {
  const previousValue = args.previousValue ?? null;
  const changePercentage =
    previousValue === null
      ? null
      : percentageChange(args.rawValue, previousValue);

  return {
    key: args.key,
    label: args.label,
    value: args.value,
    raw_value: round(args.rawValue, 2),
    comparison_value: previousValue === null ? null : round(previousValue, 2),
    change_percentage: changePercentage,
    change_label: formatPercent(changePercentage),
    change_direction: changeDirection(changePercentage),
  };
}

function localParts(
  date: Date,
  timezone: string,
): {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const valueFor = (type: string): number => {
    const part = parts.find((item) => item.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: valueFor("year"),
    month: valueFor("month"),
    day: valueFor("day"),
    hour: valueFor("hour"),
    minute: valueFor("minute"),
    second: valueFor("second"),
  };
}

function zonedTimeToUtc(args: {
  day: number;
  hour?: number;
  minute?: number;
  month: number;
  second?: number;
  timezone: string;
  year: number;
}): Date {
  const utcGuess = Date.UTC(
    args.year,
    args.month - 1,
    args.day,
    args.hour ?? 0,
    args.minute ?? 0,
    args.second ?? 0,
    0,
  );
  const parts = localParts(new Date(utcGuess), args.timezone);
  const zonedGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );

  return new Date(utcGuess - (zonedGuess - utcGuess));
}

function localDateKey(date: Date, timezone: string): string {
  const parts = localParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function monthKey(date: Date, timezone: string): string {
  const parts = localParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function startOfLocalDay(date: Date, timezone: string): Date {
  const parts = localParts(date, timezone);
  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    timezone,
  });
}

function startOfCurrentMonth(timezone: string): Date {
  const nowParts = localParts(new Date(), timezone);
  return zonedTimeToUtc({
    year: nowParts.year,
    month: nowParts.month,
    day: 1,
    timezone,
  });
}

function shiftUtcDateDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function parseDateOnly(
  value: string,
): { day: number; month: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseCustomStart(value: string | null, timezone: string): Date | null {
  if (!value) {
    return null;
  }

  const dateOnly = parseDateOnly(value);
  if (dateOnly) {
    return zonedTimeToUtc({ ...dateOnly, timezone });
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function parseCustomEnd(value: string | null, timezone: string): Date | null {
  if (!value) {
    return null;
  }

  const dateOnly = parseDateOnly(value);
  if (dateOnly) {
    const start = zonedTimeToUtc({ ...dateOnly, timezone });
    return shiftUtcDateDays(start, 1);
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function normalizePeriod(params: JsonObject): RevenuePeriod {
  const rawPeriod =
    readString(params.period) ?? readString(params.date_range) ?? "this_month";
  switch (rawPeriod) {
    case "today":
    case "yesterday":
    case "this_week":
    case "last_7_days":
    case "last_30_days":
    case "this_month":
    case "this_quarter":
    case "this_year":
    case "custom":
      return rawPeriod;
    default:
      return "this_month";
  }
}

function resolveDateRange(
  params: JsonObject,
  timezone: string,
): DateRange | null {
  const period = normalizePeriod(params);
  const now = new Date();
  const todayStart = startOfLocalDay(now, timezone);
  const nowParts = localParts(now, timezone);
  const currentLocalDate = Date.UTC(
    nowParts.year,
    nowParts.month - 1,
    nowParts.day,
  );
  const localWeekday = new Date(currentLocalDate).getUTCDay();
  const daysSinceMonday = (localWeekday + 6) % 7;
  const weekStartDate = new Date(currentLocalDate - daysSinceMonday * DAY_MS);

  if (period === "custom") {
    const start = parseCustomStart(readString(params.start_date), timezone);
    const end = parseCustomEnd(readString(params.end_date), timezone);
    if (!start || !end || end <= start) {
      return null;
    }

    return {
      period,
      label: "custom",
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  if (period === "today") {
    return {
      period,
      label: "today",
      start: todayStart.toISOString(),
      end: now.toISOString(),
    };
  }

  if (period === "yesterday") {
    const yesterdayStart = shiftUtcDateDays(todayStart, -1);
    return {
      period,
      label: "yesterday",
      start: yesterdayStart.toISOString(),
      end: todayStart.toISOString(),
    };
  }

  if (period === "last_7_days") {
    return {
      period,
      label: "last 7 days",
      start: shiftUtcDateDays(now, -7).toISOString(),
      end: now.toISOString(),
    };
  }

  if (period === "last_30_days") {
    return {
      period,
      label: "last 30 days",
      start: shiftUtcDateDays(now, -30).toISOString(),
      end: now.toISOString(),
    };
  }

  if (period === "this_week") {
    const start = zonedTimeToUtc({
      year: weekStartDate.getUTCFullYear(),
      month: weekStartDate.getUTCMonth() + 1,
      day: weekStartDate.getUTCDate(),
      timezone,
    });
    return {
      period,
      label: "this week",
      start: start.toISOString(),
      end: now.toISOString(),
    };
  }

  if (period === "this_quarter") {
    const quarterMonth = Math.floor((nowParts.month - 1) / 3) * 3 + 1;
    const start = zonedTimeToUtc({
      year: nowParts.year,
      month: quarterMonth,
      day: 1,
      timezone,
    });
    return {
      period,
      label: "this quarter",
      start: start.toISOString(),
      end: now.toISOString(),
    };
  }

  if (period === "this_year") {
    const start = zonedTimeToUtc({
      year: nowParts.year,
      month: 1,
      day: 1,
      timezone,
    });
    return {
      period,
      label: "this year",
      start: start.toISOString(),
      end: now.toISOString(),
    };
  }

  const monthStart = zonedTimeToUtc({
    year: nowParts.year,
    month: nowParts.month,
    day: 1,
    timezone,
  });
  return {
    period,
    label: "this month",
    start: monthStart.toISOString(),
    end: now.toISOString(),
  };
}

function previousRange(range: DateRange): DateRange {
  const startMs = Date.parse(range.start);
  const endMs = Date.parse(range.end);
  const lengthMs = endMs - startMs;
  const previousEnd = new Date(startMs);
  const previousStart = new Date(startMs - lengthMs);

  return {
    period: range.period,
    label: `previous ${range.label}`,
    start: previousStart.toISOString(),
    end: previousEnd.toISOString(),
  };
}

function intervalForRange(range: DateRange): TimeSeriesInterval {
  const lengthDays = Math.ceil(
    (Date.parse(range.end) - Date.parse(range.start)) / DAY_MS,
  );
  if (lengthDays <= 30) {
    return "day";
  }
  if (lengthDays <= 90) {
    return "week";
  }

  return "month";
}

function weeklyKey(date: Date, timezone: string): string {
  const parts = localParts(date, timezone);
  const localDate = Date.UTC(parts.year, parts.month - 1, parts.day);
  const weekday = new Date(localDate).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const weekStart = new Date(localDate - daysSinceMonday * DAY_MS);
  return `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, "0")}-${String(weekStart.getUTCDate()).padStart(2, "0")}`;
}

function timeSeriesKey(
  value: string,
  interval: TimeSeriesInterval,
  timezone: string,
): string | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const date = new Date(parsed);
  if (interval === "month") {
    return monthKey(date, timezone);
  }

  if (interval === "week") {
    return weeklyKey(date, timezone);
  }

  return localDateKey(date, timezone);
}

function normalizeBreakdown(params: JsonObject): RevenueBreakdown {
  const rawBreakdown = readString(params.breakdown) ?? "total";
  switch (rawBreakdown) {
    case "by_channel":
    case "by_provider":
    case "time_series":
    case "total":
      return rawBreakdown;
    default:
      return "total";
  }
}

function normalizeRevenueSource(params: JsonObject): RevenueProvider | "all" {
  const rawSource = readString(params.source) ?? "all";
  return REVENUE_PROVIDERS.includes(rawSource as RevenueProvider)
    ? (rawSource as RevenueProvider)
    : "all";
}

function providerChannel(provider: RevenueProvider): RevenueChannel {
  return provider === "shopify" ? "online" : "pos";
}

function providerLabel(provider: RevenueProvider): string {
  switch (provider) {
    case "square":
      return "Square";
    case "clover":
      return "Clover";
    case "shopify":
      return "Shopify";
    case "lightspeed":
      return "Lightspeed";
  }
}

function channelLabel(channel: RevenueChannel): string {
  switch (channel) {
    case "pos":
      return "POS";
    case "online":
      return "Online";
    case "platform":
      return "Platform";
  }
}

function sourceAllowsProvider(
  source: RevenueProvider | "all",
  provider: RevenueProvider,
): boolean {
  return source === "all" || source === provider;
}

async function discoverProviders(
  client: BloomQueryClient,
  context: ToolExecutionContext,
): Promise<ProviderDiscovery> {
  const [squareResponse, cloverResponse, lightspeedResponse, shopifyResponse] =
    await Promise.all([
      client
        .from("square_connections")
        .select("id")
        .eq("tenant_id", context.tenantId)
        .eq("user_id", context.userId)
        .eq("status", "connected"),
      client
        .from("clover_connections")
        .select("id")
        .eq("tenant_id", context.tenantId)
        .eq("user_id", context.userId)
        .eq("status", "connected"),
      client
        .from("lightspeed_connections")
        .select("id")
        .eq("tenant_id", context.tenantId)
        .eq("user_id", context.userId)
        .eq("status", "connected"),
      client
        .from("shopify_connections")
        .select("id")
        .eq("tenant_id", context.tenantId)
        .eq("user_id", context.userId)
        .eq("status", "connected"),
    ]);

  if (squareResponse.error) {
    throw squareResponse.error;
  }
  if (cloverResponse.error) {
    throw cloverResponse.error;
  }
  if (lightspeedResponse.error) {
    throw lightspeedResponse.error;
  }
  if (shopifyResponse.error) {
    throw shopifyResponse.error;
  }

  return {
    squareConnectionIds: (
      (squareResponse.data ?? []) as SquareConnectionRow[]
    ).map((row) => row.id),
    cloverConnectionIds: (
      (cloverResponse.data ?? []) as CloverConnectionRow[]
    ).map((row) => row.id),
    lightspeedConnected:
      ((lightspeedResponse.data ?? []) as LightspeedConnectionRow[]).length > 0,
    shopifyConnected:
      ((shopifyResponse.data ?? []) as ShopifyConnectionRow[]).length > 0,
  };
}

function mapPosRevenueOrder(
  row: PosRevenueRow,
  provider: "square" | "clover",
): RevenueOrder {
  const revenue = finiteNumber(row.total_amount);
  const refunds = finiteNumber(row.refund_amount);
  return {
    orderId: row.id,
    provider,
    channel: providerChannel(provider),
    occurredAt: row.order_date,
    revenue,
    refunds,
    netRevenue: revenue - refunds,
    currency: row.currency,
  };
}

function mapShopifyRevenueOrder(row: ShopifyRevenueRow): RevenueOrder {
  const revenue = finiteNumber(row.total_price);
  return {
    orderId: row.id,
    provider: "shopify",
    channel: "online",
    occurredAt: row.order_date ?? row.created_at,
    revenue,
    refunds: 0,
    netRevenue: revenue,
    currency: row.currency,
  };
}

function mapLightspeedRevenueOrder(row: LightspeedRevenueRow): RevenueOrder {
  const revenue = finiteNumber(row.total_amount);
  return {
    orderId: row.id,
    provider: "lightspeed",
    channel: "pos",
    occurredAt: row.sale_date,
    revenue,
    refunds: 0,
    netRevenue: revenue,
    currency: null,
  };
}

async function loadPosRevenueOrders(
  client: BloomQueryClient,
  connectionIds: string[],
  provider: "square" | "clover",
  range: DateRange,
): Promise<RevenueOrder[]> {
  if (connectionIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("pos_orders")
    .select("id, currency, order_date, refund_amount, total_amount")
    .in("pos_connection_id", connectionIds)
    .gte("order_date", range.start)
    .lt("order_date", range.end);

  if (error) {
    throw error;
  }

  return ((data ?? []) as PosRevenueRow[]).map((row) =>
    mapPosRevenueOrder(row, provider),
  );
}

async function loadShopifyRevenueOrders(
  client: BloomQueryClient,
  tenantId: string,
  enabled: boolean,
  range: DateRange,
): Promise<RevenueOrder[]> {
  if (!enabled) {
    return [];
  }

  const { data, error } = await client
    .from("shopify_orders")
    .select("id, created_at, currency, order_date, total_price")
    .eq("tenant_id", tenantId)
    .or(
      `and(order_date.gte.${range.start},order_date.lt.${range.end}),and(order_date.is.null,created_at.gte.${range.start},created_at.lt.${range.end})`,
    );

  if (error) {
    throw error;
  }

  return ((data ?? []) as ShopifyRevenueRow[]).map(mapShopifyRevenueOrder);
}

async function loadLightspeedRevenueOrders(
  client: BloomQueryClient,
  tenantId: string,
  enabled: boolean,
  range: DateRange,
): Promise<RevenueOrder[]> {
  if (!enabled) {
    return [];
  }

  const { data, error } = await client
    .from("lightspeed_sales")
    .select("id, sale_date, total_amount")
    .eq("tenant_id", tenantId)
    .gte("sale_date", range.start)
    .lt("sale_date", range.end);

  if (error) {
    throw error;
  }

  return ((data ?? []) as LightspeedRevenueRow[]).map(
    mapLightspeedRevenueOrder,
  );
}

async function loadRevenueOrders(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  range: DateRange,
  source: RevenueProvider | "all" = "all",
): Promise<RevenueOrder[]> {
  const providers = await discoverProviders(client, context);
  const [squareOrders, cloverOrders, shopifyOrders, lightspeedOrders] =
    await Promise.all([
      sourceAllowsProvider(source, "square")
        ? loadPosRevenueOrders(
            client,
            providers.squareConnectionIds,
            "square",
            range,
          )
        : Promise.resolve([]),
      sourceAllowsProvider(source, "clover")
        ? loadPosRevenueOrders(
            client,
            providers.cloverConnectionIds,
            "clover",
            range,
          )
        : Promise.resolve([]),
      sourceAllowsProvider(source, "shopify")
        ? loadShopifyRevenueOrders(
            client,
            context.tenantId,
            providers.shopifyConnected,
            range,
          )
        : Promise.resolve([]),
      sourceAllowsProvider(source, "lightspeed")
        ? loadLightspeedRevenueOrders(
            client,
            context.tenantId,
            providers.lightspeedConnected,
            range,
          )
        : Promise.resolve([]),
    ]);

  return [
    ...squareOrders,
    ...cloverOrders,
    ...shopifyOrders,
    ...lightspeedOrders,
  ];
}

function revenueTotals(orders: RevenueOrder[]): RevenueTotals {
  const revenue = orders.reduce((sum, order) => sum + order.revenue, 0);
  const refunds = orders.reduce((sum, order) => sum + order.refunds, 0);
  const netRevenue = orders.reduce((sum, order) => sum + order.netRevenue, 0);
  const orderCount = orders.length;
  const currency =
    orders.find((order) => order.currency)?.currency ?? DEFAULT_CURRENCY;

  return {
    revenue: round(revenue, 2),
    refunds: round(refunds, 2),
    netRevenue: round(netRevenue, 2),
    orderCount,
    averageOrderValue: orderCount > 0 ? round(revenue / orderCount, 2) : 0,
    currency,
  };
}

function revenueMetricValue(
  totals: RevenueTotals,
  metric: string | null,
): number {
  switch (metric) {
    case "order_count":
      return totals.orderCount;
    case "average_order_value":
      return totals.averageOrderValue;
    case "refunds":
      return totals.refunds;
    case "total_revenue":
    default:
      return totals.revenue;
  }
}

function comparisonPayload(current: number, previous: number): JsonObject {
  const changePercentage = percentageChange(current, previous);
  return {
    current_value: round(current, 2),
    previous_value: round(previous, 2),
    change_percentage: changePercentage,
    change_label: formatPercent(changePercentage),
    change_direction: changeDirection(changePercentage),
  };
}

function totalsPayload(totals: RevenueTotals): JsonObject {
  return {
    revenue: totals.revenue,
    formatted_revenue: formatCurrency(totals.revenue, totals.currency),
    net_revenue: totals.netRevenue,
    formatted_net_revenue: formatCurrency(totals.netRevenue, totals.currency),
    refunds: totals.refunds,
    formatted_refunds: formatCurrency(totals.refunds, totals.currency),
    order_count: totals.orderCount,
    average_order_value: totals.averageOrderValue,
    formatted_average_order_value: formatCurrency(
      totals.averageOrderValue,
      totals.currency,
    ),
    currency: totals.currency,
  };
}

function providerRows(orders: RevenueOrder[], tenantId: string): JsonArray {
  return REVENUE_PROVIDERS.map((provider) => {
    const providerOrders = orders.filter(
      (order) => order.provider === provider,
    );
    const totals = revenueTotals(providerOrders);
    return {
      tenant_id: tenantId,
      provider,
      provider_label: providerLabel(provider),
      channel: providerChannel(provider),
      revenue: totals.revenue,
      formatted_revenue: formatCurrency(totals.revenue, totals.currency),
      net_revenue: totals.netRevenue,
      order_count: totals.orderCount,
      average_order_value: totals.averageOrderValue,
      formatted_average_order_value: formatCurrency(
        totals.averageOrderValue,
        totals.currency,
      ),
    } as JsonObject;
  });
}

function channelRows(orders: RevenueOrder[]): JsonArray {
  const channels: RevenueChannel[] = ["pos", "online", "platform"];
  return channels.map((channel) => {
    const channelOrders = orders.filter((order) => order.channel === channel);
    const totals = revenueTotals(channelOrders);
    return {
      channel,
      channel_label: channelLabel(channel),
      revenue: totals.revenue,
      formatted_revenue: formatCurrency(totals.revenue, totals.currency),
      net_revenue: totals.netRevenue,
      order_count: totals.orderCount,
      average_order_value: totals.averageOrderValue,
      formatted_average_order_value: formatCurrency(
        totals.averageOrderValue,
        totals.currency,
      ),
    } as JsonObject;
  });
}

function buildTimeSeries(
  orders: RevenueOrder[],
  range: DateRange,
  timezone: string,
): { interval: TimeSeriesInterval; series: JsonArray } {
  const interval = intervalForRange(range);
  const buckets = new Map<string, { orderCount: number; revenue: number }>();

  for (const order of orders) {
    const key = timeSeriesKey(order.occurredAt, interval, timezone);
    if (!key) {
      continue;
    }

    const bucket = buckets.get(key) ?? { revenue: 0, orderCount: 0 };
    bucket.revenue += order.revenue;
    bucket.orderCount += 1;
    buckets.set(key, bucket);
  }

  const series = Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([date, bucket]) =>
        ({
          date,
          revenue: round(bucket.revenue, 2),
          order_count: bucket.orderCount,
        }) as JsonObject,
    );

  return { interval, series };
}

async function countRows(
  query: PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>,
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function countCustomers(
  client: BloomQueryClient,
  tenantId: string,
): Promise<number> {
  return await countRows(
    client
      .from("crm_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
  );
}

async function countCustomersBefore(
  client: BloomQueryClient,
  tenantId: string,
  before: string,
): Promise<number> {
  return await countRows(
    client
      .from("crm_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .lt("created_at", before),
  );
}

async function countCustomersInRange(
  client: BloomQueryClient,
  tenantId: string,
  range: DateRange,
): Promise<number> {
  return await countRows(
    client
      .from("crm_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gte("created_at", range.start)
      .lt("created_at", range.end),
  );
}

async function countActiveCampaigns(
  client: BloomQueryClient,
  tenantId: string,
): Promise<number> {
  return await countRows(
    client
      .from("crm_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", [...ACTIVE_CAMPAIGN_STATUSES]),
  );
}

function campaignOpenRate(row: CampaignSummaryRow): number {
  const metrics = isRecord(row.metrics) ? row.metrics : null;
  const rates = nestedRecord(metrics, "rates");
  const totals = nestedRecord(metrics, "totals");
  const delivered = firstFiniteNumber([
    totals?.delivered,
    totals?.successful_reach,
    totals?.sent,
  ]);
  const opens = firstFiniteNumber([
    totals?.opens,
    totals?.opened,
    totals?.unique_opens,
  ]);

  return firstFiniteNumber(
    [rates?.open_reported, rates?.open, row.open_rate],
    delivered > 0 ? round((opens / delivered) * 100, 2) : 0,
  );
}

async function loadTopCampaign(
  client: BloomQueryClient,
  tenantId: string,
): Promise<JsonObject | null> {
  const cutoff = shiftUtcDateDays(new Date(), -30).toISOString();
  const { data, error } = await client
    .from("crm_campaigns")
    .select("id, metrics, name, open_rate, sent_at, status, subject_line")
    .eq("tenant_id", tenantId)
    .not("sent_at", "is", null)
    .gte("sent_at", cutoff)
    .order("sent_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CampaignSummaryRow[];
  const [topCampaign] = rows
    .map((row) => ({ row, openRate: campaignOpenRate(row) }))
    .sort((left, right) => right.openRate - left.openRate);

  if (!topCampaign) {
    return null;
  }

  return {
    name: topCampaign.row.name,
    subject_line: topCampaign.row.subject_line,
    status: topCampaign.row.status,
    sent_at: topCampaign.row.sent_at,
    open_rate: round(topCampaign.openRate, 2),
    formatted_open_rate: formatPercent(topCampaign.openRate),
  };
}

function dashboardMonthRanges(timezone: string): {
  current: DateRange;
  previous: DateRange;
} {
  const monthStart = startOfCurrentMonth(timezone);
  const current: DateRange = {
    period: "this_month",
    label: "this month",
    start: monthStart.toISOString(),
    end: new Date().toISOString(),
  };
  return { current, previous: previousRange(current) };
}

export const getDashboardSummary: ToolImplementation = async (
  _params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const ranges = dashboardMonthRanges(context.timezone);
  const recentRange: DateRange = {
    period: "last_7_days",
    label: "last 7 days",
    start: shiftUtcDateDays(new Date(), -7).toISOString(),
    end: new Date().toISOString(),
  };
  const previousRecentRange = previousRange(recentRange);

  const [
    totalCustomers,
    customersBeforeMonth,
    newCustomersThisMonth,
    newCustomersPreviousMonth,
    activeCampaigns,
    revenueOrders,
    previousRevenueOrders,
    recentOrders,
    previousRecentOrders,
    topCampaign,
  ] = await Promise.all([
    countCustomers(client, context.tenantId),
    countCustomersBefore(client, context.tenantId, ranges.current.start),
    countCustomersInRange(client, context.tenantId, ranges.current),
    countCustomersInRange(client, context.tenantId, ranges.previous),
    countActiveCampaigns(client, context.tenantId),
    loadRevenueOrders(client, context, ranges.current),
    loadRevenueOrders(client, context, ranges.previous),
    loadRevenueOrders(client, context, recentRange),
    loadRevenueOrders(client, context, previousRecentRange),
    loadTopCampaign(client, context.tenantId),
  ]);

  const revenue = revenueTotals(revenueOrders);
  const previousRevenue = revenueTotals(previousRevenueOrders);
  const metrics: JsonArray = [
    metricCard({
      key: "total_customers",
      label: "Customers",
      rawValue: totalCustomers,
      value: formatInteger(totalCustomers),
      previousValue: customersBeforeMonth,
    }),
    metricCard({
      key: "new_customers_this_month",
      label: "New customers this month",
      rawValue: newCustomersThisMonth,
      value: formatInteger(newCustomersThisMonth),
      previousValue: newCustomersPreviousMonth,
    }),
    metricCard({
      key: "revenue_this_month",
      label: "Revenue this month",
      rawValue: revenue.revenue,
      value: formatCurrency(revenue.revenue, revenue.currency),
      previousValue: previousRevenue.revenue,
    }),
    metricCard({
      key: "active_campaigns",
      label: "Active campaigns",
      rawValue: activeCampaigns,
      value: formatInteger(activeCampaigns),
      previousValue: null,
    }),
    metricCard({
      key: "recent_orders",
      label: "Recent orders",
      rawValue: recentOrders.length,
      value: formatInteger(recentOrders.length),
      previousValue: previousRecentOrders.length,
    }),
  ];

  const data: JsonObject = {
    tenant_id: context.tenantId,
    generated_at: new Date().toISOString(),
    comparison_period: "previous_period",
    date_range: {
      current_month: ranges.current,
      previous_month: ranges.previous,
    },
    metrics,
    top_performing_campaign: topCampaign,
  };

  return createResult({
    data,
    count: metrics.length,
    blockType: "stat_card",
    message: `Loaded ${metrics.length} dashboard KPIs for this tenant, including customers, revenue, campaigns, orders, and top campaign performance.`,
  });
};

export const getRevenueAnalytics: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const range = resolveDateRange(params, context.timezone);
  if (!range) {
    return errorResult(
      "Custom revenue analytics requires a valid start_date and end_date.",
      "validation_error",
    );
  }

  const breakdown = normalizeBreakdown(params);
  const source = normalizeRevenueSource(params);
  const metric = readString(params.metric) ?? "total_revenue";
  const comparisonEnabled = readBoolean(params.comparison, true);
  const comparisonRange = previousRange(range);
  const [orders, comparisonOrders] = await Promise.all([
    loadRevenueOrders(client, context, range, source),
    comparisonEnabled
      ? loadRevenueOrders(client, context, comparisonRange, source)
      : Promise.resolve([]),
  ]);
  const totals = revenueTotals(orders);
  const previousTotals = revenueTotals(comparisonOrders);
  const currentMetric = revenueMetricValue(totals, metric);
  const previousMetric = revenueMetricValue(previousTotals, metric);
  const commonPayload: JsonObject = {
    tenant_id: context.tenantId,
    generated_at: new Date().toISOString(),
    period: range.period,
    breakdown,
    source,
    metric,
    date_range: {
      start: range.start,
      end: range.end,
      label: range.label,
    },
    totals: totalsPayload(totals),
    comparison: comparisonEnabled
      ? {
          date_range: {
            start: comparisonRange.start,
            end: comparisonRange.end,
            label: comparisonRange.label,
          },
          ...comparisonPayload(currentMetric, previousMetric),
        }
      : null,
  };

  if (breakdown === "by_provider") {
    const rows = providerRows(orders, context.tenantId);
    return createResult({
      data: rows,
      count: rows.length,
      blockType: "data_table",
      message: `Loaded revenue by provider for ${range.label}.`,
    });
  }

  if (breakdown === "time_series") {
    const timeSeries = buildTimeSeries(orders, range, context.timezone);
    return createResult({
      data: {
        ...commonPayload,
        chart_type: "bar",
        x_axis: "date",
        y_axis: "revenue",
        interval: timeSeries.interval,
        series: timeSeries.series,
      },
      count: timeSeries.series.length,
      blockType: "chart",
      message: `Loaded ${timeSeries.series.length} revenue points for ${range.label}.`,
    });
  }

  const data: JsonObject = {
    ...commonPayload,
    channels: breakdown === "by_channel" ? channelRows(orders) : [],
    metric_cards: [
      metricCard({
        key: "revenue",
        label: "Revenue",
        rawValue: totals.revenue,
        value: formatCurrency(totals.revenue, totals.currency),
        previousValue: comparisonEnabled ? previousTotals.revenue : null,
      }),
      metricCard({
        key: "orders",
        label: "Orders",
        rawValue: totals.orderCount,
        value: formatInteger(totals.orderCount),
        previousValue: comparisonEnabled ? previousTotals.orderCount : null,
      }),
      metricCard({
        key: "average_order_value",
        label: "Average order value",
        rawValue: totals.averageOrderValue,
        value: formatCurrency(totals.averageOrderValue, totals.currency),
        previousValue: comparisonEnabled
          ? previousTotals.averageOrderValue
          : null,
      }),
    ],
  };

  return createResult({
    data,
    count: totals.orderCount,
    blockType: "stat_card",
    message: `Loaded revenue analytics for ${range.label}.`,
  });
};

function rateFromCounts(numerator: number, denominator: number): number {
  return denominator > 0 ? round((numerator / denominator) * 100, 3) : 0;
}

function normalizeRate(value: unknown): number {
  return round(finiteNumber(value), 3);
}

function domainReputationStatus(
  bounceRate: number,
  complaintRate: number,
): "good" | "warning" | "poor" {
  if (bounceRate > 5 || complaintRate > 0.2) {
    return "poor";
  }
  if (bounceRate > 2 || complaintRate > 0.1) {
    return "warning";
  }

  return "good";
}

function warmupStatus(
  stage: number | null,
): "active" | "complete" | "not_started" {
  if (stage === null || stage <= 0) {
    return "not_started";
  }
  return stage >= 4 ? "complete" : "active";
}

function deliverabilityScore(
  bounceRate: number,
  complaintRate: number,
): number {
  const bouncePenalty = Math.min(50, bounceRate * 5);
  const complaintPenalty = Math.min(30, complaintRate * 50);
  return clamp(round(100 - bouncePenalty - complaintPenalty, 0), 0, 100);
}

function emailTrend(
  recentBounceRate: number,
  thirtyDayBounceRate: number,
): TrendDirection {
  if (thirtyDayBounceRate === 0) {
    return recentBounceRate > 0 ? "declining" : "stable";
  }

  if (recentBounceRate < thirtyDayBounceRate * 0.8) {
    return "improving";
  }
  if (recentBounceRate > thirtyDayBounceRate * 1.2) {
    return "declining";
  }

  return "stable";
}

function domainMatches(
  row: DomainEmailStatsRow,
  domain: string | null,
): boolean {
  if (!domain) {
    return true;
  }

  return row.domain_name.toLowerCase() === domain.toLowerCase();
}

async function loadDomainStats(
  client: BloomQueryClient,
  tenantId: string,
  domain: string | null,
): Promise<DomainEmailStatsRow[]> {
  const { data, error } = await client.rpc("get_domain_email_stats_30d", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as DomainEmailStatsRow[]).filter((row) =>
    domainMatches(row, domain),
  );
}

async function loadDeliverabilitySummary(
  client: BloomQueryClient,
  tenantId: string,
  domain: string | null,
): Promise<DeliverabilitySummaryRow[]> {
  let query = client
    .from("deliverability_summary_30d")
    .select(
      "tenant_id, domain_name, sent_30d, delivered_30d, opened_30d, clicked_30d, bounced_30d, complained_30d, bounce_rate, complaint_rate, open_rate, click_rate",
    )
    .eq("tenant_id", tenantId);

  if (domain) {
    query = query.eq("domain_name", domain);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as DeliverabilitySummaryRow[];
}

async function loadRecentEmailEvents(
  client: BloomQueryClient,
  tenantId: string,
  domainIds: string[],
): Promise<EmailGovernanceEventRow[]> {
  const recentStart = shiftUtcDateDays(new Date(), -7).toISOString();
  let query = client
    .from("email_governance_email_events")
    .select("event_type")
    .eq("tenant_id", tenantId)
    .gte("ingested_at", recentStart)
    .lt("ingested_at", new Date().toISOString());

  if (domainIds.length > 0) {
    query = query.in("domain_id", domainIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as EmailGovernanceEventRow[];
}

function summarizeDomainStats(stats: DomainEmailStatsRow[]): {
  bounceRate: number;
  complaintRate: number;
  sent: number;
} {
  const sent = stats.reduce(
    (sum, row) => sum + finiteNumber(row.emails_sent_30d),
    0,
  );
  const bounced = stats.reduce(
    (sum, row) => sum + finiteNumber(row.emails_bounced_30d),
    0,
  );
  const complained = stats.reduce(
    (sum, row) => sum + finiteNumber(row.emails_complained_30d),
    0,
  );
  return {
    sent,
    bounceRate: rateFromCounts(bounced, sent),
    complaintRate: rateFromCounts(complained, sent),
  };
}

function summarizeRecentEvents(events: EmailGovernanceEventRow[]): {
  bounceRate: number;
  complaintRate: number;
  sent: number;
} {
  const sent = events.filter((event) => event.event_type === "sent").length;
  const bounced = events.filter(
    (event) => event.event_type === "bounced",
  ).length;
  const complained = events.filter(
    (event) => event.event_type === "complained",
  ).length;
  return {
    sent,
    bounceRate: rateFromCounts(bounced, sent),
    complaintRate: rateFromCounts(complained, sent),
  };
}

function mapDomainHealthRow(
  row: DomainEmailStatsRow,
  trend: TrendDirection,
): JsonObject {
  const bounceRate = normalizeRate(row.bounce_rate_30d);
  const complaintRate = normalizeRate(row.complaint_rate_30d);
  const warmupStage = Number.isFinite(row.warmup_stage)
    ? row.warmup_stage
    : null;
  return {
    tenant_id: row.tenant_id,
    domain_name: row.domain_name,
    verification_status: row.verification_status,
    warmup_stage: warmupStage,
    warmup_status: warmupStatus(warmupStage),
    emails_sent_30d: finiteNumber(row.emails_sent_30d),
    bounce_rate_30d: bounceRate,
    formatted_bounce_rate_30d: formatPercent(bounceRate),
    complaint_rate_30d: complaintRate,
    formatted_complaint_rate_30d: formatPercent(complaintRate),
    deliverability_score: deliverabilityScore(bounceRate, complaintRate),
    reputation_status: domainReputationStatus(bounceRate, complaintRate),
    trend_direction: trend,
  };
}

export const getEmailHealth: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const channel = readString(params.channel);
  if (channel === "sms") {
    return errorResult(
      "get_email_health only reports email deliverability metrics.",
      "unsupported_channel",
    );
  }

  const client = getQueryClient(context);
  const domain = readString(params.domain);
  const [domainStats, summaries] = await Promise.all([
    loadDomainStats(client, context.tenantId, domain),
    loadDeliverabilitySummary(client, context.tenantId, domain),
  ]);
  const domainIds = domainStats
    .map((row) => row.domain_id)
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  const recentEvents = await loadRecentEmailEvents(
    client,
    context.tenantId,
    domainIds,
  );
  const thirtyDay = summarizeDomainStats(domainStats);
  const recent = summarizeRecentEvents(recentEvents);
  const trend = emailTrend(recent.bounceRate, thirtyDay.bounceRate);
  const summarySent = summaries.reduce(
    (sum, row) => sum + finiteNumber(row.sent_30d),
    0,
  );
  const summaryBounced = summaries.reduce(
    (sum, row) => sum + finiteNumber(row.bounced_30d),
    0,
  );
  const summaryComplained = summaries.reduce(
    (sum, row) => sum + finiteNumber(row.complained_30d),
    0,
  );
  const bounceRate =
    domainStats.length > 0
      ? thirtyDay.bounceRate
      : rateFromCounts(summaryBounced, summarySent);
  const complaintRate =
    domainStats.length > 0
      ? thirtyDay.complaintRate
      : rateFromCounts(summaryComplained, summarySent);

  if (domainStats.length > 1 && !domain) {
    const rows = domainStats.map((row) =>
      mapDomainHealthRow(row, trend),
    ) as JsonArray;
    return createResult({
      data: rows,
      count: rows.length,
      blockType: "data_table",
      message: `Loaded email deliverability health for ${rows.length} sending domains. Overall bounce rate is ${formatPercent(bounceRate) ?? "0%"}.`,
    });
  }

  const selectedDomain = domainStats[0] ?? null;
  const data: JsonObject = {
    tenant_id: context.tenantId,
    generated_at: new Date().toISOString(),
    window: "30d",
    domain_name: selectedDomain?.domain_name ?? domain ?? null,
    domains_count: domainStats.length,
    sent_30d: domainStats.length > 0 ? thirtyDay.sent : summarySent,
    bounce_rate_30d: bounceRate,
    formatted_bounce_rate_30d: formatPercent(bounceRate),
    complaint_rate_30d: complaintRate,
    formatted_complaint_rate_30d: formatPercent(complaintRate),
    deliverability_score: deliverabilityScore(bounceRate, complaintRate),
    reputation_status: domainReputationStatus(bounceRate, complaintRate),
    trend_direction: trend,
    trend_basis: {
      recent_window: "7d",
      recent_sent: recent.sent,
      recent_bounce_rate: recent.bounceRate,
      thirty_day_sent: domainStats.length > 0 ? thirtyDay.sent : summarySent,
      thirty_day_bounce_rate: bounceRate,
    },
    metrics: [
      metricCard({
        key: "bounce_rate_30d",
        label: "Bounce rate",
        rawValue: bounceRate,
        value: formatPercent(bounceRate) ?? "0%",
        previousValue: recent.bounceRate,
      }),
      metricCard({
        key: "complaint_rate_30d",
        label: "Complaint rate",
        rawValue: complaintRate,
        value: formatPercent(complaintRate) ?? "0%",
        previousValue: recent.complaintRate,
      }),
      metricCard({
        key: "deliverability_score",
        label: "Deliverability score",
        rawValue: deliverabilityScore(bounceRate, complaintRate),
        value: `${deliverabilityScore(bounceRate, complaintRate)}%`,
        previousValue: null,
      }),
    ],
  };

  return createResult({
    data,
    count: domainStats.length,
    blockType: "stat_card",
    message: `Loaded 30-day email health. Bounce rate is ${formatPercent(bounceRate) ?? "0%"} and complaint rate is ${formatPercent(complaintRate) ?? "0%"}.`,
  });
};
