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
  normalizeSortBy,
  paginationRange,
  parseListQueryParams,
  sanitizePostgrestSearch,
  type BloomQueryClient,
} from "./shared.ts";

type ProductRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "tenant_id"
  | "name"
  | "sku"
  | "status"
  | "source"
  | "price"
  | "compare_at_price"
  | "currency"
  | "inventory_count"
  | "track_inventory"
  | "is_visible"
  | "created_at"
>;

const PRODUCT_SELECT = `
  id,
  tenant_id,
  name,
  sku,
  status,
  source,
  price,
  compare_at_price,
  currency,
  inventory_count,
  track_inventory,
  is_visible,
  created_at
`;

const PRODUCT_SORT_FIELDS = [
  "name",
  "sku",
  "status",
  "source",
  "price",
  "compare_at_price",
  "inventory_count",
  "is_visible",
  "track_inventory",
  "category",
  "subcategory",
  "created_at",
  "updated_at",
] as const;

function normalizeProductFilter(filter: ToolFilter): ToolFilter {
  return filter.field === "is_featured"
    ? { ...filter, field: "is_visible" }
    : filter;
}

function mapProduct(row: ProductRow): JsonObject {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    sku: row.sku,
    status: row.status,
    source: row.source,
    price: row.price,
    compare_at_price: row.compare_at_price,
    currency: row.currency,
    inventory_count: row.inventory_count,
    track_inventory: row.track_inventory,
    is_visible: row.is_visible,
    created_at: row.created_at,
  };
}

export const queryProducts: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client: BloomQueryClient = getQueryClient(context);
  const queryParams = parseListQueryParams(params, "created_at");
  const sortBy = normalizeSortBy(
    queryParams.sortBy,
    PRODUCT_SORT_FIELDS,
    "created_at",
    {
      is_featured: "is_visible",
    },
  );
  const [from, to] = paginationRange(queryParams.page, queryParams.pageSize);
  const filters = queryParams.filters.map(normalizeProductFilter);

  let query = client
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("tenant_id", context.tenantId);

  if (queryParams.search) {
    const search = sanitizePostgrestSearch(queryParams.search);
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
  }

  query = applyFilters(query, filters, {
    entity: "product",
    timezone: context.timezone,
  })
    .order(sortBy, { ascending: queryParams.sortOrder === "asc" })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const items = ((data ?? []) as ProductRow[]).map(
    (row) => mapProduct(row) as JsonValue,
  );
  return createListResult({ entityLabel: "product", items, count });
};
