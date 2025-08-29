
import * as Sentry from "https://deno.land/x/sentry/index.js";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.38.0'

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

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
  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`
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
  const createMediaUrl = `https://graph.facebook.com/v19.0/${accountId}/media`
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
  
  if (!createResponse.ok) {
    throw new Error(createResult.error?.message || 'Instagram media creation failed')
  }

  // Publish media
  const publishUrl = `https://graph.facebook.com/v19.0/${accountId}/media_publish`
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

  // Test error endpoint for Sentry verification
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    throw new Error('Test error from publish-now edge function - Sentry should capture this!');
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

    const results = []

    for (const platform of body.platforms) {
      try {
        // Get social connection
        const { data: connection, error: connectionError } = await supabaseClient
          .from('social_connections')
          .select('*')
          .eq('user_id', user.id)
          .eq('platform', platform.toLowerCase())
          .eq('is_active', true)
          .single()

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
        await supabaseClient
          .from('scheduled_posts')
          .insert({
            content_id: body.contentId,
            user_id: user.id,
            platform: platform.toUpperCase(),
            publish_at: new Date().toISOString(),
            status: 'PUBLISHED',
            published_id: publishedId
          })

        results.push({ platform, success: true, publishedId })

      } catch (error) {
        console.error(`Error publishing to ${platform}:`, error)
        
        // Create scheduled post record with error status
        await supabaseClient
          .from('scheduled_posts')
          .insert({
            content_id: body.contentId,
            user_id: user.id,
            platform: platform.toUpperCase(),
            publish_at: new Date().toISOString(),
            status: 'ERROR',
            error_message: error.message
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
    Sentry.captureException(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

Deno.serve(handler);
