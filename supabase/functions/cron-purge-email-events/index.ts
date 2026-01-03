import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Nightly Cron: Purge Old Email Events
 * 
 * Runs to delete email_tracking_events older than 18 months
 * for data retention compliance.
 * 
 * Authentication: Requires X-Task-Signature HMAC header
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-task-signature",
};

const RETENTION_MONTHS = 18;

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
  console.log(`🗑️ Starting email events purge at ${new Date().toISOString()}`);

  try {
    // Verify HMAC signature if CRON_SIGNING_SECRET is set
    const cronSecret = Deno.env.get('CRON_SIGNING_SECRET');
    
    if (cronSecret) {
      const signature = req.headers.get('x-task-signature');
      
      // Create timestamp-based payload for verification
      const timestamp = new Date().toISOString().slice(0, 13); // Hour precision
      const payload = `cron-purge-email-events:${timestamp}`;
      
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
        const prevPayload = `cron-purge-email-events:${prevHour}`;
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

    // Calculate cutoff date (18 months ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);
    const cutoffIso = cutoffDate.toISOString();

    console.log(`📅 Purging events older than ${cutoffIso} (${RETENTION_MONTHS} months)`);

    // Count events to be deleted first
    const { count: toDeleteCount } = await supabase
      .from('email_tracking_events')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffIso);

    console.log(`📊 Found ${toDeleteCount || 0} events to purge`);

    // Delete in batches to avoid timeouts
    let totalDeleted = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore && totalDeleted < (toDeleteCount || 0)) {
      // Get batch of IDs to delete
      const { data: batch, error: selectError } = await supabase
        .from('email_tracking_events')
        .select('id')
        .lt('created_at', cutoffIso)
        .limit(batchSize);

      if (selectError) {
        console.error('Error selecting batch:', selectError);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      const ids = batch.map(e => e.id);
      
      const { error: deleteError } = await supabase
        .from('email_tracking_events')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('Error deleting batch:', deleteError);
        break;
      }

      totalDeleted += batch.length;
      console.log(`🗑️ Deleted batch: ${batch.length} events (total: ${totalDeleted})`);

      // Safety check to avoid infinite loops
      if (batch.length < batchSize) {
        hasMore = false;
      }
    }

    const duration = Date.now() - startTime;

    // Log purge run for health page
    await supabase
      .from('analytics_alerts')
      .insert({
        tenant_id: null,
        metric: 'purge_completed',
        value: totalDeleted,
        threshold: 0,
        severity: 'warning', // Info level, using warning as closest
        resolved_at: new Date().toISOString(), // Mark as resolved immediately
      }).catch(err => console.error('Failed to log purge alert:', err));

    const summary = {
      runAt: new Date().toISOString(),
      durationMs: duration,
      cutoffDate: cutoffIso,
      retentionMonths: RETENTION_MONTHS,
      eventsFound: toDeleteCount || 0,
      eventsDeleted: totalDeleted,
    };

    console.log(`✅ Purge complete:`, JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        summary,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Purge error:', error);
    
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
