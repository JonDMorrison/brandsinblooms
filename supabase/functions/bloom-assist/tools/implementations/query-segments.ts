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
  createListResult,
  getQueryClient,
  isRecord,
  normalizeSortBy,
  paginationRange,
  parseListQueryParams,
  sanitizePostgrestSearch,
} from "./shared.ts";

type SegmentRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  | "id"
  | "name"
  | "status"
  | "customer_count"
  | "conditions"
  | "created_at"
  | "auto_update"
>;

const SEGMENT_SELECT = `
  id,
  name,
  status,
  customer_count,
  conditions,
  created_at,
  auto_update
`;

const SEGMENT_SORT_FIELDS = [
  "name",
  "status",
  "customer_count",
  "auto_update",
  "include_all_customers",
  "is_system_segment",
  "created_at",
  "updated_at",
  "source",
  "persona_id",
] as const;

function summarizeRules(value: JsonValue | null): string {
  if (!value) {
    return "No rules configured";
  }

  if (Array.isArray(value)) {
    return value.length === 1 ? "1 rule" : `${value.length} rules`;
  }

  if (isRecord(value)) {
    const rules = value.rules;
    const condition =
      typeof value.condition === "string" ? value.condition : "matching";
    if (Array.isArray(rules)) {
      return rules.length === 1
        ? `1 ${condition} rule`
        : `${rules.length} ${condition} rules`;
    }
  }

  return "Custom rules configured";
}

function normalizeSegmentFilter(filter: ToolFilter): ToolFilter {
  if (filter.field !== "type") {
    return filter;
  }

  if (filter.value === "dynamic") {
    return { ...filter, field: "auto_update", value: true };
  }

  if (filter.value === "static") {
    return { ...filter, field: "auto_update", value: false };
  }

  return filter;
}

function mapSegment(row: SegmentRow): JsonObject {
  return {
    id: row.id,
    name: row.name,
    type: row.auto_update ? "dynamic" : "static",
    status: row.status,
    customer_count: row.customer_count ?? 0,
    rules_summary: summarizeRules(row.conditions),
    created_at: row.created_at,
  };
}

export const querySegments: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const queryParams = parseListQueryParams(params, "created_at");
  const sortBy = normalizeSortBy(
    queryParams.sortBy,
    SEGMENT_SORT_FIELDS,
    "created_at",
    {
      type: "auto_update",
    },
  );
  const [from, to] = paginationRange(queryParams.page, queryParams.pageSize);
  const filters = queryParams.filters.map(normalizeSegmentFilter);

  let query = client
    .from("crm_segments")
    .select(SEGMENT_SELECT, { count: "exact" })
    .eq("tenant_id", context.tenantId)
    .is("deleted_at", null);

  if (queryParams.search) {
    const search = sanitizePostgrestSearch(queryParams.search);
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
  }

  query = applyFilters(query, filters, {
    entity: "segment",
    timezone: context.timezone,
  })
    .order(sortBy, { ascending: queryParams.sortOrder === "asc" })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const items = ((data ?? []) as SegmentRow[]).map(
    (row) => mapSegment(row) as JsonValue,
  );
  return createListResult({ entityLabel: "segment", items, count });
};
