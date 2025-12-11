import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateServerFooterHtml, type CompanyProfileData } from "../_shared/footerGenerator.ts";

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
 * The frontend no longer generates footer HTML - it's added server-side only.
 * This function is kept as a safeguard in case legacy content has a footer.
 */
function stripExistingFooter(html: string): string {
  // Look for footer markers - try multiple patterns
  const footerPatterns = [
    // Pattern 1: Footer with margin-top: 40px (our generated footer)
    /<div[^>]*style="[^"]*background-color[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*$/i,
    // Pattern 2: Unsubscribe section at the end
    /<div[^>]*>\s*<div[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>[\s\S]*?Unsubscribe[\s\S]*?<\/div>\s*<\/div>\s*$/i,
    // Pattern 3: Footer with specific background color patterns
    /<div[^>]*style="[^"]*background-color:\s*#283024[^"]*"[^>]*>[\s\S]*<\/div>\s*$/i,
    // Pattern 4: Footer table structure with social icons from bloomsuite.app
    /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>\s*<div[^>]*style="[^"]*max-width:\s*640px[^"]*"[^>]*>[\s\S]*?social-icons[\s\S]*?<\/div>\s*<\/div>\s*$/i,
  ];

  let strippedHtml = html;
  
  for (const pattern of footerPatterns) {
    const match = strippedHtml.match(pattern);
    if (match) {
      console.log("📧 Found and stripping existing footer (legacy content)");
      strippedHtml = strippedHtml.replace(pattern, '');
      break;
    }
  }
  
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
      type: payload.email ? 'campaign' : payload.senderId ? 'sender' : 'domain',
      email: payload.email || payload.testEmail 
    });

    // Check if Resend API key is configured
    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get authorization token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("❌ Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("❌ Failed to get user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch FULL company profile including social URLs for footer regeneration
    const { data: companyProfile, error: profileError } = await supabaseClient
      .from('company_profiles')
      .select(`
        company_name, custom_sender_email, website_url,
        street_address, city, state_province, postal_code, country,
        company_email, company_phone,
        facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
        footer_legal_text, brand_primary_color, brand_text_color, feature_flags
      `)
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error("❌ Failed to fetch company profile:", profileError);
    }

    // Log social URLs for debugging
    console.log("📧 Company profile social URLs:", {
      facebook: companyProfile?.facebook_url ? '✓' : '✗',
      instagram: companyProfile?.instagram_url ? '✓' : '✗',
      tiktok: companyProfile?.tiktok_url ? '✓' : '✗',
      pinterest: companyProfile?.pinterest_url ? '✓' : '✗',
      youtube: companyProfile?.youtube_url ? '✓' : '✗',
      linkedin: companyProfile?.linkedin_url ? '✓' : '✗',
    });

    // Determine reply-to email and sender name
    const replyToEmail = companyProfile?.custom_sender_email || user.email;
    const senderName = companyProfile?.company_name || 'BloomSuite';
    
    // Use bulk domain for "from" address
    const BULK_DOMAIN = 'notify.bloomsuite.app';
    const fromAddress = `${senderName} <hello@${BULK_DOMAIN}>`;
    
    console.log("📤 Email config:", { fromAddress, replyToEmail, senderName });

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
        const unsubscribeUrl = '#unsubscribe-test';
        const managePreferencesUrl = '#preferences-test';
        
        // Generate server-side footer with full profile data
        const serverFooter = generateServerFooterHtml(
          companyProfile as CompanyProfileData,
          unsubscribeUrl,
          managePreferencesUrl
        );
        
        // Find the closing body/html tags and insert footer before them
        if (contentWithoutFooter.includes('</body>')) {
          finalContent = contentWithoutFooter.replace('</body>', `${serverFooter}</body>`);
        } else if (contentWithoutFooter.includes('</html>')) {
          finalContent = contentWithoutFooter.replace('</html>', `${serverFooter}</html>`);
        } else {
          // No body/html tags, just append
          finalContent = contentWithoutFooter + serverFooter;
        }
        
        console.log("📧 Footer regenerated successfully for test email");
      }
      
      emailResponse = await resend.emails.send({
        from: fromAddress,
        reply_to: replyToEmail,
        to: [email],
        subject: `[TEST] ${subject}`,
        html: finalContent,
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
      
      console.log("📤 Sending domain test email to:", testEmail, "for domain:", domain);
      
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
        message: "Test email sent successfully" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
    
  } catch (error: any) {
    console.error("❌ Error in send-test-email function:", error);
    
    // Handle specific Resend errors with better messages
    let errorMessage = error.message || "Failed to send test email";
    let statusCode = 500;
    
    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      errorMessage = "Email service configuration error. Please check your Resend API key.";
      statusCode = 500;
    } else if (error.message?.includes('domain') || error.message?.includes('verify')) {
      errorMessage = "Domain verification required. Please verify your sending domain.";
      statusCode = 403;
    } else if (error.message?.includes('rate limit')) {
      errorMessage = "Rate limit exceeded. Please try again in a few moments.";
      statusCode = 429;
    } else if (error.message?.includes('Invalid payload')) {
      errorMessage = "Invalid request format. Please try again.";
      statusCode = 400;
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
