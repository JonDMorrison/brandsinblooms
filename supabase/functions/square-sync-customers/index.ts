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

    // Get user's tenant_id
    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    // Get Square connection
    const { data: connection } = await supabaseClient
      .from('square_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Square connection');

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Fetch customers from Square
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/customers'
      : 'https://connect.squareup.com/v2/customers';

    let cursor: string | undefined;
    let customersSynced = 0;

    do {
      const url = new URL(baseUrl);
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to fetch customers');
      }

      // Process customers and insert into crm_customers
      if (data.customers && data.customers.length > 0) {
        for (const customer of data.customers) {
          const customerEmail = customer.email_address || `square-${customer.id}@noemail.local`;
          
          console.log(`[SQUARE-SYNC] Processing customer: ${customerEmail} (Square ID: ${customer.id})`);
          
          const { data: upsertData, error: upsertError } = await supabaseClient
            .from('crm_customers')
            .upsert({
              tenant_id: userData.tenant_id,
              email: customerEmail,
              first_name: customer.given_name,
              last_name: customer.family_name,
              phone: customer.phone_number,
              pos_source: 'square',
              created_at: customer.created_at,
              updated_at: customer.updated_at,
            }, {
              onConflict: 'tenant_id,email',
            })
            .select();
          
          if (upsertError) {
            console.error(`[SQUARE-SYNC] Failed to upsert customer ${customerEmail}:`, upsertError);
            continue; // Skip this customer but continue with others
          }
          
          console.log(`[SQUARE-SYNC] Successfully upserted customer ${customerEmail}`);
          customersSynced++;
        }
      }

      cursor = data.cursor;
    } while (cursor);

    // Update connection with sync info
    await supabaseClient
      .from('square_connections')
      .update({
        last_customer_sync: new Date().toISOString(),
        customers_synced: customersSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({ success: true, customersSynced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-SYNC-CUSTOMERS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});