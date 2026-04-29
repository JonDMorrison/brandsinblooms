import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

console.log("[LS-WEBHOOK] Edge function starting");

const HANDLER_NAME = "lightspeed-webhook-handler";
const responseHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lightspeed-signature, x-lightspeed-storeid",
  "Content-Type": "application/json",
};

type JsonObject = Record<string, unknown>;

type LightspeedConnection = {
  id: string;
  tenant_id: string;
  domain_prefix: string;
  retailer_id: number | null;
  status: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonObject;
}

function toInteger(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function parseLightspeedCompletedFlag(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSaleStatus(status: unknown) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function isCompletedSaleStatus(status: unknown) {
  return ["completed", "closed", "paid"].includes(normalizeSaleStatus(status));
}

function getFirstNonEmptyString(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function getObjectArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry && typeof entry === "object");
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
}

function getVariants(product: any) {
  return getObjectArray(
    product.variants ?? product.Variants?.Variant ?? product.variant,
  );
}

function getInventoryEntries(product: any) {
  return getObjectArray(
    product.inventory ?? product.Inventory ?? product.inventory_levels,
  );
}

function extractProductPrice(product: any) {
  const primaryVariant = getVariants(product)[0] as
    | Record<string, unknown>
    | undefined;

  return toNullableNumber(
    product.price_including_tax ??
      product.price ??
      product.retail_price ??
      primaryVariant?.price_including_tax ??
      primaryVariant?.price ??
      primaryVariant?.retail_price ??
      product.default_price ??
      product.defaultPrice ??
      product.Prices?.ItemPrice?.[0]?.amount,
  );
}

function extractProductSupplyPrice(product: any) {
  const primaryVariant = getVariants(product)[0] as
    | Record<string, unknown>
    | undefined;

  return toNullableNumber(
    product.supply_price ??
      product.supplyPrice ??
      primaryVariant?.supply_price ??
      primaryVariant?.supplyPrice ??
      product.defaultCost,
  );
}

function extractProductInventoryCount(product: any) {
  const primaryInventory = getInventoryEntries(product)[0] as
    | Record<string, unknown>
    | undefined;

  return toNullableInteger(
    product.inventory_count ??
      product.available_inventory ??
      product.stock_on_hand ??
      product.qoh ??
      primaryInventory?.count ??
      primaryInventory?.current_amount ??
      primaryInventory?.available ??
      product.ItemShops?.ItemShop?.[0]?.qoh,
  );
}

function extractProductCategory(product: any) {
  return getFirstNonEmptyString(
    product.product_type,
    product.productType,
    product.type,
    product.category_name,
    product.category?.name,
    product.Category?.name,
    product.ProductType?.name,
    product.product_type?.name,
  );
}

function extractProductBrand(product: any) {
  return getFirstNonEmptyString(
    product.brand_name,
    product.brand,
    product.Brand?.name,
    product.brand?.name,
  );
}

function extractProductTags(product: any) {
  const tags = new Set<string>();

  if (Array.isArray(product.tags)) {
    for (const tag of product.tags) {
      const value = typeof tag === "string" ? tag : tag?.name;
      if (typeof value === "string" && value.trim().length > 0) {
        tags.add(value.trim());
      }
    }
  }

  const legacyTags = product.Tags?.tag;
  if (Array.isArray(legacyTags)) {
    for (const tag of legacyTags) {
      const value = typeof tag === "string" ? tag : tag?.name;
      if (typeof value === "string" && value.trim().length > 0) {
        tags.add(value.trim());
      }
    }
  } else {
    const value =
      typeof legacyTags === "string" ? legacyTags : legacyTags?.name;
    if (typeof value === "string" && value.trim().length > 0) {
      tags.add(value.trim());
    }
  }

  return Array.from(tags);
}

function getExistingArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

async function propagateSalesRollupToCrm(
  supabase: any,
  tenantId: string,
  lightspeedCustomerId: string,
  purchaseCount: number,
  totalSpend: number,
  firstPurchaseDate: string | null,
  lastPurchaseDate: string | null,
) {
  const { data: updatedRows, error } = await supabase
    .from("crm_customers")
    .update({
      updated_at: new Date().toISOString(),
      pos_source: "lightspeed",
      external_id: lightspeedCustomerId,
      pos_order_count: purchaseCount,
      total_spent: totalSpend,
      pos_total_spent: totalSpend,
      lifetime_value: totalSpend,
      first_purchase_date: firstPurchaseDate,
      last_purchase_date: lastPurchaseDate,
    })
    .eq("tenant_id", tenantId)
    .eq("pos_source", "lightspeed")
    .eq("external_id", lightspeedCustomerId)
    .select("id");

  if (error) {
    console.error(
      "[LS-WEBHOOK] Failed to propagate CRM rollup:",
      error.message,
    );
    return;
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.warn(
      `[LS-WEBHOOK] No CRM customer linked to Lightspeed customer ${lightspeedCustomerId}; skipping CRM rollup propagation`,
    );
  }
}

async function refreshCustomerRollupFromSales(
  supabase: any,
  connection: LightspeedConnection,
  lightspeedCustomerId: string,
) {
  const { data: customerSales, error: customerSalesError } = await supabase
    .from("lightspeed_sales")
    .select("total_amount,sale_date,status")
    .eq("tenant_id", connection.tenant_id)
    .eq("lightspeed_customer_id", lightspeedCustomerId)
    .order("sale_date", { ascending: true });

  if (customerSalesError) {
    throw customerSalesError;
  }

  const completedSales = (customerSales ?? []).filter((customerSale: any) =>
    isCompletedSaleStatus(customerSale.status),
  );
  const totalSpend = completedSales.reduce(
    (sum: number, customerSale: any) =>
      sum + Number.parseFloat(String(customerSale.total_amount ?? 0)),
    0,
  );
  const purchaseCount = completedSales.length;
  const firstPurchaseDate = completedSales[0]?.sale_date ?? null;
  const lastPurchaseDate =
    completedSales[completedSales.length - 1]?.sale_date ?? null;

  const { error: customerUpdateError } = await supabase
    .from("lightspeed_customers")
    .update({
      total_spend: totalSpend,
      purchase_count: purchaseCount,
      first_purchase_date: firstPurchaseDate,
      last_purchase_date: lastPurchaseDate,
    })
    .eq("tenant_id", connection.tenant_id)
    .eq("lightspeed_customer_id", lightspeedCustomerId);

  if (customerUpdateError) {
    throw customerUpdateError;
  }

  await propagateSalesRollupToCrm(
    supabase,
    connection.tenant_id,
    lightspeedCustomerId,
    purchaseCount,
    totalSpend,
    firstPurchaseDate,
    lastPurchaseDate,
  );
}

function getRoutingContext(req: Request) {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const trailingSegment = pathSegments[pathSegments.length - 1] ?? null;
  const domainPrefixFromPath =
    trailingSegment && trailingSegment !== HANDLER_NAME
      ? trailingSegment
      : null;
  const storeIdFromHeader =
    req.headers.get("x-lightspeed-storeid")?.trim() || null;

  return {
    domainPrefixFromPath,
    storeIdFromHeader,
  };
}

function isProductionEnvironment() {
  const environment =
    Deno.env.get("ENVIRONMENT") ??
    Deno.env.get("NODE_ENV") ??
    Deno.env.get("SUPABASE_ENV") ??
    "";

  return ["production", "prod"].includes(environment.toLowerCase());
}

function decodeBase64Signature(signatureHeader: string) {
  const normalized = signatureHeader
    .trim()
    .replace(/^sha256=/i, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// FIX: [P3] - HMAC-SHA256 webhook signature verification
async function verifyLightspeedSignature(
  rawBody: string,
  signatureHeader: string,
) {
  const secret = Deno.env.get("LIGHTSPEED_WEBHOOK_SECRET");

  if (!secret) {
    // FIX: [P3] - Fail closed in production when secret is missing
    console.warn("[LS-WEBHOOK] LIGHTSPEED_WEBHOOK_SECRET not configured");
    return !isProductionEnvironment();
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Signature(signatureHeader),
      encoder.encode(rawBody),
    );
  } catch (error) {
    console.error("[LS-WEBHOOK] Signature verification error:", error);
    return false;
  }
}

function extractEventType(payload: unknown) {
  const root = asObject(payload);
  const data = asObject(root?.data);

  const eventType =
    root?.event_type ?? root?.type ?? data?.event_type ?? data?.type;
  return typeof eventType === "string" && eventType.length > 0
    ? eventType
    : "unknown";
}

function extractEntity(
  payload: unknown,
  idKey: string,
  candidateKeys: string[],
) {
  const root = asObject(payload);
  const containers = [
    root,
    asObject(root?.data),
    asObject(asObject(root?.data)?.object),
  ].filter((value): value is JsonObject => Boolean(value));

  for (const container of containers) {
    for (const candidateKey of candidateKeys) {
      const candidate = asObject(container[candidateKey]);
      if (candidate?.[idKey] !== undefined && candidate?.[idKey] !== null) {
        return candidate;
      }
    }

    if (container[idKey] !== undefined && container[idKey] !== null) {
      return container;
    }
  }

  return null;
}

function extractSaleFromPayload(payload: unknown) {
  return extractEntity(payload, "saleID", ["Sale", "sale"]);
}

function extractCustomerFromPayload(payload: unknown) {
  return extractEntity(payload, "customerID", ["Customer", "customer"]);
}

function extractProductFromPayload(payload: unknown) {
  return extractEntity(payload, "itemID", [
    "Item",
    "item",
    "Product",
    "product",
  ]);
}

function mapLightspeedCustomer(
  customer: any,
  connection: LightspeedConnection,
) {
  const email = normalizeEmail(
    customer.Contact?.Emails?.ContactEmail?.[0]?.address ?? customer.email,
  );
  const purchaseCount = toNullableInteger(
    customer.numVisits ?? customer.purchaseCount,
  );
  const totalSpend = toNullableNumber(customer.totalSpend);

  return {
    tenant_id: connection.tenant_id,
    lightspeed_customer_id: String(customer.customerID),
    contact_id: customer.contactID ? String(customer.contactID) : null,
    email,
    phone:
      customer.Contact?.Phones?.ContactPhone?.[0]?.number ??
      customer.Contact?.Phones?.Phone?.[0]?.number ??
      null,
    first_name: customer.firstName ?? null,
    last_name: customer.lastName ?? null,
    customer_group_id: customer.customerTypeID
      ? String(customer.customerTypeID)
      : customer.CustomerType?.customerTypeID
        ? String(customer.CustomerType.customerTypeID)
        : null,
    loyalty_balance:
      customer.loyaltyBalance !== undefined && customer.loyaltyBalance !== null
        ? Number.parseFloat(String(customer.loyaltyBalance))
        : customer.creditAccountID
          ? 0
          : null,
    purchase_count:
      typeof purchaseCount === "number" && purchaseCount > 0
        ? purchaseCount
        : null,
    total_spend:
      typeof totalSpend === "number" && totalSpend > 0 ? totalSpend : null,
    first_purchase_date: customer.firstVisit ?? null,
    last_purchase_date: customer.lastVisit ?? null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };
}

function mapLightspeedSale(sale: any, connection: LightspeedConnection) {
  const payment = Array.isArray(sale.payments)
    ? sale.payments[0]
    : (sale.SalePayments?.SalePayment?.[0] ?? null);

  return {
    tenant_id: connection.tenant_id,
    lightspeed_sale_id: String(sale.id ?? sale.saleID),
    lightspeed_customer_id:
      (sale.customer_id ?? sale.customer?.id ?? sale.customerID)
        ? String(sale.customer_id ?? sale.customer?.id ?? sale.customerID)
        : null,
    contact_id: sale.Customer?.contactID
      ? String(sale.Customer.contactID)
      : null,
    sale_date:
      sale.completed_at ??
      sale.created_at ??
      sale.completeTime ??
      sale.createTime ??
      null,
    total_amount:
      sale.total_price !== undefined && sale.total_price !== null
        ? Number.parseFloat(String(sale.total_price))
        : sale.calcTotal !== undefined && sale.calcTotal !== null
          ? Number.parseFloat(String(sale.calcTotal))
          : Number.parseFloat(String(sale.total ?? 0)),
    status:
      normalizeSaleStatus(sale.status) ||
      (parseLightspeedCompletedFlag(sale.completed) ? "completed" : "open"),
    line_items:
      sale.line_items ?? sale.SaleLines?.SaleLine ?? sale.SaleLines ?? [],
    payment_method:
      payment?.payment_type_name ??
      payment?.PaymentType?.name ??
      payment?.paymentType?.name ??
      null,
    note: sale.note ?? null,
    raw_data: sale,
    synced_at: new Date().toISOString(),
  };
}

function mapLightspeedProduct(
  product: any,
  connection: LightspeedConnection,
  existingProduct?: Record<string, unknown> | null,
) {
  const price = extractProductPrice(product);
  const supplyPrice = extractProductSupplyPrice(product);
  const inventoryCount = extractProductInventoryCount(product);
  const category = extractProductCategory(product);
  const tags = extractProductTags(product);

  return {
    tenant_id: connection.tenant_id,
    lightspeed_product_id: String(product.id ?? product.itemID),
    name: product.name ?? product.description ?? existingProduct?.name ?? null,
    sku:
      product.sku ??
      product.systemSku ??
      product.customSku ??
      product.manufacturerSku ??
      existingProduct?.sku ??
      null,
    description:
      product.longDescription ??
      product.description ??
      existingProduct?.description ??
      null,
    price: price ?? existingProduct?.price ?? 0,
    supply_price: supplyPrice ?? existingProduct?.supply_price ?? 0,
    inventory_count: inventoryCount ?? existingProduct?.inventory_count ?? 0,
    stock_count:
      inventoryCount ??
      existingProduct?.stock_count ??
      existingProduct?.inventory_count ??
      0,
    category:
      category ??
      existingProduct?.category ??
      existingProduct?.product_type ??
      null,
    product_type:
      category ??
      existingProduct?.product_type ??
      existingProduct?.category ??
      null,
    brand: extractProductBrand(product) ?? existingProduct?.brand ?? null,
    tags: tags.length > 0 ? tags : getExistingArray(existingProduct?.tags),
    raw_data: product,
    synced_at: new Date().toISOString(),
  };
}

function mapLightspeedProductToCatalogProduct(
  row: ReturnType<typeof mapLightspeedProduct>,
) {
  return {
    tenant_id: row.tenant_id,
    external_id: row.lightspeed_product_id,
    source: "lightspeed",
    name: row.name ?? "Unnamed Product",
    description: row.description,
    sku: row.sku,
    price: row.price ?? 0,
    cost_price: row.supply_price ?? 0,
    currency: "USD",
    inventory_count: row.inventory_count ?? 0,
    stock_count: row.stock_count ?? row.inventory_count ?? 0,
    category: row.category ?? row.product_type ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    external_data: row.raw_data ?? {},
    last_synced_at: row.synced_at,
    status: "active",
    is_visible: true,
    updated_at: row.synced_at,
  };
}

async function resolveLightspeedConnection(
  supabase: any,
  domainPrefixFromPath: string | null,
  storeIdFromHeader: string | null,
) {
  if (domainPrefixFromPath) {
    const { data, error } = await supabase
      .from("lightspeed_connections")
      .select("*")
      .eq("status", "connected")
      .eq("domain_prefix", domainPrefixFromPath)
      .limit(1);

    return {
      connection: (data?.[0] ?? null) as LightspeedConnection | null,
      error,
      routingSource: "path",
      routingKey: domainPrefixFromPath,
    };
  }

  if (!storeIdFromHeader) {
    return {
      connection: null,
      error: null,
      routingSource: null,
      routingKey: null,
    };
  }

  const retailerId = Number.parseInt(storeIdFromHeader, 10);
  if (!Number.isFinite(retailerId)) {
    return {
      connection: null,
      error: null,
      routingSource: "header",
      routingKey: storeIdFromHeader,
    };
  }

  const { data, error } = await supabase
    .from("lightspeed_connections")
    .select("*")
    .eq("status", "connected")
    .eq("retailer_id", retailerId)
    .limit(1);

  return {
    connection: (data?.[0] ?? null) as LightspeedConnection | null,
    error,
    routingSource: "header",
    routingKey: String(retailerId),
  };
}

async function updateLastWebhookReceivedAt(
  supabase: any,
  connectionId: string,
) {
  const { error } = await supabase
    .from("lightspeed_connections")
    .update({ last_webhook_received_at: new Date().toISOString() })
    .eq("id", connectionId);

  if (error) {
    console.error(
      "[LS-WEBHOOK] Failed to update last_webhook_received_at:",
      error.message,
    );
  }
}

// SECURITY: [T1] - Each handler writes only to the single matched tenant
async function handleSaleEvent(
  payload: unknown,
  connection: LightspeedConnection,
  supabase: any,
) {
  const sale = extractSaleFromPayload(payload);
  if (!sale?.saleID) {
    console.log("[LS-WEBHOOK] Sale event missing saleID, ignoring");
    return;
  }

  const mappedSale = mapLightspeedSale(sale, connection);

  const { error: upsertError } = await supabase
    .from("lightspeed_sales")
    .upsert(mappedSale, {
      onConflict: "tenant_id,lightspeed_sale_id",
    });

  if (upsertError) {
    throw upsertError;
  }

  await supabase
    .from("lightspeed_connections")
    .update({ last_sales_sync: new Date().toISOString() })
    .eq("id", connection.id);

  if (mappedSale.lightspeed_customer_id) {
    await refreshCustomerRollupFromSales(
      supabase,
      connection,
      mappedSale.lightspeed_customer_id,
    );
  }

  console.log(
    `[LS-WEBHOOK] Sale ${sale.saleID} upserted for tenant ${connection.tenant_id}`,
  );
}

// SECURITY: [T1] - Write only to the single matched tenant
async function handleCustomerEvent(
  payload: unknown,
  connection: LightspeedConnection,
  supabase: any,
) {
  const customer = extractCustomerFromPayload(payload);
  if (!customer?.customerID) {
    console.log("[LS-WEBHOOK] Customer event missing customerID, ignoring");
    return;
  }

  const providerRow = mapLightspeedCustomer(customer, connection);

  const { error: providerUpsertError } = await supabase
    .from("lightspeed_customers")
    .upsert(providerRow, {
      onConflict: "tenant_id,lightspeed_customer_id",
    });

  if (providerUpsertError) {
    throw providerUpsertError;
  }

  const email = providerRow.email;

  if (email) {
    const crmRow: Record<string, unknown> = {
      tenant_id: connection.tenant_id,
      email,
      pos_source: "lightspeed",
      external_id: String(customer.customerID),
      updated_at: new Date().toISOString(),
    };

    if (providerRow.first_name) {
      crmRow.first_name = providerRow.first_name;
    }

    if (providerRow.last_name) {
      crmRow.last_name = providerRow.last_name;
    }

    if (providerRow.phone) {
      crmRow.phone = providerRow.phone;
    }

    if (
      typeof providerRow.purchase_count === "number" &&
      providerRow.purchase_count > 0
    ) {
      crmRow.pos_order_count = providerRow.purchase_count;
    }

    if (
      typeof providerRow.total_spend === "number" &&
      providerRow.total_spend > 0
    ) {
      crmRow.total_spent = providerRow.total_spend;
      crmRow.pos_total_spent = providerRow.total_spend;
      crmRow.lifetime_value = providerRow.total_spend;
    }

    if (providerRow.first_purchase_date) {
      crmRow.first_purchase_date = providerRow.first_purchase_date;
    }

    if (providerRow.last_purchase_date) {
      crmRow.last_purchase_date = providerRow.last_purchase_date;
    }

    const { error: crmUpsertError } = await supabase
      .from("crm_customers")
      .upsert(crmRow, { onConflict: "tenant_id,email" });

    if (crmUpsertError) {
      throw crmUpsertError;
    }
  }

  await supabase
    .from("lightspeed_connections")
    .update({ last_customer_sync: new Date().toISOString() })
    .eq("id", connection.id);

  console.log(
    `[LS-WEBHOOK] Customer ${customer.customerID} upserted for tenant ${connection.tenant_id}`,
  );
}

// SECURITY: [T1] - Write only to the single matched tenant
async function handleProductEvent(
  payload: unknown,
  connection: LightspeedConnection,
  supabase: any,
) {
  const product = extractProductFromPayload(payload);
  if (!product?.itemID) {
    console.log("[LS-WEBHOOK] Product event missing itemID, ignoring");
    return;
  }

  const productId = String(product.id ?? product.itemID);
  const { data: existingProduct } = await supabase
    .from("lightspeed_products")
    .select(
      "price,supply_price,inventory_count,stock_count,category,product_type,brand,tags,sku,description,name",
    )
    .eq("tenant_id", connection.tenant_id)
    .eq("lightspeed_product_id", productId)
    .maybeSingle();

  const providerRow = mapLightspeedProduct(
    product,
    connection,
    existingProduct,
  );

  const { error: upsertError } = await supabase
    .from("lightspeed_products")
    .upsert(providerRow, {
      onConflict: "tenant_id,lightspeed_product_id",
    });

  if (upsertError) {
    throw upsertError;
  }

  const { error: catalogUpsertError } = await supabase
    .from("products")
    .upsert(mapLightspeedProductToCatalogProduct(providerRow), {
      onConflict: "tenant_id,external_id",
    });

  if (catalogUpsertError) {
    throw catalogUpsertError;
  }

  await supabase
    .from("lightspeed_connections")
    .update({ last_product_sync: new Date().toISOString() })
    .eq("id", connection.id);

  console.log(
    `[LS-WEBHOOK] Product ${product.itemID} upserted for tenant ${connection.tenant_id}`,
  );
}

async function dispatchLightspeedEvent(
  eventType: string,
  payload: unknown,
  connection: LightspeedConnection,
  supabase: any,
) {
  switch (eventType) {
    case "sale.update":
    case "sale.completed":
    case "sale.updated":
      await handleSaleEvent(payload, connection, supabase);
      break;
    case "customer.update":
    case "customer.created":
    case "customer.updated":
      await handleCustomerEvent(payload, connection, supabase);
      break;
    case "product.update":
    case "inventory.update":
    case "product.updated":
    case "item.updated":
      await handleProductEvent(payload, connection, supabase);
      break;
    default:
      console.log(`[LS-WEBHOOK] Unhandled event type: ${eventType} — ignoring`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: responseHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { domainPrefixFromPath, storeIdFromHeader } = getRoutingContext(req);
  if (!domainPrefixFromPath && !storeIdFromHeader) {
    console.error("[LS-WEBHOOK] No routing key found in path or headers");
    return jsonResponse({ error: "Missing routing context" }, 400);
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-lightspeed-signature");

  if (!signatureHeader) {
    console.warn("[LS-WEBHOOK] Missing signature header — rejecting");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const signatureValid = await verifyLightspeedSignature(
    rawBody,
    signatureHeader,
  );
  if (!signatureValid) {
    console.warn("[LS-WEBHOOK] Signature verification failed — rejecting");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  console.log("[LS-WEBHOOK] Signature verified");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const {
    connection,
    error: connError,
    routingSource,
    routingKey,
  } = await resolveLightspeedConnection(
    supabase,
    domainPrefixFromPath,
    storeIdFromHeader,
  );

  if (connError) {
    console.error(
      "[LS-WEBHOOK] Connection resolution error:",
      connError.message,
    );
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  if (!connection) {
    console.warn(
      `[LS-WEBHOOK] No matching connected Lightspeed store found for ${routingSource ?? "unknown"} routing key ${routingKey ?? "n/a"}`,
    );
    return jsonResponse({ success: true, unroutable: true }, 200);
  }

  console.log(
    `[LS-WEBHOOK] Routed via ${routingSource}=${routingKey} to tenant ${connection.tenant_id}, connection ${connection.id}`,
  );

  await updateLastWebhookReceivedAt(supabase, connection.id);

  let payload: unknown;
  try {
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    console.error("[LS-WEBHOOK] Invalid JSON payload");
    return jsonResponse({ error: "Bad Request" }, 400);
  }

  const eventType = extractEventType(payload);
  console.log(
    `[LS-WEBHOOK] Event type: ${eventType}, tenant: ${connection.tenant_id}`,
  );

  try {
    await dispatchLightspeedEvent(eventType, payload, connection, supabase);
  } catch (error) {
    console.error(`[LS-WEBHOOK] Event dispatch error for ${eventType}:`, error);
  }

  return jsonResponse({ success: true, processed: eventType }, 200);
});
