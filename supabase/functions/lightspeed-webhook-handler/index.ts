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

async function verifyLightspeedSignature(
  rawBody: string,
  signatureHeader: string,
) {
  const secret = Deno.env.get("LIGHTSPEED_WEBHOOK_SECRET");

  if (!secret) {
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
    purchase_count: toInteger(customer.numVisits ?? customer.purchaseCount, 0),
    total_spend:
      customer.totalSpend !== undefined && customer.totalSpend !== null
        ? Number.parseFloat(String(customer.totalSpend))
        : null,
    first_purchase_date: customer.firstVisit ?? null,
    last_purchase_date: customer.lastVisit ?? null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };
}

function mapLightspeedSale(sale: any, connection: LightspeedConnection) {
  return {
    tenant_id: connection.tenant_id,
    lightspeed_sale_id: String(sale.saleID),
    lightspeed_customer_id: sale.customerID ? String(sale.customerID) : null,
    contact_id: sale.Customer?.contactID
      ? String(sale.Customer.contactID)
      : null,
    sale_date: sale.completeTime ?? sale.createTime ?? null,
    total_amount:
      sale.calcTotal !== undefined && sale.calcTotal !== null
        ? Number.parseFloat(String(sale.calcTotal))
        : Number.parseFloat(String(sale.total ?? 0)),
    status: parseLightspeedCompletedFlag(sale.completed) ? "completed" : "open",
    line_items: sale.SaleLines?.SaleLine ?? sale.SaleLines ?? [],
    payment_method:
      sale.SalePayments?.SalePayment?.[0]?.PaymentType?.name ??
      sale.SalePayments?.SalePayment?.[0]?.paymentType?.name ??
      null,
    note: sale.note ?? null,
    raw_data: sale,
    synced_at: new Date().toISOString(),
  };
}

function mapLightspeedProduct(product: any, connection: LightspeedConnection) {
  const rawTags = Array.isArray(product.tags)
    ? product.tags
    : product.Tags?.tag
      ? (Array.isArray(product.Tags.tag)
          ? product.Tags.tag
          : [product.Tags.tag]
        ).map((tag: any) => tag?.name ?? tag)
      : [];

  return {
    tenant_id: connection.tenant_id,
    lightspeed_product_id: String(product.itemID),
    name: product.description ?? null,
    sku:
      product.systemSku ?? product.customSku ?? product.manufacturerSku ?? null,
    description: product.longDescription ?? null,
    price:
      product.Prices?.ItemPrice?.[0]?.amount !== undefined &&
      product.Prices?.ItemPrice?.[0]?.amount !== null
        ? Number.parseFloat(String(product.Prices.ItemPrice[0].amount))
        : product.defaultCost !== undefined && product.defaultCost !== null
          ? Number.parseFloat(String(product.defaultCost))
          : null,
    inventory_count:
      product.ItemShops?.ItemShop?.[0]?.qoh !== undefined &&
      product.ItemShops?.ItemShop?.[0]?.qoh !== null
        ? Number.parseInt(String(product.ItemShops.ItemShop[0].qoh), 10)
        : product.qoh !== undefined && product.qoh !== null
          ? Number.parseInt(String(product.qoh), 10)
          : 0,
    category: product.Category?.name ?? null,
    tags: rawTags,
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
    currency: "USD",
    inventory_count: row.inventory_count ?? 0,
    category: row.category,
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

  const { error: upsertError } = await supabase
    .from("lightspeed_sales")
    .upsert(mapLightspeedSale(sale, connection), {
      onConflict: "tenant_id,lightspeed_sale_id",
    });

  if (upsertError) {
    throw upsertError;
  }

  await supabase
    .from("lightspeed_connections")
    .update({ last_sales_sync: new Date().toISOString() })
    .eq("id", connection.id);

  console.log(
    `[LS-WEBHOOK] Sale ${sale.saleID} upserted for tenant ${connection.tenant_id}`,
  );
}

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
      lightspeed_customer_id: String(customer.customerID),
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

    if (typeof providerRow.purchase_count === "number") {
      crmRow.pos_order_count = providerRow.purchase_count;
    }

    if (typeof providerRow.total_spend === "number") {
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

  const providerRow = mapLightspeedProduct(product, connection);

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
    case "sale.completed":
    case "sale.updated":
      await handleSaleEvent(payload, connection, supabase);
      break;
    case "customer.created":
    case "customer.updated":
      await handleCustomerEvent(payload, connection, supabase);
      break;
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
