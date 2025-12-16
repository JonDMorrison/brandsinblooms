import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[USAGE-NOTIFICATIONS] ${step}${detailsStr}`);
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// Email templates
const get80PercentEmailHtml = (resource: string, percent: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; color: #6b7280; }
    .progress-bar { background: #e5e7eb; border-radius: 9999px; height: 8px; margin: 20px 0; }
    .progress-fill { background: #f59e0b; height: 100%; border-radius: 9999px; width: ${Math.min(percent, 100)}%; }
    .cta-button { display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">⚠️ Usage Alert</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">You're approaching your ${resource} limit</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>You've used <strong>${Math.round(percent)}%</strong> of your monthly ${resource} quota. Here's your current usage:</p>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <p>To avoid any interruption to your campaigns, consider upgrading your plan for higher limits and additional features.</p>
      <center>
        <a href="https://bloomsuite.app/pricing" class="cta-button">Upgrade Your Plan</a>
      </center>
    </div>
    <div class="footer">
      <p>BloomSuite - Marketing Made Simple for Garden Centers</p>
      <p>Questions? Reply to this email or visit our help center.</p>
    </div>
  </div>
</body>
</html>
`;

const get100PercentEmailHtml = (resource: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; color: #6b7280; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🚨 Limit Reached</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Your ${resource} quota has been reached</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <div class="alert-box">
        <strong>Important:</strong> You've reached 100% of your monthly ${resource} quota. Additional ${resource === 'email' ? 'emails' : 'messages'} may be paused or charged at overage rates.
      </div>
      <p>To continue sending without interruption, please upgrade your plan now.</p>
      <center>
        <a href="https://bloomsuite.app/pricing" class="cta-button">Upgrade Now</a>
      </center>
    </div>
    <div class="footer">
      <p>BloomSuite - Marketing Made Simple for Garden Centers</p>
      <p>Questions? Reply to this email or visit our help center.</p>
    </div>
  </div>
</body>
</html>
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep('Starting usage notification check');

    // Get tier limits
    const { data: tierLimits } = await supabase
      .from('tier_limits')
      .select('*');

    const limitsMap = new Map(tierLimits?.map(t => [t.tier, t]) || []);

    // Get all active subscriptions with usage data
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        tier,
        email_usage,
        sms_usage,
        email_quota,
        sms_quota,
        usage_alert_80_sent_at,
        usage_alert_100_sent_at
      `)
      .not('plan', 'eq', 'expired');

    if (subError) {
      logStep('Error fetching subscriptions', { error: subError });
      throw subError;
    }

    logStep(`Found ${subscriptions?.length || 0} active subscriptions to check`);

    const notifications: Array<{
      userId: string;
      email: string;
      type: '80_percent' | '100_percent';
      resource: 'email' | 'sms' | 'both';
      percent: number;
    }> = [];

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const sub of subscriptions || []) {
      // Get limits from tier or legacy columns
      const tierLimit = limitsMap.get(sub.tier);
      const emailLimit = tierLimit?.email_limit ?? sub.email_quota ?? 10000;
      const smsLimit = tierLimit?.sms_limit ?? sub.sms_quota ?? 1000;

      // Skip unlimited plans
      if (emailLimit === -1 && smsLimit === -1) continue;

      const emailUsage = sub.email_usage || 0;
      const smsUsage = sub.sms_usage || 0;

      const emailPercent = emailLimit > 0 ? (emailUsage / emailLimit) * 100 : 0;
      const smsPercent = smsLimit > 0 ? (smsUsage / smsLimit) * 100 : 0;

      // Check for 100% threshold (not already notified)
      const at100 = (emailLimit > 0 && emailPercent >= 100) || (smsLimit > 0 && smsPercent >= 100);
      const at80 = (emailLimit > 0 && emailPercent >= 80) || (smsLimit > 0 && smsPercent >= 80);

      // Get user email first
      const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
      const userEmail = userData?.user?.email;

      if (!userEmail) {
        logStep('No email found for user', { userId: sub.user_id });
        continue;
      }

      if (at100 && !sub.usage_alert_100_sent_at) {
        const resource = emailPercent >= 100 && smsPercent >= 100 
          ? 'both' 
          : emailPercent >= 100 ? 'email' : 'sms';

        logStep('Sending 100% alert email', { email: userEmail, resource });

        try {
          // Send actual email via Resend
          const emailResponse = await resend.emails.send({
            from: 'BloomSuite <noreply@bloomsuite.app>',
            to: [userEmail],
            subject: `🚨 ${resource === 'both' ? 'Email & SMS' : resource.toUpperCase()} Limit Reached - Action Required`,
            html: get100PercentEmailHtml(resource === 'both' ? 'email and SMS' : resource),
          });

          logStep('100% alert email sent', { emailResponse });
          emailsSent++;

          // Update the sent timestamp
          await supabase
            .from('subscriptions')
            .update({ 
              usage_alert_100_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', sub.id);

          notifications.push({
            userId: sub.user_id,
            email: userEmail,
            type: '100_percent',
            resource,
            percent: Math.max(emailPercent, smsPercent),
          });
        } catch (emailError) {
          logStep('Failed to send 100% alert email', { error: emailError.message });
          emailsFailed++;
        }
      } 
      else if (at80 && !at100 && !sub.usage_alert_80_sent_at) {
        const resource = emailPercent >= 80 && smsPercent >= 80 
          ? 'both' 
          : emailPercent >= 80 ? 'email' : 'sms';
        const percent = Math.max(emailPercent, smsPercent);

        logStep('Sending 80% alert email', { email: userEmail, resource, percent });

        try {
          // Send actual email via Resend
          const emailResponse = await resend.emails.send({
            from: 'BloomSuite <noreply@bloomsuite.app>',
            to: [userEmail],
            subject: `⚠️ ${resource === 'both' ? 'Email & SMS' : resource.toUpperCase()} Usage at ${Math.round(percent)}%`,
            html: get80PercentEmailHtml(resource === 'both' ? 'email and SMS' : resource, percent),
          });

          logStep('80% alert email sent', { emailResponse });
          emailsSent++;

          // Update the sent timestamp
          await supabase
            .from('subscriptions')
            .update({ 
              usage_alert_80_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', sub.id);

          notifications.push({
            userId: sub.user_id,
            email: userEmail,
            type: '80_percent',
            resource,
            percent,
          });
        } catch (emailError) {
          logStep('Failed to send 80% alert email', { error: emailError.message });
          emailsFailed++;
        }
      }
    }

    logStep(`Completed: ${emailsSent} emails sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        emailsFailed,
        notificationsSent: notifications.length,
        notifications 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    logStep('Error in usage notifications', { error: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
