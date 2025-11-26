import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Invoke customer sync
    const { data: customersData, error: customersError } = await supabaseClient.functions.invoke(
      'square-sync-customers',
      { headers: { Authorization: authHeader } }
    );

    // Invoke sales sync
    const { data: salesData, error: salesError } = await supabaseClient.functions.invoke(
      'square-sync-sales',
      { headers: { Authorization: authHeader } }
    );

    // Invoke products sync
    const { data: productsData, error: productsError } = await supabaseClient.functions.invoke(
      'square-sync-products',
      { headers: { Authorization: authHeader } }
    );

    const results = {
      customers: customersData || { error: customersError?.message },
      sales: salesData || { error: salesError?.message },
      products: productsData || { error: productsError?.message },
    };

    const errors = [];
    if (customersError) errors.push(`Customers: ${customersError.message}`);
    if (salesError) errors.push(`Sales: ${salesError.message}`);
    if (productsError) errors.push(`Products: ${productsError.message}`);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-FULL-SYNC] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});