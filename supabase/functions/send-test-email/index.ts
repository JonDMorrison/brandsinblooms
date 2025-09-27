import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2";

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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Send test email function called");
    
    const payload = await req.json();
    console.log("📧 Payload received:", { 
      type: payload.campaignId ? 'campaign' : payload.senderId ? 'sender' : 'domain',
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

    let emailResponse;

    if (payload.campaignId !== undefined) {
      // Campaign test email
      const { email, subject, content } = payload as CampaignTestPayload;
      
      console.log("📤 Sending campaign test email to:", email);
      
      emailResponse = await resend.emails.send({
        from: "BloomSuite <noreply@brandsinblooms.com>",
        to: [email],
        subject: `[TEST] ${subject}`,
        html: content,
      });
      
    } else if (payload.senderId) {
      // Sender test email
      const { testEmail } = payload as SenderTestPayload;
      
      console.log("📤 Sending sender test email to:", testEmail);
      
      emailResponse = await resend.emails.send({
        from: "BloomSuite <noreply@brandsinblooms.com>",
        to: [testEmail],
        subject: "BloomSuite Sender Configuration Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #22C55E;">Sender Configuration Test</h2>
            <p>This is a test email to verify your sender configuration is working correctly.</p>
            <p>If you receive this email, your sender settings are properly configured!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              Sent from BloomSuite - Email Marketing Platform
            </p>
          </div>
        `,
      });
      
    } else if (payload.domain) {
      // Domain test email
      const { testEmail, domain } = payload as DomainTestPayload;
      
      console.log("📤 Sending domain test email to:", testEmail, "for domain:", domain);
      
      emailResponse = await resend.emails.send({
        from: `BloomSuite <test@${domain}>`,
        to: [testEmail],
        subject: "BloomSuite Domain Verification Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #22C55E;">Domain Verification Test</h2>
            <p>This is a test email to verify your domain <strong>${domain}</strong> is properly configured.</p>
            <p>If you receive this email, your domain DNS settings are working correctly!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              Sent from ${domain} via BloomSuite
            </p>
          </div>
        `,
      });
    } else {
      throw new Error("Invalid payload format");
    }

    console.log("✅ Email sent successfully:", emailResponse);

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
    
    // Handle specific Resend errors
    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({ error: "Email service configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send test email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);