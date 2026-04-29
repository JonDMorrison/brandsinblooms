import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { recalculateLightspeedCustomerSpend } from "../_shared/lightspeed/recalculateCustomerSpend.ts";

console.log("[LS-WEBHOOK] Edge function starting");

const HANDLER_NAME = "lightspeed-webhook-handler";
const responseHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lightspeed-signature, x-lightspeed-storeid, x-signature, x-vend-webhook-id, x-vend-webhook-source",
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

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getFirstPresentValue(source: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function hasLegacyLightspeedWrapper(payloadObject: JsonObject) {
  return [
    "Sale",
    "sale",
    "Customer",
    "customer",
    "Item",
    "item",
    "Product",
    "product",
  ].some((key) => Boolean(asObject(payloadObject[key])));
}

function normalizeVendSaleLineItem(lineItem: JsonObject) {
  const product = asObject(lineItem.product);

  return {
    ...lineItem,
    product_id: getFirstNonEmptyString(
      lineItem.product_id,
      lineItem.productId,
      product?.id,
      lineItem.item_id,
      lineItem.itemId,
    ),
    quantity: toNullableNumber(lineItem.quantity) ?? 0,
    price: toNullableNumber(lineItem.price) ?? 0,
    price_total: toNullableNumber(
      lineItem.price_total ?? lineItem.total_price ?? lineItem.total,
    ) ?? 0,
    discount: toNullableNumber(lineItem.discount) ?? 0,
    tax: toNullableNumber(lineItem.tax) ?? 0,
    tax_total: toNullableNumber(lineItem.tax_total) ?? 0,
    name: getFirstNonEmptyString(
      lineItem.name,
      lineItem.product_name,
      lineItem.productName,
      product?.name,
      lineItem.description,
    ),
    sku: getFirstNonEmptyString(
      lineItem.sku,
      lineItem.systemSku,
      lineItem.customSku,
      lineItem.manufacturerSku,
      product?.sku,
    ),
  };
}

function normalizeVendSalePayment(payment: JsonObject) {
  const paymentType = asObject(payment.paymentType);
  const legacyPaymentType = asObject(payment.PaymentType);

  return {
    ...payment,
    payment_type_name: getFirstNonEmptyString(
      payment.payment_type_name,
      payment.paymentTypeName,
      payment.payment_type_id,
      paymentType?.name,
      legacyPaymentType?.name,
    ),
    amount: toNullableNumber(payment.amount) ?? 0,
  };
}

function normalizeSalePayload(payload: JsonObject) {
  const totals = asObject(payload.totals) ?? {};
  const customer = asObject(payload.customer) ?? {};
  const saleProducts = getObjectArray(payload.register_sale_products).map(
    (entry) => normalizeVendSaleLineItem(entry as JsonObject),
  );
  const salePayments = getObjectArray(payload.register_sale_payments).map(
    (entry) => normalizeVendSalePayment(entry as JsonObject),
  );
  const saleId = getFirstNonEmptyString(payload.id, payload.saleID);
  const customerId = getFirstNonEmptyString(
    payload.customer_id,
    customer.id,
    payload.customerID,
  );
  const totalPrice =
    totals.total_price ??
    totals.total_payment ??
    payload.total_price ??
    payload.total ??
    0;
  const totalTax = totals.total_tax ?? payload.total_tax ?? 0;
  const status =
    normalizeOptionalString(payload.status) ??
    normalizeOptionalString(payload.state);
  const saleDate =
    normalizeOptionalString(payload.sale_date) ??
    normalizeOptionalString(payload.completed_at) ??
    normalizeOptionalString(payload.updated_at) ??
    normalizeOptionalString(payload.created_at);
  const createdAt =
    normalizeOptionalString(payload.created_at) ??
    normalizeOptionalString(payload.sale_date);
  const updatedAt = normalizeOptionalString(payload.updated_at);
  const invoiceNumber = normalizeOptionalString(payload.invoice_number);
  const outletId = normalizeOptionalString(payload.outlet_id);
  const registerId = normalizeOptionalString(payload.register_id);
  const userId = normalizeOptionalString(payload.user_id);
  const source = normalizeOptionalString(payload.source);
  const note = normalizeOptionalString(payload.note);

  const normalized = {
    ...payload,
    _vend_format: true,
    _vend_event_type: "sale",
    _sale_id: saleId,
    _total_price: totalPrice,
    _total_tax: totalTax,
    _line_items: saleProducts,
    _payments: salePayments,
    _customer_id: customerId,
    _customer_email: normalizeEmail(customer.email),
    _customer_name: customer.first_name
      ? `${customer.first_name} ${customer.last_name || ""}`.trim()
      : null,
    _status: status,
    _state: normalizeOptionalString(payload.state),
    _sale_date: saleDate,
    _created_at: createdAt,
    _updated_at: updatedAt,
    _invoice_number: invoiceNumber,
    _outlet_id: outletId,
    _register_id: registerId,
    _user_id: userId,
    _source: source,
    _note: note,
    saleID: saleId,
    customerID: customerId,
    customer_id: customerId,
    total_price: totalPrice,
    total_tax: totalTax,
    line_items: saleProducts,
    payments: salePayments,
    completed_at: saleDate,
    created_at: createdAt,
    updated_at: updatedAt,
    status,
    note,
  } satisfies JsonObject;

  console.log(
    `[LS-WEBHOOK] Sale normalized: id=${saleId ?? "n/a"}, total=${String(totalPrice)}, items=${saleProducts.length}`,
  );

  return normalized;
}

function normalizeVendCustomerPayload(payload: JsonObject) {
  return {
    ...payload,
    _vend_format: true,
    _vend_event_type: "customer",
    customerID: payload.id ?? payload.customerID,
    email: normalizeEmail(payload.email),
    phone: getFirstNonEmptyString(payload.phone, payload.mobile, payload.fax),
    firstName: getFirstNonEmptyString(
      payload.first_name,
      payload.contact_first_name,
      payload.firstName,
    ),
    lastName: getFirstNonEmptyString(
      payload.last_name,
      payload.contact_last_name,
      payload.lastName,
    ),
    customerTypeID: getFirstNonEmptyString(
      payload.customer_group_id,
      payload.customerTypeID,
      payload.customer_code,
    ),
    customer_group_id: getFirstNonEmptyString(
      payload.customer_group_id,
      payload.customerTypeID,
      payload.customer_code,
    ),
    loyaltyBalance: toNullableNumber(payload.loyalty_balance),
    loyalty_balance: toNullableNumber(payload.loyalty_balance),
    totalSpend: toNullableNumber(payload.total_spend),
    purchaseCount: toNullableInteger(payload.purchase_count),
    firstVisit: normalizeOptionalString(payload.first_purchase_date),
    lastVisit: normalizeOptionalString(payload.last_purchase_date),
  };
}

function normalizeVendProductPayload(payload: JsonObject) {
  const productId = getFirstNonEmptyString(
    payload.id,
    payload.product_id,
    payload.itemID,
  );
  const category = getFirstNonEmptyString(
    payload.product_type,
    payload.category_name,
    asObject(payload.category)?.name,
  );
  const retailPrice = toNullableNumber(
    payload.retail_price ?? payload.price ?? payload.price_including_tax,
  );

  return {
    ...payload,
    _vend_format: true,
    _vend_event_type: "product",
    itemID: productId,
    product_id: productId,
    name: getFirstNonEmptyString(
      payload.name,
      payload.handle,
      payload.description,
    ),
    description: getFirstNonEmptyString(
      payload.description,
      payload.longDescription,
    ),
    sku: getFirstNonEmptyString(
      payload.sku,
      payload.systemSku,
      payload.customSku,
      payload.manufacturerSku,
    ),
    price: retailPrice,
    retail_price: retailPrice,
    supply_price: toNullableNumber(payload.supply_price ?? payload.defaultCost),
    inventory_count: toNullableInteger(
      payload.inventory_count ??
        payload.available_inventory ??
        payload.stock_on_hand,
    ),
    product_type: category,
    category_name: category,
  };
}

function normalizeVendInventoryPayload(payload: JsonObject) {
  const product = asObject(payload.product) ?? {};
  const outlet = asObject(payload.outlet);
  const productId = getFirstNonEmptyString(
    payload.product_id,
    product.id,
    product.itemID,
  );
  const category = getFirstNonEmptyString(
    product.product_type,
    product.category_name,
    asObject(product.category)?.name,
  );
  const retailPrice = toNullableNumber(
    product.retail_price ??
      product.price ??
      product.price_including_tax ??
      payload.retail_price ??
      payload.price,
  );
  const inventoryCount = toNullableInteger(
    payload.count ??
      payload.inventory_count ??
      product.inventory_count ??
      product.available_inventory,
  );

  return {
    ...product,
    ...payload,
    _vend_format: true,
    _vend_event_type: "inventory",
    _inventory_id: payload.id ?? null,
    _outlet_name: getFirstNonEmptyString(outlet?.name, outlet?.outlet_name),
    itemID: productId,
    product_id: productId,
    id: productId,
    name: getFirstNonEmptyString(
      product.name,
      product.handle,
      payload.name,
      payload.handle,
      product.description,
      payload.description,
    ),
    description: getFirstNonEmptyString(
      product.description,
      product.longDescription,
      payload.description,
    ),
    sku: getFirstNonEmptyString(
      product.sku,
      product.systemSku,
      product.customSku,
      product.manufacturerSku,
      payload.sku,
    ),
    price: retailPrice,
    retail_price: retailPrice,
    supply_price: toNullableNumber(
      payload.attributed_cost ?? product.supply_price ?? product.defaultCost,
    ),
    inventory_count: inventoryCount,
    available_inventory: inventoryCount,
    stock_count: inventoryCount,
    count: inventoryCount,
    product_type: category,
    category_name: category,
    tags: Array.isArray(product.tags) ? product.tags : payload.tags,
    raw_inventory_event: payload,
  };
}

function normalizeVendPayload(eventType: string, payload: unknown): unknown {
  const root = asObject(payload);
  if (!root) {
    return payload;
  }

  const candidate = asObject(root.data) ?? root;
  const hasRSeriesWrapper =
    "Sale" in candidate ||
    "Customer" in candidate ||
    "Item" in candidate ||
    "Product" in candidate;

  console.log(
    `[LS-WEBHOOK] normalizeVendPayload — eventType: ${eventType}, hasRSeriesWrapper: ${hasRSeriesWrapper}, payloadKeys: ${Object.keys(candidate).slice(0, 5).join(", ")}...`,
  );

  if (hasRSeriesWrapper) {
    console.log("[LS-WEBHOOK] Payload has R-Series wrapper — skipping normalization");
    return payload;
  }

  console.log(`[LS-WEBHOOK] Normalizing Vend ${eventType} payload`);

  let normalized: unknown;
  if (
    eventType === "sale.update" ||
    eventType === "sale.completed" ||
    eventType === "sale.updated"
  ) {
    normalized = normalizeSalePayload(candidate);
  } else if (
    eventType === "customer.update" ||
    eventType === "customer.created" ||
    eventType === "customer.updated"
  ) {
    normalized = normalizeVendCustomerPayload(candidate);
  } else if (eventType === "inventory.update") {
    normalized = normalizeVendInventoryPayload(candidate);
  } else if (
    eventType === "product.update" ||
    eventType === "product.updated" ||
    eventType === "item.updated"
  ) {
    normalized = normalizeVendProductPayload(candidate);
  } else {
    console.log(`[LS-WEBHOOK] No normalizer for event type: ${eventType}`);
    return payload;
  }

  if (candidate === root) {
    return normalized;
  }

  const normalizedObject = asObject(normalized);
  return {
    ...root,
    data: normalized,
    ...(normalizedObject?._vend_format === true ? { _vend_format: true } : {}),
    ...(typeof normalizedObject?._vend_event_type === "string"
      ? { _vend_event_type: normalizedObject._vend_event_type }
      : {}),
  };
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
  const spendResult = await recalculateLightspeedCustomerSpend(supabase, {
    tenantId: connection.tenant_id,
    connectionId: connection.id,
    lightspeedCustomerId,
  });

  console.log(
    `[LS-WEBHOOK] Spend recalculation for ${lightspeedCustomerId}: ${spendResult.updated} updated, ${spendResult.skipped} unchanged, ${spendResult.errors} errors`,
  );

  if (spendResult.errors > 0) {
    throw new Error(
      `Failed to recalculate spend for Lightspeed customer ${lightspeedCustomerId}`,
    );
  }
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

function extractVendSignature(header: string | null) {
  if (!header) {
    return null;
  }

  const signatureMatch = header.match(/signature=([a-f0-9]+)/i);
  return signatureMatch?.[1] || null;
}

async function verifyVendSignature(
  rawBody: string,
  signatureHex: string,
  secret: string,
) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody),
    );

    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    if (computedHex.length !== signatureHex.length) {
      return false;
    }

    let mismatch = 0;
    for (let index = 0; index < computedHex.length; index++) {
      mismatch |= computedHex.charCodeAt(index) ^ signatureHex.charCodeAt(index);
    }

    return mismatch === 0;
  } catch (error) {
    console.error("[LS-WEBHOOK] Signature verification error:", error);
    return false;
  }
}

