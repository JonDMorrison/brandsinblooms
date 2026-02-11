import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lookup token
    const { data: tokenData, error: tokenError } = await supabase
      .from("crm_email_preference_tokens")
      .select("id, tenant_id, customer_id, email, purpose, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company info for branding
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tokenData.tenant_id)
      .single();

    // Try to get more detailed company info
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select("company_name, location_info")
      .eq("user_id", (
        await supabase
          .from("users")
          .select("id")
          .eq("tenant_id", tokenData.tenant_id)
          .limit(1)
          .single()
      ).data?.id)
      .single();

    return new Response(
      JSON.stringify({
        valid: true,
        data: {
          id: tokenData.id,
          tenant_id: tokenData.tenant_id,
          customer_id: tokenData.customer_id,
          email: tokenData.email,
          purpose: tokenData.purpose,
        },
        company: {
          name: companyProfile?.company_name || tenant?.name || "Our Company",
          address: companyProfile?.location_info || "",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error validating token:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Validation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
