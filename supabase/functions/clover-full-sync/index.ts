import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('[CLOVER-FULL-SYNC] Starting full sync orchestration...');

    // Sequential sync for proper data flow
    // 1. Sync customers first
    console.log('[CLOVER-FULL-SYNC] Step 1: Syncing customers...');
    const { data: customersData, error: customersError } = await supabaseClient.functions.invoke(
      'clover-sync-customers',
      { headers: { Authorization: authHeader } }
    );

    if (customersError) {
      console.error('[CLOVER-FULL-SYNC] Customer sync error:', customersError.message);
    } else {
      console.log('[CLOVER-FULL-SYNC] Customer sync complete:', customersData);
    }

    // 2. Sync sales second (uses customer data, builds product_tags)
    console.log('[CLOVER-FULL-SYNC] Step 2: Syncing sales...');
    const { data: salesData, error: salesError } = await supabaseClient.functions.invoke(
      'clover-sync-sales',
      { headers: { Authorization: authHeader } }
    );

    if (salesError) {
      console.error('[CLOVER-FULL-SYNC] Sales sync error:', salesError.message);
    } else {
      console.log('[CLOVER-FULL-SYNC] Sales sync complete:', salesData);
    }

    // 3. Sync products third (for inventory + catalog reference)
    console.log('[CLOVER-FULL-SYNC] Step 3: Syncing products...');
    const { data: productsData, error: productsError } = await supabaseClient.functions.invoke(
      'clover-sync-products',
      { headers: { Authorization: authHeader } }
    );

    if (productsError) {
      console.error('[CLOVER-FULL-SYNC] Products sync error:', productsError.message);
    } else {
      console.log('[CLOVER-FULL-SYNC] Products sync complete:', productsData);
    }

    const results = {
      customers: customersData || { error: customersError?.message },
      sales: salesData || { error: salesError?.message },
      products: productsData || { error: productsError?.message },
    };

    const errors = [];
    if (customersError) errors.push(`Customers: ${customersError.message}`);
    if (salesError) errors.push(`Sales: ${salesError.message}`);
    if (productsError) errors.push(`Products: ${productsError.message}`);

    console.log('[CLOVER-FULL-SYNC] Full sync complete. Errors:', errors.length);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        results,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          customersSynced: customersData?.customersSynced || 0,
          salesSynced: salesData?.salesSynced || 0,
          customersWithProductTags: salesData?.customersWithProductTags || 0,
          productsSynced: productsData?.productsSynced || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CLOVER-FULL-SYNC] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
