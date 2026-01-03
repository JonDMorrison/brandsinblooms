import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Nightly Cron: Recompute Analytics
 * 
 * Runs at 03:00 UTC daily to:
 * 1. Recompute metrics for campaigns sent in the last 14 days
 * 2. Log run summary
 * 3. Alert on failures
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`🌙 Starting nightly analytics recompute at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get campaigns sent in the last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: campaigns, error: fetchError } = await supabase
      .from('crm_campaigns')
      .select('id, name, tenant_id, sent_at, rollup_refreshed_at')
      .eq('status', 'sent')
      .gte('sent_at', fourteenDaysAgo.toISOString())
      .order('sent_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch campaigns: ${fetchError.message}`);
    }

    const totalCampaigns = campaigns?.length || 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: { campaignId: string; error: string }[] = [];

    console.log(`📊 Found ${totalCampaigns} campaigns to recompute`);

    // Process each campaign
    for (const campaign of campaigns || []) {
      try {
        const { error: recomputeError } = await supabase.rpc('recompute_campaign_metrics', {
          p_campaign_id: campaign.id
        });

        if (recomputeError) {
          throw recomputeError;
        }

        successCount++;
        console.log(`✅ Recomputed: ${campaign.name} (${campaign.id})`);
      } catch (err: any) {
        errorCount++;
        errors.push({ campaignId: campaign.id, error: err.message });
        console.error(`❌ Failed: ${campaign.name} (${campaign.id}): ${err.message}`);
      }
    }

    const duration = Date.now() - startTime;

    // Build summary
    const summary = {
      runAt: new Date().toISOString(),
      durationMs: duration,
      totalCampaigns,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`📋 Nightly recompute summary:`, JSON.stringify(summary, null, 2));

    // Log summary to database for tracking
    if (errorCount > 0) {
      // Store an alert for failures
      await supabase
        .from('email_tracking_events')
        .insert({
          campaign_id: null,
          tenant_id: campaigns?.[0]?.tenant_id || null,
          customer_email: 'system',
          event_type: 'alert',
          event_data: { 
            alert_type: 'cron_errors',
            message: `Nightly recompute failed for ${errorCount} campaigns`,
            summary,
          },
          provider_message_id: `cron_alert_${Date.now()}`,
          event_ts_provider: new Date().toISOString(),
          ingested_at: new Date().toISOString(),
        }).catch(err => console.error('Failed to log cron alert:', err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Nightly cron error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        runAt: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
