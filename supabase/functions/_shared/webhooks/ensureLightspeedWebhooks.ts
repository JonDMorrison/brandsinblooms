/**
 * ensureLightspeedWebhooks - Idempotent webhook subscription manager for Lightspeed
 * 
 * IMPORTANT: Lightspeed X-Series has webhook support via the API.
 * R-Series (legacy) does NOT support webhooks - sync-only.
 * 
 * This function handles both cases appropriately.
 */

import { EnsureWebhooksResult, calculateNextRetry } from './types.ts';
import { decryptToken } from '../crypto/tokens.ts';

const REQUIRED_EVENTS = [
  'sale.completed',
  'sale.updated', 
  'customer.created',
  'customer.updated',
  'product.updated',
  'loyalty.updated',
];

export async function ensureLightspeedWebhooks(
  supabase: any,
  connectionId: string
): Promise<EnsureWebhooksResult> {
  console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Starting for connection:', connectionId);

  try {
    // 1. Load connection
    const { data: connection, error: connError } = await supabase
      .from('lightspeed_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      console.error('[ENSURE-LIGHTSPEED-WEBHOOKS] Connection not found:', connError?.message);
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'Connection not found',
        action: 'failed',
      };
    }

    if (!connection.encrypted_access_token || connection.encrypted_access_token === 'pending') {
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'OAuth not completed',
        action: 'failed',
      };
    }

    // 2. Decrypt access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
      if (!accessToken) throw new Error('Decryption returned empty');
    } catch (e: any) {
      console.error('[ENSURE-LIGHTSPEED-WEBHOOKS] Token decryption failed:', e.message);
      await updateConnectionError(supabase, connectionId, `Token decryption failed: ${e.message}`);
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'Token decryption failed',
        action: 'failed',
      };
    }

    const domainPrefix = connection.domain_prefix;
    if (!domainPrefix) {
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'No domain prefix configured',
        action: 'failed',
      };
    }

    const baseUrl = `https://${domainPrefix}.retail.lightspeed.app/api/2.0`;
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/lightspeed-webhook-handler`;

    // 3. List existing webhooks
    console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Fetching existing webhooks...');
    const listResponse = await fetch(`${baseUrl}/Webhook.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Lightspeed may not support webhooks for all account types
    if (listResponse.status === 404 || listResponse.status === 403) {
      console.warn('[ENSURE-LIGHTSPEED-WEBHOOKS] Webhook API not available - sync-only mode');
      
      await supabase
        .from('lightspeed_connections')
        .update({
          webhooks_subscribed: false,
          webhook_last_error: 'Lightspeed webhook API not available for this account. Sync-only mode.',
          webhooks_last_checked_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      return {
        success: true,
        verified: false,
        subscription_id: null,
        error: 'Webhook API not available - sync-only',
        action: 'skipped',
      };
    }

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('[ENSURE-LIGHTSPEED-WEBHOOKS] List failed:', listResponse.status, errorText);
      await updateConnectionError(supabase, connectionId, `API error: ${listResponse.status}`);
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: `Lightspeed API error: ${listResponse.status}`,
        action: 'failed',
      };
    }

    const listData = await listResponse.json();
    const webhooks = listData.Webhook || [];
    console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Found', webhooks.length, 'existing webhooks');

    // 4. Find our webhook
    const existingWebhook = webhooks.find((w: any) =>
      w.url === webhookUrl || w.url?.includes('lightspeed-webhook-handler')
    );

    let subscriptionId: string | null = null;
    let action: 'created' | 'updated' | 'verified' = 'verified';

    if (existingWebhook) {
      // Webhook exists - check if it's enabled
      subscriptionId = existingWebhook.webhookID?.toString() || existingWebhook.id?.toString();
      
      if (!existingWebhook.enabled) {
        // Enable the webhook
        console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Enabling disabled webhook:', subscriptionId);
        
        await fetch(`${baseUrl}/Webhook/${subscriptionId}.json`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Webhook: { enabled: true }
          }),
        });
        
        action = 'updated';
      }
      
      console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Webhook exists:', subscriptionId);
    } else {
      // Create new webhook
      console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Creating webhook to:', webhookUrl);
      
      const createResponse = await fetch(`${baseUrl}/Webhook.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Webhook: {
            url: webhookUrl,
            enabled: true,
            event: 'all', // Lightspeed uses 'all' or specific event types
          }
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        const errorMsg = errorData.message || `Create failed: ${createResponse.status}`;
        console.error('[ENSURE-LIGHTSPEED-WEBHOOKS] Create failed:', errorMsg);
        await updateConnectionError(supabase, connectionId, errorMsg);
        return {
          success: false,
          verified: false,
          subscription_id: null,
          error: errorMsg,
          action: 'failed',
        };
      }

      const createData = await createResponse.json();
      subscriptionId = createData.Webhook?.webhookID?.toString() || createData.Webhook?.id?.toString();
      action = 'created';
      console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Webhook created:', subscriptionId);
    }

    // 5. Verify webhook exists
    console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] Verifying...');
    const verifyResponse = await fetch(`${baseUrl}/Webhook.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    let verified = false;
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const confirmedWebhook = (verifyData.Webhook || []).find((w: any) =>
        w.webhookID?.toString() === subscriptionId || 
        w.id?.toString() === subscriptionId ||
        w.url?.includes('lightspeed-webhook-handler')
      );
      
      if (confirmedWebhook && confirmedWebhook.enabled) {
        verified = true;
        subscriptionId = confirmedWebhook.webhookID?.toString() || confirmedWebhook.id?.toString();
        console.log('[ENSURE-LIGHTSPEED-WEBHOOKS] ✓ VERIFIED:', subscriptionId);
      }
    }

    // 6. Update connection state
    await supabase
      .from('lightspeed_connections')
      .update({
        webhooks_subscribed: verified,
        webhook_subscription_id: subscriptionId,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_last_error: verified ? null : 'Verification failed',
        webhook_retry_count: verified ? 0 : (connection.webhook_retry_count || 0) + 1,
        webhook_next_retry_at: verified ? null : calculateNextRetry((connection.webhook_retry_count || 0) + 1).toISOString(),
      })
      .eq('id', connectionId);

    return {
      success: true,
      verified,
      subscription_id: subscriptionId,
      error: verified ? null : 'Verification pending',
      action,
    };

  } catch (error: any) {
    console.error('[ENSURE-LIGHTSPEED-WEBHOOKS] Error:', error.message);
    await updateConnectionError(supabase, connectionId, error.message);
    return {
      success: false,
      verified: false,
      subscription_id: null,
      error: error.message,
      action: 'failed',
    };
  }
}

async function updateConnectionError(supabase: any, connectionId: string, error: string) {
  try {
    const { data: conn } = await supabase
      .from('lightspeed_connections')
      .select('webhook_retry_count')
      .eq('id', connectionId)
      .single();

    const retryCount = (conn?.webhook_retry_count || 0) + 1;

    await supabase
      .from('lightspeed_connections')
      .update({
        webhooks_subscribed: false,
        webhook_last_error: error,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_retry_count: retryCount,
        webhook_next_retry_at: calculateNextRetry(retryCount).toISOString(),
      })
      .eq('id', connectionId);
  } catch (e) {
    console.error('[ENSURE-LIGHTSPEED-WEBHOOKS] Failed to update error state:', e);
  }
}
