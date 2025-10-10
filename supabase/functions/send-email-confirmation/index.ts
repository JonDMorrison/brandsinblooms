import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  customerId: string;
  email: string;
  firstName?: string;
  brandName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { customerId, email, firstName, brandName }: ConfirmationEmailRequest = await req.json();

    console.log(`Sending confirmation email to ${email} for customer ${customerId}`);

    // Generate confirmation token (encrypted customer ID)
    const token = btoa(customerId);
    const confirmUrl = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}/confirm-subscription?token=${token}`;

    const emailResponse = await resend.emails.send({
      from: `${brandName || 'Our Team'} <onboarding@resend.dev>`,
      to: [email],
      subject: `Confirm your subscription to ${brandName || 'our newsletter'}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #22C55E; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .button:hover { background: #16A34A; }
              .benefits { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .benefit-item { display: flex; align-items: start; margin: 12px 0; }
              .benefit-icon { color: #22C55E; margin-right: 10px; font-size: 20px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Confirm Your Subscription</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px;">Hi${firstName ? ` ${firstName}` : ''}!</p>
              
              <p>We recently added your email to our customer list. To make sure you want to hear from us, please confirm your subscription.</p>
              
              <div style="text-align: center;">
                <a href="${confirmUrl}" class="button">Confirm Subscription</a>
              </div>
              
              <div class="benefits">
                <p style="font-weight: 600; margin-bottom: 15px;">By confirming, you'll receive:</p>
                <div class="benefit-item">
                  <span class="benefit-icon">✨</span>
                  <span>Exclusive offers and promotions</span>
                </div>
                <div class="benefit-item">
                  <span class="benefit-icon">🎁</span>
                  <span>New product announcements</span>
                </div>
                <div class="benefit-item">
                  <span class="benefit-icon">💡</span>
                  <span>Helpful tips and updates</span>
                </div>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">You can unsubscribe anytime with one click.</p>
              
              <div class="footer">
                <p>Not interested? No problem—just ignore this email.</p>
                <p style="margin-top: 15px;">&copy; ${new Date().getFullYear()} ${brandName || 'Our Company'}. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      throw new Error(emailResponse.error.message);
    }

    console.log(`Confirmation email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending confirmation email:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
