import { serve } from "https://deno.land/std@0.168.0/http/server.ts"


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Milestone 3: Email-domain warmup & domain-level limits are removed.
// This function is kept for compatibility with existing schedules, but it is now a no-op.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('ℹ️ reset-daily-limits: warmup disabled; no work to do.');
    return new Response(
      JSON.stringify({
        success: true,
        warmup_disabled: true,
        message: 'Email-domain warmup & limits are disabled'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Critical error in reset-daily-limits:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
