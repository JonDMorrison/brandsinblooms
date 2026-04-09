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

    // ── AI auto-response to the client ──────────────────────────────
    // Isolated in its own try/catch — failure here must NOT fail the
    // function. The internal support@ email is the source of truth.
    try {
      const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

      const openAiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 400,
            messages: [
              {
                role: "system",
                content: `You are a warm, knowledgeable support assistant for BloomSuite — a marketing platform built for independent garden centers. You help garden center owners with questions about email campaigns, automations, contacts, POS integrations, social media, and account setup.

Your job is to read the client's support request and write a helpful, specific, warm email response.

Rules:
- Be warm and human. Write like Jeff — knowledgeable but approachable.
- Answer their specific question directly if you can, based on the knowledge base below.
- If you can answer it: give a clear, step-by-step answer. Link to bloomsuite.notion.site/bloomsuite-help for more detail.
- If you cannot fully answer it: acknowledge their question specifically, tell them a human is looking into it, and give them the KB link as a starting point.
- Never make up features or settings that don't exist.
- Never promise specific outcomes.
- Always end with: "We've also flagged this for our team and will follow up if anything needs a closer look. — Jeff & Jon, BloomSuite"
- Keep it under 200 words. Conversational paragraphs, not bullet walls.

KNOWLEDGE BASE SUMMARY:
- Getting Started: 5-step setup wizard — brand colors (bloomsuite.app/profile/brand-colors), company profile (bloomsuite.app/profile/company), POS connection (bloomsuite.app/integrations), import contacts (bloomsuite.app/crm/customers), email domain (bloomsuite.app/crm/settings/email-sending)
- Supported POS: Square, Shopify, Lightspeed (requires setup call), Clover
- Email domain: requires SPF, DKIM, DMARC DNS records. Can take 48 hours to verify.
- Campaigns: Go to bloomsuite.app/newsletters/new. Target open rate 25%+, click rate 2-5%, bounce rate under 3%.
- Automations: bloomsuite.app/crm/automations. Win-back, post-purchase, seasonal triggers available.
- Contacts/segments: bloomsuite.app/crm/customers and bloomsuite.app/crm/segments
- Analytics: bloomsuite.app/analytics
- Social media: Facebook and Instagram via OAuth. Tokens expire every 60 days.
- CASL: Canadian anti-spam. Implied consent = purchased in last 24 months. Express consent = explicit opt-in.
- SMS: US and Canada only. STOP keyword handled automatically.
- If emails go to spam: check domain verification at bloomsuite.app/crm/settings/email-sending
- Full help: bloomsuite.notion.site/bloomsuite-help`,
              },
              {
                role: "user",
                content: `Support request from ${name} (${email})\n\nSubject: ${subject}\n\nMessage: ${message}`,
              },
            ],
          }),
        },
      );

      const openAiData = await openAiResponse.json();
      const aiReply: string | null =
        openAiData?.choices?.[0]?.message?.content ?? null;

      if (aiReply) {
        const aiParagraphs = aiReply
          .split(/\n+/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0)
          .map((p: string) => `<p>${p}</p>`)
          .join("\n");

        const autoReplyHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #1f2937;">
            <p>Hi ${name},</p>
            ${aiParagraphs}
          </div>
        `;

        const autoReplyResponse = await resend.emails.send({
          from: "BloomSuite Support <hello@brandsinblooms.com>",
          to: [email],
          reply_to: SUPPORT_INBOX,
          subject: `Re: ${subject}`,
          html: autoReplyHtml,
        });

        console.log("send-support-ticket: AI auto-reply sent", autoReplyResponse);
      } else {
        console.warn(
          "send-support-ticket: OpenAI returned no content — skipping auto-reply",
          openAiData,
        );
      }
    } catch (autoReplyErr) {
      console.error(
        "send-support-ticket: AI auto-reply failed (non-fatal):",
        autoReplyErr,
      );
    }

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
