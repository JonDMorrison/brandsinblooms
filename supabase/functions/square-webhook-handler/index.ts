import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// FIX: [P30] - Move dynamic crypto imports to top-level instead of repeated await import() calls
import { decryptToken } from "../_shared/crypto/tokens.ts";
import { matchesAutomationTriggerConditions } from "../_shared/automation/triggerConditions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-square-signature, x-square-hmacsha256-signature",
};

interface SquareWebhookPayload {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: { type: string; id: string; object: Record<string, any> };
}

type EnqueueOutcome = {
  jobId: string | null;
  status: string | null;
  message: string | null;
  success: boolean | null;
  current: number | null;
  max: number | null;
};

function parseEnqueueOutcome(payload: unknown): EnqueueOutcome {
  if (typeof payload === "string") {
    return {
      jobId: payload,
      status: "allow",
      message: null,
      success: true,
      current: null,
      max: null,
    };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidate = record.id ?? record.jobId ?? record.job_id;
    return {
      jobId: typeof candidate === "string" ? candidate : null,
      status: typeof record.status === "string" ? record.status : null,
      message: typeof record.message === "string" ? record.message : null,
      success: typeof record.success === "boolean" ? record.success : null,
      current: typeof record.current === "number" ? record.current : null,
      max: typeof record.max === "number" ? record.max : null,
    };
  }

  return {
    jobId: null,
    status: null,
    message: null,
    success: null,
    current: null,
    max: null,
  };
}

async function verifySquareSignature(
  body: string,
  signature: string | null,
  notificationUrl: string,
): Promise<boolean> {
  const webhookSecret = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!webhookSecret) {
    // SECURITY: [W2] - Fail closed on missing secret (was returning true)
    console.error(
      "[WEBHOOK] No SQUARE_WEBHOOK_SIGNATURE_KEY configured - rejecting webhook for security",
    );
    return false;
  }
  if (!signature) {
    console.log("[WEBHOOK] No signature provided");
    return false;
  }
  try {
    const stringToSign = notificationUrl + body;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(stringToSign),
    );
    const expectedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer)),
    );
    // FIX: [P27] - Use constant-time comparison to prevent timing attacks on signature verification
    const sigEncoder = new TextEncoder();
    const a = sigEncoder.encode(signature);
    const b = sigEncoder.encode(expectedSignature);
    if (a.byteLength !== b.byteLength) {
      console.log("[WEBHOOK] Signature mismatch - length differs");
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    const isValid = result === 0;
    if (!isValid) {
      console.log(
        "[WEBHOOK] Signature mismatch - expected:",
        expectedSignature.substring(0, 20) + "...",
        "got:",
        signature.substring(0, 20) + "...",
      );
    }
    return isValid;
  } catch (e: any) {
    console.error("[WEBHOOK] Signature verification error:", e.message);
    return false;
  }
}

async function findTenantByMerchantId(supabase: any, merchantId: string) {
  const { data, error } = await supabase
    .from("square_connections")
    .select(
      "id, tenant_id, user_id, merchant_id, environment, encrypted_access_token",
    )
    .eq("merchant_id", merchantId)
    .eq("status", "connected")
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve Square merchant: ${error.message}`);
  }
  return data;
}

async function updateLastWebhookReceived(supabase: any, connectionId: string) {
  const { error } = await supabase
    .from("square_connections")
    .update({ last_webhook_received_at: new Date().toISOString() })
    .eq("id", connectionId);
  if (error) {
    throw new Error(`Failed to record Square webhook health: ${error.message}`);
  }
}

async function claimWebhookEvent(
  supabase: any,
  connection: any,
  payload: SquareWebhookPayload,
) {
  const { data, error } = await supabase.rpc("claim_pos_webhook_event", {
    p_tenant_id: connection.tenant_id,
    p_provider: "square",
    p_connection_id: connection.id,
    p_event_id: payload.event_id,
    p_event_type: payload.type,
    p_payload: payload,
    p_stale_after_minutes: 15,
  });
  if (error) {
    throw new Error(`Failed to claim Square webhook: ${error.message}`);
  }
  return data as {
    claimed: boolean;
    event_id: string;
    attempt_count: number;
    reason: string;
  };
}

async function completeWebhookEvent(supabase: any, eventId: string) {
  const { data: completed, error } = await supabase.rpc(
    "complete_pos_webhook_event",
    { p_event_id: eventId },
  );
  if (error || completed !== true) {
    throw new Error(
      `Failed to complete Square webhook: ${error?.message || "claim was lost"}`,
    );
  }
}

async function failWebhookEvent(
  supabase: any,
  eventId: string,
  processingError: unknown,
) {
  const message =
    processingError instanceof Error
      ? processingError.message
      : "Unknown Square webhook error";
  const { error } = await supabase.rpc("fail_pos_webhook_event", {
    p_event_id: eventId,
    p_error_message: message,
  });
  if (error) {
    console.error("Failed to record Square webhook failure:", error.message);
  }
}

async function fetchSquareOrder(
  orderId: string,
  accessToken: string,
  environment: string,
): Promise<any> {
  const baseUrl =
    environment === "sandbox"
      ? `https://connect.squareupsandbox.com/v2/orders/${orderId}`
      : `https://connect.squareup.com/v2/orders/${orderId}`;
  const response = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
    },
  });
  const data = await response.json();
  if (!response.ok || !data.order) {
    throw new Error(
      `Square order ${orderId} could not be loaded (${response.status})`,
    );
  }
  return data.order;
}

