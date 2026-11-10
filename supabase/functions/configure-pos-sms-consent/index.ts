import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supportedProviders = new Set([
  "square",
  "lightspeed",
  "vmx",
  "clover",
  "shopify",
]);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "An authenticated user is required." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.slice("Bearer ".length);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid user token." }, 401);
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!userData?.tenant_id) {
      return jsonResponse({ error: "No tenant was found for this user." }, 403);
    }

    const body = await req.json();
    const provider = typeof body.provider === "string"
      ? body.provider.trim().toLowerCase()
      : "";
    if (!supportedProviders.has(provider)) {
      return jsonResponse({ error: "Unsupported POS provider." }, 400);
    }
    if (body.checkout_phone_consent !== true) {
      return jsonResponse(
        { error: "Checkout phone disclosure confirmation is required." },
        400,
      );
    }

    const { data, error: policyError } = await supabase.rpc(
      "configure_pos_sms_checkout_policy",
      {
        p_tenant_id: userData.tenant_id,
        p_user_id: authData.user.id,
        p_provider: provider,
      },
    );
    if (policyError) throw policyError;
    const policy = Array.isArray(data) ? data[0] : data;

    return jsonResponse({ policy });
  } catch (error) {
    console.error("configure-pos-sms-consent error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unable to save the POS SMS policy." },
      500,
    );
  }
});
