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

    console.log('[SQUARE-FULL-SYNC] Starting full sync orchestration...');

    // Phase 5: Sequential sync for proper data flow
    // 1. Sync customers first (gets groups + preferences)
    console.log('[SQUARE-FULL-SYNC] Step 1: Syncing customers...');
    const { data: customersData, error: customersError } = await supabaseClient.functions.invoke(
      'square-sync-customers',
      { headers: { Authorization: authHeader } }
    );

    if (customersError) {
      console.error('[SQUARE-FULL-SYNC] Customer sync error:', customersError.message);
    } else {
      console.log('[SQUARE-FULL-SYNC] Customer sync complete:', customersData);
    }

    // 2. Sync sales second (uses customer data, builds product_tags)
    console.log('[SQUARE-FULL-SYNC] Step 2: Syncing sales...');
    const { data: salesData, error: salesError } = await supabaseClient.functions.invoke(
      'square-sync-sales',
      { headers: { Authorization: authHeader } }
    );

    if (salesError) {
      console.error('[SQUARE-FULL-SYNC] Sales sync error:', salesError.message);
    } else {
      console.log('[SQUARE-FULL-SYNC] Sales sync complete:', salesData);
    }

    // 3. Sync products third (for inventory + catalog reference)
    console.log('[SQUARE-FULL-SYNC] Step 3: Syncing products...');
    const { data: productsData, error: productsError } = await supabaseClient.functions.invoke(
      'square-sync-products',
      { headers: { Authorization: authHeader } }
    );

    if (productsError) {
      console.error('[SQUARE-FULL-SYNC] Products sync error:', productsError.message);
    } else {
      console.log('[SQUARE-FULL-SYNC] Products sync complete:', productsData);
    }

    // 4. Auto-assign personas based on purchase history
    console.log('[SQUARE-FULL-SYNC] Step 4: Running persona auto-assignment...');
    let personasAssigned = 0;
    
    // Get all Square customers for this tenant
    const { data: squareCustomers } = await supabaseClient
      .from('crm_customers')
      .select('id')
      .eq('pos_source', 'square')
      .not('order_history', 'is', null);

    if (squareCustomers && squareCustomers.length > 0) {
      console.log(`[SQUARE-FULL-SYNC] Processing ${squareCustomers.length} customers for persona assignment...`);
      
      for (const customer of squareCustomers) {
        try {
          const { data: personaResult, error: personaError } = await supabaseClient.functions.invoke(
            'persona-auto-assignment',
            { 
              body: { customer_id: customer.id },
              headers: { Authorization: authHeader } 
            }
          );

          if (!personaError && personaResult?.assigned) {
            personasAssigned++;
          }
        } catch (err: any) {
          console.error(`[SQUARE-FULL-SYNC] Persona assignment failed for ${customer.id}:`, err.message);
        }
      }
      console.log(`[SQUARE-FULL-SYNC] Persona assignment complete: ${personasAssigned} assigned`);
    } else {
      console.log('[SQUARE-FULL-SYNC] No customers with order history for persona assignment');
    }

    // 5. Auto-assign segments based on customer data
    console.log('[SQUARE-FULL-SYNC] Step 5: Running segment auto-assignment...');
    const { data: segmentData, error: segmentError } = await supabaseClient.functions.invoke(
      'segment-auto-assignment',
      { headers: { Authorization: authHeader } }
    );

    if (segmentError) {
      console.error('[SQUARE-FULL-SYNC] Segment assignment error:', segmentError.message);
    } else {
      console.log('[SQUARE-FULL-SYNC] Segment assignment complete:', segmentData);
    }

    const results = {
      customers: customersData || { error: customersError?.message },
      sales: salesData || { error: salesError?.message },
      products: productsData || { error: productsError?.message },
      personaAssignment: { assigned: personasAssigned },
      segmentAssignment: segmentData || { error: segmentError?.message },
    };

    const errors = [];
    if (customersError) errors.push(`Customers: ${customersError.message}`);
    if (salesError) errors.push(`Sales: ${salesError.message}`);
    if (productsError) errors.push(`Products: ${productsError.message}`);
    if (segmentError) errors.push(`Segments: ${segmentError.message}`);

    console.log('[SQUARE-FULL-SYNC] Full sync complete. Errors:', errors.length);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        results,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          customersSynced: customersData?.progress?.synced || customersData?.customersSynced || 0,
          groupsLoaded: customersData?.groupsLoaded || 0,
          salesSynced: salesData?.salesSynced || 0,
          customersWithPurchaseData: salesData?.customersWithPurchaseData || 0,
          productsSynced: productsData?.productsSynced || 0,
          personasAssigned,
          segmentsProcessed: segmentData?.segmentsProcessed || 0,
          segmentAssignments: segmentData?.assignmentsCreated || 0
        }
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
