import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import { BLOOM_UPLOADS_BUCKET } from "../../attachments.ts";
import { resolveRelativeDateValue } from "../filter-engine.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolFilter,
  ToolImplementation,
  ToolName,
  ToolResult,
} from "../types.ts";
import { queryCampaigns } from "./query-campaigns.ts";
import { queryCustomers } from "./query-customers.ts";
import { queryProducts } from "./query-products.ts";
import { querySegments } from "./query-segments.ts";
import {
  getQueryClient,
  isJsonValue,
  isRecord,
  toNumberOrNull,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type ExportEntity =
  | "customers"
  | "products"
  | "campaigns"
  | "segments"
  | "orders";
type ExportFormat = "csv" | "json";
type ExportRowsResult = {
  rows: JsonObject[];
  totalMatchingCount: number;
  truncated: boolean;
  emptyMessage?: string;
};

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

const EXPORT_ROW_LIMIT = 5000;
const EXPORT_PAGE_SIZE = 50;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
const MAX_FILENAME_CHARS = 120;
const ORDER_FIELD_ALIASES: Record<string, keyof NormalizedOrder> = {
  customer_email: "customer_email",
  email: "customer_email",
  total: "total",
  total_amount: "total",
  total_price: "total",
  created_at: "created_at",
  order_date: "created_at",
};
const EXPORT_QUERY_IMPLEMENTATIONS: Record<
  Exclude<ExportEntity, "orders">,
  ToolImplementation
> = {
  customers: queryCustomers,
  products: queryProducts,
  campaigns: queryCampaigns,
  segments: querySegments,
};
const EXPORT_ENTITY_ALIASES: Record<ExportEntity, readonly string[]> = {
  customers: ["customer", "customers"],
  products: ["product", "products"],
  campaigns: ["campaign", "campaigns"],
  segments: ["segment", "segments"],
  orders: ["order", "orders"],
};
const PLURAL_ENTITY_LABELS: Record<ExportEntity, string> = {
  customers: "customers",
  products: "products",
  campaigns: "campaigns",
  segments: "segments",
  orders: "orders",
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function createResult(args: {
  success: boolean;
  message: string;
  data?: JsonValue | null;
  count?: number | null;
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

function errorResult(message: string, error: string): ToolResult {
  return createResult({
    success: false,
    message,
    error,
    blockType: "text",
  });
}

function singularEntityLabel(entity: ExportEntity): string {
  return EXPORT_ENTITY_ALIASES[entity][0];
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function readExportEntity(value: unknown): ExportEntity | null {
  return value === "customers" ||
    value === "products" ||
    value === "campaigns" ||
    value === "segments" ||
    value === "orders"
    ? value
    : null;
}

function readExportFormat(value: unknown): ExportFormat | null {
  return value === "csv" || value === "json" ? value : null;
}

function normalizeExportFilters(
  value: unknown,
  entity: ExportEntity,
): ToolFilter[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const aliases = new Set(EXPORT_ENTITY_ALIASES[entity]);
  const normalizedEntity = singularEntityLabel(entity) as ToolFilter["entity"];

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const filterEntity = readString(entry.entity)?.toLowerCase();
    const field = readString(entry.field);
    const operator = readString(entry.operator);
    if (!filterEntity || !aliases.has(filterEntity) || !field || !operator) {
      return [];
    }

    const filter: ToolFilter = {
      entity: normalizedEntity,
      field,
      operator: operator as ToolFilter["operator"],
    };

    if (entry.value !== undefined && isJsonValue(entry.value)) {
      filter.value = entry.value;
    }

    return [filter];
  });
}

function readJsonObjectArray(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is JsonObject =>
      isRecord(item) && Object.values(item).every(isJsonValue),
  );
}

async function fetchPagedQueryRows(args: {
  entity: Exclude<ExportEntity, "orders">;
  filters: ToolFilter[];
  context: ToolExecutionContext;
}): Promise<ExportRowsResult> {
  const implementation = EXPORT_QUERY_IMPLEMENTATIONS[args.entity];
  const rows: JsonObject[] = [];
  let page = 1;
  let totalMatchingCount = 0;

  while (rows.length < EXPORT_ROW_LIMIT) {
    const result = await implementation(
      {
        page,
        page_size: EXPORT_PAGE_SIZE,
        filters: args.filters,
      },
      args.context,
    );

    if (!result.success) {
      throw new Error(result.message || `Failed to export ${args.entity}.`);
    }

    const pageRows = readJsonObjectArray(result.data);
    if (page === 1) {
      totalMatchingCount =
        typeof result.count === "number" && Number.isFinite(result.count)
          ? result.count
          : pageRows.length;
    }

    if (pageRows.length === 0) {
      break;
    }

    const remaining = EXPORT_ROW_LIMIT - rows.length;
    rows.push(...pageRows.slice(0, remaining));

    const reachedKnownEnd =
      typeof result.count === "number" && rows.length >= result.count;
    if (
      pageRows.length < EXPORT_PAGE_SIZE ||
      reachedKnownEnd ||
      rows.length >= EXPORT_ROW_LIMIT
    ) {
      break;
    }

    page += 1;
  }

  return {
    rows,
    totalMatchingCount,
    truncated: totalMatchingCount > rows.length,
  };
}

function jsonArrayLength(value: JsonValue): number {
  return Array.isArray(value) ? value.length : 0;
}

function jsonOrNull(value: unknown): JsonValue | null {
  return isJsonValue(value) ? value : null;
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

function normalizeOrderFilterField(field: string): keyof NormalizedOrder {
  return ORDER_FIELD_ALIASES[field] ?? (field as keyof NormalizedOrder);
}

function valueForOrderFilter(
  order: NormalizedOrder,
  field: string,
): JsonValue | undefined {
  const normalizedField = normalizeOrderFilterField(field);
  const value = order[normalizedField];
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

function resolvedFilterValue(
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

function valueArray(value: JsonValue | undefined): JsonValue[] {
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

function matchesOrderFilter(
  order: NormalizedOrder,
  filter: ToolFilter,
  timezone: string,
): boolean {
  const actual = valueForOrderFilter(order, filter.field);
  const expected = resolvedFilterValue(filter, timezone);

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

function applyOrderFilters(
  orders: NormalizedOrder[],
  filters: ToolFilter[],
  timezone: string,
): NormalizedOrder[] {
  return orders.filter((order) =>
    filters.every((filter) => matchesOrderFilter(order, filter, timezone)),
  );
}

function sortOrdersForExport(orders: NormalizedOrder[]): NormalizedOrder[] {
  return [...orders].sort((left, right) => {
    const compared = compareValues(
      isJsonValue(left.created_at) ? left.created_at : null,
      isJsonValue(right.created_at) ? right.created_at : null,
    );
    return (compared ?? 0) * -1;
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

async function fetchOrderExportRows(
  filters: ToolFilter[],
  context: ToolExecutionContext,
): Promise<ExportRowsResult> {
  const client = getQueryClient(context);
  const providerDiscovery = await discoverProviders(client, context);
  const hasConnectedProvider =
    providerDiscovery.squareConnectionIds.length > 0 ||
    providerDiscovery.cloverConnectionIds.length > 0 ||
    providerDiscovery.lightspeedConnected ||
    providerDiscovery.shopifyConnected;

  if (!hasConnectedProvider) {
    return {
      rows: [],
      totalMatchingCount: 0,
      truncated: false,
      emptyMessage:
        "No connected order providers were found for this tenant, so no export file was created.",
    };
  }

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

  const filtered = applyOrderFilters(
    [...squareOrders, ...cloverOrders, ...shopifyOrders, ...lightspeedOrders],
    filters,
    context.timezone,
  );
  const sorted = sortOrdersForExport(filtered);
  const limited = sorted.slice(0, EXPORT_ROW_LIMIT);

  return {
    rows: limited.map((order) => mapOrder(order)),
    totalMatchingCount: filtered.length,
    truncated: filtered.length > limited.length,
  };
}

async function fetchExportRows(args: {
  entity: ExportEntity;
  filters: ToolFilter[];
  context: ToolExecutionContext;
}): Promise<ExportRowsResult> {
  if (args.entity === "orders") {
    return fetchOrderExportRows(args.filters, args.context);
  }

  return fetchPagedQueryRows({
    entity: args.entity,
    filters: args.filters,
    context: args.context,
  });
}

function csvCellValue(value: JsonValue | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    const primitiveValues = value.filter(
      (entry): entry is string | number | boolean =>
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean",
    );

    return primitiveValues.length === value.length
      ? primitiveValues.map(String).join("; ")
      : JSON.stringify(value);
  }

  if (isRecord(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function collectColumns(rows: JsonObject[]): string[] {
  const columns: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  return columns;
}

function buildCsvContent(rows: JsonObject[]): string {
  const columns = collectColumns(rows);
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows.map((row) =>
    columns
      .map((column) =>
        escapeCsvCell(csvCellValue(row[column] as JsonValue | undefined)),
      )
      .join(","),
  );

  return [header, ...body].join("\n");
}

function serializeRows(rows: JsonObject[], format: ExportFormat): string {
  return format === "json"
    ? JSON.stringify(rows, null, 2)
    : buildCsvContent(rows);
}

function sanitizeStorageFilename(filename: string): string {
  const cleaned = filename
    .replace(/[/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, MAX_FILENAME_CHARS)
    .replace(/^\.+/, "")
    .trim();

  return cleaned || "export";
}

function buildExportFileName(
  entity: ExportEntity,
  format: ExportFormat,
  generatedAtIso: string,
): string {
  const normalizedTimestamp = generatedAtIso.replace(/[.:]/g, "-");
  return sanitizeStorageFilename(
    `${entity}-export-${normalizedTimestamp}.${format}`,
  );
}

function exportMimeType(format: ExportFormat): string {
  return format === "csv" ? "text/csv" : "text/plain";
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

async function uploadExportBytes(args: {
  storagePath: string;
  bytes: Uint8Array;
  contentType: string;
  context: ToolExecutionContext;
}): Promise<void> {
  if (args.context.dataClient) {
    const { error } = await args.context.dataClient.storage
      .from(BLOOM_UPLOADS_BUCKET)
      .upload(args.storagePath, args.bytes, {
        contentType: args.contentType,
        upsert: false,
      });

    if (!error) {
      return;
    }
  }

  const { error } = await args.context.serviceClient.storage
    .from(BLOOM_UPLOADS_BUCKET)
    .upload(args.storagePath, args.bytes, {
      contentType: args.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload export file: ${error.message}`);
  }
}

async function createSignedDownloadUrl(
  storagePath: string,
  context: ToolExecutionContext,
): Promise<string> {
  const { data, error } = await context.serviceClient.storage
    .from(BLOOM_UPLOADS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to generate a signed download URL: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data.signedUrl;
}

function buildDownloadMessage(args: {
  entity: ExportEntity;
  format: ExportFormat;
  rowCount: number;
  totalMatchingCount: number;
  truncated: boolean;
  fileName: string;
  downloadUrl: string;
}): string {
  const noun =
    args.rowCount === 1
      ? singularEntityLabel(args.entity)
      : PLURAL_ENTITY_LABELS[args.entity];
  const prefix = args.truncated
    ? `Exported ${args.rowCount.toLocaleString()} of ${args.totalMatchingCount.toLocaleString()} ${PLURAL_ENTITY_LABELS[args.entity]}`
    : `Exported ${args.rowCount.toLocaleString()} ${noun}`;

  return `${prefix} to ${args.fileName}. Download URL (expires in 1 hour): ${args.downloadUrl}`;
}

function buildExportCard(args: {
  entity: ExportEntity;
  format: ExportFormat;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  rowCount: number;
  totalMatchingCount: number;
  truncated: boolean;
  generatedAt: string;
  expiresAt: string;
  byteSize: number;
}): JsonObject {
  return {
    entity_type: "segment",
    entity: {
      name: `${titleCase(PLURAL_ENTITY_LABELS[args.entity])} export`,
      type: args.format,
      status: args.truncated ? "limited" : "ready",
      customer_count: args.rowCount,
    },
    actions: [
      {
        label: "Show URL Again",
        prompt: `Show the signed download URL again for ${args.fileName}.`,
        icon: "eye",
      },
    ],
    file_name: args.fileName,
    storage_path: args.storagePath,
    download_url: args.downloadUrl,
    format: args.format,
    row_count: args.rowCount,
    total_matching_count: args.totalMatchingCount,
    truncated: args.truncated,
    generated_at: args.generatedAt,
    expires_at: args.expiresAt,
    file_size_bytes: args.byteSize,
    file_size_label: formatByteSize(args.byteSize),
  };
}

const exportData: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const entity = readExportEntity(params.entity);
  const format = readExportFormat(params.format);
  if (!entity || !format) {
    return errorResult(
      "Export parameters were invalid after validation.",
      "validation_error",
    );
  }

  const filters = normalizeExportFilters(params.filters, entity);
  const exportRows = await fetchExportRows({ entity, filters, context });
  if (exportRows.rows.length === 0) {
    return createResult({
      success: true,
      message:
        exportRows.emptyMessage ??
        `No ${PLURAL_ENTITY_LABELS[entity]} matched the requested filters, so no export file was created.`,
      count: 0,
      blockType: "text",
    });
  }

  const generatedAt = new Date().toISOString();
  const fileName = buildExportFileName(entity, format, generatedAt);
  const storagePath = `${context.tenantId}/${context.conversationId}/exports/${crypto.randomUUID()}_${fileName}`;
  const serialized = serializeRows(exportRows.rows, format);
  const bytes = new TextEncoder().encode(serialized);

  if (bytes.byteLength > MAX_EXPORT_BYTES) {
    return errorResult(
      `The export file would be ${formatByteSize(bytes.byteLength)}, which exceeds the 10 MB Bloom upload limit. Narrow the filters or use CSV.`,
      "export_too_large",
    );
  }

  await uploadExportBytes({
    storagePath,
    bytes,
    contentType: exportMimeType(format),
    context,
  });

  const downloadUrl = await createSignedDownloadUrl(storagePath, context);
  const expiresAt = new Date(
    Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  ).toISOString();

  return createResult({
    success: true,
    message: buildDownloadMessage({
      entity,
      format,
      rowCount: exportRows.rows.length,
      totalMatchingCount: exportRows.totalMatchingCount,
      truncated: exportRows.truncated,
      fileName,
      downloadUrl,
    }),
    data: buildExportCard({
      entity,
      format,
      fileName,
      storagePath,
      downloadUrl,
      rowCount: exportRows.rows.length,
      totalMatchingCount: exportRows.totalMatchingCount,
      truncated: exportRows.truncated,
      generatedAt,
      expiresAt,
      byteSize: bytes.byteLength,
    }),
    count: exportRows.rows.length,
    blockType: "data_card",
  });
};

export function exportDataImplementation(
  toolName: ToolName,
): ToolImplementation | null {
  return toolName === "export_data" ? exportData : null;
}
