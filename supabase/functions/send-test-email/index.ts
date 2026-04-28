import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.1.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateServerFooterHtml,
  type CompanyProfileData,
} from "../_shared/footerGenerator.ts";
import {
  resolveSender,
  buildFromAddress,
  type SenderConfig,
} from "../_shared/senderResolver.ts";
import { sanitizeEmailHtmlImageSources } from "../_shared/emailImageUrl.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CampaignTestPayload {
  email: string;
  subject: string;
  content: string;
  campaignId?: string;
}

interface SenderTestPayload {
  senderId: string;
  testEmail: string;
}

interface DomainTestPayload {
  domain: string;
  testEmail: string;
}

/**
 * Strip ALL existing footer HTML from content to prevent double footers.
 * The server-side footer generator is the single source of truth.
 * This aggressively removes any footer-like structures before the closing tags.
 */
function stripExistingFooter(html: string): string {
  let strippedHtml = html;

  // Pattern: Footer wrapper with margin-top: 40px (our generated footer)
  // This is the most reliable marker for our footers
  const footerWrapperPattern =
    /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi;
  if (footerWrapperPattern.test(strippedHtml)) {
    console.log("📧 Stripping footer with margin-top:40px pattern");
    strippedHtml = strippedHtml.replace(footerWrapperPattern, "");
  }

  // Pattern: Footer with Unsubscribe link inside background-colored container
  const unsubscribeFooterPattern =
    /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*max-width:\s*640px[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (unsubscribeFooterPattern.test(strippedHtml)) {
    console.log("📧 Stripping unsubscribe footer pattern");
    strippedHtml = strippedHtml.replace(unsubscribeFooterPattern, "");
  }

  // Pattern: Social icons from our storage
  const socialIconsFooterPattern =
    /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?social-icons[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (socialIconsFooterPattern.test(strippedHtml)) {
    console.log("📧 Stripping social icons footer pattern");
    strippedHtml = strippedHtml.replace(socialIconsFooterPattern, "");
  }

  // Pattern: Legacy footer with specific dark green background
  const legacyGreenFooterPattern =
    /<div[^>]*style="[^"]*background-color:\s*#283024[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (legacyGreenFooterPattern.test(strippedHtml)) {
    console.log("📧 Stripping legacy green footer pattern");
    strippedHtml = strippedHtml.replace(legacyGreenFooterPattern, "");
  }

  // Final cleanup: Remove any remaining footer-like structures before closing tags
  // Look for the pattern: colored div containing "Unsubscribe" anywhere before </body>
  const finalCleanupPattern =
    /<div[^>]*style="[^"]*background-color[^"]*width:\s*100%[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/div>)*\s*(<\/body>|<\/html>|$))/gi;
  strippedHtml = strippedHtml.replace(finalCleanupPattern, (match) => {
    console.log("📧 Final cleanup: stripping remaining footer structure");
    return "";
  });

  console.log("📧 Footer stripping complete");
  return strippedHtml;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Send test email function called");

    const payload = await req.json();
    console.log("📧 Payload received:", {
      type: payload.email ? "campaign" : payload.senderId ? "sender" : "domain",
      email: payload.email || payload.testEmail,
    });

    // Check if Resend API key is configured
    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // Get authorization token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("❌ Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // Use service role client to verify user from JWT - more reliable than anon key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Extract JWT token and get user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error("❌ Failed to get user:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log("✅ Authenticated user:", user.id, user.email);
    // Fetch FULL company profile including social URLs for footer regeneration
    const { data: companyProfile, error: profileError } = await supabaseAdmin
      .from("company_profiles")
      .select(
        `
        company_name, custom_sender_email, website_url,
        street_address, city, state_province, postal_code, country,
        company_email, company_phone,
        facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
        footer_legal_text, brand_primary_color, brand_text_color, feature_flags
      `,
      )
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("❌ Failed to fetch company profile:", profileError);
    }

    // Log social URLs for debugging
    console.log("📧 Company profile social URLs:", {
      facebook: companyProfile?.facebook_url ? "✓" : "✗",
      instagram: companyProfile?.instagram_url ? "✓" : "✗",
      tiktok: companyProfile?.tiktok_url ? "✓" : "✗",
      pinterest: companyProfile?.pinterest_url ? "✓" : "✗",
      youtube: companyProfile?.youtube_url ? "✓" : "✗",
      linkedin: companyProfile?.linkedin_url ? "✓" : "✗",
    });

    // Get tenant ID for the user
    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userRecord?.tenant_id;

    // Use unified sender resolver for determining sender
    let senderConfig: SenderConfig | null = null;
    if (tenantId) {
      senderConfig = await resolveSender(supabaseAdmin, tenantId, {
        userId: user.id,
      });
      console.log("📧 Resolved sender config:", senderConfig);
    }

    // Determine reply-to email (prefer sender settings, then custom email, then user email)
    const replyToEmail =
      senderConfig?.replyTo ||
      companyProfile?.custom_sender_email ||
      user.email;
    const senderName = companyProfile?.company_name || "BloomSuite";

    // Use sender resolver config if available, otherwise fallback to default
    let fromAddress: string;
    if (senderConfig) {
      fromAddress = buildFromAddress(senderConfig);
    } else {
      // Fallback for cases where tenant is not found
      const BULK_DOMAIN = "notify.bloomsuite.app";
      fromAddress = `${senderName} <hello@${BULK_DOMAIN}>`;
    }

    console.log("📤 Email config:", {
      fromAddress,
      replyToEmail,
      senderName,
      deliveryMethod: senderConfig?.deliveryMethod || "fallback",
    });

    let emailResponse;

    // Check which type of test email based on payload structure
    if (payload.email && payload.subject && payload.content) {
      // Campaign test email - regenerate footer server-side
      const { email, subject, content } = payload as CampaignTestPayload;

      console.log("📤 Sending campaign test email to:", email);

      // Regenerate footer server-side to ensure social icons are included
      let finalContent = content;

      if (companyProfile) {
        console.log("📧 Regenerating footer server-side for test email");

        // Strip any existing footer
        const contentWithoutFooter = stripExistingFooter(content);

        // Generate placeholder URLs for test emails
        const unsubscribeUrl = "#unsubscribe-test";
        const managePreferencesUrl = "#preferences-test";

        // Generate server-side footer with full profile data
        const serverFooter = generateServerFooterHtml(
          companyProfile as CompanyProfileData,
          unsubscribeUrl,
          managePreferencesUrl,
        );

        // Find the closing body/html tags and insert footer before them
        if (contentWithoutFooter.includes("</body>")) {
          finalContent = contentWithoutFooter.replace(
            "</body>",
            `${serverFooter}</body>`,
          );
        } else if (contentWithoutFooter.includes("</html>")) {
          finalContent = contentWithoutFooter.replace(
            "</html>",
            `${serverFooter}</html>`,
          );
        } else {
          // No body/html tags, just append
          finalContent = contentWithoutFooter + serverFooter;
        }

        console.log("📧 Footer regenerated successfully for test email");
      }

      const imageSanitization = sanitizeEmailHtmlImageSources(
        finalContent,
        "send-test-email",
      );

      emailResponse = await resend.emails.send({
        from: fromAddress,
        reply_to: replyToEmail,
        to: [email],
        subject: `[TEST] ${subject}`,
        html: imageSanitization.html,
      });

      // Check for Resend errors
      if (emailResponse.error) {
        console.error("❌ Resend returned an error:", emailResponse.error);
        throw new Error(emailResponse.error.message || "Email service error");
      }
    } else if (payload.senderId) {
      // Sender test email
      const { testEmail } = payload as SenderTestPayload;

      console.log("📤 Sending sender test email to:", testEmail);

      emailResponse = await resend.emails.send({
        from: fromAddress,
        reply_to: replyToEmail,
        to: [testEmail],
        subject: "BloomSuite Sender Configuration Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #22C55E;">Sender Configuration Test</h2>
            <p>This is a test email to verify your sender configuration is working correctly.</p>
            <p>If you receive this email, your sender settings are properly configured!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              Sent from BloomSuite - Email Marketing Platform<br/>
              Reply-to: ${replyToEmail}
            </p>
          </div>
        `,
      });

      // Check for Resend errors
      if (emailResponse.error) {
        console.error("❌ Resend returned an error:", emailResponse.error);
        throw new Error(emailResponse.error.message || "Email service error");
      }
    } else if (payload.domain) {
      // Domain test email
      const { testEmail, domain } = payload as DomainTestPayload;

      console.log(
        "📤 Sending domain test email to:",
        testEmail,
        "for domain:",
        domain,
      );

      emailResponse = await resend.emails.send({
        from: fromAddress,
        reply_to: replyToEmail,
        to: [testEmail],
        subject: "BloomSuite Domain Verification Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #22C55E;">Domain Verification Test</h2>
            <p>This is a test email to verify your domain <strong>${domain}</strong> is properly configured.</p>
            <p>If you receive this email, your domain DNS settings are working correctly!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              Sent from ${domain} via BloomSuite<br/>
              Reply-to: ${replyToEmail}
            </p>
          </div>
        `,
      });

      // Check for Resend errors
      if (emailResponse.error) {
        console.error("❌ Resend returned an error:", emailResponse.error);
        throw new Error(emailResponse.error.message || "Email service error");
      }
    } else {
      console.error("❌ Invalid payload format:", payload);
      throw new Error("Invalid payload format - missing required fields");
    }

    console.log("✅ Email sent successfully:", emailResponse.data);

    return new Response(
      JSON.stringify({
        emailId: emailResponse.data?.id,
        message: "Test email sent successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error: any) {
    console.error("❌ Error in send-test-email function:", error);

    // Handle specific Resend errors with better messages
    let errorMessage = error.message || "Failed to send test email";
    let statusCode = 500;

    if (
      error.message?.includes("API key") ||
      error.message?.includes("authentication")
    ) {
      errorMessage =
        "Email service configuration error. Please check your Resend API key.";
      statusCode = 500;
    } else if (
      error.message?.includes("domain") ||
      error.message?.includes("verify")
    ) {
      errorMessage =
        "Domain verification required. Please verify your sending domain.";
      statusCode = 403;
    } else if (error.message?.includes("rate limit")) {
      errorMessage = "Rate limit exceeded. Please try again in a few moments.";
      statusCode = 429;
    } else if (error.message?.includes("Invalid payload")) {
      errorMessage = "Invalid request format. Please try again.";
      statusCode = 400;
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
