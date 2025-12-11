import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPRESSION_DAYS = 180;
const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[suppression-checker] Starting nightly suppression check');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - SUPPRESSION_DAYS);
    const cutoffIso = cutoffDate.toISOString();

    console.log(`[suppression-checker] Cutoff date: ${cutoffIso} (${SUPPRESSION_DAYS} days ago)`);

    // Find customers to suppress:
    // - Not already suppressed
    // - Either never opened (last_open_at is null and created > 180 days ago)
    // - Or last opened > 180 days ago
    let totalSuppressed = 0;
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      // Get customers who should be suppressed
      const { data: customersToSuppress, error: fetchError } = await supabase
        .from('crm_customers')
        .select('id, email, tenant_id, last_open_at, created_at')
        .eq('suppressed', false)
        .or(`last_open_at.lt.${cutoffIso},and(last_open_at.is.null,created_at.lt.${cutoffIso})`)
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchError) {
        console.error('[suppression-checker] Error fetching customers:', fetchError);
        throw fetchError;
      }

      if (!customersToSuppress || customersToSuppress.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[suppression-checker] Found ${customersToSuppress.length} customers to suppress (batch ${Math.floor(offset / BATCH_SIZE) + 1})`);

      // Suppress in batches
      const customerIds = customersToSuppress.map(c => c.id);
      
      const { error: updateError, count } = await supabase
        .from('crm_customers')
        .update({
          suppressed: true,
          suppressed_at: new Date().toISOString(),
          suppressed_reason: `No email opens in ${SUPPRESSION_DAYS} days`,
        })
        .in('id', customerIds);

      if (updateError) {
        console.error('[suppression-checker] Error suppressing customers:', updateError);
        throw updateError;
      }

      totalSuppressed += customersToSuppress.length;
      
      // Log by tenant for visibility
      const tenantCounts: Record<string, number> = {};
      customersToSuppress.forEach(c => {
        tenantCounts[c.tenant_id] = (tenantCounts[c.tenant_id] || 0) + 1;
      });
      
      for (const [tenantId, count] of Object.entries(tenantCounts)) {
        console.log(`[suppression-checker] Tenant ${tenantId}: suppressed ${count} customers`);
      }

      if (customersToSuppress.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }
    }

    // Also check for customers who should be unsuppressed (opened recently)
    // This is a backup in case the trigger didn't fire
    const { data: customersToUnsuppress, error: unsuppressFetchError } = await supabase
      .from('crm_customers')
      .select('id, email')
      .eq('suppressed', true)
      .gte('last_open_at', cutoffIso);

    if (unsuppressFetchError) {
      console.error('[suppression-checker] Error fetching customers to unsuppress:', unsuppressFetchError);
    } else if (customersToUnsuppress && customersToUnsuppress.length > 0) {
      const unsuppressIds = customersToUnsuppress.map(c => c.id);
      
      const { error: unsuppressError } = await supabase
        .from('crm_customers')
        .update({
          suppressed: false,
          suppressed_at: null,
          suppressed_reason: null,
        })
        .in('id', unsuppressIds);

      if (unsuppressError) {
        console.error('[suppression-checker] Error unsuppressing customers:', unsuppressError);
      } else {
        console.log(`[suppression-checker] Unsuppressed ${customersToUnsuppress.length} customers who opened recently`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[suppression-checker] Completed in ${duration}ms. Total suppressed: ${totalSuppressed}`);

    return new Response(
      JSON.stringify({
        success: true,
        suppressed_count: totalSuppressed,
        unsuppressed_count: customersToUnsuppress?.length || 0,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[suppression-checker] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
