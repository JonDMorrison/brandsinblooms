import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Nightly Cron: Recompute Analytics
 * 
 * Runs at 03:00 UTC daily to:
 * 1. Recompute metrics for campaigns sent in the last 14 days
 * 2. Log run summary
 * 3. Alert on failures
 * 
 * Authentication: Requires X-Task-Signature HMAC header
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-task-signature",
};

// HMAC signature verification
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    const data = encoder.encode(payload);
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`🌙 Starting nightly analytics recompute at ${new Date().toISOString()}`);

  try {
    // Verify HMAC signature if CRON_SIGNING_SECRET is set
    const cronSecret = Deno.env.get('CRON_SIGNING_SECRET');
    
    if (cronSecret) {
      const signature = req.headers.get('x-task-signature');
      const body = await req.text();
      
      // Create timestamp-based payload for verification
      const timestamp = new Date().toISOString().slice(0, 13); // Hour precision
      const payload = `cron-recompute-analytics:${timestamp}`;
      
      if (!signature) {
        console.error('❌ Missing X-Task-Signature header');
        return new Response(
          JSON.stringify({ error: 'Missing signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const isValid = await verifySignature(payload, signature, cronSecret);
      
      if (!isValid) {
        // Try previous hour for clock skew tolerance
        const prevHour = new Date(Date.now() - 3600000).toISOString().slice(0, 13);
        const prevPayload = `cron-recompute-analytics:${prevHour}`;
        const isPrevValid = await verifySignature(prevPayload, signature, cronSecret);
        
        if (!isPrevValid) {
          console.error('❌ Invalid signature');
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      console.log('✅ Signature verified');
    } else {
      console.log('⚠️ CRON_SIGNING_SECRET not set, skipping signature verification');
    }

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

    // Store alert for failures in analytics_alerts table
    if (errorCount > 0) {
      await supabase
        .from('analytics_alerts')
        .insert({
          tenant_id: null, // System-wide alert
          metric: 'cron_recompute_errors',
          value: errorCount,
          threshold: 0,
          severity: errorCount > 5 ? 'critical' : 'warning',
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
