import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import { resolveRelativeDateValue } from "../filter-engine.ts";
import type {
  ToolExecutionContext,
  ToolFilter,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  getQueryClient,
  isJsonValue,
  normalizeSortBy,
  paginationRange,
  parseListQueryParams,
  sanitizePostgrestSearch,
  toNumberOrNull,
  uniqueStrings,
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
type PosOrderRow = Pick<
  Database["public"]["Tables"]["pos_orders"]["Row"],
  | "id"
  | "external_id"
  | "external_customer_id"
  | "pos_connection_id"
  | "pos_customer_id"
  | "items"
  | "order_date"
  | "created_at"
  | "currency"
  | "status"
  | "fulfillment_state"
  | "fulfillment_type"
  | "total_amount"
>;
type PosCustomerRow = Pick<
  Database["public"]["Tables"]["pos_customers"]["Row"],
  "id" | "email"
>;
type ShopifyOrderRow = Pick<
  Database["public"]["Tables"]["shopify_orders"]["Row"],
  | "id"
  | "shopify_order_id"
  | "order_number"
  | "email"
  | "currency"
  | "financial_status"
  | "fulfillment_status"
  | "line_items"
  | "order_date"
  | "created_at"
  | "total_price"
>;
type LightspeedSaleRow = Pick<
  Database["public"]["Tables"]["lightspeed_sales"]["Row"],
  | "id"
  | "lightspeed_sale_id"
  | "lightspeed_customer_id"
  | "line_items"
  | "sale_date"
  | "created_at"
  | "status"
  | "total_amount"
>;
type LightspeedCustomerRow = Pick<
  Database["public"]["Tables"]["lightspeed_customers"]["Row"],
  "lightspeed_customer_id" | "email"
>;

type OrderSource = "square" | "clover" | "shopify" | "lightspeed";

type ProviderDiscovery = {
  squareConnectionIds: string[];
  cloverConnectionIds: string[];
  lightspeedConnected: boolean;
  shopifyConnected: boolean;
};

type NormalizedOrder = {
  id: string;
  source: OrderSource;
  external_id: string | null;
  customer_email: string | null;
  email: string | null;
  total: number | null;
  total_amount: number | null;
  total_price: number | null;
  currency: string | null;
  status: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  fulfillment_state: string | null;
  items_count: number;
  created_at: string | null;
  order_date: string | null;
};

const ORDER_SORT_FIELDS = [
  "source",
  "external_id",
  "email",
  "customer_email",
  "status",
  "financial_status",
  "fulfillment_status",
  "fulfillment_state",
  "order_date",
  "created_at",
  "total",
  "total_amount",
  "total_price",
  "currency",
  "items_count",
] as const;

const ORDER_FIELD_ALIASES: Record<string, keyof NormalizedOrder> = {
  customer_email: "customer_email",
  email: "customer_email",
  total: "total",
  total_amount: "total",
  total_price: "total",
  created_at: "created_at",
  order_date: "created_at",
};

function jsonArrayLength(value: JsonValue): number {
  return Array.isArray(value) ? value.length : 0;
}

function jsonOrNull(value: unknown): JsonValue | null {
  return isJsonValue(value) ? value : null;
}

function createOrdersResult(args: {
  items: JsonValue[];
  count: number;
  message?: string;
}): ToolResult {
  return {
    success: true,
    data: args.items,
    count: args.count,
    message:
      args.message ??
      `Found ${args.count.toLocaleString()} orders matching your criteria.`,
    error: null,
    block_type: "data_table",
    confirmation_required: false,
    confirmation_details: null,
  };
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

async function loadPosCustomerEmails(
  client: BloomQueryClient,
  connectionIds: string[],
  orders: PosOrderRow[],
): Promise<Map<string, string | null>> {
  const customerIds = uniqueStrings(
    orders.map((order) => order.pos_customer_id),
  );
  if (customerIds.length === 0 || connectionIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("pos_customers")
    .select("id, email")
    .in("pos_connection_id", connectionIds)
    .in("id", customerIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as PosCustomerRow[]).map((row) => [row.id, row.email]),
  );
}

async function loadLightspeedCustomerEmails(
  client: BloomQueryClient,
  tenantId: string,
  sales: LightspeedSaleRow[],
): Promise<Map<string, string | null>> {
  const customerIds = uniqueStrings(
    sales.map((sale) => sale.lightspeed_customer_id),
  );
  if (customerIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("lightspeed_customers")
    .select("lightspeed_customer_id, email")
    .eq("tenant_id", tenantId)
    .in("lightspeed_customer_id", customerIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as LightspeedCustomerRow[]).map((row) => [
      row.lightspeed_customer_id,
      row.email,
    ]),
  );
}

function normalizePosOrder(
  row: PosOrderRow,
  source: "square" | "clover",
  emailByCustomerId: Map<string, string | null>,
): NormalizedOrder {
  const email = row.pos_customer_id
    ? (emailByCustomerId.get(row.pos_customer_id) ?? null)
    : null;
  const createdAt = row.order_date ?? row.created_at;
  const total = toNumberOrNull(row.total_amount);

  return {
    id: row.id,
    source,
    external_id: row.external_id,
    customer_email: email,
    email,
    total,
    total_amount: total,
    total_price: null,
    currency: row.currency,
    status: row.status,
    financial_status: null,
    fulfillment_status: row.fulfillment_type,
    fulfillment_state: row.fulfillment_state,
    items_count: jsonArrayLength(jsonOrNull(row.items) ?? []),
    created_at: createdAt,
    order_date: createdAt,
  };
}

function normalizeShopifyOrder(row: ShopifyOrderRow): NormalizedOrder {
  const createdAt = row.order_date ?? row.created_at;
  const total = toNumberOrNull(row.total_price);

  return {
    id: row.id,
    source: "shopify",
    external_id: row.order_number ?? row.shopify_order_id,
    customer_email: row.email,
    email: row.email,
    total,
    total_amount: null,
    total_price: total,
    currency: row.currency,
    status: row.financial_status ?? row.fulfillment_status,
    financial_status: row.financial_status,
    fulfillment_status: row.fulfillment_status,
    fulfillment_state: null,
    items_count: jsonArrayLength(jsonOrNull(row.line_items) ?? []),
    created_at: createdAt,
    order_date: createdAt,
  };
}

function normalizeLightspeedSale(
  row: LightspeedSaleRow,
  emailByCustomerId: Map<string, string | null>,
): NormalizedOrder {
  const email = row.lightspeed_customer_id
    ? (emailByCustomerId.get(row.lightspeed_customer_id) ?? null)
    : null;
  const createdAt = row.sale_date ?? row.created_at;
  const total = toNumberOrNull(row.total_amount);

  return {
    id: row.id,
    source: "lightspeed",
    external_id: row.lightspeed_sale_id,
    customer_email: email,
    email,
    total,
    total_amount: total,
    total_price: null,
    currency: null,
    status: row.status,
    financial_status: null,
    fulfillment_status: null,
    fulfillment_state: null,
    items_count: jsonArrayLength(jsonOrNull(row.line_items) ?? []),
    created_at: createdAt,
    order_date: createdAt,
  };
}

async function loadPosOrders(
  client: BloomQueryClient,
  connectionIds: string[],
  source: "square" | "clover",
): Promise<NormalizedOrder[]> {
  if (connectionIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("pos_orders")
    .select(
      "id, external_id, external_customer_id, pos_connection_id, pos_customer_id, items, order_date, created_at, currency, status, fulfillment_state, fulfillment_type, total_amount",
    )
    .in("pos_connection_id", connectionIds);

  if (error) {
    throw error;
  }

  const orders = (data ?? []) as PosOrderRow[];
  const emailByCustomerId = await loadPosCustomerEmails(
    client,
    connectionIds,
    orders,
  );
  return orders.map((order) =>
    normalizePosOrder(order, source, emailByCustomerId),
  );
}

async function loadShopifyOrders(
  client: BloomQueryClient,
  tenantId: string,
  enabled: boolean,
): Promise<NormalizedOrder[]> {
  if (!enabled) {
    return [];
  }

  const { data, error } = await client
    .from("shopify_orders")
    .select(
      "id, shopify_order_id, order_number, email, currency, financial_status, fulfillment_status, line_items, order_date, created_at, total_price",
    )
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ShopifyOrderRow[]).map(normalizeShopifyOrder);
}

async function loadLightspeedOrders(
  client: BloomQueryClient,
  tenantId: string,
  enabled: boolean,
): Promise<NormalizedOrder[]> {
  if (!enabled) {
    return [];
  }

  const { data, error } = await client
    .from("lightspeed_sales")
    .select(
      "id, lightspeed_sale_id, lightspeed_customer_id, line_items, sale_date, created_at, status, total_amount",
    )
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  const sales = (data ?? []) as LightspeedSaleRow[];
  const emailByCustomerId = await loadLightspeedCustomerEmails(
    client,
    tenantId,
    sales,
  );
  return sales.map((sale) => normalizeLightspeedSale(sale, emailByCustomerId));
}

function normalizeFilterField(field: string): keyof NormalizedOrder {
  return ORDER_FIELD_ALIASES[field] ?? (field as keyof NormalizedOrder);
}

function valueForFilter(
  order: NormalizedOrder,
  field: string,
): JsonValue | undefined {
  const normalized = normalizeFilterField(field);
  const value = order[normalized];
  return isJsonValue(value) ? value : undefined;
}

function primitiveCompareValue(
  value: JsonValue | undefined,
): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return null;
}

function filterValue(
  filter: ToolFilter,
  timezone: string,
): JsonValue | undefined {
  if (typeof filter.value === "string") {
    const relative = resolveRelativeDateValue(filter.value, timezone);
    if (relative) {
      return filter.operator === "lt" || filter.operator === "lte"
        ? relative.end
        : relative.start;
    }
  }
  return filter.value;
}

function valuesEqual(
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function compareValues(
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): number | null {
  const leftValue = primitiveCompareValue(left);
  const rightValue = primitiveCompareValue(right);
  if (leftValue === null || rightValue === null) {
    return null;
  }

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }

  return String(leftValue).localeCompare(String(rightValue));
}

function betweenValues(
  filter: ToolFilter,
  timezone: string,
): [JsonValue, JsonValue] | null {
  if (typeof filter.value === "string") {
    const relative = resolveRelativeDateValue(filter.value, timezone);
    return relative ? [relative.start, relative.end] : null;
  }

  return Array.isArray(filter.value) && filter.value.length === 2
    ? [filter.value[0], filter.value[1]]
    : null;
}

function valueArray(value: JsonValue | undefined): JsonArray {
  return Array.isArray(value) ? value : [];
}

function matchesRelativeDateEquals(
  actual: JsonValue | undefined,
  filter: ToolFilter,
  timezone: string,
): boolean | null {
  if (typeof filter.value !== "string") {
    return null;
  }

  const relative = resolveRelativeDateValue(filter.value, timezone);
  if (!relative) {
    return null;
  }

  const lower = compareValues(actual, relative.start);
  const upper = compareValues(actual, relative.end);
  return lower !== null && upper !== null && lower >= 0 && upper <= 0;
}

function matchesFilter(
  order: NormalizedOrder,
  filter: ToolFilter,
  timezone: string,
): boolean {
  const actual = valueForFilter(order, filter.field);
  const expected = filterValue(filter, timezone);

  switch (filter.operator) {
    case "equals": {
      const relativeMatch = matchesRelativeDateEquals(actual, filter, timezone);
      return relativeMatch ?? valuesEqual(actual, expected);
    }
    case "not_equals":
      return !valuesEqual(actual, expected);
    case "contains":
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase());
    case "not_contains":
      return !String(actual ?? "")
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase());
    case "starts_with":
      return String(actual ?? "")
        .toLowerCase()
        .startsWith(String(expected ?? "").toLowerCase());
    case "ends_with":
      return String(actual ?? "")
        .toLowerCase()
        .endsWith(String(expected ?? "").toLowerCase());
    case "gt": {
      const compared = compareValues(actual, expected);
      return compared !== null && compared > 0;
    }
    case "lt": {
      const compared = compareValues(actual, expected);
      return compared !== null && compared < 0;
    }
    case "gte": {
      const compared = compareValues(actual, expected);
      return compared !== null && compared >= 0;
    }
    case "lte": {
      const compared = compareValues(actual, expected);
      return compared !== null && compared <= 0;
    }
    case "between": {
      const range = betweenValues(filter, timezone);
      if (!range) {
        return false;
      }
      const lower = compareValues(actual, range[0]);
      const upper = compareValues(actual, range[1]);
      return lower !== null && upper !== null && lower >= 0 && upper <= 0;
    }
    case "in":
      return valueArray(expected).some((value) => valuesEqual(actual, value));
    case "not_in":
      return !valueArray(expected).some((value) => valuesEqual(actual, value));
    case "is_null":
      return actual === null || actual === undefined;
    case "is_not_null":
      return actual !== null && actual !== undefined;
    case "has":
    case "has_not":
    case "has_count":
      return true;
  }
}

