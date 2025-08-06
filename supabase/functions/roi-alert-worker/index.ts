import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlertRule {
  id: string;
  tenant_id: string;
  rule_type: 'high_roi' | 'low_roi' | 'high_redemption' | 'low_ctr';
  threshold_value: number;
  notification_channels: string[]; // ['email', 'slack']
  is_active: boolean;
}

async function sendSlackAlert(webhookUrl: string, message: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        username: 'ROI Analytics',
        icon_emoji: ':chart_with_upwards_trend:'
      })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
    return false;
  }
}

async function sendEmailAlert(supabase: any, tenantId: string, subject: string, message: string) {
  try {
    // Get tenant owner email
    const { data: users } = await supabase
      .from('users')
      .select('email')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .limit(1);

    if (!users?.length) return false;

    // Use Resend API to send email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return false;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'alerts@yourdomain.com',
        to: users[0].email,
        subject,
        html: `
          <h2>${subject}</h2>
          <p>${message}</p>
          <p>View your dashboard for more details.</p>
        `
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send email alert:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('ROI Alert Worker starting...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active alert rules
    const { data: alertRules, error: rulesError } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) {
      console.error('Failed to fetch alert rules:', rulesError);
      return new Response('Failed to fetch alert rules', { status: 500 });
    }

    if (!alertRules || alertRules.length === 0) {
      console.log('No active alert rules found');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const alertsTriggered = [];
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');

    // Check each tenant's campaigns against their alert rules
    for (const rule of alertRules) {
      try {
        // Get recent campaigns for this tenant
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: campaigns } = await supabase
          .from('crm_sms_campaigns')
          .select('*')
          .eq('tenant_id', rule.tenant_id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        if (!campaigns?.length) continue;

        // Calculate metrics for each campaign
        for (const campaign of campaigns) {
          const { data: events } = await supabase
            .from('analytics_events')
            .select('*')
            .eq('campaign_id', campaign.id)
            .gte('created_at', thirtyDaysAgo.toISOString());

          const { data: coupons } = await supabase
            .from('coupons')
            .select('*')
            .eq('campaign_id', campaign.id);

          if (!events?.length) continue;

          // Calculate key metrics
          const totalSent = events.filter(e => e.event_type === 'sms_sent').length;
          const totalClicks = events.filter(e => e.event_type === 'link_click').length;
          const totalRedemptions = events.filter(e => e.event_type === 'coupon_redeem').length;
          const totalRevenue = events
            .filter(e => e.event_type === 'coupon_redeem')
            .reduce((sum, e) => sum + ((e.payload as any)?.net_sales || 0), 0);

          const revenuePerSend = totalSent > 0 ? totalRevenue / totalSent : 0;
          const ctr = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;
          const redemptionRate = coupons?.length > 0 ? (totalRedemptions / coupons.length) * 100 : 0;

          // Check alert conditions
          let shouldAlert = false;
          let alertMessage = '';

          switch (rule.rule_type) {
            case 'high_roi':
              if (revenuePerSend > rule.threshold_value) {
                shouldAlert = true;
                alertMessage = `🎉 High ROI Alert: Campaign "${campaign.name}" is generating $${revenuePerSend.toFixed(2)} per send (threshold: $${rule.threshold_value})`;
              }
              break;

            case 'low_roi':
              if (revenuePerSend < rule.threshold_value && totalSent > 50) {
                shouldAlert = true;
                alertMessage = `⚠️ Low ROI Alert: Campaign "${campaign.name}" is only generating $${revenuePerSend.toFixed(2)} per send (threshold: $${rule.threshold_value})`;
              }
              break;

            case 'low_ctr':
              if (ctr < rule.threshold_value && totalSent > 50) {
                shouldAlert = true;
                alertMessage = `📉 Low CTR Alert: Campaign "${campaign.name}" has a ${ctr.toFixed(1)}% click rate (threshold: ${rule.threshold_value}%)`;
              }
              break;

            case 'high_redemption':
              if (redemptionRate > rule.threshold_value) {
                shouldAlert = true;
                alertMessage = `🎯 High Redemption Alert: Campaign "${campaign.name}" has a ${redemptionRate.toFixed(1)}% redemption rate!`;
              }
              break;
          }

          if (shouldAlert) {
            // Check if we've already sent this alert recently (prevent spam)
            const { data: recentAlert } = await supabase
              .from('alert_history')
              .select('*')
              .eq('campaign_id', campaign.id)
              .eq('rule_type', rule.rule_type)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .single();

            if (recentAlert) {
              console.log(`Skipping duplicate alert for campaign ${campaign.id}`);
              continue;
            }

            // Send notifications
            const notifications = [];

            if (rule.notification_channels.includes('slack') && slackWebhookUrl) {
              const slackSent = await sendSlackAlert(slackWebhookUrl, alertMessage);
              notifications.push({ channel: 'slack', success: slackSent });
            }

            if (rule.notification_channels.includes('email')) {
              const emailSent = await sendEmailAlert(
                supabase, 
                rule.tenant_id, 
                `ROI Alert: ${campaign.name}`,
                alertMessage
              );
              notifications.push({ channel: 'email', success: emailSent });
            }

            // Log the alert
            await supabase
              .from('alert_history')
              .insert({
                tenant_id: rule.tenant_id,
                campaign_id: campaign.id,
                rule_type: rule.rule_type,
                threshold_value: rule.threshold_value,
                actual_value: rule.rule_type === 'high_roi' || rule.rule_type === 'low_roi' 
                  ? revenuePerSend 
                  : rule.rule_type === 'low_ctr' 
                    ? ctr 
                    : redemptionRate,
                message: alertMessage,
                notifications_sent: notifications
              });

            alertsTriggered.push({
              campaign: campaign.name,
              rule_type: rule.rule_type,
              message: alertMessage
            });

            console.log(`Alert triggered: ${alertMessage}`);
          }
        }
      } catch (error) {
        console.error(`Error processing rule ${rule.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        processed: alertRules.length,
        alerts_triggered: alertsTriggered.length,
        alerts: alertsTriggered
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('ROI Alert Worker error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});