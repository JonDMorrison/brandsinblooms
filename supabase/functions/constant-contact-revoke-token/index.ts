import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userRecord?.tenant_id) {
      throw new Error("Tenant not found");
    }

    const tenantId = userRecord.tenant_id;

    const { error: updateError } = await supabase
      .from("provider_connections")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        encrypted_access_token: null,
      })
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("provider", "constant_contact");

    if (updateError) {
      console.error(
        "[constant-contact-revoke-token] Update error:",
        updateError,
      );
      throw new Error("Failed to disconnect Constant Contact");
    }

    const { error: artifactDeleteError } = await supabase
      .from("provider_artifacts")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("provider", "constant_contact");

    if (artifactDeleteError) {
      console.error(
        "[constant-contact-revoke-token] Artifact delete error:",
        artifactDeleteError,
      );
      throw new Error("Failed to clear Constant Contact artifacts");
    }

    console.log(
      `[constant-contact-revoke-token] Disconnected Constant Contact for user ${user.id}`,
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[constant-contact-revoke-token] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
