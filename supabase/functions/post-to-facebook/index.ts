
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getFacebookCredentials } from '../_shared/environment.ts'

// FIX: [SM4] - Use configurable Facebook Graph API version instead of hardcoded value
const GRAPH_API_VERSION = Deno.env.get('FACEBOOK_GRAPH_API_VERSION') || 'v21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Strip markdown formatting for Facebook (which doesn't render it)
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

  // SECURITY: E2 - Add JWT authentication to prevent unauthenticated access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const token = authHeader.replace('Bearer ', '');
  const { createClient: createAuthClient } = await import('npm:@supabase/supabase-js@2');
  const supabaseAuth = createAuthClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { content_task_id, content, platform_post_id } = await req.json()

    // Get the content task and connection info from database
    const { createClient } = await import('npm:@supabase/supabase-js@2')
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get task and user's Facebook connection
    // FIX: [SC3] - Add user ownership check to prevent cross-tenant posting
    const { data: task, error: taskError } = await supabaseAdmin
      .from('content_tasks')
      .select(`
        *,
        social_connections!inner(*)
      `)
      .eq('id', content_task_id)
      .eq('user_id', user.id)
      .eq('social_connections.platform', 'facebook')
      .single()

    if (taskError || !task) {
      throw new Error('Task or Facebook connection not found')
    }

    const connection = task.social_connections
    
    // Refresh token if needed
    await refreshTokenIfNeeded(connection, supabaseAdmin)

    // Post to Facebook (strip markdown as Facebook doesn't render it)
    const formData = new FormData()
    formData.append('message', stripMarkdownForSocial(content))
    formData.append('access_token', connection.access_token)

    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${connection.page_id || connection.platform_account_id}/feed`, {
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
  // FIX: [SH2] - Standardize token refresh threshold to 7 days across all paths
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  if (expiresAt > sevenDaysFromNow) {
    return // Token is still valid
  }

  // Use production credentials for token refresh (backend operation)
  const { clientId, clientSecret } = getFacebookCredentials('production')
  const finalClientId = clientId || Deno.env.get('FB_CLIENT_ID')
  const finalClientSecret = clientSecret || Deno.env.get('FB_CLIENT_SECRET')
  
  const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${finalClientId}&client_secret=${finalClientSecret}&fb_exchange_token=${connection.access_token}`
  
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
