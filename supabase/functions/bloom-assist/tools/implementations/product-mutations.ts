import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolName,
  ToolResult,
} from "../types.ts";
import { getQueryClient, isRecord } from "./shared.ts";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type ProductRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "tenant_id"
  | "name"
  | "description"
  | "sku"
  | "barcode"
  | "price"
  | "cost_price"
  | "compare_at_price"
  | "currency"
  | "inventory_count"
  | "track_inventory"
  | "low_stock_threshold"
  | "category"
  | "subcategory"
  | "tags"
  | "source"
  | "status"
  | "is_visible"
  | "created_at"
  | "updated_at"
>;
type ProductMutationToolName =
  | "create_product"
  | "update_product"
  | "toggle_product_status";

const PRODUCT_CARD_SELECT = `
  id,
  tenant_id,
  name,
  description,
  sku,
  barcode,
  price,
  cost_price,
  compare_at_price,
  currency,
  inventory_count,
  track_inventory,
  low_stock_threshold,
  category,
  subcategory,
  tags,
  source,
  status,
  is_visible,
  created_at,
  updated_at
`;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(readString)
        .filter((item): item is string => Boolean(item))
        .filter((item, index, items) => items.indexOf(item) === index)
    : [];
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function hasOwnProperty(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizedKey(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
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

function errorResult(
  message: string,
  error: string,
  data?: JsonValue | null,
): ToolResult {
  return createResult({
    success: false,
    message,
    error,
    data,
    blockType: "text",
  });
}

function productLabel(product: ProductRow): string {
  return product.name || product.sku || "Product";
}

function mapProductCard(row: ProductRow): JsonObject {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    barcode: row.barcode,
    price: row.price,
    cost_price: row.cost_price,
    compare_at_price: row.compare_at_price,
    currency: row.currency,
    inventory_count: row.inventory_count,
    track_inventory: row.track_inventory,
    low_stock_threshold: row.low_stock_threshold,
    category: row.category,
    subcategory: row.subcategory,
    tags: row.tags ?? [],
    source: row.source,
    status: row.status,
    is_visible: row.is_visible,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateCompareAtPrice(
  price: number | null,
  compareAtPrice: number | null,
): string | null {
  if (price === null || compareAtPrice === null) {
    return null;
  }

  return compareAtPrice < price
    ? "Compare-at price must be greater than or equal to price."
    : null;
}

async function loadTenantProducts(
  context: ToolExecutionContext,
): Promise<ProductRow[]> {
  const client = getQueryClient(context);
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("tenant_id", context.tenantId);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductRow[];
}

function findDuplicateProduct(args: {
  products: ProductRow[];
  name: string | null;
  sku: string | null;
  excludeProductId?: string;
}): ProductRow | null {
  const normalizedName = normalizedKey(args.name);
  const normalizedSku = normalizedKey(args.sku);

  return (
    args.products.find((product) => {
      if (args.excludeProductId && product.id === args.excludeProductId) {
        return false;
      }

      const duplicateName =
        normalizedName !== null &&
        normalizedKey(product.name) === normalizedName;
      const duplicateSku =
        normalizedSku !== null && normalizedKey(product.sku) === normalizedSku;

      return duplicateName || duplicateSku;
    }) ?? null
  );
}

async function loadScopedProduct(args: {
  productId: string;
  context: ToolExecutionContext;
}): Promise<ProductRow | null> {
  const client = getQueryClient(args.context);
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("tenant_id", args.context.tenantId)
    .eq("id", args.productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProductRow | null) ?? null;
}

function buildCreatePayload(
  params: JsonObject,
  context: ToolExecutionContext,
): ProductInsert | null {
  const name = readString(params.name);
  const price = readNumber(params.price);
  const inventoryCount = readNumber(params.inventory_count);
  const trackInventory = readBoolean(params.track_inventory);
  const lowStockThreshold = readNumber(params.low_stock_threshold);
  if (!name || price === null) {
    return null;
  }

  return {
    tenant_id: context.tenantId,
    created_by_user_id: context.userId,
    name,
    description: readString(params.description),
    sku: readString(params.sku),
    barcode: readString(params.barcode),
    price,
    cost_price: readNumber(params.cost_price),
    compare_at_price: readNumber(params.compare_at_price),
    currency: readString(params.currency) ?? "USD",
    category: readString(params.category),
    subcategory: readString(params.subcategory),
    tags: readStringArray(params.tags),
    source: readString(params.source) ?? "platform",
    status: readString(params.status) ?? "active",
    is_visible: readBoolean(params.is_visible) ?? true,
    ...(inventoryCount !== null ? { inventory_count: inventoryCount } : {}),
    ...(trackInventory !== null ? { track_inventory: trackInventory } : {}),
    ...(lowStockThreshold !== null
      ? { low_stock_threshold: lowStockThreshold }
      : {}),
  };
}

function buildUpdatePayload(changes: JsonObject): ProductUpdate {
  const payload: ProductUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (hasOwnProperty(changes, "name")) {
    payload.name = readString(changes.name) ?? "";
  }
  if (hasOwnProperty(changes, "description")) {
    payload.description = readString(changes.description);
  }
  if (hasOwnProperty(changes, "sku")) {
    payload.sku = readString(changes.sku);
  }
  if (hasOwnProperty(changes, "barcode")) {
    payload.barcode = readString(changes.barcode);
  }
  if (hasOwnProperty(changes, "price")) {
    payload.price = readNumber(changes.price);
  }
  if (hasOwnProperty(changes, "cost_price")) {
    payload.cost_price = readNumber(changes.cost_price);
  }
  if (hasOwnProperty(changes, "compare_at_price")) {
    payload.compare_at_price = readNumber(changes.compare_at_price);
  }
  if (hasOwnProperty(changes, "currency")) {
    payload.currency = readString(changes.currency) ?? "";
  }
  if (hasOwnProperty(changes, "inventory_count")) {
    payload.inventory_count = readNumber(changes.inventory_count);
  }
  if (hasOwnProperty(changes, "track_inventory")) {
    payload.track_inventory = readBoolean(changes.track_inventory);
  }
  if (hasOwnProperty(changes, "low_stock_threshold")) {
    payload.low_stock_threshold = readNumber(changes.low_stock_threshold);
  }
  if (hasOwnProperty(changes, "category")) {
    payload.category = readString(changes.category);
  }
  if (hasOwnProperty(changes, "subcategory")) {
    payload.subcategory = readString(changes.subcategory);
  }
  if (hasOwnProperty(changes, "tags")) {
    payload.tags = readStringArray(changes.tags);
  }
  if (hasOwnProperty(changes, "source")) {
    payload.source = readString(changes.source) ?? "";
  }
  if (hasOwnProperty(changes, "status")) {
    payload.status = readString(changes.status) ?? "";
  }
  if (hasOwnProperty(changes, "is_visible")) {
    payload.is_visible = readBoolean(changes.is_visible);
  }

  return payload;
}

function changedFields(changes: JsonObject): string[] {
  return Object.keys(changes).filter((field) => field !== "product_id");
}

async function createProduct(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const payload = buildCreatePayload(params, context);
  if (!payload) {
    return errorResult(
      "Product name and price are required.",
      "validation_error",
    );
  }

  const priceError = validateCompareAtPrice(
    payload.price ?? null,
    payload.compare_at_price ?? null,
  );
  if (priceError) {
    return errorResult(priceError, "validation_error");
  }

  const duplicate = findDuplicateProduct({
    products: await loadTenantProducts(context),
    name: payload.name,
    sku: payload.sku ?? null,
  });
  if (duplicate) {
    return errorResult(
      `A product named \"${duplicate.name}\" or using SKU \"${duplicate.sku ?? "none"}\" already exists for this tenant.`,
      "duplicate_product",
      { existing_product: mapProductCard(duplicate) },
    );
  }

  const client = getQueryClient(context);
  const { data, error } = await client
    .from("products")
    .insert(payload)
    .select(PRODUCT_CARD_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const product = data as ProductRow;
  return createResult({
    success: true,
    message: `Created ${productLabel(product)}.`,
    data: mapProductCard(product),
    count: 1,
    blockType: "data_card",
  });
}

async function updateProduct(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const productId = readString(params.product_id);
  const changes = isRecord(params.changes)
    ? (params.changes as JsonObject)
    : null;
  if (!productId || !changes) {
    return errorResult(
      "Product ID and a changes object are required.",
      "validation_error",
    );
  }

  const existingProduct = await loadScopedProduct({ productId, context });
  if (!existingProduct) {
    return errorResult(
      "The requested product was not found for this tenant.",
      "product_not_found",
    );
  }

  const payload = buildUpdatePayload(changes);
  const fields = changedFields(changes);
  if (fields.length === 0) {
    return errorResult(
      "No supported product fields were provided to update.",
      "validation_error",
    );
  }

  if (hasOwnProperty(changes, "name") && payload.name === "") {
    return errorResult(
      "Product name must be a non-empty string.",
      "validation_error",
    );
  }
  if (hasOwnProperty(changes, "currency") && payload.currency === "") {
    return errorResult(
      "Currency must be a non-empty ISO code.",
      "validation_error",
    );
  }
  if (hasOwnProperty(changes, "source") && payload.source === "") {
    return errorResult(
      "Source must be a non-empty product source.",
      "validation_error",
    );
  }
  if (hasOwnProperty(changes, "status") && payload.status === "") {
    return errorResult(
      "Status must be a non-empty product status.",
      "validation_error",
    );
  }

  const nextPrice = hasOwnProperty(changes, "price")
    ? (payload.price ?? null)
    : existingProduct.price;
  const nextCompareAtPrice = hasOwnProperty(changes, "compare_at_price")
    ? (payload.compare_at_price ?? null)
    : existingProduct.compare_at_price;
  const priceError = validateCompareAtPrice(nextPrice, nextCompareAtPrice);
  if (priceError) {
    return errorResult(priceError, "validation_error");
  }

  const duplicate = findDuplicateProduct({
    products: await loadTenantProducts(context),
    name: hasOwnProperty(changes, "name") ? (payload.name ?? null) : null,
    sku: hasOwnProperty(changes, "sku") ? (payload.sku ?? null) : null,
    excludeProductId: productId,
  });
  if (duplicate) {
    return errorResult(
      `A product named \"${duplicate.name}\" or using SKU \"${duplicate.sku ?? "none"}\" already exists for this tenant.`,
      "duplicate_product",
      { existing_product: mapProductCard(duplicate) },
    );
  }

  const client = getQueryClient(context);
  const { data, error } = await client
    .from("products")
    .update(payload)
    .eq("tenant_id", context.tenantId)
    .eq("id", productId)
    .select(PRODUCT_CARD_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const product = data as ProductRow;
  const after = mapProductCard(product);
  return createResult({
    success: true,
    message: `Updated ${productLabel(product)}.`,
    data: {
      ...after,
      before: mapProductCard(existingProduct),
      after,
      changed_fields: fields,
    },
    count: 1,
    blockType: "data_card",
  });
}

async function toggleProductStatus(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const productId = readString(params.product_id);
  const nextStatus = readString(params.status);
  if (!productId || !nextStatus) {
    return errorResult(
      "Product ID and status are required.",
      "validation_error",
    );
  }

  const existingProduct = await loadScopedProduct({ productId, context });
  if (!existingProduct) {
    return errorResult(
      "The requested product was not found for this tenant.",
      "product_not_found",
    );
  }

  if (existingProduct.status === nextStatus) {
    return createResult({
      success: true,
      message: `${productLabel(existingProduct)} is already ${nextStatus}.`,
      data: {
        ...mapProductCard(existingProduct),
        previous_status: existingProduct.status,
        new_status: nextStatus,
      },
      count: 1,
      blockType: "data_card",
    });
  }

  const client = getQueryClient(context);
  const { data, error } = await client
    .from("products")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", context.tenantId)
    .eq("id", productId)
    .select(PRODUCT_CARD_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const product = data as ProductRow;
  return createResult({
    success: true,
    message: `${productLabel(product)} status changed from ${existingProduct.status} to ${product.status}.`,
    data: {
      ...mapProductCard(product),
      previous_status: existingProduct.status,
      new_status: product.status,
    },
    count: 1,
    blockType: "data_card",
  });
}

export function productMutationImplementation(
  toolName: ToolName,
): ToolImplementation | null {
  switch (toolName) {
    case "create_product":
      return createProduct;
    case "update_product":
      return updateProduct;
    case "toggle_product_status":
      return toggleProductStatus;
    default:
      return null;
  }
}
