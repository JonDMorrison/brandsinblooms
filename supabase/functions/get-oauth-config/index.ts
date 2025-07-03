import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check if FB_CLIENT_ID is configured
    const clientId = Deno.env.get('FB_CLIENT_ID')
    
    if (!clientId) {
      console.error('❌ FB_CLIENT_ID not configured in Supabase secrets')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Facebook Client ID not configured' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Providing OAuth config - Client ID configured')

    return new Response(
      JSON.stringify({ 
        success: true,
        provider: 'facebook',
        clientId: clientId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error getting OAuth config:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})