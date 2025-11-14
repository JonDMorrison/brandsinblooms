import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { detectEnvironment, getFacebookCredentials } from '../_shared/environment.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Detect environment and get appropriate credentials
    const environment = detectEnvironment(req)
    const { clientId, clientSecret } = getFacebookCredentials(environment)
    
    // Fallback to legacy secrets for backward compatibility
    const finalClientId = clientId || Deno.env.get('FB_CLIENT_ID')
    
    if (!finalClientId) {
      console.error(`❌ FB_CLIENT_ID not configured for ${environment} environment`)
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

    console.log(`✅ Providing OAuth config for ${environment} - Client ID configured`)

    return new Response(
      JSON.stringify({ 
        success: true,
        provider: 'facebook',
        clientId: finalClientId,
        environment
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