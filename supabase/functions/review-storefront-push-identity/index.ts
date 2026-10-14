import { createClient } from "npm:@supabase/supabase-js@2.58.0";

function json(status: number, value: Record<string, unknown>) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function uuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!url || !secret || token.length < 40) return json(401, { error: "CRM sign-in required" });
  const db = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return json(401, { error: "Invalid CRM session" });
  const { data: caller } = await db.from("users")
    .select("tenant_id,role").eq("id",user.id).maybeSingle();
  if (!caller?.tenant_id || caller.role !== "admin") {
    return json(403, { error: "CRM tenant administrator required" });
  }
  let body: Record<string, unknown>;
  try {
    const value: unknown = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid");
    body = value as Record<string, unknown>;
  } catch { return json(400, { error: "Invalid request" }); }

  if (body.action === "list") {
    const { data: links, error } = await db.from("crm_storefront_customer_links")
      .select("id,storefront_site_id,storefront_user_id,source_email,source_email_seen_at,created_at")
      .eq("tenant_id", caller.tenant_id).eq("status", "pending")
      .order("created_at", { ascending: true }).limit(100);
    if (error) return json(503, { error: "Identity review queue unavailable" });
    const emails = [...new Set((links || []).map(x=>x.source_email).filter(Boolean))] as string[];
    const { data: candidates } = emails.length
      ? await db.from("crm_customers")
        .select("id,email,first_name,last_name")
        .eq("tenant_id", caller.tenant_id)
        .is("deleted_at", null).is("merged_into_customer_id",null)
        .in("email", emails).limit(250)
      : { data: [] };
    const candidatesByEmail = new Map<string, Array<{ id: string; label: string }>>();
    for (const candidate of candidates || []) {
      if (!candidate.email) continue;
      const group = candidatesByEmail.get(candidate.email.toLowerCase()) || [];
      group.push({ id: candidate.id,
        label: [candidate.first_name,candidate.last_name].filter(Boolean).join(" ") ||
          candidate.email });
      candidatesByEmail.set(candidate.email.toLowerCase(),group);
    }
    return json(200, { pending: (links || []).map(link=>({
      id:link.id,siteId:link.storefront_site_id,
      storefrontUserId:link.storefront_user_id,
      observedEmail:link.source_email || null,
      sourceEmailSeenAt:link.source_email_seen_at,
      createdAt:link.created_at,
      candidateMatches: (candidatesByEmail.get((link.source_email || "").toLowerCase())||[]).slice(0,5),
    })) });
  }

  if (body.action !== "verify" || !uuid(body.linkId) ||
      !uuid(body.crmCustomerId) ||
      body.confirmedManually !== true ||
      typeof body.reason !== "string" ||
      body.reason.trim().length < 12 ||
      body.reason.length > 300) {
    return json(400, { error: "Select a customer and record your separate identity verification" });
  }

  const { data: link } = await db.from("crm_storefront_customer_links")
    .select("id,storefront_site_id,tenant_id,status")
    .eq("id", body.linkId).eq("tenant_id", caller.tenant_id)
    .eq("status","pending").maybeSingle();
  if (!link) return json(409, { error: "Identity link is not pending" });
  const [{ data: mapping }, { data: customer }] = await Promise.all([
    db.from("crm_storefront_tenant_links").select("enabled")
      .eq("storefront_site_id", link.storefront_site_id)
      .eq("crm_tenant_id", caller.tenant_id).maybeSingle(),
    db.from("crm_customers").select("id")
      .eq("id", body.crmCustomerId).eq("tenant_id", caller.tenant_id)
      .is("deleted_at",null).is("merged_into_customer_id",null).maybeSingle(),
  ]);
  if (mapping?.enabled !== true || !customer) {
    return json(409, { error: "Store linkage or CRM customer is not verified" });
  }

  const evidenceRef = "manual-review:" + user.id + ":" + body.reason.trim();
  const { data: saved, error: saveError } = await db.from("crm_storefront_customer_links")
    .update({
      crm_customer_id: customer.id,
      status: "verified",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      evidence_ref: evidenceRef,
      updated_at: new Date().toISOString(),
    }).eq("id", link.id).eq("tenant_id",caller.tenant_id)
      .eq("status","pending").select("id").maybeSingle();
  if (saveError || !saved) {
    console.error("[review-storefront-push-identity] review rejected", { code: saveError?.code });
    return json(409, { error: "Customer link was already reviewed or conflicts with another verified link" });
  }
  return json(200, { status: "verified", linkId: saved.id });
});
