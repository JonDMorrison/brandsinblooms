import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * VMX workers may run from the authenticated tenant UI or the internal
 * Supabase service-role cron. Never authorize a tenant from a request body.
 */
export async function authorizeVmxConnectionRequest(req: Request, tenantId: string) {
  const auth = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && auth === `Bearer ${serviceKey}`) {
    return;
  }
  if (!auth.startsWith("Bearer ")) {
    throw new Error("VMX integration management permission required.");
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: authResult, error: authError } = await client.auth.getUser(auth.slice(7));
  if (authError || !authResult.user) {
    throw new Error("VMX integration management permission required.");
  }
  const { data: access, error: accessError } = await client.rpc("get_current_crm_access");
  if (accessError || !access || typeof access !== "object" ||
      Array.isArray(access) || access.tenantId !== tenantId ||
      !Array.isArray(access.permissions) ||
      !access.permissions.includes("integrations.manage")) {
    throw new Error("VMX integration management permission required.");
  }
}

export function requireVmxServiceRequest(req: Request) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key || req.headers.get("Authorization") !== `Bearer ${key}`) {
    throw new Error("Internal VMX scheduler authorization required.");
  }
}
