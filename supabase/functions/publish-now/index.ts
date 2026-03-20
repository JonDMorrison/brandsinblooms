import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

// FIX: [SM4] - Use configurable Facebook Graph API version instead of hardcoded value
const GRAPH_API_VERSION = Deno.env.get('FACEBOOK_GRAPH_API_VERSION') || 'v21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PublishNowRequest {
  contentId: string;
  caption: string;
  mediaUrl?: string;
  platforms: string[];
}

async function publishToFacebook(pageId: string, accessToken: string, caption: string, mediaUrl?: string) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`
  const formData = new FormData()
  formData.append('message', caption)
  formData.append('access_token', accessToken)
  
  if (mediaUrl) {
    formData.append('link', mediaUrl)
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  })

  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error?.message || 'Facebook API error')
  }
  
  return result.id
}

async function publishToInstagram(accountId: string, accessToken: string, caption: string, mediaUrl?: string) {
  if (!mediaUrl) {
    throw new Error('Instagram posts require media')
  }

  // Create media container
  const createMediaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/media`
  const createResponse = await fetch(createMediaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: mediaUrl,
      caption: caption,
      access_token: accessToken
    })
  })

  const createResult = await createResponse.json()
  
  if (!createResponse.ok || !createResult.id) {
    console.warn('Instagram media container creation failed', { 
      accountId,
      mediaUrl,
      error: createResult.error?.message || 'No container ID returned'
    });
    throw new Error(createResult.error?.message || 'Instagram media creation failed')
  }

  // Publish media
  const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/media_publish`
  const publishResponse = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: createResult.id,
      access_token: accessToken
    })
  })

  const publishResult = await publishResponse.json()
  
  if (!publishResponse.ok) {
    throw new Error(publishResult.error?.message || 'Instagram publish failed')
  }
  
  return publishResult.id
}

async function handler(req: Request): Promise<Response> {
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

    const body: PublishNowRequest = await req.json()
    
    // Validate input
    if (!body.contentId || !body.caption || !body.platforms?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify content ownership
    const { data: content, error: contentError } = await supabaseClient
      .from('generated_content')
      .select('id')
      .eq('id', body.contentId)
      .eq('user_id', user.id)
      .single()

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: 'Content not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // FIX: [SM2] - Look up tenant_id for the user and scope social_connections query by tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()
    const tenantId = profile?.tenant_id

    const results = []

    for (const platform of body.platforms) {
      try {
        // Get social connection scoped by tenant_id when available
        const connectionQuery = supabaseClient
          .from('social_connections')
          .select('*')
          .eq('user_id', user.id)
          .eq('platform', platform.toLowerCase())
          .eq('is_active', true)
        if (tenantId) {
          connectionQuery.eq('tenant_id', tenantId)
        }
        const { data: connection, error: connectionError } = await connectionQuery.single()

        if (connectionError || !connection) {
          throw new Error(`No active connection for ${platform}`)
        }

        let publishedId: string

        if (platform.toUpperCase() === 'FB') {
          publishedId = await publishToFacebook(
            connection.page_id || connection.platform_account_id,
            connection.access_token,
            body.caption,
            body.mediaUrl
          )
        } else if (platform.toUpperCase().startsWith('IG_')) {
          publishedId = await publishToInstagram(
            connection.platform_account_id,
            connection.access_token,
            body.caption,
            body.mediaUrl
          )
        } else {
          throw new Error(`Unsupported platform: ${platform}`)
        }

        // Create scheduled post record with published status
        // FIX: [SH3] - Set mode to MANUAL for direct publishes to prevent cron double-publish
        await supabaseClient
          .from('scheduled_posts')
          .insert({
            content_id: body.contentId,
            user_id: user.id,
            platform: platform.toUpperCase(),
            publish_at: new Date().toISOString(),
            status: 'PUBLISHED',
            published_id: publishedId,
            mode: 'MANUAL'
          })

        results.push({ platform, success: true, publishedId })

      } catch (error) {
        console.error(`Error publishing to ${platform}:`, error)
        
        // Create scheduled post record with error status
        // FIX: [SH3] - Set mode to MANUAL for direct publishes to prevent cron double-publish
        await supabaseClient
          .from('scheduled_posts')
          .insert({
            content_id: body.contentId,
            user_id: user.id,
            platform: platform.toUpperCase(),
            publish_at: new Date().toISOString(),
            status: 'ERROR',
            error_message: error.message,
            mode: 'MANUAL'
          })

        results.push({ platform, success: false, error: error.message })
      }
    }

    // Update content status if any posts were successful
    const hasSuccess = results.some(r => r.success)
    if (hasSuccess) {
      await supabaseClient
        .from('generated_content')
        .update({ status: 'PUBLISHED' })
        .eq('id', body.contentId)
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error publishing now:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

Deno.serve(handler);
