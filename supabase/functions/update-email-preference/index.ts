import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { token, optIn } = await req.json();

    if (!token || typeof optIn !== "boolean") {
      return new Response(
        JSON.stringify({ success: false, error: "Token and optIn are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP and user agent from request
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                      req.headers.get("x-real-ip") ||
                      null;
    const userAgent = req.headers.get("user-agent") || null;

    // Update customer consent
    const { error: updateError } = await supabase
      .from("crm_customers")
      .update({
        email_opt_in: optIn,
        email_opt_in_at: optIn ? new Date().toISOString() : null,
        email_consent_source: "opt_in_landing_page",
        email_consent_ip: ipAddress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenData.customer_id);

    if (updateError) {
      console.error("Error updating customer:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update preferences" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Canonical suppression_list maintenance
    const normalizedEmail = String(tokenData.email || '').toLowerCase().trim();
    if (normalizedEmail) {
      if (optIn) {
        // Resubscribe lifts only the explicit unsubscribe suppression.
        const { error: liftError } = await supabase
          .from('suppression_list')
          .update({
            lifted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tokenData.tenant_id)
          .eq('email', normalizedEmail)
          .eq('channel', 'email')
          .eq('suppression_type', 'unsubscribed')
          .is('lifted_at', null);

        if (liftError) {
          console.warn('⚠️ Failed to lift unsubscribed suppression:', liftError);
        }
      } else {
        // Opt-out creates/updates an explicit unsubscribe suppression.
        const { error: suppressError } = await supabase
          .from('suppression_list')
          .upsert({
            tenant_id: tokenData.tenant_id,
            customer_id: tokenData.customer_id,
            email: normalizedEmail,
            suppression_type: 'unsubscribed',
            channel: 'email',
            reason: 'preference_center_opt_out',
            auto_suppressed: false,
            suppressed_at: new Date().toISOString(),
            lifted_at: null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,email,channel,suppression_type',
            ignoreDuplicates: false,
          });

        if (suppressError) {
          console.warn('⚠️ Failed to write unsubscribe suppression:', suppressError);
        }
      }
    }

    // Record consent event
    await supabase.from("crm_email_consent_events").insert({
      tenant_id: tokenData.tenant_id,
      customer_id: tokenData.customer_id,
      email: tokenData.email,
      event_type: optIn ? "opt_in" : "opt_out",
      source: "opt_in_landing_page",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Delete or mark token as used (optional - keeping it allows page reload)
    // For now, we'll leave the token valid until expiry

    return new Response(
      JSON.stringify({ success: true, optIn }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating preference:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
