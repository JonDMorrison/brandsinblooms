import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2";

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

    // Generate HTML table
    const userRows = userDetails.map(user => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: left;">${user.email}</td>
        <td style="padding: 12px; text-align: left;">${user.name}</td>
        <td style="padding: 12px; text-align: left;">${user.company}</td>
        <td style="padding: 12px; text-align: center;">${user.signupDate}</td>
        <td style="padding: 12px; text-align: center;">${user.trialEndDate}</td>
        <td style="padding: 12px; text-align: center;">${user.daysRemaining}</td>
        <td style="padding: 12px; text-align: center;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; ${
            user.status === 'Active' 
              ? 'background: #d1fae5; color: #065f46;' 
              : 'background: #fee2e2; color: #991b1b;'
          }">
            ${user.status}
          </span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22C55E; margin-bottom: 10px;">BloomSuite Trial Users Report</h2>
        <p style="color: #666; margin-bottom: 20px;">Generated on ${new Date().toLocaleString()}</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Summary</h3>
          <p style="margin: 5px 0;"><strong>Total Trial Users:</strong> ${userDetails.length}</p>
          <p style="margin: 5px 0;"><strong>Active Trials:</strong> ${userDetails.filter(u => u.status === 'Active').length}</p>
          <p style="margin: 5px 0;"><strong>Expired Trials:</strong> ${userDetails.filter(u => u.status === 'Expired').length}</p>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Email</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Name</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Company</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Signup Date</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Trial End</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Days Left</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${userRows}
            </tbody>
          </table>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This report was generated automatically by the BloomSuite system.
        </p>
      </div>
    `;

    // Send email to admins
    const adminEmails = ['jon@brandsinblooms.com', 'jeff@brandsinblooms.com'];
    
    for (const adminEmail of adminEmails) {
      console.log(`[TRIAL-REPORT] Sending report to ${adminEmail}`);
      
      const emailResponse = await resend.emails.send({
        from: "BloomSuite Reports <noreply@brandsinblooms.com>",
        to: [adminEmail],
        subject: `📊 BloomSuite Trial Users Report - ${userDetails.length} Total Users`,
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
