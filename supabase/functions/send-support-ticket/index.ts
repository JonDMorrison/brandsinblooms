import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.1.0";
import { handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";
import { renderBloomSystemEmail, bloomEmailCard, bloomEmailEscape } from "../../../src/lib/email/premiumBotanical.ts";

/**
 * send-support-ticket
 *
 * Forwards a simple in-app support ticket submission to Bloom via Resend. Compatibility endpoint for older clients.
 */

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface SupportTicketRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const SUPPORT_INBOX = "bloom@support.bloomsuite.app";

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const { name, email, subject, message }: SupportTicketRequest = await req.json();

    if (typeof name !== "string" || name.trim().length < 2 || name.length > 100 || typeof email !== "string" || email.length > 255 || typeof subject !== "string" || !subject.trim() || subject.length > 300 || typeof message !== "string" || message.trim().length < 10 || message.length > 20000) {
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

    const emailHtml = renderBloomSystemEmail({
      eyebrow: "NEW SUPPORT REQUEST",
      title: "A customer needs support",
      icon: "mail",
      preheader: String(subject),
      bodyHtml: bloomEmailCard("Contact details", [
        { label: "Name", value: String(name), icon: "leaf" },
        { label: "Email", value: String(email), icon: "mail" },
        { label: "Subject", value: String(subject), icon: "mail" },
        { label: "Received", value: new Date().toLocaleString(), icon: "calendar" },
      ], "mail") +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background:#F8F9F6;border:1px solid #DBE3DF;border-radius:14px"><tr><td style="padding:18px">' +
      '<h2 style="margin:0 0 10px;font-size:18px;color:#1B3049">Customer message</h2>' +
      '<p style="margin:0;white-space:pre-wrap;line-height:1.6;color:#536475">' + bloomEmailEscape(String(message)) + '</p>' +
      '</td></tr></table>',
      footer: "BloomSuite — internal support notification.",
    });

    const emailResponse = await resend.emails.send({
      from: "BloomSuite Support <support@brandsinblooms.com>",
      to: [SUPPORT_INBOX],
      replyTo: email,
      subject: `[Support] ${subject}`,
      html: emailHtml,
      text: `---------- Forwarded message ---------\nFrom: ${email}\n\nPublic support form (email address is self-reported, not identity verification).\nName: ${name}\n\n${message}`,
    });

    if (emailResponse.error || !emailResponse.data?.id) {
      return corsJsonResponse({ error: "Your message could not be delivered. Please try again." }, { status: 502 });
    }
    // Bloom owns ticket creation, approved answers and acknowledgements.
    return corsJsonResponse({ success: true, message: "Support request sent to Bloom" });
  } catch {
    console.error("Support request delivery failed");
    return corsJsonResponse({ error: "Your message could not be delivered. Please try again." }, { status: 500 });
  }
};

serve(handler);
