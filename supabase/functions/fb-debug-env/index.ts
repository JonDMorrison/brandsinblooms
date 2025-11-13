import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get('FB_CLIENT_ID') || ''
    const clientSecret = Deno.env.get('FB_CLIENT_SECRET') || ''

    // Show first 8 and last 4 characters for verification
    const maskedClientId = clientId.length > 12
      ? `${clientId.substring(0, 8)}...${clientId.slice(-4)}`
      : '(not set or too short)'

    const maskedClientSecret = clientSecret.length > 4
      ? `${clientSecret.substring(0, 4)}...${clientSecret.slice(-4)}`
      : '(not set or too short)'

    return new Response(
      JSON.stringify({
        FB_CLIENT_ID: maskedClientId,
        FB_CLIENT_SECRET: maskedClientSecret,
        callback_url_note: 'Should be configured in Meta: https://bloomsuite.app/integrations/facebook/callback',
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in fb-debug-env:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
