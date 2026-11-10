import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  normalizeCustomerInterests,
  normalizeGardeningExperience,
} from "../_shared/customerPreferenceCenter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const emailOptIn = body?.emailOptIn ?? body?.optIn;
    const interests = normalizeCustomerInterests(body?.interests);
    const gardeningExperience = normalizeGardeningExperience(
      body?.gardeningExperience,
    );

    if (!token || typeof emailOptIn !== "boolean") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token and emailOptIn are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("crm_email_preference_tokens")
      .select("id, tenant_id, customer_id, email, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token expired" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Record the request context with the consent decision.
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    // The RPC applies the profile, consent audit, and suppression update in one
    // database transaction so a partial compliance state cannot be committed.
    const { data: updateResult, error: updateError } = await supabase.rpc(
      "update_customer_preference_center",
      {
        p_token: token,
        p_email_opt_in: emailOptIn,
        p_topics: interests,
        p_gardening_experience: gardeningExperience,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      },
    );

    if (updateError || !updateResult) {
      console.error("Error updating customer preferences:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to update preferences",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Preference fields are immediately useful to auto-updating segments.
    const { error: segmentError } = await supabase.functions.invoke(
      "evaluate-customer-segments",
      {
        body: {
          customer_id: tokenData.customer_id,
          tenant_id: tokenData.tenant_id,
        },
      },
    );

    if (segmentError) {
      console.error("Failed to refresh customer segments:", segmentError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailOptIn,
        preferences: updateResult,
        segmentRefreshPending: Boolean(segmentError),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error updating preference:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
