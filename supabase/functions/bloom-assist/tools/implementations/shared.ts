import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import type {
  FilterOperator,
  ToolExecutionContext,
  ToolFilter,
  ToolResult,
} from "../types.ts";
import { FILTER_OPERATORS } from "../types.ts";

type PublicSchema = Database["public"];

export type BloomQueryClient = SupabaseClient<Database, "public", PublicSchema>;

export type ListQueryParams = {
  filters: ToolFilter[];
  page: number;
  pageSize: number;
  search: string | null;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const FILTER_OPERATOR_SET = new Set<string>(FILTER_OPERATORS);

export function getQueryClient(
  context: ToolExecutionContext,
): BloomQueryClient {
  return (context.dataClient ?? context.serviceClient) as BloomQueryClient;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isToolFilter(value: unknown): value is ToolFilter {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.field === "string" &&
    typeof value.operator === "string" &&
    FILTER_OPERATOR_SET.has(value.operator) &&
    (value.value === undefined || isJsonValue(value.value))
  );
}

function readInteger(value: JsonValue | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : fallback;
}

function readString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function parseListQueryParams(
  params: JsonObject,
  defaultSortBy: string,
): ListQueryParams {
  const filtersValue = params.filters;
  const filters = Array.isArray(filtersValue)
    ? filtersValue.filter(isToolFilter)
    : [];
  const page = Math.max(DEFAULT_PAGE, readInteger(params.page, DEFAULT_PAGE));
  const requestedPageSize = readInteger(params.page_size, DEFAULT_PAGE_SIZE);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, requestedPageSize));
  const sortOrder = params.sort_order === "asc" ? "asc" : "desc";

  return {
    filters,
    page,
    pageSize,
    search: readString(params.search),
    sortBy: readString(params.sort_by) ?? defaultSortBy,
    sortOrder,
  };
}

export function normalizeSortBy(
  requested: string,
  allowed: readonly string[],
  fallback: string,
  aliases: Record<string, string> = {},
): string {
  const normalized = aliases[requested] ?? requested;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function paginationRange(
  page: number,
  pageSize: number,
): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function createListResult(args: {
  entityLabel: string;
  items: JsonArray;
  count: number | null;
}): ToolResult {
  const total = args.count ?? args.items.length;
  const blockType = args.items.length === 1 ? "data_card" : "data_table";
  const plural = total === 1 ? args.entityLabel : `${args.entityLabel}s`;

  return {
    success: true,
    data: args.items,
    count: total,
    message: `Found ${total.toLocaleString()} ${plural} matching your criteria.`,
    error: null,
    block_type: blockType,
    confirmation_required: false,
    confirmation_details: null,
  };
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function uniqueStrings(
  values: Array<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? "")
        .filter((value) => value.length > 0),
    ),
  );
}

export function sanitizePostgrestSearch(value: string): string {
  return value.replace(/[,.()"'\\]/g, "").trim();
}

export function formatCurrency(value: number | null, currency = "USD"): string {
  const amount = value ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function isJunctionOperator(operator: FilterOperator): boolean {
  return (
    operator === "has" || operator === "has_not" || operator === "has_count"
  );
}

export function asJsonObject(value: JsonValue | undefined): JsonObject | null {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? value
    : null;
}
