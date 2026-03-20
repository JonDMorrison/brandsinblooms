import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getFacebookCredentials, getSquareCredentials, getLightspeedCredentials } from '../_shared/environment.ts'
import { encryptToken, decryptToken } from '../_shared/crypto/tokens.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function refreshFacebookToken(connection: any) {
  // Use production credentials for token refresh (backend operation)
  const { clientId, clientSecret } = getFacebookCredentials('production')
  const finalClientId = clientId || Deno.env.get('FB_CLIENT_ID')
  const finalClientSecret = clientSecret || Deno.env.get('FB_CLIENT_SECRET')
  
  const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${finalClientId}&client_secret=${finalClientSecret}&fb_exchange_token=${connection.access_token}`
  
  const response = await fetch(refreshUrl)
  const data = await response.json()
  
  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message || 'Failed to refresh Facebook token')
  }
  
  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000)
  
  await supabaseAdmin
    .from('social_connections')
    .update({
      access_token: data.access_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', connection.id)
  
  return { success: true, newExpiresAt }
}

/**
 * Refresh Square OAuth token using refresh_token
 * Square tokens last 30 days, refresh tokens last until used
 */
async function refreshSquareToken(connection: any) {
  console.log(`[SQUARE-REFRESH] Starting token refresh for connection ${connection.id}`)
  
  // Decrypt the refresh token
  if (!connection.encrypted_refresh_token) {
    throw new Error('No refresh token available - user must reconnect')
  }
  
  let refreshToken: string
  try {
    refreshToken = await decryptToken(connection.encrypted_refresh_token)
  } catch (e: any) {
    throw new Error(`Failed to decrypt refresh token: ${e.message}`)
  }
  
  // Use production credentials for token refresh
  const { clientId, clientSecret } = getSquareCredentials('production')
  
  if (!clientId || !clientSecret) {
    throw new Error('Square credentials not configured')
  }
  
  // Determine the token URL based on environment
  const tokenUrl = connection.environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com/oauth2/token'
    : 'https://connect.squareup.com/oauth2/token'
  
  console.log(`[SQUARE-REFRESH] Calling Square token endpoint...`)
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Square-Version': '2024-01-18',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  
  const data = await response.json()
  
  if (!response.ok || !data.access_token) {
    console.error('[SQUARE-REFRESH] Token refresh failed:', data)
    throw new Error(data.message || data.error_description || 'Failed to refresh Square token')
  }
  
  console.log(`[SQUARE-REFRESH] New tokens received`)
  
  // Encrypt the new tokens
  const encryptedAccessToken = await encryptToken(data.access_token)
  const encryptedRefreshToken = data.refresh_token 
    ? await encryptToken(data.refresh_token) 
    : connection.encrypted_refresh_token // Keep old if not returned
  
  // Square tokens expire in 30 days
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  
  // Update the connection
  await supabaseAdmin
    .from('square_connections')
    .update({
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
  
  console.log(`[SQUARE-REFRESH] Successfully refreshed token for connection ${connection.id}, expires: ${newExpiresAt.toISOString()}`)
  
  return { success: true, newExpiresAt }
}

serve(async (req) => {
  try {
    console.log('Token refresh worker starting...')
    
    let totalSuccess = 0
    let totalErrors = 0
    
    // ============================================
    // 1. REFRESH FACEBOOK/INSTAGRAM TOKENS
    // ============================================
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: socialConnections, error: socialFetchError } = await supabaseAdmin
      .from('social_connections')
      .select('id, user_id, platform, access_token, expires_at')
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', thirtyDaysFromNow)
      .in('platform', ['facebook', 'instagram'])

    if (socialFetchError) {
      console.error('Error fetching social connections:', socialFetchError)
    } else {
      console.log(`Found ${socialConnections?.length || 0} social connections to refresh`)
      
      for (const connection of socialConnections || []) {
        try {
          console.log(`Refreshing token for social connection ${connection.id} (${connection.platform})`)
          await refreshFacebookToken(connection)
          totalSuccess++
          console.log(`Successfully refreshed token for social connection ${connection.id}`)
        } catch (error) {
          console.error(`Error refreshing token for social connection ${connection.id}:`, error)
          totalErrors++
          // FIX: [SH5] - Mark connection as expired on refresh failure so users are notified
          await supabaseAdmin.from('social_connections').update({ is_active: false }).eq('id', connection.id);
          // TODO: Add user notification mechanism (email or in-app alert) when social tokens expire
        }
      }
    }

    // ============================================
    // 2. REFRESH SQUARE TOKENS
    // FIX: [P9] - Add Square token refresh (tokens expire after 30 days)
    // Refresh tokens expiring within 7 days
    // ============================================
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: squareConnections, error: squareFetchError } = await supabaseAdmin
      .from('square_connections')
      .select('id, tenant_id, encrypted_access_token, encrypted_refresh_token, expires_at, environment, status')
      .eq('status', 'connected')
      .not('expires_at', 'is', null)
      .not('encrypted_refresh_token', 'is', null)
      .lt('expires_at', sevenDaysFromNow)

    if (squareFetchError) {
      console.error('Error fetching Square connections:', squareFetchError)
    } else {
      console.log(`Found ${squareConnections?.length || 0} Square connections to refresh`)
      
      for (const connection of squareConnections || []) {
        try {
          console.log(`Refreshing token for Square connection ${connection.id}`)
          await refreshSquareToken(connection)
          totalSuccess++
        } catch (error: any) {
          console.error(`Error refreshing Square token for connection ${connection.id}:`, error.message)
          totalErrors++
          
          // If refresh failed due to invalid token, mark connection for re-auth
          if (error.message?.includes('invalid') || error.message?.includes('expired')) {
            console.log(`[SQUARE-REFRESH] Marking connection ${connection.id} as needing reconnection`)
            await supabaseAdmin
              .from('square_connections')
              .update({
                status: 'token_expired',
                updated_at: new Date().toISOString(),
              })
              .eq('id', connection.id)
          }
        }
      }
    }

    // ============================================
    // 3. REFRESH LIGHTSPEED TOKENS
    // FIX: [P4] - Add Lightspeed token refresh support
    // TODO: Confirm Lightspeed X-Series token refresh endpoint URL
    // Refresh tokens expiring within 30 minutes
    // ============================================
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { data: lightspeedConnections, error: lsFetchError } = await supabaseAdmin
      .from('lightspeed_connections')
      .select('id, tenant_id, domain_prefix, encrypted_access_token, encrypted_refresh_token, expires_at, status')
      .eq('status', 'connected')
      .not('expires_at', 'is', null)
      .not('encrypted_refresh_token', 'is', null)
      .lt('expires_at', thirtyMinutesFromNow)

    if (lsFetchError) {
      console.error('Error fetching Lightspeed connections:', lsFetchError)
    } else {
      console.log(`Found ${lightspeedConnections?.length || 0} Lightspeed connections to refresh`)

      for (const connection of lightspeedConnections || []) {
        try {
          console.log(`[LS-REFRESH] Refreshing token for connection ${connection.id}`)

          if (!connection.encrypted_refresh_token) {
            throw new Error('No refresh token available - user must reconnect')
          }

          const refreshToken = await decryptToken(connection.encrypted_refresh_token)

          const { clientId, clientSecret } = getLightspeedCredentials('production')
          if (!clientId || !clientSecret) {
            throw new Error('Lightspeed credentials not configured')
          }

          const tokenUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/1.0/token`
          const tokenParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
          })

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString(),
          })

          const data = await response.json()

          if (!response.ok || !data.access_token) {
            throw new Error(data.error_description || data.error || 'Failed to refresh Lightspeed token')
          }

          const encryptedAccessToken = await encryptToken(data.access_token)
          const encryptedRefreshToken = data.refresh_token
            ? await encryptToken(data.refresh_token)
            : connection.encrypted_refresh_token

          const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000)

          await supabaseAdmin
            .from('lightspeed_connections')
            .update({
              encrypted_access_token: encryptedAccessToken,
              encrypted_refresh_token: encryptedRefreshToken,
              expires_at: newExpiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', connection.id)

          console.log(`[LS-REFRESH] Successfully refreshed token for connection ${connection.id}, expires: ${newExpiresAt.toISOString()}`)
          totalSuccess++
        } catch (error: any) {
          console.error(`[LS-REFRESH] Error refreshing Lightspeed token for connection ${connection.id}:`, error.message)
          totalErrors++

          if (error.message?.includes('invalid') || error.message?.includes('expired')) {
            console.log(`[LS-REFRESH] Marking connection ${connection.id} as needing reconnection`)
            await supabaseAdmin
              .from('lightspeed_connections')
              .update({
                status: 'token_expired',
                updated_at: new Date().toISOString(),
              })
              .eq('id', connection.id)
          }
        }
      }
    }

    // ============================================
    // 4. REFRESH CLOVER TOKENS (if applicable)
    // ============================================
    const { data: cloverConnections, error: cloverFetchError } = await supabaseAdmin
      .from('clover_connections')
      .select('id, tenant_id, encrypted_access_token, encrypted_refresh_token, expires_at, environment, status')
      .eq('status', 'connected')
      .not('expires_at', 'is', null)
      .not('encrypted_refresh_token', 'is', null)
      .lt('expires_at', sevenDaysFromNow)

    if (cloverFetchError) {
      console.error('Error fetching Clover connections:', cloverFetchError)
    } else {
      console.log(`Found ${cloverConnections?.length || 0} Clover connections to refresh`)
      // Note: Clover refresh implementation would go here if needed
      // Clover typically requires re-authentication
    }

    const summary = `Token refresh complete: ${totalSuccess} success, ${totalErrors} errors`
    console.log(summary)
    
    return new Response(summary, { status: 200 })

  } catch (error) {
    console.error('Token refresh worker error:', error)
    return new Response('Worker error', { status: 500 })
  }
})