function applyInMemoryFilters(
  orders: NormalizedOrder[],
  filters: ToolFilter[],
  timezone: string,
): NormalizedOrder[] {
  return orders.filter((order) =>
    filters.every((filter) => matchesFilter(order, filter, timezone)),
  );
}

function matchesSearch(order: NormalizedOrder, search: string | null): boolean {
  if (!search) {
    return true;
  }

  const normalized = sanitizePostgrestSearch(search).toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    order.external_id,
    order.customer_email,
    order.status,
    order.financial_status,
    order.fulfillment_status,
    order.source,
  ].some(
    (value) =>
      typeof value === "string" && value.toLowerCase().includes(normalized),
  );
}

function sortOrders(
  orders: NormalizedOrder[],
  sortBy: string,
  sortOrder: "asc" | "desc",
): NormalizedOrder[] {
  const field = normalizeFilterField(sortBy);
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...orders].sort((left, right) => {
    const compared = compareValues(
      isJsonValue(left[field]) ? left[field] : null,
      isJsonValue(right[field]) ? right[field] : null,
    );
    return (compared ?? 0) * direction;
  });
}

function mapOrder(order: NormalizedOrder): JsonObject {
  return {
    id: order.id,
    source: order.source,
    external_id: order.external_id,
    customer_email: order.customer_email,
    total: order.total,
    currency: order.currency,
    status: order.status,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    fulfillment_state: order.fulfillment_state,
    items_count: order.items_count,
    created_at: order.created_at,
  };
}

