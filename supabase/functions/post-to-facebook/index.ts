
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

    // Post to Facebook
    const formData = new FormData()
    formData.append('message', post.content)
    formData.append('access_token', connection.access_token)
    
    if (post.media_url) {
      formData.append('url', post.media_url)
    }

    const endpoint = post.media_url 
      ? `https://graph.facebook.com/v19.0/${connection.page_id}/photos`
      : `https://graph.facebook.com/v19.0/${connection.page_id}/feed`

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    })

    const result = await response.json()
    
    // Update post status
    const status = response.ok ? 'published' : 'failed'
    await supabaseAdmin
      .from('social_posts')
      .update({
        status,
        api_response: result,
        updated_at: new Date().toISOString()
      })
      .eq('id', post_id)

    return new Response(
      JSON.stringify({ success: response.ok, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error posting to Facebook:', error)
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

  const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${Deno.env.get('FB_CLIENT_ID')}&client_secret=${Deno.env.get('FB_CLIENT_SECRET')}&fb_exchange_token=${connection.access_token}`
  
  const response = await fetch(refreshUrl)
  const data = await response.json()
  
  if (data.access_token) {
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000)
    await supabaseAdmin
      .from('social_connections')
      .update({
        access_token: data.access_token,
        expires_at: newExpiresAt.toISOString()
      })
      .eq('id', connection.id)
  }
}
