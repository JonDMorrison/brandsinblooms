import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REQUIRED_EVENTS = [
  'payment.created',
  'payment.updated',
  'order.created',
  'order.updated',
  'customer.created',
  'customer.updated',
  'loyalty.account.created',
  'loyalty.program.enrollment.created',
];

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
      .eq('status', 'active')
      .single();

    if (connError || !connection) {
      throw new Error('No active Square connection found');
    }

    console.log('[SQUARE-WEBHOOKS] Found connection for merchant:', connection.merchant_id);

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);
    if (!accessToken) {
      throw new Error('Failed to decrypt access token');
    }

    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';

    // List current webhook subscriptions
    console.log('[SQUARE-WEBHOOKS] Fetching webhook subscriptions...');
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
      console.error('[SQUARE-WEBHOOKS] Failed to list subscriptions:', errorText);
      throw new Error(`Failed to list webhook subscriptions: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const subscriptions = listData.subscriptions || [];

    console.log('[SQUARE-WEBHOOKS] Found', subscriptions.length, 'webhook subscriptions');

    // Analyze subscriptions
    const analysis = subscriptions.map((sub: any) => {
      const subscribedEvents = sub.event_types || [];
      const missingEvents = REQUIRED_EVENTS.filter(e => !subscribedEvents.includes(e));
      const hasLoyaltyEvents = subscribedEvents.some((e: string) => e.startsWith('loyalty.'));

      return {
        id: sub.id,
        name: sub.name,
        notification_url: sub.notification_url,
        enabled: sub.enabled,
        event_types: subscribedEvents,
        missing_events: missingEvents,
        has_loyalty_events: hasLoyaltyEvents,
      };
    });

    // Check if we need to update any subscription
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'add_loyalty_events') {
      const subscriptionId = body?.subscription_id;
      if (!subscriptionId) {
        throw new Error('subscription_id required for add_loyalty_events action');
      }

      const targetSub = subscriptions.find((s: any) => s.id === subscriptionId);
      if (!targetSub) {
        throw new Error('Subscription not found');
      }

      const currentEvents = targetSub.event_types || [];
      const loyaltyEvents = ['loyalty.account.created', 'loyalty.program.enrollment.created'];
      const newEvents = [...new Set([...currentEvents, ...loyaltyEvents])];

      console.log('[SQUARE-WEBHOOKS] Updating subscription', subscriptionId, 'with loyalty events');

      const updateResponse = await fetch(`${baseUrl}/v2/webhooks/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-18',
        },
        body: JSON.stringify({
          subscription: {
            event_types: newEvents,
          },
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[SQUARE-WEBHOOKS] Failed to update subscription:', errorText);
        throw new Error(`Failed to update webhook subscription: ${updateResponse.status}`);
      }

      const updateData = await updateResponse.json();
      console.log('[SQUARE-WEBHOOKS] Subscription updated successfully');

      return new Response(
        JSON.stringify({
          success: true,
          action: 'add_loyalty_events',
          subscription: updateData.subscription,
          message: 'Loyalty events added to webhook subscription',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: return analysis
    const hasAnyLoyaltySubscription = analysis.some((a: any) => a.has_loyalty_events);

    return new Response(
      JSON.stringify({
        success: true,
        merchant_id: connection.merchant_id,
        environment: connection.environment,
        subscriptions: analysis,
        summary: {
          total_subscriptions: subscriptions.length,
          has_loyalty_events: hasAnyLoyaltySubscription,
          required_events: REQUIRED_EVENTS,
        },
        recommendation: hasAnyLoyaltySubscription
          ? 'Loyalty events are configured. Webhooks should be working.'
          : 'No loyalty events found. Use action "add_loyalty_events" with a subscription_id to add them.',
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
