import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const encoder = new TextEncoder();
const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_DRIFT_SECONDS = 300;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalSignature(received: string, computed: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(received)) return false;
  let different = 0;
  for (let index = 0; index < 64; index++) {
    different |= received.charCodeAt(index) ^ computed.charCodeAt(index);
  }
  return different === 0;
}

async function digest(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function verifySignedEnvelope(req: Request, body: string, secret: string): Promise<boolean> {
  const timestamp = Number(req.headers.get("x-bloom-timestamp"));
  if (!Number.isSafeInteger(timestamp) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestamp) > ALLOWED_DRIFT_SECONDS) return false;
  if (req.headers.get("x-bloom-key-id") !== (Deno.env.get("PWA_BRIDGE_KEY_ID") || "v1")) return false;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = encoder.encode(String(timestamp) + "." + body);
  const signature = hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, signed)));
  return equalSignature(req.headers.get("x-bloom-signature") || "", signature);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Browser-managed delivery URLs only. Prevent arbitrary outbound requests. */
function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 40 || value.length > 4096) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

function validKey(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const secret = Deno.env.get("PWA_BRIDGE_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || secret.length < 32 || !url || !serviceKey) {
    return json(503, { error: "Push bridge is not configured" });
  }
  const body = await req.text();
  if (encoder.encode(body).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: "Payload too large" });
  }
  if (!await verifySignedEnvelope(req, body, secret)) {
    return json(401, { error: "Invalid signed request" });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
    if (!event || typeof event !== "object" || Array.isArray(event)) throw Error("Invalid event");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { eventId, siteId, userId, action } = event;
  if (!isUuid(eventId) || !isUuid(siteId) || !isUuid(userId) ||
      (action !== "subscribe" && action !== "unsubscribe")) {
    return json(400, { error: "Invalid event envelope" });
  }

  const subscription = event.subscription;
  const fields = subscription && typeof subscription === "object" && !Array.isArray(subscription)
    ? subscription as Record<string, unknown>
    : {};
  const keys = fields.keys && typeof fields.keys === "object" && !Array.isArray(fields.keys)
    ? fields.keys as Record<string, unknown>
    : {};
  if (action === "subscribe") {
    if (event.consentVersion !== "offers-events-v1" ||
        !validPushEndpoint(fields.endpoint) ||
        !validKey(keys.p256dh, 24, 256) ||
        !validKey(keys.auth, 12, 256)) {
      return json(400, { error: "Invalid browser subscription or consent" });
    }
  }

  const endpoint = typeof fields.endpoint === "string" ? fields.endpoint : "";
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("accept_storefront_push_v1", {
    p_event_id: eventId,
    p_site_id: siteId,
    p_user_id: userId,
    p_action: action,
    p_endpoint: action === "subscribe" ? endpoint : null,
    p_endpoint_hash: await digest(endpoint),
    p_p256dh: action === "subscribe" ? keys.p256dh : null,
    p_auth: action === "subscribe" ? keys.auth : null,
    p_vapid_version: 1,
    p_payload_hash: await digest(body),
  });
  if (error) {
    // Never log the body, subscription endpoint, signing secret, or key material.
    console.error("[receive-storefront-push] rejected event", { code: error.code });
    return json(409, { error: "Subscription could not be linked" });
  }
  const status = String(data?.status || "");
  if (status === "identity_review_required") return json(409, { status });
  if (status === "tenant_not_enabled") return json(403, { status });
  return json(200, { status });
});
