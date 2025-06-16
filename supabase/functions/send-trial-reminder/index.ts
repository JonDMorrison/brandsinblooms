
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrialReminderRequest {
  user_id: string;
  email: string;
  days_remaining: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TRIAL-REMINDER] Function started');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, email, days_remaining }: TrialReminderRequest = await req.json();
    console.log(`[TRIAL-REMINDER] Sending email to ${email} for user ${user_id} with ${days_remaining} days remaining`);

    // Get user's company profile for personalization
    const { data: profile, error: profileError } = await supabase
      .from('company_profiles')
      .select('company_name')
      .eq('user_id', user_id)
      .maybeSingle();

    if (profileError) {
      console.error('[TRIAL-REMINDER] Error fetching company profile:', profileError);
    }

    const companyName = profile?.company_name || 'there';

    const emailResponse = await resend.emails.send({
      from: "Bloom Boost <support@bloomboost.co>",
      to: [email],
      subject: "Your trial ends in 3 days - Don't go back to manual posting!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">Hi ${companyName}! 👋</h1>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Your free trial ends in <strong>3 days</strong>, and we don't want you to go back to the old way of doing things:
          </p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
            <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
              <li>Thinking about what to post</li>
              <li>Typing everything out manually</li>
              <li>Never getting around to actually posting it</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            With Bloom Boost, you've experienced how easy content creation can be. Your campaigns are ready, your content is generated, and your social media strategy is on autopilot.
          </p>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #0c4a6e; font-weight: 500;">
              💡 <strong>Keep the momentum going!</strong> Choose a plan that fits your needs and never worry about content creation again.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://your-app-url.com/pricing" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Choose Your Plan & Continue Growing
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            Questions? Just reply to this email - we're here to help!
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            Best regards,<br>
            The Bloom Boost Team 🌸
          </p>
        </div>
      `,
    });

    console.log("[TRIAL-REMINDER] Email sent successfully:", emailResponse);

    // Record the email in our tracking table
    const { error: trackingError } = await supabase
      .from('trial_expiration_emails')
      .insert({
        user_id,
        days_remaining,
        email_type: 'trial_expiring'
      });

    if (trackingError) {
      console.error('[TRIAL-REMINDER] Error recording email tracking:', trackingError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      email_id: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("[TRIAL-REMINDER] Error in send-trial-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
