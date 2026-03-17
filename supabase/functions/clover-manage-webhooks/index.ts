/**
 * clover-manage-webhooks
 * 
 * Exposes webhook management for admin tools and health checks.
 * 
 * Actions:
 * - status: Get current webhook status (default)
 * - retry: Force retry webhook verification
 * - verify: Verify webhook state
 * 
 * Ported from square-manage-webhooks with Clover-specific adaptations.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ensureCloverWebhooks } from '../_shared/webhooks/ensureCloverWebhooks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CLOVER-WEBHOOKS] Request received');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get tenant_id
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      throw new Error('No tenant found for user');
    }

    // Get Clover connection
    const { data: connection, error: connError } = await supabaseClient
      .from('clover_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .in('status', ['active', 'connected'])
      .single();

    if (connError || !connection) {
      throw new Error('No active Clover connection found');
    }

    console.log('[CLOVER-WEBHOOKS] Found connection:', connection.id);

    // Parse action from body
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'status';

    // Use service role client for webhook operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ACTION: retry - Force retry webhook verification
    if (action === 'retry' || action === 'subscribe') {
      console.log('[CLOVER-WEBHOOKS] Retry/Subscribe action requested');
      
      const result = await ensureCloverWebhooks(serviceClient, connection.id);
      
      return new Response(
        JSON.stringify({
          success: result.success,
          action: result.action,
          verified: result.verified,
          subscription_id: result.subscription_id,
          error: result.error,
          message: result.verified 
            ? 'Webhook subscription verified and active'
            : result.error || 'Webhook subscription pending - awaiting first webhook delivery',
          note: 'Clover webhooks are configured at the app level in App Market. Verification depends on receiving webhooks.',
        }),
        { 
          status: result.verified ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ACTION: verify - Check subscription exists
    if (action === 'verify') {
      console.log('[CLOVER-WEBHOOKS] Verify action requested');
      
      const result = await ensureCloverWebhooks(serviceClient, connection.id);
      
      return new Response(
        JSON.stringify({
          success: true,
          verified: result.verified,
          subscription_id: result.subscription_id,
          message: result.verified 
            ? 'Webhook subscription is active and verified'
            : 'Webhook subscription not verified - awaiting webhook delivery',
          note: 'Unlike Square, Clover webhook subscriptions are configured in the Clover App Market, not via API.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DEFAULT: status - Return current webhook status from database
    return new Response(
      JSON.stringify({
        success: true,
        action: 'status',
        connection_id: connection.id,
        merchant_id: connection.merchant_id,
        region: connection.region,
        webhooks: {
          subscribed: connection.webhooks_subscribed || false,
          subscription_id: connection.webhook_subscription_id,
          last_checked_at: connection.webhooks_last_checked_at,
          last_error: connection.webhook_last_error,
          last_webhook_received_at: connection.last_webhook_received_at,
          retry_count: connection.webhook_retry_count || 0,
          next_retry_at: connection.webhook_next_retry_at,
        },
        message: connection.webhooks_subscribed 
          ? 'Webhooks are active'
          : connection.webhook_last_error 
            ? `Issue detected: ${connection.webhook_last_error}`
            : 'Webhooks not configured - check Clover App Market settings',
        note: 'Clover webhooks require configuration in the Clover Developer Portal and App Market.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CLOVER-WEBHOOKS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
