
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }
    
    const jwt = authHeader.replace('Bearer ', '')
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    const clientId = Deno.env.get('FB_CLIENT_ID')
    const clientSecret = Deno.env.get('FB_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Facebook/Instagram app credentials not configured')
    }

    console.log('Starting OAuth token exchange for user:', user.id)

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
      console.error('Token exchange failed:', tokenData)
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`)
    }

    const accessToken = tokenData.access_token
    console.log('Successfully obtained access token')

    // Get user info and pages/accounts
    const userResponse = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`)
    const userData = await userResponse.json()

    if (!userResponse.ok) {
      console.error('Failed to get user data:', userData)
      throw new Error(`Failed to get user data: ${JSON.stringify(userData)}`)
    }

    console.log('Retrieved Facebook user data:', userData.name)

    // Get pages (for Facebook) and Instagram accounts
    const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`)
    const pagesData = await pagesResponse.json()

    if (!pagesResponse.ok) {
      console.error('Failed to get pages:', pagesData)
      throw new Error(`Failed to get pages: ${JSON.stringify(pagesData)}`)
    }

    console.log(`Found ${pagesData.data?.length || 0} pages to process`)

    // Store connections for each page/account
    const connections = []
    
    for (const page of pagesData.data || []) {
      console.log('Processing page:', page.name)
      
      // Store Facebook page connection
      const { data: fbConnection, error: fbError } = await supabase
        .from('social_connections')
        .upsert({
          user_id: user.id,
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
        console.log('Successfully saved Facebook connection for:', page.name)
        connections.push(fbConnection[0])
      }

      // Store Instagram connection if available
      if (page.instagram_business_account) {
        const igAccount = page.instagram_business_account
        console.log('Processing Instagram account:', igAccount.id)
        
        // Get Instagram account details
        const igResponse = await fetch(`https://graph.facebook.com/v19.0/${igAccount.id}?fields=id,username&access_token=${page.access_token}`)
        const igData = await igResponse.json()

        if (igResponse.ok) {
          const { data: igConnection, error: igError } = await supabase
            .from('social_connections')
            .upsert({
              user_id: user.id,
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
            console.log('Successfully saved Instagram connection for:', igData.username)
            connections.push(igConnection[0])
          }
        } else {
          console.error('Failed to get Instagram account details:', igData)
        }
      }
    }

    console.log(`Successfully processed ${connections.length} connections`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        connections: connections,
        user: userData,
        message: `Successfully connected ${connections.length} account${connections.length !== 1 ? 's' : ''}`
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
