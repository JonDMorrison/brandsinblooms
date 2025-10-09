
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Strip markdown formatting for Instagram (which doesn't render it)
function stripMarkdownForSocial(text: string): string {
  if (!text) return text;
  
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(?<!https?:\/\/[^\s]*)_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content_task_id, content, media_url } = await req.json()
    
    // Get the content task and connection info from database
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get task and user's Instagram connection
    const { data: task, error: taskError } = await supabaseAdmin
      .from('content_tasks')
      .select(`
        *,
        social_connections!inner(*)
      `)
      .eq('id', content_task_id)
      .eq('social_connections.platform', 'instagram')
      .single()

    if (taskError || !task) {
      throw new Error('Task or Instagram connection not found')
    }

    const connection = task.social_connections
    
    // Refresh token if needed
    await refreshTokenIfNeeded(connection, supabaseAdmin)

    let result;
    
    if (media_url) {
      // Create media object first (strip markdown as Instagram doesn't render it)
      const cleanContent = stripMarkdownForSocial(content);
      const mediaResponse = await fetch(`https://graph.facebook.com/v19.0/${connection.platform_account_id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: media_url,
          caption: cleanContent,
          access_token: connection.access_token
        })
      })
      
      const mediaResult = await mediaResponse.json()
      
      if (!mediaResponse.ok || !mediaResult.id) {
        throw new Error(mediaResult.error?.message || 'Failed to create Instagram media')
      }
      
      // Publish the media
      const publishResponse = await fetch(`https://graph.facebook.com/v19.0/${connection.platform_account_id}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: mediaResult.id,
          access_token: connection.access_token
        })
      })
      
      result = await publishResponse.json()
      
      if (!publishResponse.ok) {
        throw new Error(result.error?.message || 'Failed to publish Instagram post')
      }
    } else {
      // Text-only post (Story or Reel - Instagram doesn't support text-only feed posts)
      throw new Error('Instagram requires media for feed posts. Please add an image.')
    }
    
    if (result.id) {
      // Update task with success
      await supabaseAdmin
        .from('content_tasks')
        .update({
          status: 'posted',
          platform_post_id: result.id,
          platform_post_url: `https://instagram.com/p/${result.id}`,
          last_posting_error: null,
          posting_attempts: (task.posting_attempts || 0) + 1
        })
        .eq('id', content_task_id)
    } else {
      // Update task with error
      const errorMessage = result.error?.message || 'Failed to post to Instagram'
      const attempts = (task.posting_attempts || 0) + 1
      
      await supabaseAdmin
        .from('content_tasks')
        .update({
          last_posting_error: errorMessage,
          posting_attempts: attempts,
          posting_disabled_at: attempts >= 3 ? new Date().toISOString() : null
        })
        .eq('id', content_task_id)
      
      throw new Error(errorMessage)
    }

    return new Response(
      JSON.stringify({ success: true, post_id: result.id }),
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
  if (!connection.expires_at) return
  
  const expiresAt = new Date(connection.expires_at)
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  
  if (expiresAt > twoDaysFromNow) {
    return // Token is still valid
  }

  const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${Deno.env.get('FB_CLIENT_ID')}&client_secret=${Deno.env.get('FB_CLIENT_SECRET')}&fb_exchange_token=${connection.access_token}`
  
  const response = await fetch(refreshUrl)
  const data = await response.json()
  
  if (data.access_token) {
    const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000)
    await supabaseAdmin
      .from('social_connections')
      .update({
        access_token: data.access_token,
        expires_at: newExpiresAt.toISOString()
      })
      .eq('id', connection.id)
  }
}
