import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.1.0";
import { renderBloomSystemEmail, bloomEmailCard, bloomEmailEscape } from "../../../src/lib/email/premiumBotanical.ts";

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
      html: renderBloomSystemEmail({
        eyebrow: "NEW SUPPORT REQUEST",
        title: "A customer needs assistance",
        icon: "mail",
        preheader: "Support request received",
        bodyHtml: bloomEmailCard("Contact details", [
          { label: "Name", value: String(senderName), icon: "leaf" },
          { label: "Email", value: String(senderEmail), icon: "mail" },
          ...(tenant_id ? [{label:"Tenant",value:String(tenant_id),icon:"leaf" as const}] : []),
          { label: "Subject", value: String(subject), icon: "mail" },
        ],"mail") +
        '<h2 style="margin:20px 0 10px;color:#1B3049;font-size:18px">Message</h2>' +
        '<p style="margin:0;white-space:pre-wrap;color:#536475;line-height:1.6">' +
        bloomEmailEscape(String(message)) + '</p>' +
        '<p>Reply directly to this email to respond to the customer.</p>',
        footer: "BloomSuite — internal support notification.",
      }),
      replyTo: senderEmail,
    });

    if (notifyError) {
      console.error("Failed to send support notification:", notifyError);
    }

    // Send confirmation email to the user
    const { error: confirmError } = await resend.emails.send({
      from: "BloomSuite <support@bloomsuite.com>",
      to: [senderEmail],
      subject: "We got your question — we'll be in touch soon",
      html: renderBloomSystemEmail({
        brandName: "BloomSuite",
        eyebrow: "SUPPORT REQUEST RECEIVED",
        title: "We got your question",
        icon: "check",
        preheader: "Our team has your message",
        bodyHtml: '<p>Hi ' + bloomEmailEscape(String(senderName)) + ',</p>' +
          '<p>Thanks for reaching out. We received your question about <strong>' +
          bloomEmailEscape(String(subject)) +
          '</strong> and will get back to you within one business day.</p>' +
          '<p>You can also browse our help centre for guides and troubleshooting.</p>',
        action:{label:"Visit the help centre",url:"https://bloomsuite.notion.site/bloomsuite-help"},
        footer:"BloomSuite Support — we're here to help.",
      }),
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
