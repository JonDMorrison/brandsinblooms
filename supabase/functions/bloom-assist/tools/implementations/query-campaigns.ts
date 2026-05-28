import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import { applyFilters } from "../filter-engine.ts";
import type {
  ToolExecutionContext,
  ToolFilter,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  asJsonObject,
  createListResult,
  getQueryClient,
  isJunctionOperator,
  isRecord,
  normalizeSortBy,
  paginationRange,
  parseListQueryParams,
  sanitizePostgrestSearch,
  toNumberOrNull,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type CampaignRow = Pick<
  Database["public"]["Tables"]["crm_campaigns"]["Row"],
  | "id"
  | "name"
  | "subject_line"
  | "status"
  | "scheduled_at"
  | "sent_at"
  | "created_at"
  | "segment_id"
  | "metrics"
  | "open_rate"
  | "click_rate"
  | "total_sent"
  | "total_recipients"
  | "messages_sent"
>;

type CampaignSegmentRow = Pick<
  Database["public"]["Tables"]["campaign_segments"]["Row"],
  "campaign_id" | "segment_id"
>;

const CAMPAIGN_SELECT = `
  id,
  name,
  subject_line,
  status,
  scheduled_at,
  sent_at,
  created_at,
  segment_id,
  metrics,
  open_rate,
  click_rate,
  total_sent,
  total_recipients,
  messages_sent
`;

const CAMPAIGN_SORT_FIELDS = [
  "name",
  "subject_line",
  "status",
  "created_at",
  "scheduled_at",
  "sent_at",
  "segment_id",
  "open_rate",
  "click_rate",
  "total_sent",
  "messages_sent",
  "messages_failed",
  "total_recipients",
  "auto_send_enabled",
] as const;

function readMetric(metrics: JsonValue | null, names: string[]): number | null {
  if (!isRecord(metrics)) {
    return null;
  }

  for (const name of names) {
    const value = metrics[name];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function campaignIdsFromSegments(
  rows: CampaignRow[],
  campaignSegments: CampaignSegmentRow[],
  segmentIds: Set<string>,
): string[] {
  return uniqueStrings([
    ...rows
      .filter((row) =>
        row.segment_id ? segmentIds.has(row.segment_id) : false,
      )
      .map((row) => row.id),
    ...campaignSegments
      .filter((row) => segmentIds.has(row.segment_id))
      .map((row) => row.campaign_id),
  ]);
}

async function resolveTenantSegmentIds(
  client: BloomQueryClient,
  tenantId: string,
  filter: ToolFilter,
): Promise<string[]> {
  const value = asJsonObject(filter.value);
  const matchValue = value?.match_value ?? filter.value;
  const matchField = value?.match_field === "name" ? "name" : "id";

  if (Array.isArray(matchValue)) {
    const ids = matchValue.filter(
      (item): item is string => typeof item === "string",
    );
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await client
      .from("crm_segments")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", ids);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => row.id);
  }

  if (typeof matchValue !== "string" || !matchValue.trim()) {
    return [];
  }

  const query = client
    .from("crm_segments")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const filtered =
    matchField === "name"
      ? query.ilike("name", matchValue.trim())
      : query.eq("id", matchValue.trim());

  const { data, error } = await filtered;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

async function resolveCampaignSegmentFilter(
  client: BloomQueryClient,
  tenantId: string,
  filter: ToolFilter,
): Promise<ToolFilter> {
  if (filter.field !== "segment_id" && !isJunctionOperator(filter.operator)) {
    return filter;
  }

  if (filter.field !== "segment_id") {
    return filter;
  }

  const segmentIds = await resolveTenantSegmentIds(client, tenantId, filter);
  const { data: campaigns, error: campaignError } = await client
    .from("crm_campaigns")
    .select("id, segment_id")
    .eq("tenant_id", tenantId);

  if (campaignError) {
    throw campaignError;
  }

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const campaignIds = campaignRows.map((row) => row.id);
  const { data: campaignSegments, error: segmentError } =
    campaignIds.length > 0
      ? await client
          .from("campaign_segments")
          .select("campaign_id, segment_id")
          .in("campaign_id", campaignIds)
      : { data: [] as CampaignSegmentRow[], error: null };

  if (segmentError) {
    throw segmentError;
  }

  const matchingIds = campaignIdsFromSegments(
    campaignRows,
    (campaignSegments ?? []) as CampaignSegmentRow[],
    new Set(segmentIds),
  );
  const nextOperator =
    filter.operator === "has_not" ||
    filter.operator === "not_equals" ||
    filter.operator === "not_in"
      ? "has_not"
      : "has";

  return {
    ...filter,
    operator: nextOperator,
    value: {
      relationship: "segment",
      match_field: "id",
      match_value: segmentIds,
      matching_ids: matchingIds,
    },
  };
}

async function resolveCampaignFilters(
  client: BloomQueryClient,
  tenantId: string,
  filters: ToolFilter[],
): Promise<ToolFilter[]> {
  const resolved: ToolFilter[] = [];
  for (const filter of filters) {
    resolved.push(await resolveCampaignSegmentFilter(client, tenantId, filter));
  }
  return resolved;
}

function normalizeCampaignFilter(filter: ToolFilter): ToolFilter {
  if (filter.field === "subject") {
    return { ...filter, field: "subject_line" };
  }

  if (filter.field === "delivered_count") {
    return { ...filter, field: "total_sent" };
  }

  return filter;
}

async function loadCampaignSegmentNames(
  client: BloomQueryClient,
  tenantId: string,
  rows: CampaignRow[],
): Promise<Map<string, string[]>> {
  const campaignIds = rows.map((row) => row.id);
  const directSegmentIds = rows
    .map((row) => row.segment_id)
    .filter((id): id is string => Boolean(id));
  const { data: links, error: linksError } =
    campaignIds.length > 0
      ? await client
          .from("campaign_segments")
          .select("campaign_id, segment_id")
          .in("campaign_id", campaignIds)
      : { data: [] as CampaignSegmentRow[], error: null };

  if (linksError) {
    throw linksError;
  }

  const allSegmentIds = uniqueStrings([
    ...directSegmentIds,
    ...((links ?? []) as CampaignSegmentRow[]).map((link) => link.segment_id),
  ]);
  const { data: segments, error: segmentsError } =
    allSegmentIds.length > 0
      ? await client
          .from("crm_segments")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", allSegmentIds)
      : { data: [] as Array<{ id: string; name: string }>, error: null };

  if (segmentsError) {
    throw segmentsError;
  }

  const segmentNamesById = new Map(
    (segments ?? []).map((segment) => [segment.id, segment.name]),
  );
  const segmentNamesByCampaign = new Map<string, string[]>();

  for (const row of rows) {
    const names = uniqueStrings([
      row.segment_id ? segmentNamesById.get(row.segment_id) : null,
      ...((links ?? []) as CampaignSegmentRow[])
        .filter((link) => link.campaign_id === row.id)
        .map((link) => segmentNamesById.get(link.segment_id)),
    ]);
    segmentNamesByCampaign.set(row.id, names);
  }

  return segmentNamesByCampaign;
}

function mapCampaign(row: CampaignRow, segmentNames: string[]): JsonObject {
  const deliveredCount =
    readMetric(row.metrics, ["delivered_count", "delivered", "sent"]) ??
    toNumberOrNull(row.total_sent) ??
    toNumberOrNull(row.messages_sent) ??
    toNumberOrNull(row.total_recipients) ??
    0;

  return {
    id: row.id,
    name: row.name,
    subject_line: row.subject_line,
    status: row.status,
    scheduled_at: row.scheduled_at,
    sent_at: row.sent_at,
    metrics_summary: {
      open_rate:
        toNumberOrNull(row.open_rate) ??
        readMetric(row.metrics, ["open_rate", "opened_rate"]),
      click_rate:
        toNumberOrNull(row.click_rate) ??
        readMetric(row.metrics, ["click_rate", "clicked_rate"]),
      delivered_count: deliveredCount,
    },
    segment_names: segmentNames,
    created_at: row.created_at,
  };
}

export const queryCampaigns: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const queryParams = parseListQueryParams(params, "created_at");
  const sortBy = normalizeSortBy(
    queryParams.sortBy,
    CAMPAIGN_SORT_FIELDS,
    "created_at",
    {
      subject: "subject_line",
      delivered_count: "total_sent",
    },
  );
  const [from, to] = paginationRange(queryParams.page, queryParams.pageSize);
  const filters = await resolveCampaignFilters(
    client,
    context.tenantId,
    queryParams.filters.map(normalizeCampaignFilter),
  );

  let query = client
    .from("crm_campaigns")
    .select(CAMPAIGN_SELECT, { count: "exact" })
    .eq("tenant_id", context.tenantId);

  if (queryParams.search) {
    const search = sanitizePostgrestSearch(queryParams.search);
    if (search) {
      query = query.or(`name.ilike.%${search}%,subject_line.ilike.%${search}%`);
    }
  }

  query = applyFilters(query, filters, {
    entity: "campaign",
    timezone: context.timezone,
    allowedFields: [...CAMPAIGN_SORT_FIELDS, "id"],
  })
    .order(sortBy, { ascending: queryParams.sortOrder === "asc" })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CampaignRow[];
  const segmentNames = await loadCampaignSegmentNames(
    client,
    context.tenantId,
    rows,
  );
  const items = rows.map(
    (row) => mapCampaign(row, segmentNames.get(row.id) ?? []) as JsonValue,
  );

  return createListResult({ entityLabel: "campaign", items, count });
};
