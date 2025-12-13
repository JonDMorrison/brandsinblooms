import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

// Get Clover API base URL based on environment and region
function getCloverApiUrl(environment: string, region: string = 'na'): string {
  if (environment === 'sandbox') {
    return 'https://apisandbox.dev.clover.com';
  }
  
  switch (region) {
    case 'eu':
      return 'https://api.eu.clover.com';
    case 'la':
      return 'https://api.la.clover.com';
    default:
      return 'https://api.clover.com';
  }
}

interface CloverCustomer {
  id: string;
  firstName?: string;
  lastName?: string;
  marketingAllowed?: boolean;
  emailAddresses?: {
    elements?: Array<{ id: string; emailAddress: string; primaryEmail?: boolean }>;
  };
  phoneNumbers?: {
    elements?: Array<{ id: string; phoneNumber: string }>;
  };
  addresses?: {
    elements?: Array<{ id: string; address1?: string; city?: string; state?: string; zip?: string }>;
  };
  metadata?: {
    businessName?: string;
  };
}

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

    // Get Clover connection
    const { data: connection } = await supabaseClient
      .from('clover_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Clover connection');

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);
    const apiBaseUrl = getCloverApiUrl(connection.environment, connection.region);

    console.log('[CLOVER-SYNC] Starting customer sync...');
    console.log('[CLOVER-SYNC] API Base URL:', apiBaseUrl);

    // Fetch customers from Clover with pagination
    let offset = 0;
    const limit = 100;
    let customersSynced = 0;

    do {
      const url = `${apiBaseUrl}/v3/merchants/${connection.merchant_id}/customers?expand=emailAddresses,phoneNumbers,addresses&limit=${limit}&offset=${offset}`;
      
      console.log('[CLOVER-SYNC] Fetching customers, offset:', offset);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CLOVER-SYNC] API error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch customers');
      }

      const data = await response.json();
      const customers: CloverCustomer[] = data.elements || [];

      if (customers.length === 0) break;

      // Process customers
      for (const customer of customers) {
        const primaryEmail = customer.emailAddresses?.elements?.find(e => e.primaryEmail)?.emailAddress 
          || customer.emailAddresses?.elements?.[0]?.emailAddress;
        
        if (!primaryEmail) {
          console.log('[CLOVER-SYNC] Skipping customer without email:', customer.id);
          continue;
        }

        const primaryPhone = customer.phoneNumbers?.elements?.[0]?.phoneNumber;

        const { error: upsertError } = await supabaseClient
          .from('crm_customers')
          .upsert({
            tenant_id: userData.tenant_id,
            user_id: user.id,
            email: primaryEmail,
            first_name: customer.firstName,
            last_name: customer.lastName,
            phone: primaryPhone,
            pos_source: 'clover',
            email_opt_in: customer.marketingAllowed ?? null,
            email_consent_source: customer.marketingAllowed !== undefined ? 'clover_pos_import' : undefined,
            clover_customer_id: customer.id,
            clover_last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,email',
          });

        if (upsertError) {
          console.error(`[CLOVER-SYNC] Failed to upsert customer ${primaryEmail}:`, upsertError);
          continue;
        }

        customersSynced++;
      }

      offset += limit;

      // Check if we got fewer results than limit (end of data)
      if (customers.length < limit) break;

    } while (true);

    // Update connection with sync info
    await supabaseClient
      .from('clover_connections')
      .update({
        last_customer_sync: new Date().toISOString(),
        customers_synced: customersSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`[CLOVER-SYNC] Customer sync complete. Total synced: ${customersSynced}`);

    return new Response(
      JSON.stringify({ success: true, customersSynced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CLOVER-SYNC-CUSTOMERS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
