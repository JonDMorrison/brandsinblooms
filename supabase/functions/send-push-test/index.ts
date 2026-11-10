import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (Deno.env.get("WEB_PUSH_PILOT_ENABLED") !== "true") {
    return json(403, { error: "Push pilot is not enabled" });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json(503, { error: "Service unavailable" });
  const bearer = req.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer ") || bearer.length < 40) {
    return json(401, { error: "CRM sign-in required" });
  }
  const token = bearer.slice(7);
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await db.auth.getUser(token);
  if (!authData.user) return json(401, { error: "Invalid CRM session" });
  const { data: caller } = await db.from("users")
    .select("tenant_id,role")
    .eq("id", authData.user.id).maybeSingle();
  if (!caller?.tenant_id || caller.role !== "admin") {
    return json(403, { error: "Tenant administrator required" });
  }

  let input: Record<string, unknown>;
  try {
    const value: unknown = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid");
    input = value as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (input.action === "list") {
    const { data: activeSubscriptions } = await db.from("crm_push_subscriptions")
      .select("customer_link_id,crm_customer_id,storefront_site_id")
      .eq("tenant_id", caller.tenant_id).eq("status", "active").limit(100);
    const ids = [...new Set((activeSubscriptions || []).map((sub) => sub.crm_customer_id))];
    if (!ids.length) return json(200, { customers: [] });
    const [{ data: prefs }, { data: links }, { data: mappings }, { data: customers }] = await Promise.all([
      db.from("crm_push_preferences").select("crm_customer_id").eq("tenant_id", caller.tenant_id)
        .eq("status", "opted_in").in("crm_customer_id", ids),
      db.from("crm_storefront_customer_links").select("id,crm_customer_id,storefront_site_id")
        .eq("tenant_id", caller.tenant_id).eq("status", "verified").in("crm_customer_id", ids),
      db.from("crm_storefront_tenant_links").select("storefront_site_id")
        .eq("crm_tenant_id", caller.tenant_id).eq("enabled", true),
      db.from("crm_customers").select("id,first_name,last_name")
        .eq("tenant_id", caller.tenant_id).in("id", ids)
        .is("deleted_at", null).is("merged_into_customer_id", null),
    ]);
    const consented = new Set((prefs || []).map((pref) => pref.crm_customer_id));
    const enabledSites = new Set((mappings || []).map((m) => m.storefront_site_id));
    const linksById = new Map((links || []).map((link) => [link.id, link]));
    const eligibleIds = new Set((activeSubscriptions || []).filter((sub) => {
      const link = linksById.get(sub.customer_link_id);
      return consented.has(sub.crm_customer_id) && enabledSites.has(sub.storefront_site_id) &&
        link?.crm_customer_id === sub.crm_customer_id &&
        link?.storefront_site_id === sub.storefront_site_id;
    }).map((sub) => sub.crm_customer_id));
    return json(200, { customers: (customers || []).filter((customer) => eligibleIds.has(customer.id))
      .map((customer) => ({
        id: customer.id,
        label: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer " + customer.id.slice(0, 8),
      })) });
  }

  const customerId = input.customerId;
  if (typeof customerId !== "string" || !UUID.test(customerId)) {
    return json(400, { error: "Valid customer ID required" });
  }
  const { data: customer } = await db.from("crm_customers")
    .select("id")
    .eq("id", customerId).eq("tenant_id", caller.tenant_id)
    .is("deleted_at", null).is("merged_into_customer_id", null).maybeSingle();
  if (!customer) return json(404, { error: "Customer not found in your tenant" });

  const { data: preference } = await db.from("crm_push_preferences")
    .select("status")
    .eq("tenant_id", caller.tenant_id)
    .eq("crm_customer_id", customerId).maybeSingle();
  if (preference?.status !== "opted_in") {
    return json(409, { error: "Customer has not opted in to push" });
  }

  // Per-customer cooldown prevents accidentally blasting the test recipient.
  const { count } = await db.from("crm_push_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", caller.tenant_id)
    .eq("crm_customer_id", customerId)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((count ?? 0) > 0) return json(429, { error: "Please wait before sending another test" });

  const { data: subs, error: subError } = await db.from("crm_push_subscriptions")
    .select("id,storefront_site_id,customer_link_id")
    .eq("tenant_id", caller.tenant_id)
    .eq("crm_customer_id", customerId)
    .eq("status", "active").limit(10);
  if (subError) return json(503, { error: "Subscriptions unavailable" });
  if (!subs?.length) return json(409, { error: "No active web push subscription" });

  const { data: links } = await db.from("crm_storefront_customer_links")
    .select("id,storefront_site_id")
    .eq("tenant_id", caller.tenant_id).eq("crm_customer_id", customerId)
    .eq("status", "verified");
  const allowed = new Set((links || []).map((link) => link.id + ":" + link.storefront_site_id));
  const eligible = subs.filter((sub) => allowed.has(sub.customer_link_id + ":" + sub.storefront_site_id));
  if (!eligible.length) return json(409, { error: "No reviewed customer mapping" });

  const batch = crypto.randomUUID();
  const { error: queueError } = await db.from("crm_push_messages").insert(
    eligible.map((subscription) => ({
      tenant_id: caller.tenant_id,
      crm_customer_id: customerId,
      subscription_id: subscription.id,
      dedupe_key: "pilot:" + batch + ":" + subscription.id,
      title: "Your garden centre has something for you",
      body: "Tap to see your offers.",
      open_path: "/account/offers",
    })),
  );
  if (queueError) {
    console.error("[send-push-test] enqueue failed", { code: queueError.code });
    return json(503, { error: "Unable to queue test" });
  }

  let workerInvoked = false;
  if (Deno.env.get("WEB_PUSH_PILOT_INVOKE_WORKER") === "true") {
    const worker = await fetch(url + "/functions/v1/process-push-send-queue", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
    workerInvoked = Boolean(worker?.ok);
  }
  return json(202, { queued: eligible.length, workerInvoked });
});
