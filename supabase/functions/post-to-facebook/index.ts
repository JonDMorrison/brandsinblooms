
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content_task_id, content, platform_post_id } = await req.json()
    
    // Get the content task and connection info from database
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get task and user's Facebook connection
    const { data: task, error: taskError } = await supabaseAdmin
      .from('content_tasks')
      .select(`
        *,
        social_connections!inner(*)
      `)
      .eq('id', content_task_id)
      .eq('social_connections.platform', 'facebook')
      .single()

    if (taskError || !task) {
      throw new Error('Task or Facebook connection not found')
    }

    const connection = task.social_connections
    
    // Refresh token if needed
    await refreshTokenIfNeeded(connection, supabaseAdmin)

    // Post to Facebook
    const formData = new FormData()
    formData.append('message', content)
    formData.append('access_token', connection.access_token)

    const response = await fetch(`https://graph.facebook.com/v19.0/${connection.page_id || connection.platform_account_id}/feed`, {
      method: 'POST',
      body: formData
    })

    const result = await response.json()
    
    if (response.ok && result.id) {
      // Update task with success
      await supabaseAdmin
        .from('content_tasks')
        .update({
          status: 'posted',
          platform_post_id: result.id,
          platform_post_url: `https://facebook.com/${result.id}`,
          last_posting_error: null,
          posting_attempts: (task.posting_attempts || 0) + 1
        })
        .eq('id', content_task_id)
    } else {
      // Update task with error
      const errorMessage = result.error?.message || 'Failed to post to Facebook'
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
