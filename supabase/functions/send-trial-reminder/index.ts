
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from "npm:resend@2.1.0";
import {renderBloomSystemEmail,bloomEmailEscape,bloomEmailCard} from "../../../src/lib/email/premiumBotanical.ts";
import { resolveSender, buildFromAddress } from "../_shared/senderResolver.ts";

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

    // Get tenant for the user to resolve sender
    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user_id)
      .single();

    // Resolve sender (trial reminders are system emails, so we use BloomSuite branding)
    // But we still want to use tenant's fallback if available for consistency
    let fromAddress = "BloomSuite <support@bloomsuite.com>";
    if (userRecord?.tenant_id) {
      const senderConfig = await resolveSender(supabase, userRecord.tenant_id, { userId: user_id });
      console.log('[TRIAL-REMINDER] Resolved sender:', senderConfig);
      // For trial reminders, always use BloomSuite branding but with the resolved email
      fromAddress = `BloomSuite <${senderConfig.fromEmail}>`;
    }

    // Generate email content based on email type
    let subject: string;
    let htmlContent: string;

    const expired=email_type==="trial_expired";
    const remaining=Number.isFinite(days_remaining)?Math.max(0,Math.ceil(days_remaining)):2;
    subject=expired?"Your BloomSuite trial has ended":"Your BloomSuite trial is ending soon";
    const summary=expired
      ?"Your seven-day trial has ended. You can review your options when you are ready to continue."
      :"Your seven-day trial has "+remaining+" day"+(remaining===1?"":"s")+" remaining. Keep your content and campaigns moving by reviewing your plan options.";
    const guidance=expired
      ?"Your account can be reactivated by choosing a subscription that fits your garden centre."
      :"You can review your plan, finish your setup and prepare for uninterrupted access.";
    htmlContent=renderBloomSystemEmail({
      eyebrow:expired?"TRIAL STATUS":"ACCOUNT REMINDER",
      title:expired?"Your trial has ended":"Keep growing with BloomSuite",
      icon:expired?"calendar":"leaf",
      preheader:summary,
      bodyHtml:"<p>Hi "+bloomEmailEscape(companyName)+",</p><p>"+bloomEmailEscape(summary)+"</p>"+
        bloomEmailCard("Next steps",[
          {label:"Status",value:expired?"Trial ended":remaining+" day"+(remaining===1?"":"s")+" left",icon:"calendar"},
          {label:"Your options",value:guidance,icon:"leaf"},
        ],"check")+
        "<p>Questions? Reply to this email and the BloomSuite team can help.</p>",
      action:{label:expired?"Review reactivation options":"Review plans",url:"https://bloomsuite.app/pricing"},
      footer:"BloomSuite — support for independent garden centres.",
    });

    const emailResponse = await resend.emails.send({
      from: fromAddress,
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
