import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  getQueryClient,
  isRecord,
  toNumberOrNull,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type CampaignRow = Pick<
  Database["public"]["Tables"]["crm_campaigns"]["Row"],
  | "id"
  | "tenant_id"
  | "name"
  | "subject_line"
  | "status"
  | "delivery_method"
  | "created_at"
  | "queued_at"
  | "sent_at"
  | "send_completed_at"
  | "metrics"
  | "open_rate"
  | "click_rate"
  | "total_sent"
  | "total_opens"
  | "total_clicks"
  | "total_recipients"
  | "messages_sent"
  | "messages_failed"
  | "messages_skipped"
  | "rollup_refreshed_at"
>;

type CampaignMetrics = {
  total_recipients: number;
  delivered_count: number;
  delivery_rate: number;
  open_count: number;
  open_rate: number;
  unique_open_count: number;
  click_count: number;
  click_rate: number;
  unique_click_count: number;
  bounce_count: number;
  bounce_rate: number;
  unsubscribe_count: number;
  spam_complaint_count: number;
  failure_count: number;
  skipped_count: number;
  click_to_open_rate: number;
  revenue_attributed: number | null;
  conversion_rate: number | null;
  list_growth_impact: number | null;
  reach_score: number;
  interaction_score: number;
  computed_at: string | null;
};

type MetricName =
  | "delivery_rate"
  | "open_rate"
  | "click_rate"
  | "bounce_rate"
  | "click_to_open_rate"
  | "delivered_count"
  | "open_count"
  | "click_count"
  | "unsubscribe_count"
  | "spam_complaint_count"
  | "total_recipients"
  | "failure_count"
  | "revenue_attributed"
  | "conversion_rate";

const CAMPAIGN_SELECT = `
  id,
  tenant_id,
  name,
  subject_line,
  status,
  delivery_method,
  created_at,
  queued_at,
  sent_at,
  send_completed_at,
  metrics,
  open_rate,
  click_rate,
  total_sent,
  total_opens,
  total_clicks,
  total_recipients,
  messages_sent,
  messages_failed,
  messages_skipped,
  rollup_refreshed_at
`;

const RECENT_RECOMPUTE_MS = 48 * 60 * 60 * 1000;
const BEST_WORST_SAMPLE_SIZE = 20;
const DEFAULT_RESULT_LIMIT = 5;