/**
 * Vend/X-Series webhooks do not include an event type field in the payload.
 * Each webhook is registered for a specific type (sale.update, customer.update, etc.)
 * and the payload is the raw entity data.
 *
 * Strategy:
 * 1. Check for explicit type/event fields (R-Series or wrapped payloads)
 * 2. Vend webhook IDs are opaque, so use them for correlation while inferring from payload shape
 * 3. Infer from payload key fingerprint (reliable — each entity has unique keys)
 */
function extractEventType(
  payload: unknown,
  headers?: Headers,
): string {
  const root = asObject(payload);
  const data = asObject(root?.data);
  const payloadObject = data ?? root;
  const vendWebhookId = headers?.get("x-vend-webhook-id");

  const explicitTypeCandidates = [
    root?.type,
    root?.event,
    root?.event_type,
    data?.type,
    data?.event,
    data?.event_type,
  ];

  for (const candidate of explicitTypeCandidates) {
    if (typeof candidate === "string" && candidate.includes(".")) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  if (!payloadObject) {
    return vendWebhookId ? "unknown" : "unknown";
  }

  if (
    "register_sale_products" in payloadObject ||
    "invoice_number" in payloadObject ||
    "sale_date" in payloadObject
  ) {
    return "sale.update";
  }

  if (
    "customer_code" in payloadObject ||
    ("first_name" in payloadObject && "loyalty_balance" in payloadObject) ||
    "enable_loyalty" in payloadObject
  ) {
    return "customer.update";
  }

  if (
    "product_id" in payloadObject &&
    "count" in payloadObject &&
    ("reorder_point" in payloadObject || "restock_level" in payloadObject)
  ) {
    return "inventory.update";
  }

  if (
    "supply_price" in payloadObject ||
    "variant_count" in payloadObject ||
    ("handle" in payloadObject && "sku" in payloadObject)
  ) {
    return "product.update";
  }

  if (
    "register_id" in payloadObject &&
    ("counted" in payloadObject ||
      "float_amount" in payloadObject ||
      "cash_movements" in payloadObject)
  ) {
    return "register_closure.update";
  }

  return "unknown";
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
  const customerRecord = asObject(customer) ?? {};
  const email = normalizeEmail(
    getFirstPresentValue(customerRecord, ["email"]) ??
      customer.Contact?.Emails?.ContactEmail?.[0]?.address,
  );
  const phone = normalizeOptionalString(
    getFirstPresentValue(customerRecord, ["phone", "mobile"]) ??
      customer.Contact?.Phones?.ContactPhone?.[0]?.number ??
      customer.Contact?.Phones?.Phone?.[0]?.number,
  );
  const purchaseCount = toNullableInteger(
    getFirstPresentValue(customerRecord, [
      "num_visits",
      "numVisits",
      "purchase_count",
      "purchaseCount",
    ]),
  );
  const totalSpend = toNullableNumber(
    getFirstPresentValue(customerRecord, ["total_spend", "totalSpend"]),
  );

  return {
    tenant_id: connection.tenant_id,
    lightspeed_customer_id: String(customer.id ?? customer.customerID),
    contact_id: customer.contact_id
      ? String(customer.contact_id)
      : customer.contactID
        ? String(customer.contactID)
        : null,
    email,
    phone,
    first_name:
      normalizeOptionalString(
        customer.first_name ?? customer.firstName ?? customer.contact_first_name,
      ) ?? null,
    last_name:
      normalizeOptionalString(
        customer.last_name ?? customer.lastName ?? customer.contact_last_name,
      ) ?? null,
    customer_group_id: getFirstNonEmptyString(
      customer.customer_group_id,
      customer.customer_code,
      customer.customerTypeID,
      customer.CustomerType?.customerTypeID,
    ),
    loyalty_balance:
      customer.loyalty_balance !== undefined &&
          customer.loyalty_balance !== null
        ? Number.parseFloat(String(customer.loyalty_balance))
        : customer.loyaltyBalance !== undefined &&
            customer.loyaltyBalance !== null
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
    first_purchase_date:
      normalizeOptionalString(
        getFirstPresentValue(customerRecord, ["first_purchase_date", "firstVisit"]),
      ) ?? null,
    last_purchase_date:
      normalizeOptionalString(
        getFirstPresentValue(customerRecord, ["last_purchase_date", "lastVisit"]),
      ) ?? null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };
}

function buildLightspeedCrmCustomerPayload(
  row: ReturnType<typeof mapLightspeedCustomer>,
) {
  const payload: Record<string, unknown> = {
    tenant_id: row.tenant_id,
    updated_at: new Date().toISOString(),
    pos_source: "lightspeed",
    external_id: row.lightspeed_customer_id,
  };

  if (row.email) {
    payload.email = row.email;
  }

  if (row.phone) {
    payload.phone = row.phone;
  }

  if (row.first_name) {
    payload.first_name = row.first_name;
  }

  if (row.last_name) {
    payload.last_name = row.last_name;
  }

  if (typeof row.purchase_count === "number" && row.purchase_count > 0) {
    payload.pos_order_count = row.purchase_count;
  }

  if (typeof row.total_spend === "number" && row.total_spend > 0) {
    payload.total_spent = row.total_spend;
    payload.pos_total_spent = row.total_spend;
    payload.lifetime_value = row.total_spend;
  }

  if (row.first_purchase_date) {
    payload.first_purchase_date = row.first_purchase_date;
  }

  if (row.last_purchase_date) {
    payload.last_purchase_date = row.last_purchase_date;
  }

  return payload;
}

function mapLightspeedSale(sale: any, connection: LightspeedConnection) {
  const payment = Array.isArray(sale.payments)
    ? sale.payments[0]
    : Array.isArray(sale.register_sale_payments)
      ? sale.register_sale_payments[0]
      : (sale.SalePayments?.SalePayment?.[0] ?? null);
  const totals = asObject(sale.totals);

  return {
    tenant_id: connection.tenant_id,
    lightspeed_sale_id: String(sale.id ?? sale.sale_id ?? sale.saleID),
    lightspeed_customer_id:
      (sale.customer_id ?? sale.customer?.id ?? sale.customerID)
        ? String(sale.customer_id ?? sale.customer?.id ?? sale.customerID)
        : null,
    contact_id: sale.Customer?.contactID
      ? String(sale.Customer.contactID)
      : null,
    sale_date:
      sale.completed_at ??
      sale.sale_date ??
      sale.created_at ??
      sale.completeTime ??
      sale.createTime ??
      null,
    total_amount:
      sale.total_price !== undefined && sale.total_price !== null
        ? Number.parseFloat(String(sale.total_price))
        : totals?.total_price !== undefined && totals?.total_price !== null
          ? Number.parseFloat(String(totals.total_price))
          : totals?.total_payment !== undefined &&
              totals?.total_payment !== null
            ? Number.parseFloat(String(totals.total_payment))
        : sale.calcTotal !== undefined && sale.calcTotal !== null
          ? Number.parseFloat(String(sale.calcTotal))
          : Number.parseFloat(String(sale.total ?? 0)),
    status:
      normalizeSaleStatus(sale.status) ||
      (parseLightspeedCompletedFlag(sale.completed) ? "completed" : "open"),
    line_items:
      sale.line_items ??
      sale.register_sale_products ??
      sale.SaleLines?.SaleLine ??
      sale.SaleLines ??
      [],
    payment_method:
      payment?.payment_type_name ??
      payment?.PaymentType?.name ??
      payment?.paymentType?.name ??
      (payment?.payment_type_id ? String(payment.payment_type_id) : null) ??
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
  const productId = String(product.id ?? product.product_id ?? product.itemID);
  const name =
    getFirstNonEmptyString(
      product.name,
      product.handle,
      product.description,
      existingProduct?.name,
    ) ?? `Product ${productId}`;

  return {
    tenant_id: connection.tenant_id,
    lightspeed_product_id: productId,
    name,
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
  const payloadObject = asObject(payload) ?? {};
  const extractedSale = asObject(extractSaleFromPayload(payload));
  const salePayload = extractedSale ?? payloadObject;
  const hasRegisterSaleProducts =
    "register_sale_products" in payloadObject ||
    "register_sale_products" in salePayload;
  const isVend = payloadObject._vend_format === true ||
    salePayload._vend_format === true ||
    (hasRegisterSaleProducts &&
      ("invoice_number" in payloadObject || "invoice_number" in salePayload)) ||
    (("sale_date" in payloadObject || "sale_date" in salePayload) &&
      ("totals" in payloadObject || "totals" in salePayload));
  console.log(
    `[LS-WEBHOOK] handleSaleEvent — format: ${isVend ? "vend" : "legacy"}, _vend_format: ${String(payloadObject._vend_format ?? salePayload._vend_format ?? false)}, has register_sale_products: ${String(hasRegisterSaleProducts)}`,
  );

  const saleId =
    getFirstNonEmptyString(
      salePayload._sale_id,
      salePayload.id,
      salePayload.saleID,
      payloadObject.id,
      payloadObject.saleID,
      asObject(payloadObject.Sale)?.saleID,
    ) ?? null;
  if (!saleId) {
    throw new Error(
      `handleSaleEvent — no sale ID found. Payload keys: ${Object.keys(salePayload).sort().join(", ")}`,
    );
  }

  const totalPrice =
    toNullableNumber(
      salePayload._total_price ??
        asObject(salePayload.totals)?.total_price ??
        asObject(salePayload.totals)?.total_payment ??
        salePayload.total_price ??
        asObject(payloadObject.Sale)?.totalPrice,
    ) ?? 0;
  const saleDate =
    normalizeOptionalString(salePayload._sale_date) ??
    normalizeOptionalString(salePayload.sale_date) ??
    normalizeOptionalString(salePayload.completed_at) ??
    normalizeOptionalString(salePayload.created_at) ??
    normalizeOptionalString(asObject(payloadObject.Sale)?.completedTime);
  const status =
    getFirstNonEmptyString(
      salePayload._status,
      salePayload.status,
      salePayload.state,
      asObject(payloadObject.Sale)?.status,
    ) ??
    (parseLightspeedCompletedFlag(asObject(payloadObject.Sale)?.completed)
      ? "completed"
      : "open");
  const customerId =
    getFirstNonEmptyString(
      salePayload._customer_id,
      salePayload.customer_id,
      salePayload.customerID,
      asObject(payloadObject.Sale)?.customerID,
    ) ?? null;
  const legacySaleLines = asObject(salePayload.SaleLines);
  const legacySalePayments = asObject(salePayload.SalePayments);
  const invoiceNumber =
    getFirstNonEmptyString(
      salePayload._invoice_number,
      salePayload.invoice_number,
      asObject(payloadObject.Sale)?.invoiceNumber,
    ) ?? null;
  const lineItems = getExistingArray(salePayload._line_items).length > 0
    ? getExistingArray(salePayload._line_items)
    : getExistingArray(salePayload.register_sale_products).length > 0
      ? getExistingArray(salePayload.register_sale_products)
      : getExistingArray(salePayload.line_items).length > 0
        ? getExistingArray(salePayload.line_items)
        : getExistingArray(legacySaleLines?.SaleLine).length > 0
          ? getExistingArray(legacySaleLines?.SaleLine)
          : getExistingArray(salePayload.SaleLines);
  const paymentMethods = getExistingArray(salePayload._payments).length > 0
    ? getExistingArray(salePayload._payments)
    : getExistingArray(salePayload.register_sale_payments).length > 0
      ? getExistingArray(salePayload.register_sale_payments)
      : getExistingArray(salePayload.payments).length > 0
        ? getExistingArray(salePayload.payments)
        : getExistingArray(legacySalePayments?.SalePayment).length > 0
          ? getExistingArray(legacySalePayments?.SalePayment)
          : getExistingArray(salePayload.SalePayments);
  const firstPayment = paymentMethods[0] && typeof paymentMethods[0] === "object"
    ? paymentMethods[0] as JsonObject
    : null;
  const note =
    getFirstNonEmptyString(salePayload._note, salePayload.note) ?? null;
  const source =
    getFirstNonEmptyString(salePayload._source, salePayload.source) ?? null;
  const outletId =
    getFirstNonEmptyString(salePayload._outlet_id, salePayload.outlet_id) ?? null;

  const baseMappedSale = mapLightspeedSale(salePayload, connection);
  const mappedSale = {
    ...baseMappedSale,
    lightspeed_sale_id: saleId,
    lightspeed_customer_id: customerId,
    sale_date: saleDate ?? baseMappedSale.sale_date,
    total_amount: totalPrice,
    status: normalizeSaleStatus(status) || baseMappedSale.status,
    line_items: lineItems,
    payment_method:
      getFirstNonEmptyString(
        firstPayment?.payment_type_name,
        firstPayment?.payment_type_id,
        asObject(firstPayment?.PaymentType)?.name,
        asObject(firstPayment?.paymentType)?.name,
      ) ?? baseMappedSale.payment_method,
    note,
    raw_data: {
      ...salePayload,
      ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
      ...(source ? { source } : {}),
      ...(outletId ? { outlet_id: outletId } : {}),
    },
    synced_at: new Date().toISOString(),
  };
  console.log(
    `[LS-WEBHOOK] Sale: id=${saleId}, total=${mappedSale.total_amount}, date=${mappedSale.sale_date}, status=${mappedSale.status}, customer=${mappedSale.lightspeed_customer_id ?? "none"}, items=${Array.isArray(mappedSale.line_items) ? mappedSale.line_items.length : 0}`,
  );

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
    `[LS-WEBHOOK] ✓ Sale ${saleId} upserted for tenant ${connection.tenant_id}`,
  );
}

// SECURITY: [T1] - Write only to the single matched tenant
async function handleCustomerEvent(
  payload: unknown,
  connection: LightspeedConnection,
  supabase: any,
) {
  const payloadObject = asObject(payload);
  const isVend = payloadObject?._vend_format === true;
  console.log(
    `[LS-WEBHOOK] handleCustomerEvent — format: ${isVend ? "vend" : "legacy"}`,
  );

  const customer = extractCustomerFromPayload(payload);
  const customerId = customer ? String(customer.id ?? customer.customerID ?? "") : "";
  if (!customer || customerId.length === 0) {
    console.error("[LS-WEBHOOK] handleCustomerEvent — no customer ID found in payload");
    return;
  }

  const providerRow = mapLightspeedCustomer(customer, connection);
  console.log(
    `[LS-WEBHOOK] Customer: id=${customerId}, email=${providerRow.email ?? "none"}, name=${[providerRow.first_name, providerRow.last_name].filter(Boolean).join(" ") || "n/a"}`,
  );

  const { error: providerUpsertError } = await supabase
    .from("lightspeed_customers")
    .upsert(providerRow, {
      onConflict: "tenant_id,lightspeed_customer_id",
    });

  if (providerUpsertError) {
    throw providerUpsertError;
  }

  const crmPayload = buildLightspeedCrmCustomerPayload(providerRow);
  if (crmPayload.email) {
    const { error: crmUpsertError } = await supabase
      .from("crm_customers")
      .upsert(crmPayload, { onConflict: "tenant_id,email" });

    if (crmUpsertError) {
      throw crmUpsertError;
    }
  }

  await supabase
    .from("lightspeed_connections")
    .update({ last_customer_sync: new Date().toISOString() })
    .eq("id", connection.id);

  console.log(
    `[LS-WEBHOOK] ✓ Customer ${customerId} upserted for tenant ${connection.tenant_id}`,
  );
}

// SECURITY: [T1] - Write only to the single matched tenant
async function handleProductEvent(
  payload: unknown,
  connection: LightspeedConnection,
  supabase: any,
) {
  const payloadObject = asObject(payload);
  const isVend = payloadObject?._vend_format === true;
  console.log(
    `[LS-WEBHOOK] handleProductEvent — format: ${isVend ? "vend" : "legacy"}, subtype: ${String(payloadObject?._vend_event_type ?? "product")}`,
  );

  const product = extractProductFromPayload(payload);
  const productId = product
    ? String(product.id ?? product.product_id ?? product.itemID ?? "")
    : "";
  if (!product || productId.length === 0) {
    console.error("[LS-WEBHOOK] handleProductEvent — no product ID found in payload");
    return;
  }

  const { data: existingProduct, error: existingProductError } = await supabase
    .from("lightspeed_products")
    .select(
      "price,supply_price,inventory_count,stock_count,category,product_type,brand,tags,sku,description,name",
    )
    .eq("tenant_id", connection.tenant_id)
    .eq("lightspeed_product_id", productId)
    .maybeSingle();

  if (existingProductError) {
    console.error(
      `[LS-WEBHOOK] Existing product lookup failed for ${productId}: ${existingProductError.message}`,
    );
  }

  const providerRow = mapLightspeedProduct(
    product,
    connection,
    existingProduct,
  );
  console.log(
    `[LS-WEBHOOK] Product: id=${productId}, name=${providerRow.name ?? "n/a"}, sku=${providerRow.sku ?? "n/a"}, price=${providerRow.price ?? 0}, inventory=${providerRow.inventory_count ?? 0}`,
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
    `[LS-WEBHOOK] ✓ Product ${productId} upserted for tenant ${connection.tenant_id}`,
  );

  if (payloadObject?._vend_event_type === "inventory") {
    console.log(
      `[LS-WEBHOOK] ✓ Stock count updated for product ${productId}: ${providerRow.inventory_count ?? 0}`,
    );
  }
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
    case "register_closure.create":
    case "register_closure.update":
      console.log(
        "[LS-WEBHOOK] Register closure event received — logged, no handler yet",
      );
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

  const incomingHeaders: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    if (!["authorization", "cookie"].includes(key.toLowerCase())) {
      incomingHeaders[key] = value;
    }
  }
  console.log(
    "[LS-WEBHOOK] Incoming headers:",
    JSON.stringify(incomingHeaders),
  );

  const vendWebhookId = req.headers.get("x-vend-webhook-id");
  const vendWebhookSource = req.headers.get("x-vend-webhook-source");
  console.log(
    `[LS-WEBHOOK] Vend webhook: id=${vendWebhookId}, source=${vendWebhookSource}`,
  );

  const contentType = req.headers.get("content-type") || "";
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("text/")
  ) {
    console.warn("[LS-WEBHOOK] Unexpected content-type:", contentType);
  }

  const rawBody = await req.text();
  const rawSignatureHeader =
    req.headers.get("x-signature") ||
    req.headers.get("x-lightspeed-signature");
  const signatureValue =
    extractVendSignature(rawSignatureHeader) || rawSignatureHeader?.trim() || null;
  const webhookSecret = Deno.env.get("LIGHTSPEED_WEBHOOK_SECRET");

  if (webhookSecret && signatureValue) {
    const signatureValid = await verifyVendSignature(
      rawBody,
      signatureValue,
      webhookSecret,
    );
    if (!signatureValid) {
      console.warn("[LS-WEBHOOK] Signature verification failed — rejecting");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    console.log(
      "[LS-WEBHOOK] Signature verified via x-signature HMAC-SHA256",
    );
  } else if (webhookSecret && !signatureValue) {
    console.log(
      "[LS-WEBHOOK] No x-signature header — accepted via URL-based auth (normal for some Vend webhook types)",
    );
  } else {
    console.log(
      "[LS-WEBHOOK] No webhook secret configured — accepting via URL-based auth",
    );
  }

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

  let payload: unknown;
  try {
    if (contentType.includes("application/json")) {
      payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = new URLSearchParams(rawBody);
      const payloadField = formData.get("payload");

      if (payloadField) {
        payload = JSON.parse(payloadField);
      } else {
        const firstKeyResult = formData.keys().next();
        const firstKey = firstKeyResult.done ? null : firstKeyResult.value;

        if (firstKey) {
          try {
            payload = JSON.parse(firstKey);
          } catch {
            try {
              payload = JSON.parse(decodeURIComponent(firstKey));
            } catch {
              const formObject: Record<string, string> = {};
              for (const [key, value] of formData.entries()) {
                formObject[key] = value;
              }
              payload = formObject;
            }
          }
        } else {
          payload = {};
        }
      }

      console.log("[LS-WEBHOOK] Parsed form-encoded body successfully");
    } else {
      payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    }
  } catch (parseError) {
    console.error("[LS-WEBHOOK] Failed to parse payload:", parseError);
    console.error(
      "[LS-WEBHOOK] Raw body (first 500 chars):",
      rawBody.slice(0, 500),
    );
    console.error("[LS-WEBHOOK] Content-Type:", contentType);
    return jsonResponse({ error: "Bad Request" }, 400);
  }

  const parsedPayloadObject = asObject(payload);
  console.log(
    "[LS-WEBHOOK] Parsed payload keys:",
    parsedPayloadObject ? Object.keys(parsedPayloadObject) : [],
  );

  const eventType = extractEventType(payload, req.headers);
  console.log(
    `[LS-WEBHOOK] Event type: ${eventType}, tenant: ${connection.tenant_id}, vend-webhook-id: ${vendWebhookId}`,
  );

  if (eventType === "unknown") {
    const payloadKeys = Object.keys(parsedPayloadObject ?? {}).sort();
    console.warn(
      `[LS-WEBHOOK] Could not infer event type. Payload keys: ${JSON.stringify(payloadKeys)}`,
    );
  }

  const payloadObj = asObject(payload);
  console.log(
    "[LS-WEBHOOK] Payload top-level keys:",
    payloadObj ? Object.keys(payloadObj) : [],
  );
  const payloadDataObj = asObject(payloadObj?.data);
  if (payloadDataObj) {
    console.log(
      "[LS-WEBHOOK] Payload data keys:",
      Object.keys(payloadDataObj),
    );
  }

  const normalizedPayload = normalizeVendPayload(eventType, payload);

  try {
    console.log(`[LS-WEBHOOK] Dispatching ${eventType} to handler...`);
    await dispatchLightspeedEvent(
      eventType,
      normalizedPayload,
      connection,
      supabase,
    );
    console.log(`[LS-WEBHOOK] ✓ ${eventType} handler completed successfully`);

    if (eventType !== "unknown") {
      await updateLastWebhookReceivedAt(supabase, connection.id);
    }

    return jsonResponse({ success: true, event: eventType }, 200);
  } catch (error) {
    const handlerError = error instanceof Error
      ? error
      : new Error(String(error));
    console.error(`[LS-WEBHOOK] Handler error for ${eventType}:`, handlerError);
    console.error(
      "[LS-WEBHOOK] Handler error stack:",
      handlerError.stack ?? "no stack",
    );

    return jsonResponse({ success: false, event: eventType }, 200);
  }
});
