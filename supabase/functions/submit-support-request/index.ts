import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, message, user_name, user_email, tenant_id } =
      await req.json();

    if (!subject || !message) {
      return new Response(
        JSON.stringify({ error: "Subject and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const senderName = user_name || user.user_metadata?.full_name || "User";
    const senderEmail = user_email || user.email || "unknown";

    // Insert into support_requests table
    const { error: insertError } = await supabase
      .from("support_requests")
      .insert({
        tenant_id: tenant_id || null,
        user_id: user.id,
        user_email: senderEmail,
        user_name: senderName,
        subject,
        message,
        status: "open",
      });

    if (insertError) {
      console.error("Failed to insert support request:", insertError.message);
      // Continue — still send the email even if DB insert fails
    }

    // Send notification email to support team
    const { error: notifyError } = await resend.emails.send({
      from: "BloomSuite <support@bloomsuite.com>",
      to: ["support@brandsinblooms.com"],
      subject: `[Support] ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">New Support Request</h2>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />
          <p><strong>From:</strong> ${senderName} (${senderEmail})</p>
          ${tenant_id ? `<p><strong>Tenant:</strong> ${tenant_id}</p>` : ""}
          <p><strong>Subject:</strong> ${subject}</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; white-space: pre-wrap;">${message}</div>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />
          <p style="color: #6b7280; font-size: 12px;">Reply directly to this email to respond to the customer.</p>
        </div>
      `,
      reply_to: senderEmail,
    });

    if (notifyError) {
      console.error("Failed to send support notification:", notifyError);
    }

    // Send confirmation email to the user
    const { error: confirmError } = await resend.emails.send({
      from: "BloomSuite <support@bloomsuite.com>",
      to: [senderEmail],
      subject: "We got your question — we'll be in touch soon",
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <p>Hi ${senderName},</p>
          <p>Thanks for reaching out. We received your question about "<strong>${subject}</strong>" and will get back to you within 1 business day.</p>
          <p>In the meantime, you can browse our <a href="https://bloomsuite.notion.site/bloomsuite-help" style="color: #68BEB9;">Help Center</a> for guides and troubleshooting.</p>
          <br />
          <p>— The BloomSuite Team</p>
        </div>
      `,
    });

    if (confirmError) {
      console.error("Failed to send confirmation email:", confirmError);
    }

    console.log(
      `[support] Request submitted by ${senderEmail}: "${subject}"`,
    );

    return new Response(
      JSON.stringify({ success: true, message: "Support request submitted" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[support] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