async function fetchSquareCustomerGroups(
  accessToken: string,
  environment: string,
): Promise<Map<string, string>> {
  const groupMap = new Map<string, string>();
  const baseUrl =
    environment === "sandbox"
      ? "https://connect.squareupsandbox.com/v2/customers/groups"
      : "https://connect.squareup.com/v2/customers/groups";
  try {
    const response = await fetch(baseUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": "2024-01-18",
      },
    });
    const data = await response.json();
    if (response.ok && data.groups)
      data.groups.forEach((g: any) => groupMap.set(g.id, g.name));
    // FIX: [issue #29] - Log errors instead of silently swallowing
  } catch (err) {
    console.error("Square webhook error (fetchSquareCustomerGroups):", err);
  }
  return groupMap;
}

function extractProductNames(order: any): string[] {
  return (order?.line_items || [])
    .map((item: any) => item.name || item.variation_name)
    .filter(Boolean);
}

function checkPersonaTargeting(customer: any, personaTargeting: any): boolean {
  if (!personaTargeting || Object.keys(personaTargeting).length === 0)
    return true;
  if (
    personaTargeting.persona_ids?.length > 0 &&
    (!customer.persona_id ||
      !personaTargeting.persona_ids.includes(customer.persona_id))
  )
    return false;
  if (
    personaTargeting.required_tags?.length > 0 &&
    !personaTargeting.required_tags.every((tag: string) =>
      (customer.tags || []).includes(tag),
    )
  )
    return false;
  if (
    personaTargeting.min_lifetime_value != null &&
    (customer.lifetime_value || 0) < personaTargeting.min_lifetime_value
  )
    return false;
  return true;
}

