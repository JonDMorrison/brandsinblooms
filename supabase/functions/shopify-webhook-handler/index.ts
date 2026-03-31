import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { fireAutomationTriggers } from "../_shared/automation/fireAutomationTriggers.ts";

type ShopifyConnection = {
  id: string;
  tenant_id: string;
  user_id: string;
  shop_domain: string;
  status: string;
  webhook_last_error: string | null;
};

type JsonRecord = Record<string, any>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeShopDomain(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "") || null
  );
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toDateOnly(value: unknown) {
  const isoValue = toIsoDate(value);
  return isoValue ? isoValue.split("T")[0] : null;
}

function getShopDomainFromRequest(req: Request) {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const trailingSegment = pathSegments[pathSegments.length - 1] ?? null;
  const headerDomain = req.headers.get("x-shopify-shop-domain");

  return normalizeShopDomain(
    trailingSegment && trailingSegment !== "shopify-webhook-handler"
      ? trailingSegment
      : headerDomain,
  );
}

async function verifyShopifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
) {
  const secret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!secret) {
    console.error("[Shopify Webhook] SHOPIFY_CLIENT_SECRET not configured");
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));

  if (computed.length !== signatureHeader.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < computed.length; index += 1) {
    mismatch |= computed.charCodeAt(index) ^ signatureHeader.charCodeAt(index);
  }

  return mismatch === 0;
}

async function findShopifyConnection(
  supabase: any,
  shopDomain: string,
): Promise<ShopifyConnection | null> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select("id, tenant_id, user_id, shop_domain, status, webhook_last_error")
    .eq("shop_domain", shopDomain)
    .eq("status", "connected")
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

