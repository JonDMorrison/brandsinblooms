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
    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const callbackUrl = 'https://bloomsuite.app/integrations/lightspeed/callback';
    const state = 'debug-test-state-' + Date.now();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'LIGHTSPEED_CLIENT_ID not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authUrl = new URL('https://secure.retail.lightspeed.app/connect');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    console.log('[DEBUG] Generated auth URL:', authUrl.toString());

    return new Response(
      JSON.stringify({
        auth_url: authUrl.toString(),
        client_id: clientId,
        redirect_uri: callbackUrl,
        state: state,
        note: 'Copy this URL and paste in browser to test redirect'
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
