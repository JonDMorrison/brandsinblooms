import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import webpush from "npm:web-push@3.6.7";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

type PushMessage = {
  id: string; tenant_id: string; crm_customer_id: string;
  subscription_id: string; title: string; body: string;
  open_path: string; attempts: number;
};

const MAX_PER_RUN = 25;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (Deno.env.get("WEB_PUSH_DELIVERY_ENABLED") !== "true") {
    return json(403, { error: "Web Push delivery is disabled by the platform" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:support@bloomsuite.app";
  if (!url || !serviceKey || !publicKey || !privateKey) {
    return json(503, { error: "Push delivery is not configured" });
  }
  const authorization = req.headers.get("Authorization") || "";
  if (authorization !== "Bearer " + serviceKey) {
    return json(401, { error: "Internal worker authorization required" });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("claim_crm_push_messages", { p_limit: MAX_PER_RUN });
  if (error) {
    console.error("[process-push-send-queue] claim failed", { code: error.code });
    return json(500, { error: "Queue unavailable" });
  }

  let accepted = 0, retry = 0, failed = 0, skipped = 0;
  for (const message of (data || []) as PushMessage[]) {
    const [{ data: subscription }, { data: preference }] = await Promise.all([
      db.from("crm_push_subscriptions")
        .select("endpoint_url,key_p256dh,key_auth,vapid_key_version,status,tenant_id,crm_customer_id")
        .eq("id", message.subscription_id).maybeSingle(),
      db.from("crm_push_preferences")
        .select("status")
        .eq("tenant_id", message.tenant_id)
        .eq("crm_customer_id", message.crm_customer_id).maybeSingle(),
    ]);
    if (!subscription || subscription.status !== "active" ||
        subscription.tenant_id !== message.tenant_id ||
        subscription.crm_customer_id !== message.crm_customer_id ||
        subscription.vapid_key_version !== 1 ||
        preference?.status !== "opted_in") {
      await db.from("crm_push_messages").update({
        status: "cancelled", claimed_at: null, last_error_code: "inactive_subscription",
      }).eq("id", message.id).eq("status", "sending");
      skipped++;
      continue;
    }
    try {
      const payload = JSON.stringify({
        title: message.title,
        body: message.body,
        url: message.open_path,
        tag: message.id,
      });
      // Accepted means accepted by the provider, not confirmed delivered.
      await webpush.sendNotification({
        endpoint: subscription.endpoint_url,
        keys: { p256dh: subscription.key_p256dh, auth: subscription.key_auth },
      }, payload, { TTL: 3600, urgency: "normal" });
      await db.from("crm_push_messages").update({
        status: "accepted", accepted_at: new Date().toISOString(),
        claimed_at: null, last_error_code: null,
      }).eq("id", message.id).eq("status", "sending");
      await db.from("crm_push_events").insert({
        tenant_id: message.tenant_id, message_id: message.id, event_type: "accepted",
      });
      accepted++;
    } catch (cause) {
      const statusCode = typeof cause === "object" && cause !== null &&
        "statusCode" in cause ? Number((cause as { statusCode: unknown }).statusCode) : 0;
      const gone = statusCode === 404 || statusCode === 410;
      if (gone) {
        await db.from("crm_push_subscriptions").update({
          status: "invalid", invalidated_at: new Date().toISOString(),
        }).eq("id", message.subscription_id);
      }
      const shouldRetry = !gone && (statusCode === 429 || statusCode >= 500 || statusCode === 0) &&
        message.attempts < 5;
      const delaySeconds = Math.min(3600, 30 * (2 ** Math.max(0, message.attempts - 1)));
      await db.from("crm_push_messages").update({
        status: shouldRetry ? "retry" : "failed",
        claimed_at: null,
        available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        last_error_code: gone ? "endpoint_gone" : statusCode ? String(statusCode) : "send_error",
      }).eq("id", message.id).eq("status", "sending");
      await db.from("crm_push_events").insert({
        tenant_id: message.tenant_id, message_id: message.id,
        event_type: gone ? "subscription_invalid" : "failed",
        details: { retryable: shouldRetry, http_status: statusCode || null },
      });
      if (shouldRetry) retry++;
      else failed++;
    }
  }
  return json(200, { claimed: (data || []).length, accepted, retry, failed, skipped });
});
