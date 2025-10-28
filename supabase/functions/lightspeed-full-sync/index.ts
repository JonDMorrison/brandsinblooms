import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

console.log('[LS-FULL-SYNC] Edge function starting');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-FULL-SYNC] Starting full sync');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      customers: null as any,
      sales: null as any,
      products: null as any,
      errors: [] as string[],
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const functionUrl = `${supabaseUrl}/functions/v1`;

    // Sync customers
    console.log('[LS-FULL-SYNC] Syncing customers...');
    try {
      const customersResponse = await supabaseClient.functions.invoke('lightspeed-sync-customers', {
        body: {},
      });
      results.customers = customersResponse.data;
      if (customersResponse.error) {
        results.errors.push(`Customers: ${customersResponse.error.message}`);
      }
    } catch (error) {
      console.error('[LS-FULL-SYNC] Customer sync error:', error);
      results.errors.push(`Customers: ${error.message}`);
    }

    // Sync sales
    console.log('[LS-FULL-SYNC] Syncing sales...');
    try {
      const salesResponse = await supabaseClient.functions.invoke('lightspeed-sync-sales', {
        body: {},
      });
      results.sales = salesResponse.data;
      if (salesResponse.error) {
        results.errors.push(`Sales: ${salesResponse.error.message}`);
      }
    } catch (error) {
      console.error('[LS-FULL-SYNC] Sales sync error:', error);
      results.errors.push(`Sales: ${error.message}`);
    }

    // Sync products
    console.log('[LS-FULL-SYNC] Syncing products...');
    try {
      const productsResponse = await supabaseClient.functions.invoke('lightspeed-sync-products', {
        body: {},
      });
      results.products = productsResponse.data;
      if (productsResponse.error) {
        results.errors.push(`Products: ${productsResponse.error.message}`);
      }
    } catch (error) {
      console.error('[LS-FULL-SYNC] Products sync error:', error);
      results.errors.push(`Products: ${error.message}`);
    }

    console.log('[LS-FULL-SYNC] Full sync complete');

    const hasErrors = results.errors.length > 0;
    const message = hasErrors
      ? `Sync completed with errors: ${results.errors.join(', ')}`
      : 'Full sync completed successfully';

    return new Response(
      JSON.stringify({
        success: !hasErrors,
        message,
        results,
      }),
      { 
        status: hasErrors ? 207 : 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[LS-FULL-SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
