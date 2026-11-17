import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto/tokens.ts";
import { createVmxClient, normalizeVmxApiBaseUrl, VmxAuthError } from "../_shared/vmx/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth — require user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !user) throw new Error("Invalid user token");

    // Resolve tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData?.tenant_id) throw new Error("No tenant found for user");

    // The service-role client may store credentials only after the bearer
    // session has proven its tenant and integrations.manage permission.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: access, error: accessError } = await userClient.rpc("get_current_crm_access");
    if (accessError || !access || typeof access !== "object" ||
        access.tenantId !== userData.tenant_id ||
        !Array.isArray(access.permissions) || !access.permissions.includes("integrations.manage")) {
      return new Response(
        JSON.stringify({ error: "Integration management permission is required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { api_key, api_url, connection_name } = await req.json();
    let apiBaseUrl: string;
    try {
      apiBaseUrl = normalizeVmxApiBaseUrl(api_url);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: (err as Error).message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!api_key || typeof api_key !== "string") {
      return new Response(
        JSON.stringify({ error: "api_key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate the API key by hitting the VMX API
    try {
      const client = createVmxClient(api_key, apiBaseUrl);
      await client.listCustomers({ start: new Date().toISOString().slice(0, 10), page: 1 });
    } catch (err) {
      if (err instanceof VmxAuthError) {
        return new Response(
          JSON.stringify({ error: "VMX API key is invalid — authentication failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "VMX API verification failed. Check the store URL and API Client ID with VMX support." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Encrypt the API key
    const encryptedKey = await encryptToken(api_key);

    // Update the existing tenant connection in place. This table does not
    // have a tenant_id/platform unique constraint, so an upsert on those
    // columns could create duplicates or misidentify a connection.
    const { data: prior, error: lookupError } = await supabase
      .from("pos_connections")
      .select("id")
      .eq("tenant_id", userData.tenant_id)
      .eq("platform", "vmx")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const fields = {
      tenant_id: userData.tenant_id,
      user_id: user.id,
      platform: "vmx",
      name: typeof connection_name === "string" && connection_name.trim().slice(0, 120) || "VMX POS",
      is_active: true,
      credentials_encrypted: JSON.stringify({ api_key: encryptedKey }),
      settings: { api_version: "1.11.0", auth_method: "header", base_url: apiBaseUrl },
      sync_status: "pending",
      sync_error: null,
      updated_at: new Date().toISOString(),
    };
    const query = prior
      ? supabase.from("pos_connections").update(fields).eq("id", prior.id).eq("tenant_id", userData.tenant_id)
      : supabase.from("pos_connections").insert(fields);
    const { data: connection, error: connError } = await query.select("id, sync_status").single();
    if (connError || !connection) throw connError ?? new Error("Connection could not be saved.");

    return new Response(
      JSON.stringify({ connection_id: connection.id, status: connection.sync_status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("vmx-connect error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
