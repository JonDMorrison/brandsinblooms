import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveSender, buildFromAddress } from "../_shared/senderResolver.ts";

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

        // Build email HTML
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preferences</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Can we send you updates?</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Hi ${firstName},</p>
    
    <p>You're receiving this email because you shared your email with <strong>${companyName}</strong> for a purchase, course, or event.</p>
    
    <p>We'd love to occasionally send you:</p>
    <ul style="padding-left: 20px;">
      <li>Seasonal gardening tips</li>
      <li>New arrivals and promotions</li>
      <li>Updates on workshops and events</li>
    </ul>
    
    <p><strong>Please choose your email preferences:</strong></p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${preferencesUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 5px;">
        Update My Preferences
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666;">You can change your preferences at any time.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      ${companyName}<br>
      ${companyAddress}
    </p>
  </div>
</body>
</html>`;

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
