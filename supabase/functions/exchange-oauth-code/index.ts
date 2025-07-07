
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🚀 OAuth exchange function started:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(req.headers.entries())
  });

  try {
    const requestBody = await req.json()
    const { code, state, redirect_uri } = requestBody
    
    console.log('🔄 OAuth exchange request received:', { 
      code: code ? `present (${code.substring(0, 10)}...)` : 'missing', 
      state: state ? `present (${state.substring(0, 8)}...)` : 'missing', 
      redirect_uri,
      requestBody: requestBody,
      contentLength: req.headers.get('content-length'),
      contentType: req.headers.get('content-type')
    })

    // Validate required parameters
    if (!code) {
      console.error('❌ Missing authorization code');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authorization code is required' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    if (!state) {
      console.error('❌ Missing state parameter');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'State parameter is required' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    if (!redirect_uri) {
      console.error('❌ Missing redirect URI');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Redirect URI is required' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ No authorization header provided')
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
      console.error('❌ User authentication failed:', userError)
      throw new Error('Invalid or expired token')
    }

    console.log('✅ User authenticated:', { 
      email: user.email,
      id: user.id.substring(0, 8) + '...'
    })

    // Check environment variables with detailed logging
    const clientId = Deno.env.get('FB_CLIENT_ID')
    const clientSecret = Deno.env.get('FB_CLIENT_SECRET')

    // Enhanced logging to debug the specific issue
    const allEnvKeys = Object.keys(Deno.env.toObject()).filter(key => key.includes('FB'))
    console.log('🔑 Facebook-related environment variables:', allEnvKeys)
    
    console.log('🔑 Environment check:', {
      clientId: clientId ? `present (${clientId.substring(0, 8)}...)` : 'MISSING',
      clientSecret: clientSecret ? 'present' : 'MISSING',
      supabaseUrl: Deno.env.get('SUPABASE_URL') ? 'present' : 'missing',
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'present' : 'missing',
      allEnvVarCount: Object.keys(Deno.env.toObject()).length
    })

    if (!clientId || !clientSecret) {
      const errorMessage = `Facebook/Instagram app credentials not configured. Missing: ${!clientId ? 'FB_CLIENT_ID ' : ''}${!clientSecret ? 'FB_CLIENT_SECRET' : ''}. Please add these to your Supabase Edge Function secrets.`
      console.error('❌ Missing Facebook credentials:', { 
        clientId: clientId ? 'present' : 'MISSING', 
        clientSecret: clientSecret ? 'present' : 'MISSING',
        availableEnvKeys: allEnvKeys,
        errorMessage
      })
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          debug: {
            availableEnvKeys: allEnvKeys,
            clientIdPresent: !!clientId,
            clientSecretPresent: !!clientSecret
          }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🔗 Starting OAuth token exchange for user:', user.id.substring(0, 8) + '...')

    // Check if this authorization code has already been used
    const { data: existingCodeCheck, error: codeCheckError } = await supabase
      .from('oauth_code_usage')
      .select('id')
      .eq('code_hash', btoa(code))
      .single()

    if (existingCodeCheck) {
      console.warn('⚠️ Authorization code already used:', { codeHash: btoa(code).substring(0, 10) + '...' })
      throw new Error('This authorization code has already been used. Please try connecting again.')
    }

    // Mark this code as used immediately to prevent race conditions
    const { error: markUsedError } = await supabase
      .from('oauth_code_usage')
      .insert({
        user_id: user.id,
        code_hash: btoa(code),
        used_at: new Date().toISOString()
      })

    if (markUsedError) {
      console.error('❌ Failed to mark code as used:', markUsedError)
      // Continue anyway - this is just a safety check
    }

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri,
      code: code,
    })

    console.log('📡 Sending token exchange request to Facebook...', {
      url: 'https://graph.facebook.com/v19.0/oauth/access_token',
      method: 'POST',
      hasParams: true
    })

    const tokenResponse = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams
    })

    const tokenData = await tokenResponse.json()
    console.log('📬 Token response received:', {
      status: tokenResponse.status,
      ok: tokenResponse.ok,
      hasAccessToken: !!tokenData.access_token,
      hasError: !!tokenData.error,
      errorType: tokenData.error?.type,
      errorMessage: tokenData.error?.message
    })

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: tokenData
      })
      throw new Error(`Token exchange failed (${tokenResponse.status}): ${JSON.stringify(tokenData)}`)
    }

    const accessToken = tokenData.access_token
    if (!accessToken) {
      throw new Error('No access token received from Facebook')
    }

    console.log('✅ Successfully obtained access token')

    // Get user info and pages/accounts
    console.log('👤 Fetching Facebook user data...')
    const userResponse = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`)
    const userData = await userResponse.json()

    if (!userResponse.ok) {
      console.error('❌ Failed to get user data:', userData)
      throw new Error(`Failed to get user data (${userResponse.status}): ${JSON.stringify(userData)}`)
    }

    console.log('✅ Retrieved Facebook user data:', {
      name: userData.name,
      id: userData.id
    })

    // Get pages (for Facebook) and Instagram accounts
    console.log('📄 Fetching Facebook pages and Instagram accounts...')
    const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`)
    const pagesData = await pagesResponse.json()

    if (!pagesResponse.ok) {
      console.error('❌ Failed to get pages:', pagesData)
      throw new Error(`Failed to get pages (${pagesResponse.status}): ${JSON.stringify(pagesData)}`)
    }

    const pageCount = pagesData.data?.length || 0
    console.log(`📊 Found ${pageCount} pages to process`)

    // Store connections for each page/account
    const connections = []
    
    for (const page of pagesData.data || []) {
      console.log('🔄 Processing page:', page.name)
      
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
        console.error('❌ Error saving Facebook connection:', fbError)
      } else {
        console.log('✅ Successfully saved Facebook connection for:', page.name)
        connections.push(fbConnection[0])
      }

      // Store Instagram connection if available
      if (page.instagram_business_account) {
        const igAccount = page.instagram_business_account
        console.log('📷 Processing Instagram account:', igAccount.id)
        
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
              username: igData.username,
              page_id: page.id, // Link to parent Facebook page
              access_token: page.access_token,
              expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
              is_active: true
            }, {
              onConflict: 'platform,platform_account_id,user_id'
            })
            .select()

          if (igError) {
            console.error('❌ Error saving Instagram connection:', igError)
          } else {
            console.log('✅ Successfully saved Instagram connection for:', igData.username)
            connections.push(igConnection[0])
          }
        } else {
          console.error('❌ Failed to get Instagram account details:', igData)
        }
      }
    }

    console.log(`🎉 Successfully processed ${connections.length} connections`)

    const successResponse = { 
      success: true, 
      connections: connections,
      user: userData,
      message: `Successfully connected ${connections.length} account${connections.length !== 1 ? 's' : ''}`
    }

    console.log('✅ Sending success response:', {
      connectionsCount: connections.length,
      hasUser: !!userData,
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify(successResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error in OAuth exchange:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    
    const errorResponse = { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
