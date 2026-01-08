/**
 * square-manage-webhooks
 * 
 * Exposes webhook management for admin tools and health checks.
 * Primary webhook setup happens automatically in square-oauth-callback.
 * 
 * Actions:
 * - status: Get current webhook status (default)
 * - retry: Force retry webhook subscription (admin)
 * - verify: Verify subscription exists in Square API
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { ensureSquareWebhooks } from '../_shared/webhooks/ensureSquareWebhooks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SQUARE-WEBHOOKS] Request received');

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

    // Get Square connection
    const { data: connection, error: connError } = await supabaseClient
      .from('square_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .in('status', ['active', 'connected'])
      .single();

    if (connError || !connection) {
      throw new Error('No active Square connection found');
    }

    console.log('[SQUARE-WEBHOOKS] Found connection:', connection.id);

    // Parse action from body
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'status';

    // Use service role client for webhook operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ACTION: retry - Force retry webhook subscription
    if (action === 'retry' || action === 'subscribe') {
      console.log('[SQUARE-WEBHOOKS] Retry/Subscribe action requested');
      
      const result = await ensureSquareWebhooks(serviceClient, connection.id);
      
      return new Response(
        JSON.stringify({
          success: result.success,
          action: result.action,
          verified: result.verified,
          subscription_id: result.subscription_id,
          error: result.error,
          event_types: result.event_types,
          message: result.verified 
            ? 'Webhook subscription verified and active'
            : result.error || 'Webhook subscription pending',
        }),
        { 
          status: result.verified ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ACTION: verify - Check subscription exists without creating
    if (action === 'verify') {
      console.log('[SQUARE-WEBHOOKS] Verify action requested');
      
      // Just run ensureSquareWebhooks which will verify and update state
      const result = await ensureSquareWebhooks(serviceClient, connection.id);
      
      return new Response(
        JSON.stringify({
          success: true,
          verified: result.verified,
          subscription_id: result.subscription_id,
          event_types: result.event_types,
          message: result.verified 
            ? 'Webhook subscription is active and verified'
            : 'Webhook subscription not found or disabled',
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
            : 'Webhooks not configured',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SQUARE-WEBHOOKS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
