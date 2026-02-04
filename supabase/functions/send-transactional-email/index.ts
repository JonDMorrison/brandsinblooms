import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Transactional email sender for automation outbox.
 * Returns Resend message ID (external_id) for tracking.
 * Logs full HTTP response for debugging.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { to, subject, html_content, from_name, from_email, reply_to: explicit_reply_to, tags } = body;
    // Reply-to: prefer explicit value, fallback to sender email
    const reply_to = explicit_reply_to || from_email;

    // Validate required fields
    if (!to || !html_content) {
      console.error("❌ Missing required fields: to or html_content");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: to and html_content are required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const hasApiKey = !!resendApiKey;
    console.log(`📧 [TransactionalEmail] API key present: ${hasApiKey}`);
    
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email service not configured",
          skipable: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Build from address
    const fromAddress = from_name 
      ? `${from_name} <${from_email || "hello@notify.bloomsuite.app"}>` 
      : from_email || "hello@notify.bloomsuite.app";

    console.log(`📧 [TransactionalEmail] Sending to: ${to}, from: ${fromAddress}, subject: ${subject?.substring(0, 50)}...`);

    // Send email via Resend
    const emailPayload: any = {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject: subject || "Message from automation",
      html: html_content,
    };

    if (reply_to) {
      emailPayload.reply_to = reply_to;
    }

    if (tags && Array.isArray(tags)) {
      emailPayload.tags = tags;
    }

    const response = await resend.emails.send(emailPayload);
    const duration = Date.now() - startTime;

    // Log full response for debugging
    console.log(`📧 [TransactionalEmail] Resend response (${duration}ms):`, JSON.stringify(response));

    // Check for errors
    if (response.error) {
      console.error(`❌ [TransactionalEmail] Resend error:`, JSON.stringify(response.error));
      return new Response(
        JSON.stringify({
          success: false,
          error: response.error.message || "Email send failed",
          error_name: response.error.name,
          duration_ms: duration
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success - return the Resend message ID
    const messageId = response.data?.id || response.id;
    console.log(`✅ [TransactionalEmail] Sent successfully. Message ID: ${messageId}`);

    return new Response(
      JSON.stringify({
        success: true,
        external_id: messageId,
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [TransactionalEmail] Exception (${duration}ms):`, error.message, error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
        duration_ms: duration
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
