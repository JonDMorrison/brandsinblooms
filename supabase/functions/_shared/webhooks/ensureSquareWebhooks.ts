/**
 * ensureSquareWebhooks - Idempotent webhook subscription manager
 * 
 * Single source of truth for Square webhook subscriptions.
 * Safe to call multiple times - will never create duplicates.
 * 
 * Callable from:
 * - square-oauth-callback (primary, after tokens stored)
 * - square-manage-webhooks (admin retry)
 * - background health checks
 */

import { decryptToken } from '../crypto/tokens.ts';

const REQUIRED_EVENTS = [
  'payment.created',
  'payment.completed',
  'payment.updated',
  'order.created',
  'order.updated',
  'order.fulfillment.updated',
  'customer.created',
  'customer.updated',
  'loyalty.account.created',
  'loyalty.program.enrollment.created',
  'refund.created',
  'catalog.version.updated',
  'inventory.count.updated',
];

export interface EnsureWebhooksResult {
  success: boolean;
  verified: boolean;
  subscription_id: string | null;
  error: string | null;
  action: 'created' | 'updated' | 'verified' | 'failed';
  event_types?: string[];
}

export async function ensureSquareWebhooks(
  supabase: any,
  connectionId: string
): Promise<EnsureWebhooksResult> {
  console.log('[ENSURE-WEBHOOKS] Starting for connection:', connectionId);
  
  try {
    // 1. Load connection with tokens
    const { data: connection, error: connError } = await supabase
      .from('square_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      console.error('[ENSURE-WEBHOOKS] Connection not found:', connError?.message);
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'Connection not found',
        action: 'failed',
      };
    }

    if (connection.encrypted_access_token === 'pending') {
      console.error('[ENSURE-WEBHOOKS] Connection has pending token');
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
      console.error('[ENSURE-WEBHOOKS] Token decryption failed:', e.message);
      await updateConnectionError(supabase, connectionId, `Token decryption failed: ${e.message}`);
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: 'Token decryption failed',
        action: 'failed',
      };
    }

    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-webhook-handler`;

    // 3. List existing subscriptions from Square API
    console.log('[ENSURE-WEBHOOKS] Fetching existing subscriptions from Square...');
    const listResponse = await fetch(`${baseUrl}/v2/webhooks/subscriptions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('[ENSURE-WEBHOOKS] Failed to list subscriptions:', listResponse.status, errorText);
      await updateConnectionError(supabase, connectionId, `Square API error: ${listResponse.status}`);
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: `Square API error: ${listResponse.status}`,
        action: 'failed',
      };
    }

    const listData = await listResponse.json();
    const subscriptions = listData.subscriptions || [];
    console.log('[ENSURE-WEBHOOKS] Found', subscriptions.length, 'existing subscriptions');

    // 4. Find our subscription by notification URL
    const existingSubscription = subscriptions.find((s: any) =>
      s.notification_url === webhookUrl || s.notification_url?.includes('square-webhook-handler')
    );

    let subscriptionId: string | null = null;
    let action: 'created' | 'updated' | 'verified' = 'verified';

    if (existingSubscription) {
      // Check if we need to update event types
      const currentEvents = new Set(existingSubscription.event_types || []);
      const missingEvents = REQUIRED_EVENTS.filter(e => !currentEvents.has(e));

      if (missingEvents.length > 0 || !existingSubscription.enabled) {
        // Update existing subscription
        console.log('[ENSURE-WEBHOOKS] Updating subscription with missing events:', missingEvents);
        const newEvents = [...new Set([...existingSubscription.event_types, ...REQUIRED_EVENTS])];

        const updateResponse = await fetch(`${baseUrl}/v2/webhooks/subscriptions/${existingSubscription.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-18',
          },
          body: JSON.stringify({
            subscription: {
              event_types: newEvents,
              enabled: true,
            },
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          const errorMsg = errorData.errors?.[0]?.detail || `Update failed: ${updateResponse.status}`;
          console.error('[ENSURE-WEBHOOKS] Update failed:', errorMsg);
          await updateConnectionError(supabase, connectionId, errorMsg);
          return {
            success: false,
            verified: false,
            subscription_id: existingSubscription.id,
            error: errorMsg,
            action: 'failed',
          };
        }

        action = 'updated';
        subscriptionId = existingSubscription.id;
        console.log('[ENSURE-WEBHOOKS] Subscription updated:', subscriptionId);
      } else {
        // Already exists and has all events
        subscriptionId = existingSubscription.id;
        console.log('[ENSURE-WEBHOOKS] Subscription already configured:', subscriptionId);
      }
    } else {
      // Create new subscription
      console.log('[ENSURE-WEBHOOKS] Creating new subscription to:', webhookUrl);

      const createResponse = await fetch(`${baseUrl}/v2/webhooks/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-18',
        },
        body: JSON.stringify({
          idempotency_key: `bloomsuite-${connectionId}-${Date.now()}`,
          subscription: {
            name: 'BloomSuite Integration',
            notification_url: webhookUrl,
            event_types: REQUIRED_EVENTS,
            enabled: true,
          },
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        const errorMsg = errorData.errors?.[0]?.detail || `Create failed: ${createResponse.status}`;
        console.error('[ENSURE-WEBHOOKS] Create failed:', errorMsg);
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
      subscriptionId = createData.subscription?.id;
      action = 'created';
      console.log('[ENSURE-WEBHOOKS] Subscription created:', subscriptionId);
    }

    // 5. VERIFY - Re-fetch to confirm subscription exists and is enabled
    console.log('[ENSURE-WEBHOOKS] Verifying subscription...');
    const verifyResponse = await fetch(`${baseUrl}/v2/webhooks/subscriptions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    let verified = false;
    let eventTypes: string[] = [];

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const confirmedSub = (verifyData.subscriptions || []).find((s: any) =>
        s.id === subscriptionId || s.notification_url?.includes('square-webhook-handler')
      );

      if (confirmedSub && confirmedSub.enabled) {
        verified = true;
        subscriptionId = confirmedSub.id;
        eventTypes = confirmedSub.event_types || [];
        console.log('[ENSURE-WEBHOOKS] ✓ VERIFIED:', subscriptionId, 'with', eventTypes.length, 'events');
      } else {
        console.warn('[ENSURE-WEBHOOKS] ⚠ Subscription not found in verification');
      }
    }

    // 6. Update connection state
    const updatePayload: any = {
      webhooks_subscribed: verified,
      webhook_subscription_id: subscriptionId,
      webhooks_last_checked_at: new Date().toISOString(),
      webhook_retry_count: verified ? 0 : (connection.webhook_retry_count || 0) + 1,
    };

    if (verified) {
      updatePayload.webhook_last_error = null;
      updatePayload.webhook_next_retry_at = null;
    } else {
      updatePayload.webhook_last_error = 'Verification failed after creation';
      // Exponential backoff: 5min, 15min, 45min, 2h, 6h, max 24h
      const retryDelays = [5, 15, 45, 120, 360, 1440];
      const retryCount = Math.min(updatePayload.webhook_retry_count, retryDelays.length - 1);
      const nextRetryMinutes = retryDelays[retryCount];
      updatePayload.webhook_next_retry_at = new Date(Date.now() + nextRetryMinutes * 60 * 1000).toISOString();
    }

    await supabase
      .from('square_connections')
      .update(updatePayload)
      .eq('id', connectionId);

    console.log('[ENSURE-WEBHOOKS] Connection updated:', verified ? 'SUCCESS' : 'PENDING RETRY');

    return {
      success: true,
      verified,
      subscription_id: subscriptionId,
      error: verified ? null : 'Verification pending',
      action,
      event_types: eventTypes,
    };

  } catch (error: any) {
    console.error('[ENSURE-WEBHOOKS] Unexpected error:', error.message);
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
      .from('square_connections')
      .select('webhook_retry_count')
      .eq('id', connectionId)
      .single();

    const retryCount = (conn?.webhook_retry_count || 0) + 1;
    const retryDelays = [5, 15, 45, 120, 360, 1440];
    const nextRetryMinutes = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];

    await supabase
      .from('square_connections')
      .update({
        webhooks_subscribed: false,
        webhook_last_error: error,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_retry_count: retryCount,
        webhook_next_retry_at: new Date(Date.now() + nextRetryMinutes * 60 * 1000).toISOString(),
      })
      .eq('id', connectionId);
  } catch (e) {
    console.error('[ENSURE-WEBHOOKS] Failed to update error state:', e);
  }
}
