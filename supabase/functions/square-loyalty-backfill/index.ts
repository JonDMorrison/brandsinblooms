import { createClient } from 'npm:@supabase/supabase-js@2';
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
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('[SQUARE-LOYALTY-BACKFILL] Starting loyalty backfill...');

    // Get user and tenant info
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const { data: userData, error: tenantError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (tenantError || !userData?.tenant_id) {
      throw new Error('Tenant not found');
    }

    const tenantId = userData.tenant_id;
    console.log(`[SQUARE-LOYALTY-BACKFILL] Tenant: ${tenantId}`);

    // Get Square connection
    const { data: connection, error: connError } = await supabase
      .from('square_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .single();

    if (connError || !connection) {
      throw new Error('No active Square connection found');
    }

    const accessToken = await decryptToken(connection.encrypted_access_token);
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2'
      : 'https://connect.squareup.com/v2';

    let cursor: string | undefined;
    let totalProcessed = 0;
    let totalMatched = 0;
    let pageCount = 0;

    // Paginate through all loyalty accounts
    do {
      pageCount++;
      console.log(`[SQUARE-LOYALTY-BACKFILL] Fetching page ${pageCount}, cursor: ${cursor || 'none'}`);
      
      const response = await fetch(`${baseUrl}/loyalty/accounts/search`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${accessToken}`, 
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: 100,
          cursor: cursor
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.errors?.[0]?.detail || 'Square Loyalty API error');
      }

      const data = await response.json();
      const loyaltyAccounts = data.loyalty_accounts || [];
      cursor = data.cursor;
      
      console.log(`[SQUARE-LOYALTY-BACKFILL] Found ${loyaltyAccounts.length} loyalty accounts on page ${pageCount}`);
      totalProcessed += loyaltyAccounts.length;

      // Process each loyalty account
      for (const account of loyaltyAccounts) {
        // Find the customer by square_customer_id
        const { data: customer } = await supabase
          .from('crm_customers')
          .select('id, tags')
          .eq('tenant_id', tenantId)
          .eq('square_customer_id', account.customer_id)
          .single();

        if (customer) {
          totalMatched++;
          
          // Add "Loyalty Member" tag if not present
          const existingTags = customer.tags || [];
          if (!existingTags.includes('Loyalty Member')) {
            await supabase
              .from('crm_customers')
              .update({ 
                tags: [...existingTags, 'Loyalty Member'],
                updated_at: new Date().toISOString()
              })
              .eq('id', customer.id);
          }

          // Upsert loyalty metrics using correct schema columns
          await supabase
            .from('customer_loyalty_metrics')
            .upsert({
              tenant_id: tenantId,
              customer_id: customer.id,
              is_perks_member: true,
              perks_enrolled_at: account.enrolled_at,
              current_points_balance: account.balance || 0,
              total_points_earned: account.lifetime_points || 0,
              updated_at: new Date().toISOString()
            }, { onConflict: 'customer_id' });
        }
      }

      // Rate limiting: wait 200ms between pages
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } while (cursor);

    console.log(`[SQUARE-LOYALTY-BACKFILL] Complete! Processed ${totalProcessed} loyalty accounts, matched ${totalMatched} customers`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Loyalty backfill complete',
        totalLoyaltyAccounts: totalProcessed,
        customersMatched: totalMatched,
        pagesProcessed: pageCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SQUARE-LOYALTY-BACKFILL] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
