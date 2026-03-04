// Milestone 4: Engagement-based auto-suppression has been removed.
// This function is kept for compatibility with any existing scheduler, but it is now a no-op.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[suppression-checker] Engagement-based suppression disabled; no work to do.');

  try {
    const duration = Date.now() - startTime;
    console.log(`[suppression-checker] Completed in ${duration}ms (no-op).`);

    return new Response(
      JSON.stringify({
        success: true,
        engagement_suppression_disabled: true,
        suppressed_count: 0,
        unsuppressed_count: 0,
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
