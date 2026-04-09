import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.1.0";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

/**
 * send-support-ticket
 *
 * Forwards a simple in-app support ticket submission to support@brandsinblooms.com
 * via Resend. Used by the Contact Support form on /support.
 */

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface SupportTicketRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const SUPPORT_INBOX = "support@brandsinblooms.com";

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const { name, email, subject, message }: SupportTicketRequest = await req.json();

    if (!name || !email || !subject || !message) {
      return corsJsonResponse(
        { error: "Missing required fields (name, email, subject, message)" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return corsJsonResponse(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    const emailHtml = `
      <h2>New BloomSuite Support Ticket</h2>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2563eb;">From</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2563eb;">${subject}</h3>
        <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

      <p style="color: #6b7280; font-size: 14px;">
        Submitted from the BloomSuite Support page on ${new Date().toLocaleString()}.
      </p>
    `;

    const emailResponse = await resend.emails.send({
      from: "BloomSuite Support <support@brandsinblooms.com>",
      to: [SUPPORT_INBOX],
      reply_to: email,
      subject: `[Support] ${subject}`,
      html: emailHtml,
    });

    console.log("send-support-ticket: email sent", emailResponse);

    return corsJsonResponse({
      success: true,
      message: "Support ticket submitted",
    });
  } catch (error: any) {
    console.error("send-support-ticket error:", error);
    return corsJsonResponse(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
};

serve(handler);
