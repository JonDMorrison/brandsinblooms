
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
  email_type?: string;
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

    const { user_id, email, days_remaining, email_type = 'trial_expiring' }: TrialReminderRequest = await req.json();
    console.log(`[TRIAL-REMINDER] Sending ${email_type} email to ${email} for user ${user_id} with ${days_remaining} days remaining`);

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

    // Generate email content based on email type
    let subject: string;
    let htmlContent: string;

    if (email_type === 'trial_expired') {
      subject = "Your 7-day trial has ended - Your content creation just got harder";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626; margin-bottom: 20px;">Hi ${companyName}! 😔</h1>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Your 7-day trial with full Bloom features has ended, and we hate to see you go back to the old way of doing things...
          </p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #7f1d1d;">You're back to:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
              <li>Staring at a blank page wondering what to post</li>
              <li>Spending hours typing out content manually</li>
              <li>Forgetting to post consistently</li>
              <li>Missing out on seasonal opportunities</li>
              <li>No more automated campaigns or social media posting</li>
              <li>No more drag-and-drop content scheduling</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            <strong>But it doesn't have to be this way!</strong> You experienced how smooth content creation can be with BloomSuite's full features. Your campaigns were ready, your content was generated, and your social media strategy was on autopilot.
          </p>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #0c4a6e; font-weight: 500;">
              🚨 <strong>Don't let your momentum die!</strong> Reactivate now and get back to effortless content creation with all Bloom features.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://udldmkqwnxhdeztyqcau.supabase.co/pricing" 
               style="background-color: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 18px;">
              Reactivate BloomSuite Now
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
            <strong>Limited time:</strong> We'll help you pick up right where you left off!
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            Questions? Just reply to this email - we're here to help!
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            Best regards,<br>
            The BloomSuite Team 🌸
          </p>
        </div>
      `;
    } else {
      // Updated trial expiring email for 2-day warning
      subject = "Your 7-day trial ends in 2 days - Don't go back to manual posting!";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">Hi ${companyName}! 👋</h1>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Your 7-day trial with <strong>full Bloom features</strong> ends in <strong>2 days</strong>, and we don't want you to go back to the old way of doing things:
          </p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
            <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
              <li>Thinking about what to post</li>
              <li>Typing everything out manually</li>
              <li>Never getting around to actually posting it</li>
              <li>Missing seasonal content opportunities</li>
            </ul>
          </div>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #166534;">What you've experienced in your trial:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #166534;">
              <li>✅ Automated content generation</li>
              <li>✅ Social media scheduling & posting</li>
              <li>✅ Drag-and-drop calendar management</li>
              <li>✅ Campaign automation</li>
              <li>✅ All premium features included</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            With BloomSuite, you've experienced how easy content creation can be with <strong>full premium access</strong>. Your campaigns are ready, your content is generated, and your social media strategy is on autopilot.
          </p>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #0c4a6e; font-weight: 500;">
              💡 <strong>Keep the momentum going!</strong> Choose a plan that fits your needs and never worry about content creation again.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://udldmkqwnxhdeztyqcau.supabase.co/pricing" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Choose Your Plan & Continue Growing
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            Questions? Just reply to this email - we're here to help!
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            Best regards,<br>
            The BloomSuite Team 🌸
          </p>
        </div>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "BloomSuite <support@bloomsuite.com>",
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    console.log("[TRIAL-REMINDER] Email sent successfully:", emailResponse);

    // Record the email in our tracking table
    const { error: trackingError } = await supabase
      .from('trial_expiration_emails')
      .insert({
        user_id,
        days_remaining,
        email_type
      });

    if (trackingError) {
      console.error('[TRIAL-REMINDER] Error recording email tracking:', trackingError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      email_id: emailResponse.data?.id,
      email_type 
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
