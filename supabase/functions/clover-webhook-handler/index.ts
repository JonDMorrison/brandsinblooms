import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireCloverApproval } from "../_shared/cloverApprovalGate.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto/tokens.ts";
import { fireAutomationTriggers } from "../_shared/automation/fireAutomationTriggers.ts";
import {
  logSignatureFailed,
  logSignatureOK,
} from "../_shared/webhooks/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-clover-auth, x-client-info",
};
type Update = { objectId?: string; type?: string; ts?: number };
type Payload = {
  verificationCode?: string;
  merchants?: Record<string, Update[]>;
};

function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function verifyCloverAuth(request: Request) {
  const expected =
    Deno.env.get("CLOVER_AUTH_CODE") || Deno.env.get("CLOVER_WEBHOOK_SECRET");
  const received = request.headers.get("x-clover-auth");
  const valid = Boolean(
    expected && received && constantTimeEqual(received!, expected!),
  );
  if (!valid) logSignatureFailed("clover", "Invalid Clover auth code");
  return valid;
}

function apiBase(connection: any) {
  if (connection.environment === "sandbox") {
    return "https://apisandbox.dev.clover.com";
  }
  if (String(connection.region).toLowerCase() === "eu") {
    return "https://api.eu.clover.com";
  }
  if (String(connection.region).toLowerCase() === "la") {
    return "https://api.la.clover.com";
  }
  return "https://api.clover.com";
}

