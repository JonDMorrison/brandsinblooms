
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

    // ═══════════════════════════════════════════════════════════
    // 🌍 ENVIRONMENT DETECTION & REDIRECT URI VALIDATION
    // ═══════════════════════════════════════════════════════════
    const environment = detectEnvironment(req)
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    
    console.log('🌍 Environment Detection (Backend):', {
      environment,
      origin,
      referer,
      redirectUriReceived: redirect_uri,
      expectedPattern: environment === 'development' 
        ? 'https://*.lovableproject.com/oauth/callback' 
        : 'https://bloomsuite.app/oauth/callback',
      matches: environment === 'development' 
        ? redirect_uri.includes('lovableproject.com/oauth/callback')
        : redirect_uri === 'https://bloomsuite.app/oauth/callback'
    });
    
    const { clientId, clientSecret } = getFacebookCredentials(environment)
    
    // ═══════════════════════════════════════════════════════════
    // 🔑 CREDENTIAL AVAILABILITY CHECK (DEV vs PROD)
    // ═══════════════════════════════════════════════════════════
    const expectedDevSecrets = {
      clientId: Deno.env.get('FB_CLIENT_ID_DEV'),
      clientSecret: Deno.env.get('FB_CLIENT_SECRET_DEV')
    };
    const expectedProdSecrets = {
      clientId: Deno.env.get('FB_CLIENT_ID_PROD'),
      clientSecret: Deno.env.get('FB_CLIENT_SECRET_PROD')
    };
    const legacySecrets = {
      clientId: Deno.env.get('FB_CLIENT_ID'),
      clientSecret: Deno.env.get('FB_CLIENT_SECRET')
    };
    
    console.log('🔑 Secret Availability Check:', {
      detectedEnvironment: environment,
      devSecretsAvailable: {
        clientId: !!expectedDevSecrets.clientId,
        clientSecret: !!expectedDevSecrets.clientSecret
      },
      prodSecretsAvailable: {
        clientId: !!expectedProdSecrets.clientId,
        clientSecret: !!expectedProdSecrets.clientSecret
      },
      legacySecretsAvailable: {
        clientId: !!legacySecrets.clientId,
        clientSecret: !!legacySecrets.clientSecret
      },
      credentialsReturnedByHelper: {
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        clientIdPreview: clientId?.substring(0, 10) + '...'
      },
      expectedSuffix: environment === 'development' ? '_DEV' : '_PROD'
    });
    
    // Fallback to legacy secrets for backward compatibility
    const finalClientId = clientId || Deno.env.get('FB_CLIENT_ID')
    const finalClientSecret = clientSecret || Deno.env.get('FB_CLIENT_SECRET')

    // Enhanced logging to debug the specific issue
    const allEnvKeys = Object.keys(Deno.env.toObject()).filter(key => key.includes('FB'))
    console.log('🔑 All Facebook-related environment variables:', allEnvKeys)
    
    console.log('🔑 Final Credentials Selection:', {
      environment,
      clientIdSource: clientId ? `FB_CLIENT_ID_${environment.toUpperCase()}` : (legacySecrets.clientId ? 'FB_CLIENT_ID (legacy)' : 'NONE'),
      clientSecretSource: clientSecret ? `FB_CLIENT_SECRET_${environment.toUpperCase()}` : (legacySecrets.clientSecret ? 'FB_CLIENT_SECRET (legacy)' : 'NONE'),
      finalClientIdPresent: !!finalClientId,
      finalClientSecretPresent: !!finalClientSecret,
      finalClientIdPreview: finalClientId?.substring(0, 10) + '...',
      supabaseUrl: Deno.env.get('SUPABASE_URL') ? 'present' : 'missing',
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'present' : 'missing',
      allEnvVarCount: Object.keys(Deno.env.toObject()).length
    })

    if (!finalClientId || !finalClientSecret) {
      const errorMessage = `Facebook/Instagram app credentials not configured for ${environment}. Missing: ${!finalClientId ? 'FB_CLIENT_ID ' : ''}${!finalClientSecret ? 'FB_CLIENT_SECRET' : ''}. Please add these to your Supabase Edge Function secrets.`
      console.error(`❌ Missing Facebook credentials for ${environment}:`, { 
        clientId: finalClientId ? 'present' : 'MISSING', 
        clientSecret: finalClientSecret ? 'present' : 'MISSING',
        availableEnvKeys: allEnvKeys,
        errorMessage
      })
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          debug: {
            environment,
            availableEnvKeys: allEnvKeys,
            clientIdPresent: !!finalClientId,
            clientSecretPresent: !!finalClientSecret
          }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🔗 Starting OAuth token exchange for user:', user.id.substring(0, 8) + '...')

    // ═══════════════════════════════════════════════════════════
    // 🔗 TOKEN EXCHANGE WITH REDIRECT URI (MUST MATCH EXACTLY)
    // ═══════════════════════════════════════════════════════════
    console.log('🔄 Token Exchange Request Details:', {
      tokenEndpoint: 'https://graph.facebook.com/v21.0/oauth/access_token',
      clientId: finalClientId?.substring(0, 10) + '...',
      redirectUriUsed: redirect_uri,
      redirectUriSource: 'from frontend request body',
      codePresent: !!code,
      codeLength: code.length,
      environment,
      timestamp: new Date().toISOString()
    });

    // ═══════════════════════════════════════════════════════════
    // FIX 1: IDEMPOTENCY CHECK - Check if connections already exist
    // ═══════════════════════════════════════════════════════════
    const { data: existingConnections } = await supabase
      .from('social_connections')
      .select('id, platform, platform_account_name, is_active')
      .eq('user_id', user.id)
      .in('platform', ['facebook', 'instagram'])
      .eq('is_active', true)

    if (existingConnections && existingConnections.length > 0) {
      console.log('✅ Active connections already exist for this user:', {
        count: existingConnections.length,
        platforms: existingConnections.map(c => c.platform)
      })
      
      // Return success immediately - idempotent operation
      return new Response(
        JSON.stringify({ 
          success: true, 
          connections: existingConnections,
          message: `Already connected (${existingConnections.length} active connection${existingConnections.length !== 1 ? 's' : ''})`,
          idempotent: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ═══════════════════════════════════════════════════════════════
    // FIX 2: DEDUPLICATION - Check if code already used with better handling
    // ═══════════════════════════════════════════════════════════════
    const codeHash = btoa(code)
    const { data: existingCodeCheck } = await supabase
      .from('oauth_code_usage')
      .select('id, used_at, user_id')
      .eq('code_hash', codeHash)
      .single()

    if (existingCodeCheck) {
      const usedAgo = Date.now() - new Date(existingCodeCheck.used_at).getTime()
      const minutesAgo = Math.floor(usedAgo / 60000)
      
      console.warn('⚠️ Authorization code already used:', { 
        codeHash: codeHash.substring(0, 10) + '...',
        usedAt: existingCodeCheck.used_at,
        minutesAgo,
        sameUser: existingCodeCheck.user_id === user.id
      })
      
      // If code was used more than 5 minutes ago and no connections exist, it's likely stale
      if (minutesAgo > 5) {
        console.log('🧹 Cleaning up stale OAuth attempt (>5 min old, no connections created)')
        await supabase
          .from('oauth_code_usage')
          .delete()
          .eq('id', existingCodeCheck.id)
        
        // Allow retry after cleanup
        console.log('✅ Stale code cleaned up, allowing retry...')
      } else {
        throw new Error('This authorization code has already been used. Please try connecting again.')
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Mark this code as used immediately to prevent race conditions
    // ═══════════════════════════════════════════════════════════════
    let codeUsageId: string | null = null
    const { data: codeUsageData, error: markUsedError } = await supabase
      .from('oauth_code_usage')
      .insert({
        user_id: user.id,
        code_hash: codeHash,
        used_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (markUsedError) {
      console.error('❌ Failed to mark code as used:', markUsedError)
      
      // CRITICAL: If we can't mark the code as used, it might be a duplicate request
      if (markUsedError.code === '23505') {
        console.warn('⚠️ Duplicate code usage detected via constraint violation')
        throw new Error('This authorization code has already been used. Please try connecting again.')
      }
      
      throw new Error('Failed to track authorization code usage. Please try again.')
    }
    
    codeUsageId = codeUsageData?.id || null
    console.log('✅ Code marked as used:', { codeUsageId })

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      client_id: finalClientId,
      client_secret: finalClientSecret,
      redirect_uri: redirect_uri,
      code: code,
    })

    console.log(`📡 Sending token exchange request to Facebook (${environment})...`, {
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
      
      // Provide user-friendly error messages for common OAuth errors
      let errorMessage = `Token exchange failed (${tokenResponse.status})`;
      
      if (tokenData.error?.message?.includes('This authorization code has been used')) {
        errorMessage = 'This authorization code has already been used. Please try connecting again.';
      } else if (tokenData.error?.message?.includes('authorization code')) {
        errorMessage = 'Invalid or expired authorization code. Please try connecting again.';
      } else if (tokenData.error?.message) {
        errorMessage = tokenData.error.message;
      }
      
      throw new Error(errorMessage)
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
    
    // ═══════════════════════════════════════════════════════════════
    // FIX 3: AUTO-CLEANUP - If token exchange failed, clean up stale code
    // ═══════════════════════════════════════════════════════════════
    try {
      const codeHash = btoa(requestBody?.code || '')
      const { data: staleCode } = await supabase
        .from('oauth_code_usage')
        .select('id')
        .eq('code_hash', codeHash)
        .eq('user_id', user?.id || '')
        .single()
      
      if (staleCode) {
        console.log('🧹 Auto-cleaning stale OAuth code after error...')
        const { error: cleanupError } = await supabase
          .from('oauth_code_usage')
          .delete()
          .eq('id', staleCode.id)
        
        if (cleanupError) {
          console.error('⚠️ Failed to clean up stale code:', cleanupError)
        } else {
          console.log('✅ Stale code cleaned up successfully')
        }
      }
    } catch (cleanupErr) {
      console.error('⚠️ Cleanup attempt failed:', cleanupErr)
      // Don't throw - just log, we want to return the original error
    }
    
    const errorResponse = { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
      retry: true, // Signal that user can retry
      action: 'Please try connecting again. The authorization has been reset.'
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