async function resolveCrmCustomerByEmail(
  supabase: any,
  tenantId: string,
  email: string | null | undefined,
) {
  if (!email) {
    return null;
  }

  const { data, error } = await supabase
    .from("crm_customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("email", String(email).trim().toLowerCase())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function upsertCrmCustomerFromShopifyCustomer(
  supabase: any,
  connection: ShopifyConnection,
  payload: JsonRecord,
) {
  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : null;
  if (!email) {
    return null;
  }

  const existing = await resolveCrmCustomerByEmail(
    supabase,
    connection.tenant_id,
    email,
  );
  const tags = normalizeTags(payload.tags);
  const totalSpent = toNumber(payload.total_spent, existing?.total_spent || 0);

  const { data, error } = await supabase
    .from("crm_customers")
    .upsert(
      {
        tenant_id: connection.tenant_id,
        user_id: connection.user_id,
        email,
        phone: payload.phone || existing?.phone || null,
        first_name: payload.first_name || existing?.first_name || null,
        last_name: payload.last_name || existing?.last_name || null,
        pos_source: "shopify",
        total_spent: totalSpent,
        lifetime_value: totalSpent,
        email_opt_in:
          typeof payload.accepts_marketing === "boolean"
            ? payload.accepts_marketing
            : existing?.email_opt_in,
        tags:
          tags.length > 0
            ? [...new Set([...(existing?.tags || []), ...tags])]
            : existing?.tags,
      },
      { onConflict: "tenant_id,email" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertShopifyCustomer(
  supabase: any,
  connection: ShopifyConnection,
  payload: JsonRecord,
  contactId: string | null,
) {
  const customerId = payload.id ? String(payload.id) : null;
  if (!customerId) {
    return null;
  }

  const { data, error } = await supabase
    .from("shopify_customers")
    .upsert(
      {
        tenant_id: connection.tenant_id,
        shopify_customer_id: customerId,
        email:
          typeof payload.email === "string"
            ? payload.email.trim().toLowerCase()
            : null,
        first_name: payload.first_name ?? null,
        last_name: payload.last_name ?? null,
        phone: payload.phone ?? null,
        total_spent: toNumber(payload.total_spent, 0),
        orders_count: toInteger(payload.orders_count, 0),
        tags: normalizeTags(payload.tags),
        accepts_marketing: Boolean(payload.accepts_marketing),
        first_order_date: toIsoDate(payload.first_order_date),
        last_order_date: toIsoDate(payload.last_order_date),
        default_address: payload.default_address ?? null,
        contact_id: contactId,
        raw_data: payload,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,shopify_customer_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function handleCustomerEvent(
  payload: JsonRecord,
  connection: ShopifyConnection,
  supabase: any,
) {
  const crmCustomer = await upsertCrmCustomerFromShopifyCustomer(
    supabase,
    connection,
    payload,
  );

  await upsertShopifyCustomer(
    supabase,
    connection,
    payload,
    crmCustomer?.id ?? null,
  );
}

async function handleOrderEvent(
  topic: string,
  payload: JsonRecord,
  connection: ShopifyConnection,
  supabase: any,
  webhookId: string | null,
) {
  const orderId = payload.id ? String(payload.id) : null;
  if (!orderId) {
    return;
  }

  const existingResponse = await supabase
    .from("shopify_orders")
    .select("*")
    .eq("tenant_id", connection.tenant_id)
    .eq("shopify_order_id", orderId)
    .maybeSingle();

  if (existingResponse.error) {
    throw existingResponse.error;
  }

  const existingOrder = existingResponse.data ?? null;
  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : null;
  const orderDate = toIsoDate(payload.created_at) || new Date().toISOString();
  const currentDate =
    toDateOnly(orderDate) || new Date().toISOString().split("T")[0];
  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  const productNames = lineItems
    .map((item) => item?.name)
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  const totalPrice = toNumber(payload.total_price, 0);
  const existingRawData =
    existingOrder &&
    typeof existingOrder.raw_data === "object" &&
    existingOrder.raw_data !== null
      ? existingOrder.raw_data
      : {};

  const crmCustomer = email
    ? await resolveCrmCustomerByEmail(supabase, connection.tenant_id, email)
    : null;

  const upsertPayload = {
    tenant_id: connection.tenant_id,
    shopify_order_id: orderId,
    shopify_customer_id: payload.customer?.id
      ? String(payload.customer.id)
      : null,
    contact_id: crmCustomer?.id ?? existingOrder?.contact_id ?? null,
    email,
    order_number:
      payload.order_number != null
        ? String(payload.order_number)
        : payload.name != null
          ? String(payload.name)
          : null,
    order_date: orderDate,
    total_price: totalPrice,
    subtotal_price: toNumber(payload.subtotal_price, 0),
    total_tax: toNumber(payload.total_tax, 0),
    currency: payload.currency ?? null,
    financial_status: payload.financial_status ?? null,
    fulfillment_status: payload.fulfillment_status ?? null,
    line_items: lineItems,
    shipping_address: payload.shipping_address ?? null,
    discount_codes: payload.discount_codes ?? null,
    tags: normalizeTags(payload.tags),
    note: payload.note ?? null,
    raw_data: {
      ...existingRawData,
      order_payload: payload,
      last_topic: topic,
      last_webhook_id: webhookId,
    },
    synced_at: new Date().toISOString(),
  };

  const { data: orderRow, error: orderError } = await supabase
    .from("shopify_orders")
    .upsert(upsertPayload, { onConflict: "tenant_id,shopify_order_id" })
    .select("*")
    .single();

  if (orderError) {
    throw orderError;
  }

  if (upsertPayload.shopify_customer_id) {
    const { data: providerCustomer, error: providerCustomerError } =
      await supabase
        .from("shopify_customers")
        .select("id, orders_count, last_order_date, contact_id")
        .eq("tenant_id", connection.tenant_id)
        .eq("shopify_customer_id", upsertPayload.shopify_customer_id)
        .maybeSingle();

    if (providerCustomerError) {
      throw providerCustomerError;
    }

    if (providerCustomer) {
      const nextOrdersCount =
        payload.customer?.orders_count != null
          ? toInteger(
              payload.customer.orders_count,
              providerCustomer.orders_count || 0,
            )
          : Math.max(
              providerCustomer.orders_count || 0,
              existingOrder
                ? providerCustomer.orders_count || 0
                : (providerCustomer.orders_count || 0) + 1,
            );

      await supabase
        .from("shopify_customers")
        .update({
          orders_count: nextOrdersCount,
          last_order_date: orderDate,
          contact_id: crmCustomer?.id ?? providerCustomer.contact_id ?? null,
          synced_at: new Date().toISOString(),
        })
        .eq("id", providerCustomer.id);
    }
  }

  if (topic !== "orders/paid" || !crmCustomer) {
    return;
  }

  const paidEventProcessed = Boolean(existingRawData.processed_paid_event_at);
  if (paidEventProcessed && existingOrder?.financial_status === "paid") {
    console.log(
      `[Shopify Webhook] Paid order ${orderId} already processed for automations`,
    );
    return;
  }

  const isFirstPurchase = !crmCustomer.first_purchase_date;
  const mergedProductTags = [
    ...new Set([...(crmCustomer.product_tags || []), ...productNames]),
  ];

  await supabase
    .from("crm_customers")
    .update({
      first_purchase_date: isFirstPurchase
        ? currentDate
        : crmCustomer.first_purchase_date,
      last_purchase_date: currentDate,
      total_spent: (crmCustomer.total_spent || 0) + totalPrice,
      lifetime_value: (crmCustomer.lifetime_value || 0) + totalPrice,
      product_tags: mergedProductTags.length > 0 ? mergedProductTags : null,
      pos_source: "shopify",
      updated_at: new Date().toISOString(),
    })
    .eq("id", crmCustomer.id);

  await supabase
    .from("shopify_orders")
    .update({
      contact_id: crmCustomer.id,
      raw_data: {
        ...existingRawData,
        order_payload: payload,
        last_topic: topic,
        last_webhook_id: webhookId,
        processed_paid_event_at: new Date().toISOString(),
      },
    })
    .eq("id", orderRow.id);

  const triggers = ["payment.completed"];
  if (isFirstPurchase) {
    triggers.push("first_purchase");
  }

  await fireAutomationTriggers(
    supabase,
    connection.tenant_id,
    crmCustomer.id,
    triggers,
    {
      order_amount: totalPrice,
      order_id: orderId,
      products: productNames,
      payment_status: payload.financial_status,
      shop_domain: connection.shop_domain,
      shopify_topic: topic,
    },
  );
}

async function handleFulfillmentEvent(
  payload: JsonRecord,
  connection: ShopifyConnection,
  supabase: any,
) {
  const orderId = payload.id ? String(payload.id) : null;
  if (!orderId) {
    return;
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("shopify_orders")
    .select("*")
    .eq("tenant_id", connection.tenant_id)
    .eq("shopify_order_id", orderId)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!orderRow) {
    return;
  }

  const existingRawData =
    orderRow &&
    typeof orderRow.raw_data === "object" &&
    orderRow.raw_data !== null
      ? orderRow.raw_data
      : {};

  const alreadyProcessed = Boolean(
    existingRawData.processed_fulfilled_event_at,
  );

  await supabase
    .from("shopify_orders")
    .update({
      fulfillment_status: payload.fulfillment_status ?? "fulfilled",
      raw_data: {
        ...existingRawData,
        order_payload: payload,
        processed_fulfilled_event_at: alreadyProcessed
          ? existingRawData.processed_fulfilled_event_at
          : new Date().toISOString(),
      },
      synced_at: new Date().toISOString(),
    })
    .eq("id", orderRow.id);

  if (alreadyProcessed || !orderRow.contact_id) {
    return;
  }

  await fireAutomationTriggers(
    supabase,
    connection.tenant_id,
    orderRow.contact_id,
    ["order.fulfilled", "order.shipped"],
    {
      order_id: orderRow.shopify_order_id,
      fulfillment_status: payload.fulfillment_status ?? "fulfilled",
      shop_domain: connection.shop_domain,
      shopify_topic: "orders/fulfilled",
    },
  );
}

async function handleOrderCancelledEvent(
  payload: JsonRecord,
  connection: ShopifyConnection,
  supabase: any,
) {
  const orderId = payload.id ? String(payload.id) : null;
  if (!orderId) {
    return;
  }

  await supabase
    .from("shopify_orders")
    .update({
      financial_status: "cancelled",
      fulfillment_status: payload.fulfillment_status ?? null,
      raw_data: payload,
      synced_at: new Date().toISOString(),
    })
    .eq("tenant_id", connection.tenant_id)
    .eq("shopify_order_id", orderId);
}

function extractRefundAmount(refundPayload: JsonRecord) {
  if (refundPayload.transactions && Array.isArray(refundPayload.transactions)) {
    const transactionTotal = refundPayload.transactions.reduce(
      (sum: number, transaction: JsonRecord) =>
        sum + toNumber(transaction.amount, 0),
      0,
    );
    if (transactionTotal > 0) {
      return transactionTotal;
    }
  }

  if (refundPayload.amount != null) {
    return toNumber(refundPayload.amount, 0);
  }

  return 0;
}

async function handleRefundEvent(
  payload: JsonRecord,
  connection: ShopifyConnection,
  supabase: any,
) {
  const refundId = payload.id ? String(payload.id) : null;
  const orderId = payload.order_id ? String(payload.order_id) : null;

  if (!refundId || !orderId) {
    return;
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("shopify_orders")
    .select("*")
    .eq("tenant_id", connection.tenant_id)
    .eq("shopify_order_id", orderId)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!orderRow) {
    return;
  }

  const existingRawData =
    orderRow &&
    typeof orderRow.raw_data === "object" &&
    orderRow.raw_data !== null
      ? orderRow.raw_data
      : {};
  const processedRefundIds = Array.isArray(existingRawData.processed_refund_ids)
    ? existingRawData.processed_refund_ids.map((entry: unknown) =>
        String(entry),
      )
    : [];

  if (processedRefundIds.includes(refundId)) {
    console.log(`[Shopify Webhook] Refund ${refundId} already processed`);
    return;
  }

  const refundAmount = extractRefundAmount(payload);
  const nextProcessedRefundIds = [...processedRefundIds, refundId];

  await supabase
    .from("shopify_orders")
    .update({
      raw_data: {
        ...existingRawData,
        last_refund_payload: payload,
        processed_refund_ids: nextProcessedRefundIds,
      },
      synced_at: new Date().toISOString(),
    })
    .eq("id", orderRow.id);

  let crmCustomer = null;
  if (orderRow.contact_id) {
    const { data, error } = await supabase
      .from("crm_customers")
      .select("*")
      .eq("id", orderRow.contact_id)
      .maybeSingle();

    if (error) {
      throw error;
    }
    crmCustomer = data ?? null;
  } else if (orderRow.email) {
    crmCustomer = await resolveCrmCustomerByEmail(
      supabase,
      connection.tenant_id,
      orderRow.email,
    );
  }

  if (!crmCustomer) {
    return;
  }

  await supabase
    .from("crm_customers")
    .update({
      lifetime_value: Math.max(
        0,
        (crmCustomer.lifetime_value || 0) - refundAmount,
      ),
      total_spent: Math.max(0, (crmCustomer.total_spent || 0) - refundAmount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", crmCustomer.id);

  if (!orderRow.contact_id) {
    await supabase
      .from("shopify_orders")
      .update({ contact_id: crmCustomer.id })
      .eq("id", orderRow.id);
  }

  await fireAutomationTriggers(
    supabase,
    connection.tenant_id,
    crmCustomer.id,
    ["refund.created"],
    {
      refund_amount: refundAmount,
      refund_reason: payload.note || payload.reason || "Not specified",
      original_order_id: orderRow.shopify_order_id,
      shop_domain: connection.shop_domain,
      shopify_topic: "refunds/create",
    },
  );
}

async function handleProductEvent(
  payload: JsonRecord,
  connection: ShopifyConnection,
  supabase: any,
) {
  const productId = payload.id ? String(payload.id) : null;
  if (!productId) {
    return;
  }

  await supabase.from("shopify_products").upsert(
    {
      tenant_id: connection.tenant_id,
      shopify_product_id: productId,
      title: payload.title ?? null,
      vendor: payload.vendor ?? null,
      product_type: payload.product_type ?? null,
      status: payload.status ?? null,
      tags: normalizeTags(payload.tags),
      variants: payload.variants ?? null,
      images: payload.images ?? null,
      inventory_quantity: Array.isArray(payload.variants)
        ? payload.variants.reduce(
            (sum: number, variant: JsonRecord) =>
              sum + toInteger(variant.inventory_quantity, 0),
            0,
          )
        : 0,
      raw_data: payload,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,shopify_product_id" },
  );
}

async function handleAppUninstalled(
  connection: ShopifyConnection,
  supabase: any,
) {
  console.warn(
    `[Shopify Webhook] App uninstalled for ${connection.shop_domain}`,
  );

  await supabase
    .from("shopify_connections")
    .update({
      status: "revoked",
      webhook_last_error:
        "App was uninstalled from Shopify. Reconnect to restore sync.",
      webhooks_subscribed: false,
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      webhook_subscription_ids: null,
      webhook_next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
}

async function dispatchShopifyEvent(
  topic: string | null,
  payload: JsonRecord,
  connection: ShopifyConnection,
  supabase: any,
  webhookId: string | null,
) {
  switch (topic) {
    case "customers/create":
    case "customers/update":
      await handleCustomerEvent(payload, connection, supabase);
      break;
    case "orders/create":
    case "orders/updated":
    case "orders/paid":
      await handleOrderEvent(topic, payload, connection, supabase, webhookId);
      break;
    case "orders/fulfilled":
      await handleFulfillmentEvent(payload, connection, supabase);
      break;
    case "orders/cancelled":
      await handleOrderCancelledEvent(payload, connection, supabase);
      break;
    case "refunds/create":
      await handleRefundEvent(payload, connection, supabase);
      break;
    case "products/create":
    case "products/update":
      await handleProductEvent(payload, connection, supabase);
      break;
    case "app/uninstalled":
      await handleAppUninstalled(connection, supabase);
      break;
    default:
      console.log(`[Shopify Webhook] Unhandled topic: ${topic}`);
      break;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const shopDomain = getShopDomainFromRequest(req);
  if (!shopDomain) {
    console.error("[Shopify Webhook] No shop domain found");
    return new Response("Missing routing context", { status: 400 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-shopify-hmac-sha256");

  if (
    !signature ||
    !(await verifyShopifyWebhookSignature(rawBody, signature))
  ) {
    console.warn(`[Shopify Webhook] Invalid signature for ${shopDomain}`);
    return new Response("Unauthorized", { status: 401 });
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

  let payload: JsonRecord;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error(`[Shopify Webhook] Invalid JSON payload for ${shopDomain}`);
    return new Response("Bad payload", { status: 400 });
  }

  const connection = await findShopifyConnection(supabase, shopDomain);
  if (!connection) {
    console.warn(
      `[Shopify Webhook] No connected store found for ${shopDomain}`,
    );
    return new Response("OK", { status: 200 });
  }

  await supabase
    .from("shopify_connections")
    .update({
      last_webhook_received_at: new Date().toISOString(),
      webhook_last_error: null,
    })
    .eq("id", connection.id);

  const topic = req.headers.get("x-shopify-topic");
  const webhookId = req.headers.get("x-shopify-webhook-id");

  console.log(
    `[Shopify Webhook] Topic: ${topic}, tenant: ${connection.tenant_id}, shop: ${shopDomain}`,
  );

  try {
    await dispatchShopifyEvent(topic, payload, connection, supabase, webhookId);
  } catch (error) {
    console.error(`[Shopify Webhook] Dispatch error for ${topic}:`, error);
  }

  return new Response("OK", { status: 200 });
});
