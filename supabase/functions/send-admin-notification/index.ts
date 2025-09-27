import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2";

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

    if (payload.type === 'trial_signup') {
      subject = '🎉 New Trial Signup - BloomSuite';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22C55E; margin-bottom: 20px;">New Trial Signup!</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #333;">User Details:</h3>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${payload.user_email}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p><strong>Signup Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This notification was sent automatically by the BloomSuite system.
          </p>
        </div>
      `;
    } else {
      subject = '💰 Trial Conversion - BloomSuite';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22C55E; margin-bottom: 20px;">Trial Converted to Paid!</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #333;">User Details:</h3>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${payload.user_email}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p><strong>New Plan:</strong> ${payload.plan || 'Paid Plan'}</p>
            <p><strong>Conversion Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This notification was sent automatically by the BloomSuite system.
          </p>
        </div>
      `;
    }

    // Send notification emails to admin emails
    const adminEmails = ['jon@brandsinblooms.com', 'jeff@brandsinblooms.com'];
    
    for (const adminEmail of adminEmails) {
      console.log(`[ADMIN-NOTIFICATION] Sending ${payload.type} notification to ${adminEmail}`);
      
      const emailResponse = await resend.emails.send({
        from: "BloomSuite Notifications <noreply@brandsinblooms.com>",
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