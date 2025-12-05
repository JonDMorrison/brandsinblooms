import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[USAGE-NOTIFICATIONS] ${step}${detailsStr}`);
};

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
      type: '80_percent' | '100_percent';
      resource: 'email' | 'sms' | 'both';
      percent: number;
    }> = [];

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

      if (at100 && !sub.usage_alert_100_sent_at) {
        const resource = emailPercent >= 100 && smsPercent >= 100 
          ? 'both' 
          : emailPercent >= 100 ? 'email' : 'sms';

        notifications.push({
          userId: sub.user_id,
          type: '100_percent',
          resource,
          percent: Math.max(emailPercent, smsPercent),
        });

        // Update the sent timestamp
        await supabase
          .from('subscriptions')
          .update({ 
            usage_alert_100_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id);

        logStep('Marked 100% alert sent', { userId: sub.user_id, resource });
      } 
      else if (at80 && !at100 && !sub.usage_alert_80_sent_at) {
        const resource = emailPercent >= 80 && smsPercent >= 80 
          ? 'both' 
          : emailPercent >= 80 ? 'email' : 'sms';

        notifications.push({
          userId: sub.user_id,
          type: '80_percent',
          resource,
          percent: Math.max(emailPercent, smsPercent),
        });

        // Update the sent timestamp
        await supabase
          .from('subscriptions')
          .update({ 
            usage_alert_80_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id);

        logStep('Marked 80% alert sent', { userId: sub.user_id, resource });
      }
    }

    logStep(`Generated ${notifications.length} notifications`);

    // TODO: Send actual email/in-app notifications here
    // For now, just log them
    for (const notification of notifications) {
      logStep('Would send notification', notification);
      
      // Get user email for sending
      const { data: userData } = await supabase.auth.admin.getUserById(notification.userId);
      if (userData?.user?.email) {
        logStep('User email for notification', { 
          email: userData.user.email, 
          type: notification.type,
          resource: notification.resource 
        });
        
        // TODO: Call Resend API to send email notification
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
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
