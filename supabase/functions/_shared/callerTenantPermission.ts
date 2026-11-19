import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Asks the database, as the caller (their own JWT), whether they hold a CRM permission for a tenant, through the
 * same `has_tenant_permission` function the CRM's policies use. True only when the call succeeds and answers
 * exactly `true`; any error, missing header or other answer is false, so callers fail closed with a 403.
 * The pattern of send-opt-in-request (47/R-03, 50-D4), shared for central-login 59: an Edge Function that then
 * works with the service role checks this first, before any service-role read or write.
 */
export async function callerHasTenantPermission(
  authHeader: string | null,
  tenantId: string | null | undefined,
  permission: string,
  locationId: string | null = null,
): Promise<boolean> {
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ") || !tenantId) return false;
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return false;
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await callerClient.rpc("has_tenant_permission", {
    p_tenant_id: tenantId,
    p_permission: permission,
    p_location_id: locationId,
  });
  return !error && data === true;
}

/** The caller's own CRM tenant (`users.tenant_id`), read with their JWT; null when signed out or not a member. */
export async function callerTenantId(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return null;
  const { data, error } = await callerClient.from("users").select("tenant_id").eq("id", userData.user.id).maybeSingle();
  if (error || !data?.tenant_id) return null;
  return data.tenant_id as string;
}
