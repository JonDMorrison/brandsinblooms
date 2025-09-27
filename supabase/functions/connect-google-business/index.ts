
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

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

    const { code } = await req.json()

    // Exchange code for access token with Google
    const tokenUrl = 'https://oauth2.googleapis.com/token'
    const tokenBody = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: Deno.env.get('GOOGLE_REDIRECT_URI') ?? '',
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      throw new Error(`Google API Error: ${tokenData.error_description}`)
    }

    // Get user's Google My Business accounts
    const accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
    const accountsResponse = await fetch(accountsUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    const accountsData = await accountsResponse.json()

    // Store the first business account (most users have one)
    if (accountsData.accounts && accountsData.accounts.length > 0) {
      const account = accountsData.accounts[0]
      
      const { error } = await supabaseClient
        .from('social_connections')
        .upsert({
          user_id: user.id,
          platform: 'google_my_business',
          platform_account_id: account.name,
          platform_account_name: account.accountName || 'Google My Business',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        })

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Successfully connected Google My Business',
          account: account.accountName 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        },
      )
    } else {
      throw new Error('No Google My Business accounts found')
    }

  } catch (error) {
    console.error('Error connecting Google My Business:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  }
})
