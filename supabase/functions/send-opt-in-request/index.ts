import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveSender, buildFromAddress } from "../_shared/senderResolver.ts";
import { renderBloomSystemEmail, bloomEmailEscape } from "../../../src/lib/email/premiumBotanical.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

interface OptInRequestBody {
  tenantId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenantId } = await req.json() as OptInRequestBody;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenantId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant and company info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, website")
      .eq("id", tenantId)
      .single();

    // Get company profile for branding
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select("company_name, website_url, location_info")
      .eq("user_id", (await supabase.from("users").select("id").eq("tenant_id", tenantId).limit(1).single()).data?.id)
      .single();

    const companyName = companyProfile?.company_name || tenant?.name || "Our Company";
    const companyAddress = companyProfile?.location_info || "";

    // Resolve sender using the unified sender resolver
    const senderConfig = await resolveSender(supabase, tenantId);
    console.log("[send-opt-in-request] Resolved sender:", senderConfig);

    // Get customers with unknown consent
    const { data: customers, error: customersError } = await supabase
      .from("crm_customers")
      .select("id, email, first_name, last_name")
      .eq("tenant_id", tenantId)
      .is("email_opt_in", null)
      .not("email", "is", null)
      .limit(500);

    if (customersError) {
      console.error("Error fetching customers:", customersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch customers" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customers || customers.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No customers with unknown consent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = Deno.env.get("APP_URL") || "https://bloomsuite.app";
    let sentCount = 0;

    // Process each customer
    for (const customer of customers) {
      try {
        // Generate preference token
        const token = crypto.randomUUID() + "-" + crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabase.from("crm_email_preference_tokens").insert({
          tenant_id: tenantId,
          customer_id: customer.id,
          email: customer.email,
          token,
          purpose: "opt_in_request",
          expires_at: expiresAt.toISOString(),
        });

        // Build preference URL
        const preferencesUrl = `${baseUrl}/email-preferences?token=${token}`;
        const firstName = customer.first_name || "Friend";

        // Keep the existing consent/pref-token flow and merchant sender intact.
        // Only the HTML layout changes; the signed preference link is never tracked.
        const emailHtml = renderBloomSystemEmail({
          eyebrow: "EMAIL PREFERENCES",
          title: "Can we send you updates?",
          preheader: "Choose whether to receive garden updates",
          brandName: companyName,
          icon: "mail",
          bodyHtml: [
            `<p style="margin:0 0 16px;">Hi ${bloomEmailEscape(firstName)},</p>`,
            `<p style="margin:0 0 16px;">You\u0027re receiving this email because you shared your email with <strong>${bloomEmailEscape(companyName)}</strong> for a purchase, course, or event.</p>`,
            `<p style="margin:0 0 12px;">We\u0027d love to occasionally send you:</p>`,
            `<ul style="padding-left:22px;margin:0 0 20px;"><li>Seasonal gardening tips</li><li>New arrivals and promotions</li><li>Updates on workshops and events</li></ul>`,
            `<p style="margin:0 0 16px;"><strong>Please choose your email preferences:</strong></p>`,
            `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0;"><tr><td bgcolor="#1B3049" style="border-radius:8px;background:#1B3049;"><a href="${bloomEmailEscape(preferencesUrl)}" data-no-track="true" clicktracking="off" style="display:inline-block;padding:15px 22px;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Update My Preferences</a></td></tr></table>`,
            `<p style="margin:0;color:#5B6B79;font-size:14px;">You can change your preferences at any time.</p>`,
          ].join(""),
          footer: companyAddress ? `${companyName} — ${companyAddress}` : companyName,
        });

        // Send email via Resend using resolved sender
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const fromAddress = buildFromAddress({
            ...senderConfig,
            fromName: companyName // Override with company name for opt-in emails
          });
          
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromAddress,
              to: [customer.email],
              subject: "Can we send you garden updates?",
              html: emailHtml,
            }),
          });

          if (emailResponse.ok) {
            // Record consent event
            await supabase.from("crm_email_consent_events").insert({
              tenant_id: tenantId,
              customer_id: customer.id,
              email: customer.email,
              event_type: "opt_in_request_sent",
              source: "opt_in_request_email",
            });
            sentCount++;
          } else {
            console.error(`Failed to send to ${customer.email}:`, await emailResponse.text());
          }
        }
      } catch (customerError) {
        console.error(`Error processing customer ${customer.id}:`, customerError);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, total: customers.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-opt-in-request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
