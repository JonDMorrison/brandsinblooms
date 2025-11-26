import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    const { data: connection } = await supabaseClient
      .from('square_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Square connection');

    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Fetch payments from Square
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/payments'
      : 'https://connect.squareup.com/v2/payments';

    let cursor: string | undefined;
    let salesSynced = 0;

    do {
      const url = new URL(baseUrl);
      if (cursor) url.searchParams.set('cursor', cursor);
      url.searchParams.set('limit', '100');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to fetch payments');
      }

      if (data.payments && data.payments.length > 0) {
        for (const payment of data.payments) {
          if (payment.status === 'COMPLETED') {
            await supabaseClient.from('pos_orders').upsert({
              pos_connection_id: connection.id,
              external_id: payment.id,
              external_customer_id: payment.customer_id,
              order_date: payment.created_at,
              total_amount: payment.amount_money?.amount ? payment.amount_money.amount / 100 : 0,
              currency: payment.amount_money?.currency || 'USD',
              status: payment.status,
              raw_data: payment,
            }, {
              onConflict: 'pos_connection_id,external_id',
            });
            salesSynced++;
          }
        }
      }

      cursor = data.cursor;
    } while (cursor);

    await supabaseClient
      .from('square_connections')
      .update({
        last_sales_sync: new Date().toISOString(),
        sales_synced: salesSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({ success: true, salesSynced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-SYNC-SALES] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});