import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPER_ADMIN_EMAILS = ['jon@getclear.ca', 'jeff@brandsinblooms.com'];

// Thresholds for alerts
const THRESHOLDS = {
  dailyEmails: 10000,          // Alert if platform sends > 10k emails/day
  dailySms: 1000,              // Alert if platform sends > 1k SMS/day
  syncFailureRate: 0.1,        // Alert if > 10% sync jobs fail
  tenantBudgetPercent: 90,     // Alert if any tenant hits 90% of budget
  anomalyMultiplier: 5,        // Alert if tenant uses 5x average
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-COST-ALERT] ${step}${detailsStr}`);
};

const generateAlertEmailHtml = (alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical'; details?: any }>) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f4f4f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .alert { border-radius: 8px; padding: 16px; margin: 16px 0; }
    .alert-critical { background: #fef2f2; border-left: 4px solid #dc2626; }
    .alert-warning { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .alert-title { font-weight: 600; margin-bottom: 4px; }
    .alert-critical .alert-title { color: #dc2626; }
    .alert-warning .alert-title { color: #d97706; }
    .details { font-size: 12px; color: #6b7280; margin-top: 8px; font-family: monospace; background: #f9fafb; padding: 8px; border-radius: 4px; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
    .cta-button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🚨 Platform Cost Alert</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${alerts.length} alert${alerts.length > 1 ? 's' : ''} detected</p>
    </div>
    <div class="content">
      <p>The following cost/usage alerts have been triggered:</p>
      ${alerts.map(alert => `
        <div class="alert alert-${alert.severity}">
          <div class="alert-title">${alert.type}</div>
          <div>${alert.message}</div>
          ${alert.details ? `<div class="details">${JSON.stringify(alert.details, null, 2)}</div>` : ''}
        </div>
      `).join('')}
      <center>
        <a href="https://bloomsuite.app/admin/costs" class="cta-button">View Cost Dashboard</a>
      </center>
    </div>
    <div class="footer">
      <p>BloomSuite Platform Alert System</p>
      <p>This is an automated message for super administrators.</p>
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

    logStep('Starting admin cost alert check');

    const alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical'; details?: any }> = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Check daily email volume
    const { count: emailCount } = await supabase
      .from('crm_campaigns')
      .select('*', { count: 'exact', head: true })
      .not('sent_at', 'is', null)
      .gte('sent_at', today);

    // Get total sent from campaigns today (sum of total_sent)
    const { data: emailCampaigns } = await supabase
      .from('crm_campaigns')
      .select('total_sent')
      .not('sent_at', 'is', null)
      .gte('sent_at', today);
    
    const totalEmailsToday = emailCampaigns?.reduce((sum, c) => sum + (c.total_sent || 0), 0) || 0;
    
    if (totalEmailsToday > THRESHOLDS.dailyEmails) {
      alerts.push({
        type: 'High Email Volume',
        message: `Platform sent ${totalEmailsToday.toLocaleString()} emails today (threshold: ${THRESHOLDS.dailyEmails.toLocaleString()})`,
        severity: totalEmailsToday > THRESHOLDS.dailyEmails * 2 ? 'critical' : 'warning',
        details: { totalEmailsToday, threshold: THRESHOLDS.dailyEmails }
      });
    }

    // 2. Check daily SMS volume
    const { data: smsCampaigns } = await supabase
      .from('crm_sms_campaigns')
      .select('total_enqueued')
      .not('sent_at', 'is', null)
      .gte('sent_at', today);
    
    const totalSmsToday = smsCampaigns?.reduce((sum, c) => sum + (c.total_enqueued || 0), 0) || 0;
    
    if (totalSmsToday > THRESHOLDS.dailySms) {
      alerts.push({
        type: 'High SMS Volume',
        message: `Platform sent ${totalSmsToday.toLocaleString()} SMS today (threshold: ${THRESHOLDS.dailySms.toLocaleString()})`,
        severity: totalSmsToday > THRESHOLDS.dailySms * 2 ? 'critical' : 'warning',
        details: { totalSmsToday, threshold: THRESHOLDS.dailySms }
      });
    }

    // 3. Check sync job failure rate (last 24 hours)
    const { data: recentJobs } = await supabase
      .from('pos_sync_jobs_v2')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (recentJobs && recentJobs.length > 10) {
      const failedJobs = recentJobs.filter(j => j.status === 'failed').length;
      const failureRate = failedJobs / recentJobs.length;
      
      if (failureRate > THRESHOLDS.syncFailureRate) {
        alerts.push({
          type: 'High Sync Failure Rate',
          message: `${(failureRate * 100).toFixed(1)}% of sync jobs failed in last 24h (${failedJobs}/${recentJobs.length})`,
          severity: failureRate > 0.25 ? 'critical' : 'warning',
          details: { failedJobs, totalJobs: recentJobs.length, failureRate: `${(failureRate * 100).toFixed(1)}%` }
        });
      }
    }

    // 4. Check for tenants near budget limit
    const { data: budgets } = await supabase
      .from('org_usage_budgets')
      .select('tenant_id, emails_limit, sms_limit');
    
    const { data: counters } = await supabase
      .from('org_usage_counters')
      .select('tenant_id, emails_sent, sms_sent, period_start')
      .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    if (budgets && counters) {
      const budgetMap = new Map(budgets.map(b => [b.tenant_id, b]));
      
      for (const counter of counters) {
        const budget = budgetMap.get(counter.tenant_id);
        if (!budget) continue;
        
        const emailPercent = budget.emails_limit > 0 ? (counter.emails_sent / budget.emails_limit) * 100 : 0;
        const smsPercent = budget.sms_limit > 0 ? (counter.sms_sent / budget.sms_limit) * 100 : 0;
        
        if (emailPercent >= THRESHOLDS.tenantBudgetPercent) {
          // Get tenant name
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', counter.tenant_id)
            .single();
          
          alerts.push({
            type: 'Tenant Budget Alert',
            message: `${tenant?.name || counter.tenant_id} is at ${emailPercent.toFixed(0)}% of email budget`,
            severity: emailPercent >= 100 ? 'critical' : 'warning',
            details: { tenantId: counter.tenant_id, emailsSent: counter.emails_sent, emailsLimit: budget.emails_limit }
          });
        }
        
        if (smsPercent >= THRESHOLDS.tenantBudgetPercent) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', counter.tenant_id)
            .single();
          
          alerts.push({
            type: 'Tenant Budget Alert',
            message: `${tenant?.name || counter.tenant_id} is at ${smsPercent.toFixed(0)}% of SMS budget`,
            severity: smsPercent >= 100 ? 'critical' : 'warning',
            details: { tenantId: counter.tenant_id, smsSent: counter.sms_sent, smsLimit: budget.sms_limit }
          });
        }
      }
    }

    // 5. Check for circuit breaker activations (consecutive failures)
    const { data: circuitBreakers } = await supabase
      .from('pos_sync_jobs_v2')
      .select('tenant_id, provider, status, created_at')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('created_at', { ascending: false });

    // Group failures by tenant+provider
    const failureGroups = new Map<string, number>();
    circuitBreakers?.forEach(job => {
      const key = `${job.tenant_id}:${job.provider}`;
      failureGroups.set(key, (failureGroups.get(key) || 0) + 1);
    });

    for (const [key, count] of failureGroups) {
      if (count >= 3) {
        const [tenantId, provider] = key.split(':');
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', tenantId)
          .single();
        
        alerts.push({
          type: 'Circuit Breaker Activated',
          message: `${tenant?.name || tenantId} has ${count} consecutive ${provider} sync failures`,
          severity: 'critical',
          details: { tenantId, provider, consecutiveFailures: count }
        });
      }
    }

    logStep(`Found ${alerts.length} alerts`);

    // Send email if there are alerts
    if (alerts.length > 0) {
      const criticalCount = alerts.filter(a => a.severity === 'critical').length;
      const subject = criticalCount > 0 
        ? `🚨 ${criticalCount} CRITICAL Platform Alert${criticalCount > 1 ? 's' : ''}`
        : `⚠️ ${alerts.length} Platform Warning${alerts.length > 1 ? 's' : ''}`;

      for (const adminEmail of SUPER_ADMIN_EMAILS) {
        try {
          await resend.emails.send({
            from: 'BloomSuite Alerts <alerts@bloomsuite.app>',
            to: [adminEmail],
            subject,
            html: generateAlertEmailHtml(alerts),
          });
          logStep('Alert email sent', { email: adminEmail, alertCount: alerts.length });
        } catch (emailError: any) {
          logStep('Failed to send alert email', { email: adminEmail, error: emailError.message });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsFound: alerts.length,
        alerts 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    logStep('Error in admin cost alert', { error: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
