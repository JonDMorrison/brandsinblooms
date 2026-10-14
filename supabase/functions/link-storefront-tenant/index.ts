import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { verifyTenantLinkCode } from "../_shared/pwaTenantLinkCode.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (Deno.env.get("WEB_PUSH_PILOT_ENABLED") !== "true") {
    return reply(403, { error: "Storefront linking is not enabled" });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("PWA_BRIDGE_SECRET");
  if (!url || !adminKey || !secret || secret.length < 32) {
    return reply(503, { error: "Storefront linking is not configured" });
  }
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (token.length < 40) return reply(401, { error: "CRM sign-in required" });
  const db = createClient(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return reply(401, { error: "Invalid CRM session" });
  const { data: caller } = await db.from("users").select("tenant_id,role")
    .eq("id",user.id).maybeSingle();
  if (!caller?.tenant_id || caller.role !== "admin") {
    return reply(403, { error: "CRM tenant administrator required" });
  }
  let input: Record<string, unknown>;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("Invalid");
    input = body as Record<string, unknown>;
  } catch { return reply(400,{ error:"Invalid request body" }); }

  if (input.action === "list") {
    const { data, error } = await db.from("crm_storefront_tenant_links")
      .select("storefront_site_id,enabled,reviewed_at")
      .eq("crm_tenant_id", caller.tenant_id).order("reviewed_at",{ascending:false}).limit(50);
    if (error) return reply(503, { error: "Connections unavailable" });
    return reply(200, { sites: data || [] });
  }

  if (input.action !== "connect" || typeof input.siteId !== "string" ||
      !UUID.test(input.siteId) || typeof input.code !== "string" ||
      !/^[A-F0-9]{24}$/.test(input.code.toUpperCase())) {
    return reply(400,{ error:"Enter the store site ID and its valid 24-character connection code" });
  }
  const siteId = input.siteId.toLowerCase();
  const code = input.code.toUpperCase();
  const valid = await verifyTenantLinkCode(secret,siteId,code);
  if (!valid) return reply(403,{ error:"Connection code is incorrect or expired" });

  const { data: current, error: lookupError } = await db.from("crm_storefront_tenant_links")
    .select("storefront_site_id,crm_tenant_id,enabled")
    .eq("storefront_site_id",siteId).maybeSingle();
  if (lookupError) return reply(503,{ error:"Unable to verify current connection" });
  if (current && current.crm_tenant_id !== caller.tenant_id) {
    return reply(409,{ error:"This storefront is already linked to a different CRM account" });
  }
  const now = new Date().toISOString();
  if (current) {
    const { error } = await db.from("crm_storefront_tenant_links")
      .update({enabled:true,reviewed_by:user.id,reviewed_at:now})
      .eq("storefront_site_id",siteId).eq("crm_tenant_id",caller.tenant_id);
    if (error) return reply(409,{ error:"Unable to enable linked storefront" });
  } else {
    const { error } = await db.from("crm_storefront_tenant_links").insert({
      storefront_site_id:siteId,crm_tenant_id:caller.tenant_id,
      enabled:true,reviewed_by:user.id,reviewed_at:now,
    });
    if (error) return reply(409,{ error:"Storefront could not be linked; review existing ownership" });
  }
  return reply(200,{ status:"connected",siteId });
});