async function fetchClover(base: string, path: string, token: string) {
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(
      `Clover API ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  return response.json();
}

function firstElement(value: any) {
  return value?.elements?.[0] || value?.[0] || null;
}

async function resolveCustomer(supabase: any, connection: any, customer: any) {
  if (!customer?.id) return null;
  const email =
    firstElement(customer.emailAddresses)?.emailAddress || customer.email;
  const phone =
    firstElement(customer.phoneNumbers)?.phoneNumber || customer.phone;
  const { error } = await supabase.rpc(
    "resolve_provider_customer_identity_batch",
    {
      p_tenant_id: connection.tenant_id,
      p_provider: "clover",
      p_user_id: connection.user_id,
      p_customers: [
        {
          external_id: customer.id,
          email: email?.toLowerCase() || null,
          phone: phone || null,
          first_name: customer.firstName || null,
          last_name: customer.lastName || null,
        },
      ],
    },
  );
  if (error) throw error;
  const { data: identity } = await supabase
    .from("crm_customer_identity_links")
    .select("crm_customer_id")
    .eq("tenant_id", connection.tenant_id)
    .eq("provider", "clover")
    .eq("external_id", customer.id)
    .maybeSingle();
  return identity?.crm_customer_id || null;
}

async function resolveCustomerId(
  supabase: any,
  connection: any,
  base: string,
  token: string,
  externalId: string | null,
) {
  if (!externalId) return null;
  const merchant = encodeURIComponent(connection.merchant_id);
  const customer = await fetchClover(
    base,
    `/v3/merchants/${merchant}/customers/${encodeURIComponent(externalId)}?expand=emailAddresses,phoneNumbers`,
    token,
  );
  return resolveCustomer(supabase, connection, customer);
}

function refundTotal(order: any, payment: any) {
  const refunds = [
    ...(order?.refunds?.elements || []),
    ...(payment?.refunds?.elements || []),
  ];
  const unique = new Map(
    refunds.map((refund: any) => [refund.id || JSON.stringify(refund), refund]),
  );
  return Array.from(unique.values()).reduce(
    (sum: number, refund: any) => sum + Number(refund.amount || 0) / 100,
    0,
  );
}

async function saveOrder(
  supabase: any,
  connection: any,
  order: any,
  payment: any,
  customerId: string | null,
) {
  const externalId = order?.id || payment?.order?.id || payment?.id;
  if (!externalId) throw new Error("Clover order has no stable ID");
  const externalCustomerId =
    firstElement(order?.customers)?.id ||
    payment?.customer?.id ||
    payment?.customerId ||
    null;
  const total = Number(order?.total ?? payment?.amount ?? 0) / 100;
  const refunded = refundTotal(order, payment);
  const items = order?.lineItems?.elements || [];
  const productNames = items
    .map((item: any) => item?.name || item?.item?.name)
    .filter(
      (value: unknown): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
  const status =
    refunded > 0
      ? "REFUNDED"
      : String(
          order?.paymentState || payment?.result || order?.state || "PAID",
        ).toUpperCase();

  const { data: stored, error } = await supabase
    .from("pos_orders")
    .upsert(
      {
        tenant_id: connection.tenant_id,
        pos_connection_id: connection.id,
        provider: "clover",
        external_id: externalId,
        external_customer_id: externalCustomerId,
        crm_customer_id: customerId,
        external_location_id: connection.merchant_id,
        order_date: new Date(
          order?.createdTime || payment?.createdTime || Date.now(),
        ).toISOString(),
        total_amount: total,
        refund_amount: refunded,
        refunded_at: refunded > 0 ? new Date().toISOString() : null,
        currency: order?.currency || payment?.currency || "USD",
        status,
        items,
        raw_data: { order, payment },
      },
      { onConflict: "pos_connection_id,external_id" },
    )
    .select("crm_customer_id")
    .single();
  if (error)
    throw new Error(`Failed to persist Clover order: ${error.message}`);

  const resolved = stored?.crm_customer_id || customerId;
  if (resolved) {
    const { error: metricsError } = await supabase.rpc(
      "recalculate_purchase_metrics",
      { p_customer_id: resolved },
    );
    if (metricsError) throw metricsError;
    const { data: metrics } = await supabase
      .from("customer_purchase_metrics")
      .select(
        "total_purchases,lifetime_value,first_purchase_date,last_purchase_date",
      )
      .eq("customer_id", resolved)
      .single();
    const { data: customer } = await supabase
      .from("crm_customers")
      .select("pos_source,clover_customer_id")
      .eq("id", resolved)
      .single();
    if (
      metrics &&
      (customer?.pos_source === "clover" ||
        customer?.clover_customer_id === externalCustomerId)
    ) {
      await supabase
        .from("crm_customers")
        .update({
          total_spent: metrics.lifetime_value,
          lifetime_value: metrics.lifetime_value,
          pos_total_spent: metrics.lifetime_value,
          pos_order_count: metrics.total_purchases,
          first_purchase_date: metrics.first_purchase_date,
          last_purchase_date: metrics.last_purchase_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resolved);
    }
    const triggers =
      refunded > 0
        ? ["refund.created"]
        : ["payment.completed", "review_request"];
    if (!refunded && metrics?.total_purchases === 1) {
      triggers.push("first_purchase");
    }
    await fireAutomationTriggers(
      supabase,
      connection.tenant_id,
      resolved,
      triggers,
      {
        order_amount: total,
        order_id: externalId,
        refund_amount: refunded,
        merchant_id: connection.merchant_id,
        pos_source: "clover",
        products: productNames.join(", "),
        product_names: productNames,
        items,
      },
    );
  }
  return { orderId: externalId, customerId: resolved, total, refunded };
}

async function processUpdate(supabase: any, connection: any, update: Update) {
  const [kind, ...parts] = String(update.objectId || "").split(":");
  const id = parts.join(":");
  if (!kind || !id) throw new Error("Invalid Clover objectId");
  if (update.type === "DELETE") return { deleted: update.objectId };
  const token = await decryptToken(connection.encrypted_access_token);
  const base = apiBase(connection);
  const merchant = encodeURIComponent(connection.merchant_id);
  const object = encodeURIComponent(id);

  if (kind === "C") {
    const customer = await fetchClover(
      base,
      `/v3/merchants/${merchant}/customers/${object}?expand=emailAddresses,phoneNumbers`,
      token,
    );
    return {
      customerId: await resolveCustomer(supabase, connection, customer),
    };
  }
  if (kind === "I") {
    const item = await fetchClover(
      base,
      `/v3/merchants/${merchant}/items/${object}`,
      token,
    );
    const { error } = await supabase
      .from("products")
      .update({
        name: item.name,
        price: item.price == null ? undefined : Number(item.price) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", connection.tenant_id)
      .eq("external_id", id);
    if (error) throw error;
    return { itemId: id };
  }

  let order: any = null;
  let payment: any = null;
  if (kind === "O") {
    order = await fetchClover(
      base,
      `/v3/merchants/${merchant}/orders/${object}?expand=lineItems,customers,payments,refunds`,
      token,
    );
  } else if (kind === "P") {
    payment = await fetchClover(
      base,
      `/v3/merchants/${merchant}/payments/${object}?expand=order,refunds`,
      token,
    );
    if (payment?.order?.id) {
      order = await fetchClover(
        base,
        `/v3/merchants/${merchant}/orders/${encodeURIComponent(payment.order.id)}?expand=lineItems,customers,payments,refunds`,
        token,
      );
    }
  } else {
    return { ignoredObjectType: kind };
  }
  const externalCustomerId =
    firstElement(order?.customers)?.id ||
    payment?.customer?.id ||
    payment?.customerId ||
    null;
  const customerId = await resolveCustomerId(
    supabase,
    connection,
    base,
    token,
    externalCustomerId,
  );
  return saveOrder(supabase, connection, order, payment, customerId);
}

serve(async (request: Request) => {
  const approvalResponse = requireCloverApproval(request);
  if (approvalResponse) return approvalResponse;
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let payload: Payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (payload.verificationCode) {
    console.log("[CLOVER-WEBHOOK] Verification code received");
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!verifyCloverAuth(request)) {
    return new Response(JSON.stringify({ error: "Invalid Clover auth code" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!payload.merchants || typeof payload.merchants !== "object") {
    return new Response(
      JSON.stringify({ error: "Missing merchants payload" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  const results: Record<string, unknown>[] = [];
  for (const [merchantId, updates] of Object.entries(payload.merchants)) {
    const { data: connection } = await supabase
      .from("clover_connections")
      .select(
        "id,tenant_id,user_id,merchant_id,environment,region,encrypted_access_token",
      )
      .eq("merchant_id", merchantId)
      .eq("status", "connected")
      .maybeSingle();
    if (!connection) {
      results.push({ merchantId, ignored: "merchant_not_connected" });
      continue;
    }
    await supabase
      .from("clover_connections")
      .update({
        last_webhook_received_at: new Date().toISOString(),
        webhook_last_error: null,
        webhooks_subscribed: true,
      })
      .eq("id", connection.id);

    for (const update of Array.isArray(updates) ? updates : []) {
      const eventId = [
        merchantId,
        update.objectId || "unknown",
        update.type || "unknown",
        update.ts || 0,
      ].join(":");
      logSignatureOK("clover", eventId, update.type || "unknown", merchantId);
      const { data: event, error: eventError } = await supabase
        .from("pos_webhook_events")
        .insert({
          tenant_id: connection.tenant_id,
          provider: "clover",
          connection_id: connection.id,
          event_id: eventId,
          event_type: update.objectId?.split(":")[0] || "unknown",
          payload: update,
          status: "processing",
        })
        .select("id")
        .single();
      if (eventError?.code === "23505") {
        results.push({ eventId, duplicate: true });
        continue;
      }
      if (eventError) throw eventError;
      try {
        const result = await processUpdate(supabase, connection, update);
        await supabase
          .from("pos_webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", event.id);
        results.push({ eventId, ...result });
      } catch (error: any) {
        await supabase
          .from("pos_webhook_events")
          .update({
            status: "failed",
            error_message: error.message,
            processed_at: new Date().toISOString(),
          })
          .eq("id", event.id);
        await supabase
          .from("clover_connections")
          .update({
            webhook_last_error: error.message,
          })
          .eq("id", connection.id);
        results.push({ eventId, error: error.message });
      }
    }
  }
  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
