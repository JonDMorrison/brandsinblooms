import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.1.0";
import {renderBloomSystemEmail,bloomEmailCard} from "../../../src/lib/email/premiumBotanical.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  type: 'trial_signup' | 'trial_conversion';
  user_id: string;
  user_email: string;
  user_name?: string;
  company_name?: string;
  plan?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ADMIN-NOTIFICATION] Function started');
    
    // Initialize Supabase and Resend
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const payload: NotificationPayload = await req.json();
    console.log('[ADMIN-NOTIFICATION] Payload received:', payload);

    // Get additional user data from database
    const { data: userData, error: userError } = await supabase
      .from('company_profiles')
      .select('company_name')
      .eq('user_id', payload.user_id)
      .single();

    if (userError) {
      console.log('[ADMIN-NOTIFICATION] No company profile found, continuing with basic info');
    }

    const companyName = userData?.company_name || payload.company_name || 'Not provided';
    const userName = payload.user_name || 'Not provided';

    // Prepare email content based on notification type
    let subject: string;
    let htmlContent: string;

    const signup=payload.type==="trial_signup";
    subject=signup?"New Trial Signup - BloomSuite":"Trial Conversion - BloomSuite";
    const rows=[
      {label:"Name",value:userName,icon:"leaf" as const},
      {label:"Email",value:payload.user_email,icon:"mail" as const},
      {label:"Company",value:companyName,icon:"leaf" as const},
      ...(signup?[]:[{label:"Plan",value:payload.plan||"Paid Plan",icon:"check" as const}]),
      {label:signup?"Signup time":"Conversion time",value:new Date().toLocaleString(),icon:"calendar" as const},
    ];
    htmlContent=renderBloomSystemEmail({
      eyebrow:signup?"NEW TRIAL SIGNUP":"TRIAL CONVERTED",
      title:signup?"A new business has started a trial":"A trial has converted to paid",
      icon:signup?"leaf":"check",
      bodyHtml:bloomEmailCard("Account details",rows,signup?"mail":"check")+
        '<p>This is an automated operational notification from BloomSuite.</p>',
      footer:"BloomSuite — internal account notification.",
    });

    // Send notification emails to admin emails
    const adminEmails = ['jon@brandsinblooms.com', 'jeff@brandsinblooms.com'];
    
    for (const adminEmail of adminEmails) {
      console.log(`[ADMIN-NOTIFICATION] Sending ${payload.type} notification to ${adminEmail}`);
      
      const emailResponse = await resend.emails.send({
        from: "BloomSuite Notifications <noreply@brandsinblooms.com>",
        replyTo: payload.user_email, // Reply goes to the user who triggered the event
        to: [adminEmail],
        subject: subject,
        html: htmlContent,
      });

      if (emailResponse.error) {
        console.error(`[ADMIN-NOTIFICATION] Failed to send to ${adminEmail}:`, emailResponse.error);
      } else {
        console.log(`[ADMIN-NOTIFICATION] Successfully sent to ${adminEmail}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${payload.type} notification sent to admin emails` 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("[ADMIN-NOTIFICATION] Error:", error);
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