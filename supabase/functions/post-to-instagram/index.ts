
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
    const { post_id } = await req.json()
    
    // Get the post from database
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: post, error: postError } = await supabaseAdmin
      .from('social_posts')
      .select(`
        *,
        social_connections!inner(*)
      `)
      .eq('id', post_id)
      .single()

    if (postError || !post) {
      throw new Error('Post not found')
    }

    const connection = post.social_connections
    
    // Refresh token if needed
    await refreshTokenIfNeeded(connection, supabaseAdmin)

    if (!post.media_url) {
      throw new Error('Instagram posts require an image')
    }

    // Step 1: Create media container
    const containerResponse = await fetch(`https://graph.facebook.com/v19.0/${connection.page_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        image_url: post.media_url,
        caption: post.content,
        access_token: connection.access_token
      })
    })

    const containerResult = await containerResponse.json()
    
    if (!containerResponse.ok) {
      throw new Error(`Container creation failed: ${JSON.stringify(containerResult)}`)
    }

    const containerId = containerResult.id

    // Step 2: Publish the media
    const publishResponse = await fetch(`https://graph.facebook.com/v19.0/${connection.page_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: connection.access_token
      })
    })

    const publishResult = await publishResponse.json()
    
    // Update post status
    const status = publishResponse.ok ? 'published' : 'failed'
    await supabaseAdmin
      .from('social_posts')
      .update({
        status,
        api_response: publishResult,
        updated_at: new Date().toISOString()
      })
      .eq('id', post_id)

    return new Response(
      JSON.stringify({ success: publishResponse.ok, result: publishResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error posting to Instagram:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function refreshTokenIfNeeded(connection: any, supabaseAdmin: any) {
  const expiresAt = new Date(connection.expires_at)
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  
  if (expiresAt > twoDaysFromNow) {
    return // Token is still valid
  }

  const clientId = Deno.env.get('FB_CLIENT_ID')
  const clientSecret = Deno.env.get('FB_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    console.error('Facebook credentials not configured for token refresh')
    return
  }

  try {
    const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${connection.access_token}`
    
    const response = await fetch(refreshUrl)
    const data = await response.json()
    
    if (data.access_token) {
      const newExpiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000) // Default to 60 days if not provided
      await supabaseAdmin
        .from('social_connections')
        .update({
          access_token: data.access_token,
          expires_at: newExpiresAt.toISOString()
        })
        .eq('id', connection.id)
      
      console.log('Token refreshed successfully for connection:', connection.id)
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
  }
}
