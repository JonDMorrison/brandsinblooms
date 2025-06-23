
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { access_token, platform, page_id } = await req.json()
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const jwt = authHeader.replace('Bearer ', '')
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify token with Meta API and get page info
    const verifyUrl = platform === 'facebook' 
      ? `https://graph.facebook.com/v19.0/${page_id}?fields=name,access_token&access_token=${access_token}`
      : `https://graph.facebook.com/v19.0/${page_id}?fields=name,username&access_token=${access_token}`

    const verifyResponse = await fetch(verifyUrl)
    const pageInfo = await verifyResponse.json()

    if (!verifyResponse.ok) {
      throw new Error(`Failed to verify ${platform} connection: ${pageInfo.error?.message}`)
    }

    // For Facebook pages, use the page access token; for Instagram, use the provided token
    const finalAccessToken = platform === 'facebook' && pageInfo.access_token 
      ? pageInfo.access_token 
      : access_token

    // Get token expiration (default to 60 days for long-lived tokens)
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

    // Save connection to database
    const { data, error } = await supabase
      .from('social_connections')
      .upsert({
        platform,
        platform_account_id: page_id,
        platform_account_name: pageInfo.name || pageInfo.username,
        page_id,
        access_token: finalAccessToken,
        expires_at: expiresAt.toISOString(),
        is_active: true
      }, {
        onConflict: 'platform,platform_account_id,user_id'
      })
      .select()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, connection: data[0] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error connecting to Meta:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
