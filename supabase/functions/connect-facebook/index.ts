
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { code, platform } = await req.json()

    // Exchange code for access token with Facebook
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${Deno.env.get('FACEBOOK_APP_ID')}&redirect_uri=${Deno.env.get('FACEBOOK_REDIRECT_URI')}&client_secret=${Deno.env.get('FACEBOOK_APP_SECRET')}&code=${code}`
    
    const tokenResponse = await fetch(tokenUrl)
    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      throw new Error(`Facebook API Error: ${tokenData.error.message}`)
    }

    // Get user's Facebook/Instagram accounts
    const accountsUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${tokenData.access_token}`
    const accountsResponse = await fetch(accountsUrl)
    const accountsData = await accountsResponse.json()

    // Store the connection in the database
    const connections = []
    
    // Store Facebook connection
    if (platform === 'facebook' || platform === 'both') {
      const { error: fbError } = await supabaseClient
        .from('social_connections')
        .upsert({
          user_id: user.id,
          platform: 'facebook',
          platform_account_id: tokenData.user_id || 'main',
          platform_account_name: 'Facebook Page',
          access_token: tokenData.access_token,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        })
      
      if (fbError) throw fbError
      connections.push('facebook')
    }

    // For Instagram, we need to get Instagram Business accounts
    if (platform === 'instagram' || platform === 'both') {
      for (const account of accountsData.data || []) {
        const igUrl = `https://graph.facebook.com/v18.0/${account.id}?fields=instagram_business_account&access_token=${tokenData.access_token}`
        const igResponse = await fetch(igUrl)
        const igData = await igResponse.json()

        if (igData.instagram_business_account) {
          const { error: igError } = await supabaseClient
            .from('social_connections')
            .upsert({
              user_id: user.id,
              platform: 'instagram',
              platform_account_id: igData.instagram_business_account.id,
              platform_account_name: account.name,
              access_token: tokenData.access_token,
              expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
            })
          
          if (igError) throw igError
          connections.push('instagram')
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        connections,
        message: `Successfully connected ${connections.join(' and ')}` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )

  } catch (error) {
    console.error('Error connecting Facebook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  }
})
