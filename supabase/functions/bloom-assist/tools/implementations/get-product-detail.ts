import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import { getQueryClient, isJsonValue } from "./shared.ts";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariationRow =
  Database["public"]["Tables"]["product_variations"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];

const PRODUCT_DETAIL_SELECT = `
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
  external_id,
  external_data,
  last_synced_at,
  status,
  is_visible,
  slug,
  meta_title,
  meta_description,
  created_at,
  updated_at
`;

const PRODUCT_VARIATION_SELECT = `
  id,
  product_id,
  name,
  sku,
  barcode,
  price,
  cost_price,
  compare_at_price,
  inventory_count,
  attributes,
  external_id,
  is_active,
  sort_order,
  created_at,
  updated_at
`;

const PRODUCT_IMAGE_SELECT = `
  id,
  product_id,
  variation_id,
  global_image_id,
  image_url,
  thumbnail_url,
  alt_text,
  sort_order,
  is_primary,
  source,
  created_at
`;

function readId(params: JsonObject, key: string): string | null {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function jsonOrNull(value: unknown): JsonValue | null {
  return isJsonValue(value) ? value : null;
}

function createDetailResult(data: JsonObject): ToolResult {
  return {
    success: true,
    data,
    count: 1,
    message: "Found the requested product.",
    error: null,
    block_type: "data_card",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function createNotFoundResult(message: string): ToolResult {
  return {
    success: false,
    data: null,
    count: 0,
    message,
    error: "not_found",
    block_type: "data_card",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function mapVariation(row: ProductVariationRow): JsonObject {
  return {
    id: row.id,
    product_id: row.product_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    price: row.price,
    cost_price: row.cost_price,
    compare_at_price: row.compare_at_price,
    inventory_count: row.inventory_count,
    attributes: jsonOrNull(row.attributes),
    external_id: row.external_id,
    is_active: row.is_active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapImage(row: ProductImageRow): JsonObject {
  return {
    id: row.id,
    product_id: row.product_id,
    variation_id: row.variation_id,
    global_image_id: row.global_image_id,
    image_url: row.image_url,
    thumbnail_url: row.thumbnail_url,
    alt_text: row.alt_text,
    sort_order: row.sort_order,
    is_primary: row.is_primary,
    source: row.source,
    created_at: row.created_at,
  };
}

function mapProduct(
  row: ProductRow,
  variations: ProductVariationRow[],
  images: ProductImageRow[],
): JsonObject {
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
    external_id: row.external_id,
    external_data: jsonOrNull(row.external_data),
    vendor: row.source === "platform" ? null : row.source,
    last_synced_at: row.last_synced_at,
    status: row.status,
    is_visible: row.is_visible,
    slug: row.slug,
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    variations: variations.map(
      (variation) => mapVariation(variation) as JsonValue,
    ),
    images: images.map((image) => mapImage(image) as JsonValue),
  };
}

export const getProductDetail: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const productId = readId(params, "product_id");
  if (!productId) {
    return createNotFoundResult("No product ID was provided.");
  }

  const client = getQueryClient(context);
  const { data: product, error: productError } = await client
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("tenant_id", context.tenantId)
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    throw productError;
  }

  if (!product) {
    return createNotFoundResult("No product found with that ID.");
  }

  const [variationsResponse, imagesResponse] = await Promise.all([
    client
      .from("product_variations")
      .select(PRODUCT_VARIATION_SELECT)
      .eq("product_id", productId)
      .order("sort_order", { ascending: true, nullsFirst: false }),
    client
      .from("product_images")
      .select(PRODUCT_IMAGE_SELECT)
      .eq("product_id", productId)
      .order("sort_order", { ascending: true, nullsFirst: false }),
  ]);

  if (variationsResponse.error) {
    throw variationsResponse.error;
  }
  if (imagesResponse.error) {
    throw imagesResponse.error;
  }

  return createDetailResult(
    mapProduct(
      product as ProductRow,
      (variationsResponse.data ?? []) as ProductVariationRow[],
      (imagesResponse.data ?? []) as ProductImageRow[],
    ),
  );
};
