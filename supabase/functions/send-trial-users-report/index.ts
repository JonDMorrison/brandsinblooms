import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.1.0";
import { renderBloomSystemEmail, bloomEmailCard, bloomEmailEscape } from "../../../src/lib/email/premiumBotanical.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TRIAL-REPORT] Starting trial users report generation');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get all trial users with their profile data
    const { data: trialUsers, error: queryError } = await supabase
      .from('subscriptions')
      .select(`
        user_id,
        plan,
        start_date,
        end_date,
        created_at
      `)
      .eq('plan', 'free_trial')
      .order('created_at', { ascending: false });

    if (queryError) {
      throw new Error(`Failed to query trial users: ${queryError.message}`);
    }

    console.log(`[TRIAL-REPORT] Found ${trialUsers?.length || 0} trial users`);

    // Get user details from auth.users and company_profiles
    const userDetails = await Promise.all(
      (trialUsers || []).map(async (subscription) => {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(subscription.user_id);
        
        const { data: profile } = await supabase
          .from('company_profiles')
          .select('company_name')
          .eq('user_id', subscription.user_id)
          .single();

        const daysRemaining = Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const status = daysRemaining > 0 ? 'Active' : 'Expired';

        return {
          email: user?.email || 'Unknown',
          name: user?.user_metadata?.full_name || 'Not provided',
          company: profile?.company_name || 'Not provided',
          signupDate: new Date(subscription.created_at).toLocaleDateString(),
          trialEndDate: new Date(subscription.end_date).toLocaleDateString(),
          daysRemaining,
          status
        };
      })
    );

    // Small-screen-first operational overview: no seven-column table or
    // user-controlled values embedded without escaping. All records remain
    // included; summary counts are unchanged.
    const activeTrials = userDetails.filter(user => user.status === 'Active').length;
    const expiredTrials = userDetails.filter(user => user.status === 'Expired').length;
    const userCards = userDetails.map(user =>
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:11px 0;background:#FFFFFF;border:1px solid #DBE3DF;border-radius:12px"><tr><td style="padding:13px 15px">' +
      '<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1B3049">' + bloomEmailEscape(user.company) + '</p>' +
      '<p style="margin:0 0 5px;font-size:14px;color:#536475">' + bloomEmailEscape(user.name) +
      ' · ' + bloomEmailEscape(user.email) + '</p>' +
      '<p style="margin:0 0 5px;font-size:13px;color:#536475">Signup ' + bloomEmailEscape(user.signupDate) +
      ' · Ends ' + bloomEmailEscape(user.trialEndDate) + '</p>' +
      '<p style="margin:0;font-size:13px;color:#536475"><strong>' + bloomEmailEscape(user.status) +
      '</strong> · ' + bloomEmailEscape(user.daysRemaining) + ' days remaining</p>' +
      '</td></tr></table>'
    ).join('');

    const htmlContent = renderBloomSystemEmail({
      eyebrow: "TRIAL ACTIVITY REPORT",
      title: "BloomSuite trial users",
      preheader: userDetails.length + " trials in this report",
      icon: "calendar",
      bodyHtml: bloomEmailCard("At a glance", [
        { label: "Total trial users", value: String(userDetails.length), icon: "leaf" },
        { label: "Active trials", value: String(activeTrials), icon: "check" },
        { label: "Expired trials", value: String(expiredTrials), icon: "calendar" },
        { label: "Generated", value: new Date().toLocaleString(), icon: "calendar" },
      ], "calendar") +
      '<h2 style="margin:24px 0 12px;font-size:18px;color:#1B3049">Trial details</h2>' +
      (userCards || '<p>No trial users found.</p>') +
      '<p style="font-size:12px;color:#536475">Internal operational report. Share only with authorized team members.</p>',
      footer: "BloomSuite — internal trial activity report.",
    });

    // Send email to admins
    const adminEmails = ['jon@brandsinblooms.com', 'jeff@brandsinblooms.com'];
    
    for (const adminEmail of adminEmails) {
      console.log(`[TRIAL-REPORT] Sending report to ${adminEmail}`);
      
      const emailResponse = await resend.emails.send({
        from: "BloomSuite Reports <noreply@brandsinblooms.com>",
        to: [adminEmail],
        subject: `BloomSuite Trial Users Report - ${userDetails.length} Total Users`,
        html: htmlContent,
      });

      if (emailResponse.error) {
        console.error(`[TRIAL-REPORT] Failed to send to ${adminEmail}:`, emailResponse.error);
      } else {
        console.log(`[TRIAL-REPORT] Successfully sent to ${adminEmail}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Report sent to admin emails`,
      totalUsers: userDetails.length,
      activeTrials: userDetails.filter(u => u.status === 'Active').length,
      expiredTrials: userDetails.filter(u => u.status === 'Expired').length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("[TRIAL-REPORT] Error:", error);
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
