import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const show = (k: string) => {
      const val = Deno.env.get(k);
      if (!val) return "(missing)";
      // Show first 8 and last 4 chars for secrets
      if (k.includes('SECRET') || k.includes('CLIENT_SECRET')) {
        return `${val.substring(0, 8)}...${val.substring(val.length - 4)}`;
      }
      return val;
    };

    const result = {
      LIGHTSPEED_CLIENT_ID: show('LIGHTSPEED_CLIENT_ID'),
      LIGHTSPEED_CLIENT_SECRET: show('LIGHTSPEED_CLIENT_SECRET') + ' (partial)',
      STATE_SIGNING_SECRET: show('STATE_SIGNING_SECRET') + ' (partial)',
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') || '(missing)',
      callback_url_note: 'Should be: https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/lightspeed-oauth-callback',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
