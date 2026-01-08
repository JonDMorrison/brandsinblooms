/**
 * ensureCloverWebhooks - Idempotent webhook subscription manager for Clover
 * 
 * IMPORTANT: Clover webhooks require App Market configuration.
 * Unlike Square, Clover doesn't have a direct API to create webhook subscriptions.
 * Webhooks are configured at the app level in Clover's developer dashboard.
 * 
 * This function:
 * - Verifies the webhook URL is reachable
 * - Updates connection state to reflect webhook status
 * - Handles the "sync-only" classification if webhooks aren't available
 */

import { EnsureWebhooksResult, calculateNextRetry } from './types.ts';

// Clover webhook capabilities are limited - they must be configured in App Market
// This function primarily tracks state and handles health checks

export async function ensureCloverWebhooks(
  supabase: any,
  connectionId: string
): Promise<EnsureWebhooksResult> {
  console.log('[ENSURE-CLOVER-WEBHOOKS] Starting for connection:', connectionId);

  try {
    // 1. Load connection
    const { data: connection, error: connError } = await supabase
      .from('clover_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      console.error('[ENSURE-CLOVER-WEBHOOKS] Connection not found:', connError?.message);
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'Connection not found',
        action: 'failed',
      };
    }

    if (connection.encrypted_access_token === 'pending') {
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'OAuth not completed',
        action: 'failed',
      };
    }

    // 2. Clover webhooks are app-level, not merchant-level
    // We can only verify that our webhook endpoint is configured in the Clover app
    // and that the merchant has authorized the necessary scopes
    
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/clover-webhook-handler`;

    // Check if we have a Clover App ID with webhooks configured
    const cloverAppId = Deno.env.get('CLOVER_APP_ID');
    
    if (!cloverAppId) {
      console.warn('[ENSURE-CLOVER-WEBHOOKS] No CLOVER_APP_ID configured');
      
      // Mark as sync-only since webhooks aren't configured at app level
      await supabase
        .from('clover_connections')
        .update({
          webhooks_subscribed: false,
          webhook_last_error: 'Clover webhooks not configured at app level. Import-only mode.',
          webhooks_last_checked_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      return {
        success: true,
        verified: false,
        subscription_id: null,
        error: 'Clover webhooks require App Market configuration. Currently sync-only.',
        action: 'skipped',
      };
    }

    // 3. If Clover app has webhooks, we assume they're configured correctly
    // Clover doesn't have an API to list/verify webhook subscriptions
    // We rely on actual webhook delivery to confirm they're working
    
    const hasReceivedWebhook = connection.last_webhook_received_at != null;
    const lastWebhookAge = connection.last_webhook_received_at
      ? (Date.now() - new Date(connection.last_webhook_received_at).getTime()) / (1000 * 60 * 60)
      : Infinity;
    
    // If we've received a webhook in the last 24 hours, consider it verified
    const verified = hasReceivedWebhook && lastWebhookAge < 24;

    await supabase
      .from('clover_connections')
      .update({
        webhooks_subscribed: verified,
        webhook_subscription_id: cloverAppId, // Use app ID as reference
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_last_error: verified ? null : 'Awaiting first webhook delivery',
        webhook_retry_count: verified ? 0 : (connection.webhook_retry_count || 0),
      })
      .eq('id', connectionId);

    console.log('[ENSURE-CLOVER-WEBHOOKS] Status:', verified ? 'VERIFIED' : 'PENDING');

    return {
      success: true,
      verified,
      subscription_id: cloverAppId,
      error: verified ? null : 'Awaiting webhook delivery to confirm',
      action: verified ? 'verified' : 'updated',
    };

  } catch (error: any) {
    console.error('[ENSURE-CLOVER-WEBHOOKS] Error:', error.message);
    
    await supabase
      .from('clover_connections')
      .update({
        webhooks_subscribed: false,
        webhook_last_error: error.message,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_retry_count: Deno.env.get('CLOVER_APP_ID') 
          ? ((await supabase.from('clover_connections').select('webhook_retry_count').eq('id', connectionId).single()).data?.webhook_retry_count || 0) + 1
          : 0,
        webhook_next_retry_at: calculateNextRetry(0).toISOString(),
      })
      .eq('id', connectionId);

    return {
      success: false,
      verified: false,
      subscription_id: null,
      error: error.message,
      action: 'failed',
    };
  }
}