function createResult(args: {
  success: boolean;
  data?: JsonValue | null;
  count?: number | null;
  message: string;
  error?: string | null;
  blockType?: ToolResult["block_type"];
}): ToolResult {
  return {
    success: args.success,
    data: args.data ?? null,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType ?? "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function errorResult(
  message: string,
  error = "campaign_analytics_error",
): ToolResult {
  return createResult({ success: false, message, error, blockType: "text" });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function readInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : fallback;
}

function firstNumber(values: unknown[], fallback = 0): number {
  for (const value of values) {
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
  }

  return fallback;
}

function nullableNumber(values: unknown[]): number | null {
  for (const value of values) {
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
  }

  return null;
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

function percentage(numerator: number, denominator: number): number {
  return denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 0;
}

function normalizeMetricName(rawValue: unknown): MetricName {
  const value = readString(rawValue)?.toLowerCase() ?? "open_rate";
  switch (value) {
    case "opens":
    case "open_count":
      return "open_count";
    case "clicks":
    case "click_count":
      return "click_count";
    case "delivery":
    case "delivery_rate":
      return "delivery_rate";
    case "recipients":
    case "recipient_count":
    case "total_recipients":
      return "total_recipients";
    case "failures":
    case "failure_count":
      return "failure_count";
    case "delivered":
    case "delivered_count":
      return "delivered_count";
    case "click_rate":
      return "click_rate";
    case "bounce_rate":
      return "bounce_rate";
    case "unsubscribe_count":
    case "unsubscribes":
      return "unsubscribe_count";
    case "spam_complaint_count":
    case "complaints":
      return "spam_complaint_count";
    case "click_to_open_rate":
    case "ctor":
      return "click_to_open_rate";
    case "revenue_attributed":
    case "revenue":
      return "revenue_attributed";
    case "conversion_rate":
      return "conversion_rate";
    case "all":
    case "open_rate":
    default:
      return "open_rate";
  }
}

function extractCampaignMetrics(row: CampaignRow): CampaignMetrics {
  const metrics = isRecord(row.metrics) ? row.metrics : null;
  const totals = nestedRecord(metrics, "totals") ?? metrics ?? {};
  const rates = nestedRecord(metrics, "rates") ?? {};
  const scores = nestedRecord(metrics, "scores") ?? {};

  const totalRecipients = firstNumber([
    totals.sent,
    row.total_recipients,
    row.total_sent,
    row.messages_sent,
  ]);
  const deliveredCount = firstNumber([
    totals.delivered,
    totals.successful_reach,
    row.total_sent,
    row.messages_sent,
  ]);
  const openCount = firstNumber([totals.opens, totals.opened, row.total_opens]);
  const clickCount = firstNumber([
    totals.clicks,
    totals.clicked,
    row.total_clicks,
  ]);
  const bounceCount = firstNumber([
    totals.hard_bounces,
    totals.bounces,
    totals.bounced,
    row.messages_failed,
  ]);
  const uniqueOpenCount = firstNumber([
    totals.unique_opens,
    totals.opens_non_mpp,
    totals.opens,
    row.total_opens,
  ]);
  const uniqueClickCount = firstNumber([
    totals.unique_clicks,
    totals.clicks,
    row.total_clicks,
  ]);

  return {
    total_recipients: totalRecipients,
    delivered_count: deliveredCount,
    delivery_rate: firstNumber(
      [rates.delivery],
      percentage(deliveredCount, totalRecipients),
    ),
    open_count: openCount,
    open_rate: firstNumber(
      [rates.open_reported, row.open_rate],
      percentage(openCount, deliveredCount),
    ),
    unique_open_count: uniqueOpenCount,
    click_count: clickCount,
    click_rate: firstNumber(
      [rates.click, row.click_rate],
      percentage(clickCount, deliveredCount),
    ),
    unique_click_count: uniqueClickCount,
    bounce_count: bounceCount,
    bounce_rate: firstNumber(
      [rates.bounce],
      percentage(bounceCount, totalRecipients),
    ),
    unsubscribe_count: firstNumber([totals.unsubscribes, totals.unsubscribed]),
    spam_complaint_count: firstNumber([totals.complaints, totals.complained]),
    failure_count: firstNumber([
      row.messages_failed,
      totals.failures,
      totals.failed,
    ]),
    skipped_count: firstNumber([row.messages_skipped, totals.skipped]),
    click_to_open_rate: firstNumber(
      [rates.click_to_open],
      percentage(clickCount, openCount),
    ),
    revenue_attributed: nullableNumber([
      metrics?.revenue,
      metrics?.revenue_attributed,
    ]),
    conversion_rate: nullableNumber([
      rates.conversion,
      metrics?.conversion_rate,
    ]),
    list_growth_impact: nullableNumber([metrics?.list_growth_impact]),
    reach_score: firstNumber([scores.reach]),
    interaction_score: firstNumber([scores.interaction]),
    computed_at: readString(metrics?.computed_at),
  };
}

function metricValue(metrics: CampaignMetrics, metric: MetricName): number {
  return metrics[metric] ?? 0;
}

function sentTimestamp(row: CampaignRow): string | null {
  return (
    row.sent_at ?? row.send_completed_at ?? row.queued_at ?? row.created_at
  );
}

function shouldRecompute(row: CampaignRow): boolean {
  const sentAt = row.sent_at ?? row.send_completed_at;
  if (!sentAt) {
    return false;
  }

  const sentTime = Date.parse(sentAt);
  return (
    Number.isFinite(sentTime) && Date.now() - sentTime <= RECENT_RECOMPUTE_MS
  );
}

async function recomputeIfRecent(
  client: BloomQueryClient,
  row: CampaignRow,
): Promise<CampaignRow> {
  if (!shouldRecompute(row)) {
    return row;
  }

  const { data, error } = await client.rpc("recompute_campaign_metrics", {
    p_campaign_id: row.id,
  });

  if (error) {
    throw error;
  }

  return isRecord(data)
    ? {
        ...row,
        metrics: data as CampaignRow["metrics"],
        rollup_refreshed_at: new Date().toISOString(),
      }
    : row;
}

async function recomputeRowsIfRecent(
  client: BloomQueryClient,
  rows: CampaignRow[],
): Promise<CampaignRow[]> {
  const refreshedRows: CampaignRow[] = [];
  for (const row of rows) {
    refreshedRows.push(await recomputeIfRecent(client, row));
  }
  return refreshedRows;
}

function mapMetricCard(row: CampaignRow): JsonObject {
  const metrics = extractCampaignMetrics(row);
  return {
    tenant_id: row.tenant_id,
    campaign_id: row.id,
    campaign_name: row.name,
    subject_line: row.subject_line,
    status: row.status,
    delivery_method: row.delivery_method,
    sent_at: row.sent_at,
    rollup_refreshed_at: row.rollup_refreshed_at,
    metrics,
    key_metrics: {
      delivered: metrics.delivered_count,
      open_rate: metrics.open_rate,
      click_rate: metrics.click_rate,
      bounce_rate: metrics.bounce_rate,
    },
    derived_metrics: {
      revenue_attributed: metrics.revenue_attributed,
      conversion_rate: metrics.conversion_rate,
      list_growth_impact: metrics.list_growth_impact,
      click_to_open_rate: metrics.click_to_open_rate,
      reach_score: metrics.reach_score,
      interaction_score: metrics.interaction_score,
    },
  };
}

function mapTableRow(row: CampaignRow): JsonObject {
  const metrics = extractCampaignMetrics(row);
  return {
    tenant_id: row.tenant_id,
    campaign_id: row.id,
    campaign_name: row.name,
    subject_line: row.subject_line,
    sent_at: row.sent_at,
    status: row.status,
    total_recipients: metrics.total_recipients,
    delivered_count: metrics.delivered_count,
    delivery_rate: metrics.delivery_rate,
    open_rate: metrics.open_rate,
    click_rate: metrics.click_rate,
    bounce_rate: metrics.bounce_rate,
    unsubscribe_count: metrics.unsubscribe_count,
    spam_complaint_count: metrics.spam_complaint_count,
    revenue_attributed: metrics.revenue_attributed,
    metrics,
  };
}

async function fetchCampaignsByIds(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  campaignIds: string[],
): Promise<CampaignRow[]> {
  const { data, error } = await client
    .from("crm_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("tenant_id", context.tenantId)
    .in("id", campaignIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CampaignRow[];
  const order = new Map(campaignIds.map((id, index) => [id, index]));
  return rows.sort(
    (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
  );
}

function missingCampaignIds(
  requestedIds: string[],
  rows: CampaignRow[],
): string[] {
  const foundIds = new Set(rows.map((row) => row.id));
  return requestedIds.filter((id) => !foundIds.has(id));
}

function dateRangeFromParams(params: JsonObject): {
  start: string;
  end: string;
} {
  const explicitStart = readString(params.start_date);
  const explicitEnd = readString(params.end_date);
  if (explicitStart && explicitEnd) {
    return { start: explicitStart, end: explicitEnd };
  }

  const now = new Date();
  const start = new Date(now);
  const range = readString(params.date_range) ?? "last_30_days";

  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString() };
    case "yesterday": {
      const yesterdayStart = new Date(now);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return {
        start: yesterdayStart.toISOString(),
        end: yesterdayEnd.toISOString(),
      };
    }
    case "last_7_days":
      start.setDate(start.getDate() - 7);
      return { start: start.toISOString(), end: now.toISOString() };
    case "this_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        end: now.toISOString(),
      };
    case "this_quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), quarterStartMonth, 1).toISOString(),
        end: now.toISOString(),
      };
    }
    case "this_year":
      return {
        start: new Date(now.getFullYear(), 0, 1).toISOString(),
        end: now.toISOString(),
      };
    case "last_30_days":
    default:
      start.setDate(start.getDate() - 30);
      return { start: start.toISOString(), end: now.toISOString() };
  }
}

