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
    const url = new URL(req.url);
    const domain = url.searchParams.get('domain') || 'brandsinblooms';
    
    const tokenUrl = `https://${domain}.retail.lightspeed.app/api/1.0/token`;

    console.log('[DEBUG] Testing token endpoint:', tokenUrl);

    let fetchResult;
    try {
      const res = await fetch(tokenUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      fetchResult = {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        body: await res.text()
      };
    } catch (error) {
      fetchResult = {
        ok: false,
        error: error.message,
        note: 'DNS or network error - domain prefix may be invalid'
      };
    }

    return new Response(
      JSON.stringify({
        tested_url: tokenUrl,
        domain_prefix: domain,
        result: fetchResult,
        interpretation: fetchResult.status === 400 
          ? '✅ Endpoint exists (400 is expected without valid params)'
          : fetchResult.error
          ? '❌ DNS/network error - check domain prefix'
          : `⚠️ Unexpected status: ${fetchResult.status}`
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
