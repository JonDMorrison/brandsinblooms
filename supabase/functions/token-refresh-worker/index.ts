
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function refreshFacebookToken(connection: any) {
  const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${Deno.env.get('FB_CLIENT_ID')}&client_secret=${Deno.env.get('FB_CLIENT_SECRET')}&fb_exchange_token=${connection.access_token}`
  
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

serve(async (req) => {
  try {
    console.log('Token refresh worker starting...')
    
    // Get connections that expire within 30 days
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: connections, error: fetchError } = await supabaseAdmin
      .from('social_connections')
      .select('id, user_id, platform, access_token, expires_at')
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', thirtyDaysFromNow)
      .in('platform', ['facebook', 'instagram'])

    if (fetchError) {
      console.error('Error fetching connections:', fetchError)
      return new Response('Error fetching connections', { status: 500 })
    }

    console.log(`Found ${connections?.length || 0} connections to refresh`)

    if (!connections || connections.length === 0) {
      return new Response('No tokens need refreshing', { status: 200 })
    }

    let successCount = 0
    let errorCount = 0

    for (const connection of connections) {
      try {
        console.log(`Refreshing token for connection ${connection.id} (${connection.platform})`)
        
        if (connection.platform === 'facebook' || connection.platform === 'instagram') {
          await refreshFacebookToken(connection)
          successCount++
          console.log(`Successfully refreshed token for connection ${connection.id}`)
        } else {
          console.log(`Unsupported platform for token refresh: ${connection.platform}`)
        }

      } catch (error) {
        console.error(`Error refreshing token for connection ${connection.id}:`, error)
        errorCount++
        
        // Log the failure but don't disable the connection
        // The user will be notified through normal error handling when they try to post
      }
    }

    return new Response(
      `Token refresh complete: ${successCount} success, ${errorCount} errors`,
      { status: 200 }
    )

  } catch (error) {
    console.error('Token refresh worker error:', error)
    return new Response('Worker error', { status: 500 })
  }
})