async function singleCampaignAnalytics(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  campaignId: string,
): Promise<ToolResult> {
  const rows = await fetchCampaignsByIds(client, context, [campaignId]);
  if (rows.length === 0) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  const row = await recomputeIfRecent(client, rows[0]);
  return createResult({
    success: true,
    message: `Loaded analytics for campaign "${row.name}".`,
    blockType: "stat_card",
    data: mapMetricCard(row),
    count: 1,
  });
}

async function comparisonAnalytics(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  campaignIds: string[],
): Promise<ToolResult> {
  if (campaignIds.length < 2 || campaignIds.length > 5) {
    return errorResult(
      "Campaign comparison requires 2 to 5 campaign IDs.",
      "validation_error",
    );
  }

  const rows = await fetchCampaignsByIds(client, context, campaignIds);
  const missingIds = missingCampaignIds(campaignIds, rows);
  if (missingIds.length > 0) {
    return errorResult(
      "One or more campaigns were not found for this tenant.",
      "not_found",
    );
  }

  const refreshedRows = await recomputeRowsIfRecent(client, rows);
  const tableRows = refreshedRows.map(mapTableRow) as JsonArray;

  return createResult({
    success: true,
    message: `Compared ${tableRows.length} campaigns.`,
    blockType: "data_table",
    data: tableRows,
    count: tableRows.length,
  });
}