async function resolveSquareCustomerIdentity(
  supabase: any,
  tenantId: string,
  userId: string,
  externalCustomerId: string | null | undefined,
  fallbackEventId: string,
  email: string | null | undefined,
  phone: string | null | undefined,
  profile: Record<string, unknown> = {},
) {
  const rpcName = externalCustomerId
    ? "resolve_provider_customer_identity"
    : "resolve_crm_customer_identity";
  const rpcArgs = externalCustomerId
    ? {
        p_tenant_id: tenantId,
        p_provider: "square",
        p_external_id: externalCustomerId,
        p_email: email || null,
        p_phone: phone || null,
        p_user_id: userId,
        p_profile: profile,
      }
    : {
        p_tenant_id: tenantId,
        p_provider: "square_payment",
        p_external_id: fallbackEventId,
        p_pos_connection_id: null,
        p_pos_customer_id: null,
        p_email: email || null,
        p_phone: phone || null,
        p_user_id: userId,
        p_profile: profile,
      };

  const { data: resolution, error: resolutionError } = await supabase.rpc(
    rpcName,
    rpcArgs,
  );
  if (resolutionError) {
    throw new Error(
      `Square customer identity resolution failed: ${resolutionError.message}`,
    );
  }

  const customerId = resolution?.customer_id;
  if (!customerId) {
    return {
      customer: null,
      matchMethod: resolution?.match_method || "ambiguous",
      conflictId: resolution?.conflict_id || null,
      created: false,
    };
  }

  const { data: customer, error: customerError } = await supabase
    .from("crm_customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .single();
  if (customerError || !customer) {
    throw new Error(
      `Resolved Square customer could not be loaded: ${customerError?.message || customerId}`,
    );
  }

  return {
    customer,
    matchMethod: resolution?.match_method || "external_id",
    conflictId: resolution?.conflict_id || null,
    created: resolution?.created === true,
  };
}

async function reconcileCustomerPurchaseSummary(
  supabase: any,
  tenantId: string,
  customerId: string,
) {
  const { error: recalculateError } = await supabase.rpc(
    "recalculate_purchase_metrics",
    { p_customer_id: customerId },
  );
  if (recalculateError) {
    throw new Error(
      `Square purchase metric reconciliation failed: ${recalculateError.message}`,
    );
  }

  const { data: metrics, error: metricsError } = await supabase
    .from("customer_purchase_metrics")
    .select(
      "lifetime_value, total_purchases, first_purchase_date, last_purchase_date",
    )
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .single();
  if (metricsError || !metrics) {
    throw new Error(
      `Square purchase summary could not be loaded: ${metricsError?.message || customerId}`,
    );
  }

  const { error: customerUpdateError } = await supabase
    .from("crm_customers")
    .update({
      pos_source: "square",
      first_purchase_date: metrics.first_purchase_date,
      last_purchase_date: metrics.last_purchase_date,
      total_spent: metrics.lifetime_value,
      pos_total_spent: metrics.lifetime_value,
      lifetime_value: metrics.lifetime_value,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", customerId);
  if (customerUpdateError) {
    throw new Error(
      `Square customer purchase summary update failed: ${customerUpdateError.message}`,
    );
  }
  return metrics;
}

async function queueAutomationTriggers(
  supabase: any,
  tenantId: string,
  customerId: string,
  triggerTypes: string[],
  eventData: Record<string, any>,
) {
  const { data: automations, error: automationsError } = await supabase
    .from("crm_automations")
    .select("id, name, trigger_type, trigger_conditions, persona_targeting")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("trigger_type", triggerTypes);
  if (automationsError) {
    throw new Error(
      `Failed to load Square-triggered automations: ${automationsError.message}`,
    );
  }
  if (!automations?.length) return;
  const { data: customer, error: customerError } = await supabase
    .from("crm_customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .single();
  if (customerError || !customer) {
    throw new Error(
      `Square automation customer could not be loaded: ${customerError?.message || customerId}`,
    );
  }

  for (const automation of automations) {
    if (!checkPersonaTargeting(customer, automation.persona_targeting))
      continue;
    if (
      !matchesAutomationTriggerConditions(
        automation.trigger_conditions,
        eventData,
      )
    )
      continue;
    const providerEventId =
      eventData.event_id ||
      eventData.refund_id ||
      eventData.loyalty_account_id ||
      eventData.order_id ||
      eventData.original_order_id;
    if (!providerEventId) {
      throw new Error(
        `Square automation ${automation.name} is missing a stable provider event id`,
      );
    }
    const sourceEventKey = [
      "square",
      automation.trigger_type,
      String(providerEventId),
      eventData.fulfillment_state || "",
    ].join(":");
    const { error: triggerError } = await supabase
      .from("automation_trigger_events")
      .upsert(
        {
          automation_id: automation.id,
          customer_id: customerId,
          tenant_id: tenantId,
          event_type: automation.trigger_type,
          source_event_key: sourceEventKey,
          metadata: {
            source: "square_webhook",
            provider_event: eventData,
          },
        },
        {
          onConflict: "tenant_id,automation_id,source_event_key",
          ignoreDuplicates: true,
        },
      );
    if (triggerError) {
      throw new Error(
        `Failed to queue Square automation ${automation.name}: ${triggerError.message}`,
      );
    }
  }
}

/**
 * Unified handler for payment.created and payment.updated events.
 * Only fires automation triggers when payment status is COMPLETED.
 * payment.created with APPROVED status just records in pos_orders.
 */
// The normalized order is idempotent, identity resolution is serialized in
// Postgres, and automation events have a provider-stable unique key. Returning
// a 500 at any boundary lets Square retry without duplicating a journey.
async function processPaymentEvent(
  supabase: any,
  tenantId: string,
  userId: string,
  paymentObj: any,
  merchantId: string,
  connection: any,
  squareEventType: string,
) {
  const paymentData = paymentObj.payment || paymentObj;
  const paymentId = paymentData.id;
  const paymentStatus = (paymentData.status || "").toUpperCase();
  const amount = (paymentData.amount_money?.amount || 0) / 100;
  const receiptEmail =
    paymentData.receipt_email || paymentData.buyer_email_address;
  const receiptPhone = paymentData.buyer_phone_number;
  const squareCustomerId = paymentData.customer_id;

  console.log(
    `[WEBHOOK] processPaymentEvent | square_event=${squareEventType} | payment_id=${paymentId} | status=${paymentStatus} | amount=${amount}`,
  );

  // Fetch linked order details if available
  let productNames: string[] = [],
    orderData: any = null;
  if (paymentData.order_id) {
    if (!connection?.encrypted_access_token) {
      throw new Error("Square access token is unavailable for order lookup");
    }
    orderData = await fetchSquareOrder(
      paymentData.order_id,
      await decryptToken(connection.encrypted_access_token),
      connection.environment || "production",
    );
    productNames = extractProductNames(orderData);
  }

  // Record/update in pos_orders
  const posConn = connection?.id ? { id: connection.id } : null;
  if (!posConn) {
    throw new Error(`Square connection is missing for merchant ${merchantId}`);
  }
  let priorOrder: { raw_data?: Record<string, unknown> } | null = null;
  if (posConn) {
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("pos_orders")
      .select("raw_data")
      .eq("external_id", paymentId)
      .eq("pos_connection_id", posConn.id)
      .maybeSingle();
    if (existingOrderError) {
      throw new Error(
        `Failed to inspect Square payment ${paymentId}: ${existingOrderError.message}`,
      );
    }
    priorOrder = existingOrder;

    const { error: orderWriteError } = await supabase.from("pos_orders").upsert(
      {
        tenant_id: tenantId,
        provider: "square",
        external_location_id:
          paymentData.location_id ||
          orderData?.location_id ||
          connection?.location_id ||
          null,
        pos_connection_id: posConn.id,
        external_id: paymentId,
        total_amount: amount,
        currency: paymentData.amount_money?.currency || "USD",
        external_customer_id: squareCustomerId,
        order_date: paymentData.created_at || new Date().toISOString(),
        status: paymentStatus,
        items:
          orderData?.line_items?.map((li: any) => ({
            name: li.name || li.variation_name,
            quantity: li.quantity,
            catalog_object_id: li.catalog_object_id,
          })) || [],
        raw_data: {
          ...(priorOrder?.raw_data || {}),
          payment: paymentData,
          order: orderData,
          square_event_type: squareEventType,
        },
      },
      { onConflict: "external_id,pos_connection_id" },
    );
    if (orderWriteError) {
      throw new Error(
        `Failed to persist Square payment ${paymentId}: ${orderWriteError.message}`,
      );
    }
  }

  // Only fire triggers when payment is COMPLETED
  if (paymentStatus !== "COMPLETED") {
    console.log(
      `[WEBHOOK] Payment ${paymentId} status=${paymentStatus} — recorded but triggers NOT fired (waiting for COMPLETED)`,
    );
    return {
      success: true,
      paymentId,
      status: paymentStatus,
      triggersDeferred: true,
    };
  }

  // Idempotency check: see if triggers were already fired for this payment
  if (posConn) {
    if (priorOrder?.raw_data?.triggers_fired) {
      console.log(
        `[WEBHOOK] Payment ${paymentId} triggers already fired — idempotency skip`,
      );
      return { success: true, paymentId, idempotencySkip: true };
    }
  }

  let identityEmail = receiptEmail;
  let identityPhone = receiptPhone;
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (
    squareCustomerId &&
    connection?.encrypted_access_token &&
    (!identityEmail || !identityPhone)
  ) {
    try {
      const accessToken = await decryptToken(connection.encrypted_access_token);
      const env = connection.environment || "production";
      const baseUrl =
        env === "sandbox"
          ? "https://connect.squareupsandbox.com"
          : "https://connect.squareup.com";
      const custResp = await fetch(
        `${baseUrl}/v2/customers/${squareCustomerId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (custResp.ok) {
        const custData = (await custResp.json()).customer;
        identityEmail ||= custData.email_address;
        identityPhone ||= custData.phone_number;
        firstName = custData.given_name || null;
        lastName = custData.family_name || null;
      }
    } catch (e) {
      console.warn(
        `[WEBHOOK] Square customer API lookup failed for ${squareCustomerId}:`,
        e,
      );
    }
  }

  const identity = await resolveSquareCustomerIdentity(
    supabase,
    tenantId,
    userId,
    squareCustomerId,
    `payment:${paymentId}`,
    identityEmail,
    identityPhone,
    {
      first_name: firstName,
      last_name: lastName,
      custom_fields: {
        square_last_payment_id: paymentId,
      },
    },
  );
  const customer = identity.customer;
  const matchedBy = identity.matchMethod;
  let isFirstPurchase = Boolean(
    customer && (identity.created || !customer.first_purchase_date),
  );

  if (customer && posConn) {
    const mergedProductTags = [
      ...new Set([...(customer.product_tags || []), ...productNames]),
    ];
    const { error: customerProfileError } = await supabase
      .from("crm_customers")
      .update({
        pos_source: "square",
        product_tags: mergedProductTags.length > 0 ? mergedProductTags : null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", customer.id);
    if (customerProfileError) {
      throw new Error(
        `Failed to update Square purchase profile: ${customerProfileError.message}`,
      );
    }

    const { error: orderLinkError } = await supabase
      .from("pos_orders")
      .update({
        crm_customer_id: customer.id,
        customer_resolution_status: "linked",
        customer_resolution_reason: null,
      })
      .eq("tenant_id", tenantId)
      .eq("external_id", paymentId)
      .eq("pos_connection_id", posConn.id);
    if (orderLinkError) {
      throw new Error(
        `Failed to link Square payment to customer: ${orderLinkError.message}`,
      );
    }
    const metrics = await reconcileCustomerPurchaseSummary(
      supabase,
      tenantId,
      customer.id,
    );
    isFirstPurchase = metrics.total_purchases === 1;
  }

  if (squareCustomerId) {
    const { error: locationError } = await supabase.rpc(
      "recompute_square_customer_locations",
      {
        p_tenant_id: tenantId,
        p_external_customer_ids: [squareCustomerId],
      },
    );
    if (locationError) {
      throw new Error(
        `Square location activity reconciliation failed: ${locationError.message}`,
      );
    }
  }

  // Queue one durable trigger event per matching automation. The automation
  // executor owns overlap rules and schedules only the next workflow step.
  if (customer) {
    const triggers = ["payment.completed"];
    if (isFirstPurchase) triggers.push("first_purchase");
    console.log(
      `[WEBHOOK] Payment COMPLETED triggers for customer ${customer.id} (matched_by=${matchedBy}): ${triggers.join(", ")}`,
    );
    await queueAutomationTriggers(supabase, tenantId, customer.id, triggers, {
      order_amount: amount,
      order_id: paymentId,
      merchant_id: merchantId,
      products: productNames.join(", "),
      product_names: productNames,
      payment_status: paymentStatus,
      square_event_type: squareEventType,
    });

    // Mark triggers as fired for idempotency
    if (posConn) {
      const { data: currentOrder } = await supabase
        .from("pos_orders")
        .select("raw_data")
        .eq("external_id", paymentId)
        .eq("pos_connection_id", posConn.id)
        .single();
      const { error: triggerMarkerError } = await supabase
        .from("pos_orders")
        .update({
          raw_data: {
            ...(currentOrder?.raw_data || {}),
            triggers_fired: true,
            triggers_fired_at: new Date().toISOString(),
          },
        })
        .eq("external_id", paymentId)
        .eq("pos_connection_id", posConn.id);
      if (triggerMarkerError) {
        throw new Error(
          `Failed to acknowledge Square payment automation events: ${triggerMarkerError.message}`,
        );
      }
    }
  } else {
    console.log(
      `[WEBHOOK] Payment COMPLETED - no customer match. email: ${receiptEmail}, square_id: ${squareCustomerId}, phone: ${receiptPhone}`,
    );
  }

  return {
    success: true,
    isFirstPurchase,
    customerId: customer?.id,
    matchedBy,
    paymentId,
    status: paymentStatus,
  };
}

/**
 * Handler for invoice.payment_made events.
 * Uses primary_recipient data for customer matching.
 */
async function processInvoicePaymentMade(
  supabase: any,
  tenantId: string,
  userId: string,
  invoiceObj: any,
  merchantId: string,
  connection: any,
) {
  const invoice = invoiceObj.invoice || invoiceObj;
  const invoiceId = invoice.id;
  const invoiceStatus = (invoice.status || "").toUpperCase();
  const recipient = invoice.primary_recipient || {};
  const recipientEmail = recipient.email_address;
  const recipientPhone = recipient.phone_number;
  const squareCustomerId = recipient.customer_id;
  const recipientFirstName = recipient.given_name;
  const recipientLastName = recipient.family_name;

  // Calculate total from payment_requests
  const totalAmount = (invoice.payment_requests || []).reduce(
    (sum: number, pr: any) => {
      return sum + (pr.computed_amount_money?.amount || 0) / 100;
    },
    0,
  );

  console.log(
    `[WEBHOOK] processInvoicePaymentMade | invoice_id=${invoiceId} | status=${invoiceStatus} | amount=${totalAmount} | recipient_email=${recipientEmail}`,
  );

  // Record in pos_orders
  const posConn = connection?.id ? { id: connection.id } : null;
  if (!posConn) {
    throw new Error(`Square connection is missing for merchant ${merchantId}`);
  }
  if (posConn) {
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("pos_orders")
      .select("raw_data")
      .eq("external_id", invoiceId)
      .eq("pos_connection_id", posConn.id)
      .maybeSingle();
    if (existingOrderError) {
      throw new Error(
        `Failed to inspect Square invoice ${invoiceId}: ${existingOrderError.message}`,
      );
    }

    const { error: invoiceWriteError } = await supabase
      .from("pos_orders")
      .upsert(
        {
          tenant_id: tenantId,
          provider: "square",
          external_location_id:
            invoice.location_id || connection?.location_id || null,
          pos_connection_id: posConn.id,
          external_id: invoiceId,
          total_amount: totalAmount,
          currency:
            invoice.payment_requests?.[0]?.computed_amount_money?.currency ||
            "USD",
          external_customer_id: squareCustomerId,
          order_date: invoice.created_at || new Date().toISOString(),
          status: invoiceStatus,
          items: [],
          raw_data: {
            ...(existingOrder?.raw_data || {}),
            invoice,
            square_event_type: "invoice.payment_made",
          },
        },
        { onConflict: "external_id,pos_connection_id" },
      );
    if (invoiceWriteError) {
      throw new Error(
        `Failed to persist Square invoice ${invoiceId}: ${invoiceWriteError.message}`,
      );
    }

    if (existingOrder?.raw_data?.triggers_fired) {
      console.log(
        `[WEBHOOK] Invoice ${invoiceId} triggers already fired — idempotency skip`,
      );
      return { success: true, invoiceId, idempotencySkip: true };
    }
  }

  const identity = await resolveSquareCustomerIdentity(
    supabase,
    tenantId,
    userId,
    squareCustomerId,
    `invoice:${invoiceId}`,
    recipientEmail,
    recipientPhone,
    {
      first_name: recipientFirstName,
      last_name: recipientLastName,
      custom_fields: {
        square_last_invoice_id: invoiceId,
      },
    },
  );
  const customer = identity.customer;
  const matchedBy = identity.matchMethod;
  let isFirstPurchase = Boolean(
    customer && (identity.created || !customer.first_purchase_date),
  );

  if (customer && posConn) {
    const { error: orderLinkError } = await supabase
      .from("pos_orders")
      .update({
        crm_customer_id: customer.id,
        customer_resolution_status: "linked",
        customer_resolution_reason: null,
      })
      .eq("tenant_id", tenantId)
      .eq("external_id", invoiceId)
      .eq("pos_connection_id", posConn.id);
    if (orderLinkError) {
      throw new Error(
        `Failed to link Square invoice to customer: ${orderLinkError.message}`,
      );
    }
    const metrics = await reconcileCustomerPurchaseSummary(
      supabase,
      tenantId,
      customer.id,
    );
    isFirstPurchase = metrics.total_purchases === 1;
  }

  if (squareCustomerId) {
    const { error: locationError } = await supabase.rpc(
      "recompute_square_customer_locations",
      {
        p_tenant_id: tenantId,
        p_external_customer_ids: [squareCustomerId],
      },
    );
    if (locationError) {
      throw new Error(
        `Square invoice location reconciliation failed: ${locationError.message}`,
      );
    }
  }

  // Queue the invoice as the same normalized payment trigger used by sales.
  if (customer) {
    const triggers = ["payment.completed"];
    if (isFirstPurchase) triggers.push("first_purchase");
    console.log(
      `[WEBHOOK] Invoice PAID triggers for customer ${customer.id} (matched_by=${matchedBy}): ${triggers.join(", ")}`,
    );
    await queueAutomationTriggers(supabase, tenantId, customer.id, triggers, {
      order_amount: totalAmount,
      order_id: invoiceId,
      merchant_id: merchantId,
      invoice_number: invoice.invoice_number,
      square_event_type: "invoice.payment_made",
    });

    // Mark triggers as fired
    if (posConn) {
      const { data: currentOrder } = await supabase
        .from("pos_orders")
        .select("raw_data")
        .eq("external_id", invoiceId)
        .eq("pos_connection_id", posConn.id)
        .single();
      const { error: triggerMarkerError } = await supabase
        .from("pos_orders")
        .update({
          raw_data: {
            ...(currentOrder?.raw_data || {}),
            triggers_fired: true,
            triggers_fired_at: new Date().toISOString(),
          },
        })
        .eq("external_id", invoiceId)
        .eq("pos_connection_id", posConn.id);
      if (triggerMarkerError) {
        throw new Error(
          `Failed to acknowledge Square invoice automation events: ${triggerMarkerError.message}`,
        );
      }
    }
  } else {
    console.log(
      `[WEBHOOK] Invoice PAID - no customer match. email: ${recipientEmail}, square_id: ${squareCustomerId}, phone: ${recipientPhone}`,
    );
  }

  return {
    success: true,
    isFirstPurchase,
    customerId: customer?.id,
    matchedBy,
    invoiceId,
  };
}

async function processSquareCustomerProfile(
  supabase: any,
  tenantId: string,
  userId: string,
  customerData: any,
  connection: any,
) {
  const customer = customerData.customer || customerData;
  if (!customer.id) return { success: false, reason: "no_customer_id" };

  let tags: string[] = [];
  if (customer.group_ids?.length > 0 && connection?.encrypted_access_token) {
    try {
      const groupMap = await fetchSquareCustomerGroups(
        await decryptToken(connection.encrypted_access_token),
        connection.environment || "production",
      );
      tags = customer.group_ids
        .map((id: string) => groupMap.get(id))
        .filter(Boolean);
    } catch (error) {
      console.error(
        "Square webhook error (processSquareCustomerProfile fetch groups):",
        error,
      );
    }
  }

  const identity = await resolveSquareCustomerIdentity(
    supabase,
    tenantId,
    userId,
    customer.id,
    `customer:${customer.id}`,
    customer.email_address,
    customer.phone_number,
    {
      first_name: customer.given_name,
      last_name: customer.family_name,
      custom_fields: {
        pos_tags: tags,
        square_email_unsubscribed:
          customer.preferences?.email_unsubscribed ?? null,
        square_created_at: customer.created_at || null,
        square_updated_at: customer.updated_at || null,
      },
    },
  );
  if (!identity.customer) {
    return {
      success: true,
      customerId: null,
      resolution: identity.matchMethod,
      conflictId: identity.conflictId,
    };
  }

  const mergedTags = [...new Set([...(identity.customer.tags || []), ...tags])];
  const { error: updateError } = await supabase
    .from("crm_customers")
    .update({
      tags: mergedTags.length > 0 ? mergedTags : null,
      square_group_ids:
        customer.group_ids?.length > 0 ? customer.group_ids : null,
      square_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", identity.customer.id);
  if (updateError) {
    throw new Error(`Failed to update Square customer: ${updateError.message}`);
  }

  return {
    success: true,
    customerId: identity.customer.id,
    resolution: identity.matchMethod,
  };
}

async function processCustomerCreated(
  supabase: any,
  tenantId: string,
  userId: string,
  customerData: any,
  connection: any,
) {
  return processSquareCustomerProfile(
    supabase,
    tenantId,
    userId,
    customerData,
    connection,
  );
}

async function processCustomerUpdated(
  supabase: any,
  tenantId: string,
  userId: string,
  customerData: any,
  connection: any,
) {
  return processSquareCustomerProfile(
    supabase,
    tenantId,
    userId,
    customerData,
    connection,
  );
}

async function processLoyaltyAccountCreated(
  supabase: any,
  tenantId: string,
  userId: string,
  loyaltyData: any,
  merchantId: string,
) {
  const loyaltyAccount = loyaltyData.loyalty_account || loyaltyData;
  const squareCustomerId = loyaltyAccount.customer_id;
  if (!squareCustomerId) return { success: false, error: "No customer ID" };

  const { data: connection } = await supabase
    .from("square_connections")
    .select("encrypted_access_token, environment")
    .eq("merchant_id", merchantId)
    .eq("status", "connected")
    .single();
  if (!connection?.encrypted_access_token)
    return { success: false, error: "No connection" };

  const accessToken = await decryptToken(connection.encrypted_access_token);
  const baseUrl =
    connection.environment === "sandbox"
      ? `https://connect.squareupsandbox.com/v2/customers/${squareCustomerId}`
      : `https://connect.squareup.com/v2/customers/${squareCustomerId}`;
  const response = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
    },
  });
  const data = await response.json();
  if (!response.ok || !data.customer)
    return { success: false, error: "Customer not found" };
  const squareCustomer = data.customer;
  const email = squareCustomer.email_address,
    phone = squareCustomer.phone_number;
  const identity = await resolveSquareCustomerIdentity(
    supabase,
    tenantId,
    userId,
    squareCustomerId,
    `loyalty:${loyaltyAccount.id}`,
    email,
    phone,
    {
      first_name: squareCustomer.given_name,
      last_name: squareCustomer.family_name,
      custom_fields: {
        square_loyalty_account_id: loyaltyAccount.id,
      },
    },
  );
  const customer = identity.customer;
  if (customer) {
    const updatedTags = customer.tags?.includes("Loyalty Member")
      ? customer.tags
      : [...(customer.tags || []), "Loyalty Member"];
    const { error: loyaltyTagError } = await supabase
      .from("crm_customers")
      .update({ tags: updatedTags, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", customer.id);
    if (loyaltyTagError) {
      throw new Error(
        `Failed to mark Square loyalty membership: ${loyaltyTagError.message}`,
      );
    }
  }

  if (customer) {
    // Find the Perks/Loyalty segment for this tenant and add customer to it
    // This triggers the segment.added automation via the database trigger
    const { data: perksSegment } = await supabase
      .from("crm_segments")
      .select("id")
      .eq("tenant_id", tenantId)
      .or("name.ilike.%perks%,name.ilike.%loyalty%")
      .limit(1)
      .single();

    if (perksSegment) {
      console.log(
        `[Loyalty] Adding customer ${customer.id} to Perks segment ${perksSegment.id}`,
      );
      const { error: segmentError } = await supabase
        .from("customer_segments")
        .upsert(
          {
            customer_id: customer.id,
            segment_id: perksSegment.id,
            assigned_by_user_id: userId,
          },
          { onConflict: "customer_id,segment_id" },
        );

      if (segmentError) {
        console.error(
          `[Loyalty] Failed to add customer to segment:`,
          segmentError,
        );
      } else {
        console.log(
          `[Loyalty] Successfully added customer to Perks segment - automation should trigger`,
        );
      }
    } else {
      console.log(
        `[Loyalty] No Perks/Loyalty segment found for tenant ${tenantId}`,
      );
    }

    await queueAutomationTriggers(
      supabase,
      tenantId,
      customer.id,
      ["loyalty_join"],
      { loyalty_account_id: loyaltyAccount.id, merchant_id: merchantId },
    );
  }
  return { success: true, customerId: customer?.id };
}

async function processFulfillmentUpdated(
  supabase: any,
  tenantId: string,
  userId: string,
  fulfillmentData: any,
  merchantId: string,
) {
  const fulfillment = fulfillmentData.fulfillment || fulfillmentData;
  const { order_id: orderId, state, type } = fulfillment;
  const { error: fulfillmentUpdateError } = await supabase
    .from("pos_orders")
    .update({
      fulfillment_state: state,
      fulfillment_type: type,
      updated_at: new Date().toISOString(),
    })
    .eq("external_id", orderId)
    .eq("tenant_id", tenantId);
  if (fulfillmentUpdateError) {
    throw new Error(
      `Failed to persist Square fulfillment: ${fulfillmentUpdateError.message}`,
    );
  }
  const { data: order } = await supabase
    .from("pos_orders")
    .select("crm_customer_id")
    .eq("external_id", orderId)
    .eq("tenant_id", tenantId)
    .single();
  if (!order?.crm_customer_id) return { success: true };
  const triggers: string[] = [];
  if (state === "PREPARED" && type === "PICKUP")
    triggers.push("order.ready_for_pickup");
  else if (state === "COMPLETED" && type === "SHIPMENT")
    triggers.push("order.shipped");
  if (triggers.length)
    await queueAutomationTriggers(
      supabase,
      tenantId,
      order.crm_customer_id,
      triggers,
      {
        order_id: orderId,
        fulfillment_type: type,
        fulfillment_state: state,
        merchant_id: merchantId,
      },
    );
  return { success: true, triggersFired: triggers };
}

async function processRefundCreated(
  supabase: any,
  tenantId: string,
  userId: string,
  refundData: any,
  merchantId: string,
) {
  const refund = refundData.refund || refundData;
  const refundAmount = (refund.amount_money?.amount || 0) / 100;
  const { data: order } = await supabase
    .from("pos_orders")
    .select("id, external_customer_id, crm_customer_id")
    .eq("external_id", refund.payment_id)
    .eq("tenant_id", tenantId)
    .single();
  if (!order) return { success: false, error: "Order not found" };
  const { error: refundWriteError } = await supabase
    .from("pos_orders")
    .update({
      status: "REFUNDED",
      refund_amount: refundAmount,
      refund_reason: refund.reason || "Not specified",
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (refundWriteError) {
    throw new Error(
      `Failed to persist Square refund: ${refundWriteError.message}`,
    );
  }
  if (order.external_customer_id) {
    const { error: locationError } = await supabase.rpc(
      "recompute_square_customer_locations",
      {
        p_tenant_id: tenantId,
        p_external_customer_ids: [order.external_customer_id],
      },
    );
    if (locationError) {
      throw new Error(
        `Square refund reconciliation failed: ${locationError.message}`,
      );
    }
    if (order.crm_customer_id) {
      await reconcileCustomerPurchaseSummary(
        supabase,
        tenantId,
        order.crm_customer_id,
      );
      await queueAutomationTriggers(
        supabase,
        tenantId,
        order.crm_customer_id,
        ["refund.created"],
        {
          refund_id: refund.id,
          refund_amount: refundAmount,
          refund_reason: refund.reason,
          original_order_id: refund.payment_id,
          merchant_id: merchantId,
        },
      );
    }
  }
  return { success: true, refundAmount };
}

async function syncProductToDatabase(
  supabase: any,
  tenantId: string,
  userId: string,
  item: any,
): Promise<boolean> {
  const itemData = item.item_data || {};
  try {
    const { data: product, error } = await supabase
      .from("products")
      .upsert(
        {
          tenant_id: tenantId,
          created_by_user_id: userId,
          external_id: item.id,
          name: itemData.name || "Unnamed Product",
          description: itemData.description || null,
          category: itemData.category?.name || null,
          source: "square",
          status: item.is_deleted ? "archived" : "active",
          sku: itemData.variations?.[0]?.item_variation_data?.sku || null,
          price: itemData.variations?.[0]?.item_variation_data?.price_money
            ?.amount
            ? itemData.variations[0].item_variation_data.price_money.amount /
              100
            : 0,
          currency:
            itemData.variations?.[0]?.item_variation_data?.price_money
              ?.currency || "USD",
          external_data: item,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,external_id" },
      )
      .select()
      .single();
    if (error) return false;
    if (itemData.variations?.length) {
      for (const v of itemData.variations) {
        const vd = v.item_variation_data || {};
        await supabase.from("product_variations").upsert(
          {
            product_id: product.id,
            external_id: v.id,
            name: vd.name || "Default",
            sku: vd.sku || null,
            price: vd.price_money?.amount ? vd.price_money.amount / 100 : 0,
            currency: vd.price_money?.currency || "USD",
            attributes: vd.item_option_values || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "product_id,external_id" },
        );
      }
    }
    if (itemData.image_ids?.length)
      await supabase
        .from("products")
        .update({ has_images: true })
        .eq("id", product.id);
    return true;
    // FIX: [P26] - Log product sync errors instead of silently swallowing
  } catch (err) {
    console.error("[square-webhook] syncProductToDatabase error:", err);
    return false;
  }
}

async function processCatalogVersionUpdated(
  supabase: any,
  tenantId: string,
  userId: string,
  catalogData: any,
  merchantId: string,
) {
  // THROTTLE: Only enqueue catalog sync if no pending/in_progress job exists
  const { data: existingJob } = await supabase
    .from("pos_sync_jobs_v2")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "square")
    .eq("sync_type", "products")
    .in("status", ["pending", "in_progress"])
    .single();

  if (existingJob) {
    console.log(
      `⏭️ Catalog sync skipped - existing job in progress: ${existingJob.id}`,
    );
    return {
      success: true,
      skipped: true,
      reason: "job_in_progress",
      existingJobId: existingJob.id,
    };
  }

  const CATALOG_SYNC_THROTTLE_MINUTES = 15;
  const { data: connection } = await supabase
    .from("square_connections")
    .select("id, last_product_sync")
    .eq("merchant_id", merchantId)
    .eq("status", "connected")
    .single();

  if (!connection) return { success: false, reason: "no_connection" };

  if (connection.last_product_sync) {
    const lastSync = new Date(connection.last_product_sync);
    const minutesSinceLastSync =
      (Date.now() - lastSync.getTime()) / (1000 * 60);
    if (minutesSinceLastSync < CATALOG_SYNC_THROTTLE_MINUTES) {
      console.log(
        `⏭️ Catalog sync throttled - last sync ${Math.round(minutesSinceLastSync)}min ago`,
      );
      return {
        success: true,
        skipped: true,
        reason: "throttled",
        minutesSinceLastSync: Math.round(minutesSinceLastSync),
      };
    }
  }

  try {
    console.log("🔄 Enqueuing catalog sync job (passed throttle check)");

    const { data: enqueueResult, error: enqueueError } = await supabase.rpc(
      "enqueue_pos_sync_job",
      {
        p_tenant_id: tenantId,
        p_provider: "square",
        p_sync_type: "products",
        p_estimated_rows: 5000,
        p_triggered_by: "webhook_catalog_update",
      },
    );

    if (enqueueError) {
      console.error("❌ Failed to enqueue catalog sync:", enqueueError.message);
      return { success: false, error: enqueueError.message };
    }

    const enqueueOutcome = parseEnqueueOutcome(enqueueResult);

    if (
      enqueueOutcome.success === false ||
      enqueueOutcome.status === "denied"
    ) {
      console.warn("⛔ Catalog sync denied:", enqueueOutcome.message);
      return {
        success: false,
        reason: enqueueOutcome.status ?? "denied",
        message: enqueueOutcome.message ?? "Catalog sync could not be queued.",
        current: enqueueOutcome.current,
        max: enqueueOutcome.max,
      };
    }

    if (!enqueueOutcome.jobId) {
      console.error("❌ Missing catalog sync job id:", enqueueResult);
      return { success: false, error: "missing job id" };
    }

    console.log(`✅ Catalog sync job enqueued: ${enqueueOutcome.jobId}`);

    EdgeRuntime.waitUntil(
      supabase.functions.invoke("pos-sync-worker", {
        body: { provider: "square" },
      }),
    );

    return { success: true, jobEnqueued: enqueueOutcome.jobId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function processInventoryCountUpdated(
  supabase: any,
  tenantId: string,
  inventoryData: any,
) {
  const counts = inventoryData?.inventory_counts || [];
  let updated = 0;
  for (const count of counts) {
    const quantity = parseInt(count.quantity || "0", 10);
    const inStock = count.state === "IN_STOCK" ? quantity : 0;
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_id", count.catalog_object_id)
      .single();
    if (product) {
      await supabase
        .from("products")
        .update({
          inventory_count: inStock,
          track_inventory: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
      updated++;
    }
    const { data: variation } = await supabase
      .from("product_variations")
      .select("id")
      .eq("external_id", count.catalog_object_id)
      .single();
    if (variation) {
      await supabase
        .from("product_variations")
        .update({
          inventory_count: inStock,
          track_inventory: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variation.id);
      updated++;
    }
  }
  return { success: true, updatedCount: updated };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  console.log("📨 Square webhook received");

  try {
    const body = await req.text();
    const signature = req.headers.get("x-square-hmacsha256-signature");
    const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/square-webhook-handler`;

    // SIGNATURE VERIFICATION
    const signatureValid = await verifySquareSignature(
      body,
      signature,
      notificationUrl,
    );

    if (!signatureValid) {
      console.error("❌ SIGNATURE_FAILED - Invalid Square webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload: SquareWebhookPayload = JSON.parse(body);

    // ============================================
    // SIGNATURE_OK - Log after successful verification
    // ============================================
    console.log(
      "✅ SIGNATURE_OK | event_id:",
      payload.event_id,
      "| event_type:",
      payload.type,
      "| merchant_id:",
      payload.merchant_id,
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const connection = await findTenantByMerchantId(
      supabase,
      payload.merchant_id,
    );

    if (!connection) {
      console.warn("⚠️ Merchant not connected:", payload.merchant_id);
      return new Response(JSON.stringify({ error: "Merchant not connected" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const claim = await claimWebhookEvent(supabase, connection, payload);
    if (!claim.claimed) {
      const alreadyProcessing = claim.reason === "already_processing";
      return new Response(
        JSON.stringify({
          success: !alreadyProcessing,
          duplicate: true,
          reason: claim.reason,
        }),
        {
          status: alreadyProcessing ? 409 : 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    try {
      let result: any = {
        success: true,
        message: `Event ${payload.type} not handled`,
      };

      switch (payload.type) {
        case "payment.created":
        case "payment.updated":
          result = await processPaymentEvent(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            payload.merchant_id,
            connection,
            payload.type,
          );
          break;
        case "invoice.payment_made":
          result = await processInvoicePaymentMade(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            payload.merchant_id,
            connection,
          );
          break;
        case "customer.created":
          result = await processCustomerCreated(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            connection,
          );
          break;
        case "customer.updated":
          result = await processCustomerUpdated(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            connection,
          );
          break;
        case "loyalty.account.created":
        case "loyalty.program.enrollment.created":
          result = await processLoyaltyAccountCreated(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            payload.merchant_id,
          );
          break;
        case "order.fulfillment.updated":
          result = await processFulfillmentUpdated(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            payload.merchant_id,
          );
          break;
        case "refund.created":
          result = await processRefundCreated(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            payload.merchant_id,
          );
          break;
        case "catalog.version.updated":
          result = await processCatalogVersionUpdated(
            supabase,
            connection.tenant_id,
            connection.user_id,
            payload.data.object,
            payload.merchant_id,
          );
          break;
        case "inventory.count.updated":
          result = await processInventoryCountUpdated(
            supabase,
            connection.tenant_id,
            payload.data.object,
          );
          break;
      }

      if (result?.success !== false) {
        await updateLastWebhookReceived(supabase, connection.id);
      }
      await completeWebhookEvent(supabase, claim.event_id);

      console.log("✅ Result:", JSON.stringify(result));
      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (processingError) {
      await failWebhookEvent(supabase, claim.event_id, processingError);
      throw processingError;
    }
  } catch (error: any) {
    console.error("💥 Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