export const queryOrders: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const providerDiscovery = await discoverProviders(client, context);
  const hasConnectedProvider =
    providerDiscovery.squareConnectionIds.length > 0 ||
    providerDiscovery.cloverConnectionIds.length > 0 ||
    providerDiscovery.lightspeedConnected ||
    providerDiscovery.shopifyConnected;

  if (!hasConnectedProvider) {
    return createOrdersResult({
      items: [],
      count: 0,
      message: "No connected order providers were found for this tenant.",
    });
  }

  const queryParams = parseListQueryParams(params, "created_at");
  const sortBy = normalizeSortBy(
    queryParams.sortBy,
    ORDER_SORT_FIELDS,
    "created_at",
    ORDER_FIELD_ALIASES,
  );
  const [squareOrders, cloverOrders, shopifyOrders, lightspeedOrders] =
    await Promise.all([
      loadPosOrders(client, providerDiscovery.squareConnectionIds, "square"),
      loadPosOrders(client, providerDiscovery.cloverConnectionIds, "clover"),
      loadShopifyOrders(
        client,
        context.tenantId,
        providerDiscovery.shopifyConnected,
      ),
      loadLightspeedOrders(
        client,
        context.tenantId,
        providerDiscovery.lightspeedConnected,
      ),
    ]);

  const merged = [
    ...squareOrders,
    ...cloverOrders,
    ...shopifyOrders,
    ...lightspeedOrders,
  ].filter((order) => matchesSearch(order, queryParams.search));
  const filtered = applyInMemoryFilters(
    merged,
    queryParams.filters,
    context.timezone,
  );
  const sorted = sortOrders(filtered, sortBy, queryParams.sortOrder);
  const [from, to] = paginationRange(queryParams.page, queryParams.pageSize);
  const items = sorted
    .slice(from, to + 1)
    .map((order) => mapOrder(order) as JsonValue);

  return createOrdersResult({ items, count: filtered.length });
};
