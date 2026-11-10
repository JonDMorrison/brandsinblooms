import { createClient } from "npm:@supabase/supabase-js@2";
import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";
import { normalizeMtaDelivery } from "../_shared/mtaDeliveryStatus.ts";
import {
  deriveMtaWebhookSecret,
  normalizeMtaInboundReply,
  unwrapMtaWebhookPayload,
  verifyMtaWebhookSignature,
} from "../_shared/mtaWebhook.ts";
import { requireInternalApiKey } from "../_shared/requireInternalApiKey.ts";

const DEFAULT_BASE_URL = "https://api.mobile-text-alerts.com";
const EVENTS = ["delivery-status", "message-reply"] as const;

type WebhookEvent = typeof EVENTS[number];
type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function mtaRequest(
  apiKey: string,
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(`Mobile Text Alerts webhook API returned HTTP ${response.status}`);
  return payload;
}

async function listMtaWebhooks(apiKey: string, baseUrl: string): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  for (let page = 0; page < 10; page += 1) {
    const payload = await mtaRequest(apiKey, baseUrl, `/v3/webhooks?page=${page}&pageSize=100`);
    const data = asRecord(asRecord(payload)?.data);
    const pageRows = Array.isArray(data?.rows)
      ? data.rows.map(asRecord).filter((row): row is JsonRecord => row !== null)
      : [];
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return rows;
}

async function configureMtaWebhooks(
  apiKey: string,
  baseUrl: string,
  webhookSecret: string,
): Promise<Array<{ event: WebhookEvent; action: "created" | "updated"; id: string | null }>> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
  const existing = await listMtaWebhooks(apiKey, baseUrl);
  const configured: Array<{ event: WebhookEvent; action: "created" | "updated"; id: string | null }> = [];

  for (const event of EVENTS) {
    const url = `${supabaseUrl}/functions/v1/mta-webhook?event=${event}`;
    const match = existing.find((row) => row.event === event && row.url === url);
    const body = JSON.stringify({
      ...(match ? {} : { event }),
      url,
      secret: webhookSecret,
      retryOnError: true,
      skipErrors: false,
      maxThroughputPerMinute: 600,
    });
    const id = typeof match?.id === "string" || typeof match?.id === "number"
      ? String(match.id)
      : null;

    const payload = match && id
      ? await mtaRequest(apiKey, baseUrl, `/v3/webhooks/${id}`, { method: "PATCH", body })
      : await mtaRequest(apiKey, baseUrl, "/v3/webhooks", { method: "POST", body });
    const configuredId = asRecord(asRecord(payload)?.data)?.id;
    configured.push({
      event,
      action: match ? "updated" : "created",
      id: typeof configuredId === "string" || typeof configuredId === "number"
        ? String(configuredId)
        : id,
    });
  }

  return configured;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return corsJsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Deno.env.get("MOBILE_TEXT_ALERTS_API_KEY");
  if (!apiKey) return corsJsonResponse({ error: "SMS provider is not configured" }, { status: 503 });

  const rawBody = new Uint8Array(await req.arrayBuffer());
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return corsJsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const root = asRecord(payload);
  const webhookSecret = Deno.env.get("MTA_WEBHOOK_SECRET") || await deriveMtaWebhookSecret(apiKey);
  const baseUrl = (Deno.env.get("MOBILE_TEXT_ALERTS_BASE_URL") || DEFAULT_BASE_URL).replace(/\/$/, "");

  if (root?.action === "configure") {
    const unauthorized = requireInternalApiKey(req);
    if (unauthorized) return unauthorized;
    try {
      const configured = await configureMtaWebhooks(apiKey, baseUrl, webhookSecret);
      return corsJsonResponse({ success: true, configured });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook configuration failed";
      console.error("[mta-webhook] configuration failed", message);
      return corsJsonResponse({ error: message }, { status: 502 });
    }
  }

  const signatureValid = await verifyMtaWebhookSignature(
    rawBody,
    req.headers.get("X-Signature"),
    webhookSecret,
  );
  if (!signatureValid) return corsJsonResponse({ error: "Invalid signature" }, { status: 401 });

  const event = new URL(req.url).searchParams.get("event") ??
    (typeof root?.event === "string" ? root.event : null);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    if (event === "delivery-status") {
      const delivery = normalizeMtaDelivery(unwrapMtaWebhookPayload(payload));
      if (!delivery) return corsJsonResponse({ error: "Invalid delivery payload" }, { status: 400 });
      const { data, error } = await supabase.rpc("apply_sms_delivery_status_batch", {
        p_deliveries: [delivery],
        p_source: "webhook",
      });
      if (error) throw new Error(error.message);
      return corsJsonResponse({ success: true, result: data });
    }

    if (event === "message-reply") {
      const reply = normalizeMtaInboundReply(payload);
      if (!reply) return corsJsonResponse({ error: "Invalid message reply payload" }, { status: 400 });
      const { data, error } = await supabase.rpc("apply_mta_inbound_sms", { p_reply: reply });
      if (error) throw new Error(error.message);
      return corsJsonResponse({ success: true, result: data });
    }

    return corsJsonResponse({ error: "Unsupported webhook event" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("[mta-webhook] processing failed", message);
    return corsJsonResponse({ error: "Webhook processing failed" }, { status: 500 });
  }
});
