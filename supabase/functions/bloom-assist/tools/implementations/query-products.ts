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
import { emptyNameSearchResult } from "../../named-entity-lookup.ts";

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
  | "low_stock_threshold"
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
  low_stock_threshold,
  is_visible,
  created_at
`;

// Low stock is a per-product rule, never a model-chosen constant: an active
// product that tracks inventory is low when its count is at or below its own
// low_stock_threshold. All three columns are nullable
// (20251208105551_3eed07fd-a3e9-4359-9679-b809ea709541.sql); a NULL count or
// NULL threshold means the product has no usable rule, so it is not low stock.
// This matches the SQL `inventory_count <= low_stock_threshold`, where NULL
// never compares true.
const LOW_STOCK_SCAN_PAGE_SIZE = 1000;
const LOW_STOCK_SCAN_MAX_ROWS = 10000;
const LOW_STOCK_REPLACED_OPERATORS = new Set(["lt", "lte"]);

export function isLowStockProduct(
  row: Pick<
    ProductRow,
    "status" | "track_inventory" | "inventory_count" | "low_stock_threshold"
  >,
): boolean {
  return (
    row.status === "active" &&
    row.track_inventory === true &&
    typeof row.inventory_count === "number" &&
    typeof row.low_stock_threshold === "number" &&
    row.inventory_count <= row.low_stock_threshold
  );
}

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
    low_stock_threshold: row.low_stock_threshold,
    is_low_stock: isLowStockProduct(row),
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
  const lowStockOnly = params.low_stock === true;
  // A low-stock request uses each product's own threshold, so a fixed
  // inventory cap the model added ("inventory_count < 10") is dropped.
  const filters = queryParams.filters
    .map(normalizeProductFilter)
    .filter(
      (filter) =>
        !lowStockOnly ||
        filter.field !== "inventory_count" ||
        !LOW_STOCK_REPLACED_OPERATORS.has(filter.operator),
    );

  const buildQuery = () => {
    let query = client
      .from("products")
      .select(PRODUCT_SELECT, { count: "exact" })
      .eq("tenant_id", context.tenantId);

    if (lowStockOnly) {
      query = query
        .eq("status", "active")
        .eq("track_inventory", true)
        .not("inventory_count", "is", null)
        .not("low_stock_threshold", "is", null);
    }

    if (queryParams.search) {
      const search = sanitizePostgrestSearch(queryParams.search);
      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }
    }

    return applyFilters(query, filters, {
      entity: "product",
      timezone: context.timezone,
    }).order(sortBy, { ascending: queryParams.sortOrder === "asc" });
  };

  if (lowStockOnly) {
    // PostgREST cannot compare two columns, so candidate rows are scanned in
    // pages and the per-product threshold rule is applied here.
    const matches: ProductRow[] = [];
    for (
      let offset = 0;
      offset < LOW_STOCK_SCAN_MAX_ROWS;
      offset += LOW_STOCK_SCAN_PAGE_SIZE
    ) {
      const { data, error } = await buildQuery().range(
        offset,
        offset + LOW_STOCK_SCAN_PAGE_SIZE - 1,
      );
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as ProductRow[];
      matches.push(...rows.filter(isLowStockProduct));
      if (rows.length < LOW_STOCK_SCAN_PAGE_SIZE) {
        break;
      }
    }

    const items = matches
      .slice(from, to + 1)
      .map((row) => mapProduct(row) as JsonValue);
    return createListResult({
      entityLabel: "low-stock product",
      items,
      count: matches.length,
    });
  }

  const { data, error, count } = await buildQuery().range(from, to);
  if (error) {
    throw error;
  }

  if ((data ?? []).length === 0 && queryParams.search && queryParams.filters.length === 0 && queryParams.page === 1) {
    return emptyNameSearchResult(context.dataClient ?? context.serviceClient, context.tenantId, "product", queryParams.search);
  }
  const items = ((data ?? []) as ProductRow[]).map(
    (row) => mapProduct(row) as JsonValue,
  );
  return createListResult({ entityLabel: "product", items, count });
};
