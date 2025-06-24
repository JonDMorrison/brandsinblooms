
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
    const { code, state, redirect_uri } = await req.json()
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const jwt = authHeader.replace('Bearer ', '')
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const clientId = Deno.env.get('FB_CLIENT_ID')
    const clientSecret = Deno.env.get('FB_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Facebook/Instagram app credentials not configured')
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri,
        code: code,
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenData.error?.message || 'Unknown error'}`)
    }

    const accessToken = tokenData.access_token

    // Get user info and pages/accounts
    const userResponse = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`)
    const userData = await userResponse.json()

    if (!userResponse.ok) {
      throw new Error(`Failed to get user data: ${userData.error?.message}`)
    }

    // Get pages (for Facebook) and Instagram accounts
    const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`)
    const pagesData = await pagesResponse.json()

    if (!pagesResponse.ok) {
      throw new Error(`Failed to get pages: ${pagesData.error?.message}`)
    }

    // Store connections for each page/account
    const connections = []
    
    for (const page of pagesData.data || []) {
      // Store Facebook page connection
      const { data: fbConnection, error: fbError } = await supabase
        .from('social_connections')
        .upsert({
          platform: 'facebook',
          platform_account_id: page.id,
          platform_account_name: page.name,
          page_id: page.id,
          access_token: page.access_token,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
          is_active: true
        }, {
          onConflict: 'platform,platform_account_id,user_id'
        })
        .select()

      if (fbError) {
        console.error('Error saving Facebook connection:', fbError)
      } else {
        connections.push(fbConnection[0])
      }

      // Store Instagram connection if available
      if (page.instagram_business_account) {
        const igAccount = page.instagram_business_account
        
        // Get Instagram account details
        const igResponse = await fetch(`https://graph.facebook.com/v19.0/${igAccount.id}?fields=id,username&access_token=${page.access_token}`)
        const igData = await igResponse.json()

        if (igResponse.ok) {
          const { data: igConnection, error: igError } = await supabase
            .from('social_connections')
            .upsert({
              platform: 'instagram',
              platform_account_id: igAccount.id,
              platform_account_name: igData.username || igAccount.id,
              page_id: igAccount.id,
              access_token: page.access_token,
              expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
              is_active: true
            }, {
              onConflict: 'platform,platform_account_id,user_id'
            })
            .select()

          if (igError) {
            console.error('Error saving Instagram connection:', igError)
          } else {
            connections.push(igConnection[0])
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        connections: connections,
        user: userData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in OAuth exchange:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