async function bestWorstAnalytics(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  params: JsonObject,
): Promise<ToolResult> {
  const metric = normalizeMetricName(params.metric);
  const direction =
    readString(params.sort_direction) ??
    readString(params.analysis_type) ??
    "best";
  const ascending = direction === "worst" || direction === "asc";
  const limit = Math.max(
    1,
    Math.min(10, readInteger(params.limit, DEFAULT_RESULT_LIMIT)),
  );
  const { data, error } = await client
    .from("crm_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("tenant_id", context.tenantId)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(BEST_WORST_SAMPLE_SIZE);

  if (error) {
    throw error;
  }

  const rows = await recomputeRowsIfRecent(
    client,
    (data ?? []) as CampaignRow[],
  );
  const sortedRows = rows
    .map((row) => ({ row, metrics: extractCampaignMetrics(row) }))
    .sort((left, right) => {
      const diff =
        metricValue(left.metrics, metric) - metricValue(right.metrics, metric);
      return ascending ? diff : -diff;
    })
    .slice(0, limit)
    .map(({ row }) => mapTableRow(row)) as JsonArray;

  return createResult({
    success: true,
    message: `${ascending ? "Lowest" : "Highest"} ${metric.replaceAll("_", " ")} campaigns from the last ${BEST_WORST_SAMPLE_SIZE} sent campaigns.`,
    blockType: "data_table",
    data: sortedRows,
    count: sortedRows.length,
  });
}

async function timeSeriesAnalytics(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  params: JsonObject,
): Promise<ToolResult> {
  const metric = normalizeMetricName(params.metric);
  const range = dateRangeFromParams(params);
  const { data, error } = await client
    .from("crm_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("tenant_id", context.tenantId)
    .gte("sent_at", range.start)
    .lte("sent_at", range.end)
    .order("sent_at", { ascending: true })
    .limit(100);

  if (error) {
    throw error;
  }

  const rows = await recomputeRowsIfRecent(
    client,
    (data ?? []) as CampaignRow[],
  );
  const series = rows.map((row) => {
    const metrics = extractCampaignMetrics(row);
    return {
      tenant_id: row.tenant_id,
      campaign_id: row.id,
      campaign_name: row.name,
      send_date: sentTimestamp(row),
      metric,
      value: metricValue(metrics, metric),
      metrics,
    };
  }) as JsonArray;

  return createResult({
    success: true,
    message: `Loaded ${series.length} campaign analytics points for ${metric.replaceAll("_", " ")}.`,
    blockType: "chart",
    data: {
      chart_type: "line",
      x_axis: "send_date",
      y_axis: metric,
      date_range: range,
      series,
    },
    count: series.length,
  });
}

function campaignIdsFromParams(params: JsonObject): string[] {
  return uniqueStrings([
    readString(params.campaign_id),
    ...readStringArray(params.campaign_ids),
  ]);
}

export const getCampaignAnalytics: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const campaignIds = campaignIdsFromParams(params);
  const analysisType = readString(params.analysis_type);

  if (campaignIds.length === 1) {
    return await singleCampaignAnalytics(client, context, campaignIds[0]);
  }

  if (campaignIds.length > 1) {
    return await comparisonAnalytics(client, context, campaignIds);
  }

  if (
    analysisType === "time_series" ||
    readString(params.start_date) ||
    readString(params.end_date)
  ) {
    return await timeSeriesAnalytics(client, context, params);
  }

  if (
    readString(params.date_range) &&
    analysisType !== "best" &&
    analysisType !== "worst"
  ) {
    return await timeSeriesAnalytics(client, context, params);
  }

  return await bestWorstAnalytics(client, context, params);
};
