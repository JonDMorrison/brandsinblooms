import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto/tokens.ts";
import { createVmxClient, VmxAuthError } from "../_shared/vmx/client.ts";

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

    const { api_key, connection_name } = await req.json();
    if (!api_key || typeof api_key !== "string") {
      return new Response(
        JSON.stringify({ error: "api_key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate the API key by hitting the VMX API
    try {
      const client = createVmxClient(api_key);
      await client.listCustomers({ start: "today", page: 1 });
    } catch (err) {
      if (err instanceof VmxAuthError) {
        return new Response(
          JSON.stringify({ error: "VMX API key is invalid — authentication failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `VMX API validation failed: ${(err as Error).message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Encrypt the API key
    const encryptedKey = await encryptToken(api_key);

    // Upsert pos_connections row
    const { data: connection, error: connError } = await supabase
      .from("pos_connections")
      .upsert(
        {
          tenant_id: userData.tenant_id,
          user_id: user.id,
          platform: "vmx",
          name: connection_name || "VMX POS",
          is_active: true,
          credentials_encrypted: JSON.stringify({ api_key: encryptedKey }),
          settings: { api_version: "1.11.0", auth_method: "header" },
          sync_status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,platform" },
      )
      .select("id, sync_status")
      .single();

    if (connError) {
      // If upsert fails due to no unique constraint on (tenant_id, platform), try insert
      const { data: inserted, error: insertErr } = await supabase
        .from("pos_connections")
        .insert({
          tenant_id: userData.tenant_id,
          user_id: user.id,
          platform: "vmx",
          name: connection_name || "VMX POS",
          is_active: true,
          credentials_encrypted: JSON.stringify({ api_key: encryptedKey }),
          settings: { api_version: "1.11.0", auth_method: "header" },
          sync_status: "pending",
        })
        .select("id, sync_status")
        .single();

      if (insertErr) throw insertErr;

      return new Response(
        JSON.stringify({ connection_id: inserted!.id, status: inserted!.sync_status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ connection_id: connection!.id, status: connection!.sync_status }),
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
