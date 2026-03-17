/**
 * square-webhook-health
 * 
 * Background health check for Square webhook subscriptions.
 * Runs periodically to ensure webhooks are working and retries failed subscriptions.
 * 
 * Called by:
 * - Scheduled cron job (recommended: hourly)
 * - Admin manual trigger
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ensureSquareWebhooks } from '../_shared/webhooks/ensureSquareWebhooks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[WEBHOOK-HEALTH] Starting health check');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find connections that need webhook retry
    const now = new Date().toISOString();
    
    const { data: connections, error } = await supabase
      .from('square_connections')
      .select('id, tenant_id, merchant_id, webhooks_subscribed, webhook_last_error, webhook_retry_count, webhook_next_retry_at')
      .eq('status', 'connected')
      .neq('encrypted_access_token', 'pending')
      .or(`webhooks_subscribed.is.false,webhooks_subscribed.is.null`);

    if (error) {
      console.error('[WEBHOOK-HEALTH] Failed to fetch connections:', error.message);
      throw error;
    }

    console.log('[WEBHOOK-HEALTH] Found', connections?.length || 0, 'connections needing attention');

    const results: any[] = [];
    const MAX_RETRIES = 10;

    for (const conn of connections || []) {
      // Skip if not due for retry yet
      if (conn.webhook_next_retry_at && new Date(conn.webhook_next_retry_at) > new Date()) {
        console.log(`[WEBHOOK-HEALTH] Skipping ${conn.id} - retry not due until ${conn.webhook_next_retry_at}`);
        results.push({
          connection_id: conn.id,
          merchant_id: conn.merchant_id,
          action: 'skipped',
          reason: 'retry_not_due',
          next_retry_at: conn.webhook_next_retry_at,
        });
        continue;
      }

      // Skip if max retries exceeded
      if ((conn.webhook_retry_count || 0) >= MAX_RETRIES) {
        console.log(`[WEBHOOK-HEALTH] Skipping ${conn.id} - max retries (${MAX_RETRIES}) exceeded`);
        results.push({
          connection_id: conn.id,
          merchant_id: conn.merchant_id,
          action: 'skipped',
          reason: 'max_retries_exceeded',
          retry_count: conn.webhook_retry_count,
        });
        continue;
      }

      console.log(`[WEBHOOK-HEALTH] Retrying webhook setup for ${conn.id} (attempt ${(conn.webhook_retry_count || 0) + 1})`);

      try {
        const result = await ensureSquareWebhooks(supabase, conn.id);
        results.push({
          connection_id: conn.id,
          merchant_id: conn.merchant_id,
          action: result.action,
          verified: result.verified,
          subscription_id: result.subscription_id,
          error: result.error,
        });
        
        if (result.verified) {
          console.log(`[WEBHOOK-HEALTH] ✓ ${conn.id} webhook restored`);
        } else {
          console.log(`[WEBHOOK-HEALTH] ⚠ ${conn.id} webhook still failing: ${result.error}`);
        }
      } catch (e: any) {
        console.error(`[WEBHOOK-HEALTH] Error processing ${conn.id}:`, e.message);
        results.push({
          connection_id: conn.id,
          merchant_id: conn.merchant_id,
          action: 'error',
          error: e.message,
        });
      }
    }

    // Also verify healthy connections periodically (check last_webhook_received_at)
    const staleThresholdHours = 24;
    const staleThreshold = new Date(Date.now() - staleThresholdHours * 60 * 60 * 1000).toISOString();

    const { data: staleConnections } = await supabase
      .from('square_connections')
      .select('id, merchant_id, webhooks_subscribed, last_webhook_received_at')
      .eq('status', 'connected')
      .eq('webhooks_subscribed', true)
      .or(`last_webhook_received_at.is.null,last_webhook_received_at.lt.${staleThreshold}`)
      .limit(5);

    if (staleConnections?.length) {
      console.log(`[WEBHOOK-HEALTH] Found ${staleConnections.length} stale connections to re-verify`);
      
      for (const conn of staleConnections) {
        try {
          const result = await ensureSquareWebhooks(supabase, conn.id);
          results.push({
            connection_id: conn.id,
            merchant_id: conn.merchant_id,
            action: 're-verified',
            verified: result.verified,
            note: 'Stale connection check',
          });
        } catch (e: any) {
          console.error(`[WEBHOOK-HEALTH] Stale check error for ${conn.id}:`, e.message);
        }
      }
    }

    const summary = {
      total_checked: results.length,
      verified: results.filter(r => r.verified).length,
      failed: results.filter(r => r.action === 'failed' || r.action === 'error').length,
      skipped: results.filter(r => r.action === 'skipped').length,
    };

    console.log('[WEBHOOK-HEALTH] Complete:', JSON.stringify(summary));

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[WEBHOOK-HEALTH] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
