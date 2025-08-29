
import * as Sentry from "https://deno.land/x/sentry/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.38.0'

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function refreshTokenIfNeeded(connection: any) {
  if (!connection.expires_at) return connection.access_token
  
  const expiresAt = new Date(connection.expires_at)
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  
  if (expiresAt > sevenDaysFromNow) {
    return connection.access_token
  }

  console.log(`Refreshing token for connection ${connection.id}`)
  
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
    
    return data.access_token
  }
  
  throw new Error('Failed to refresh token')
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

async function publishToInstagram(accountId: string, accessToken: string, caption: string, mediaUrl?: string, isReel = false) {
  if (!mediaUrl) {
    throw new Error('Instagram posts require media')
  }

  // Create media container
  const createMediaUrl = `https://graph.facebook.com/v19.0/${accountId}/media`
  const mediaParams: any = {
    caption: caption,
    access_token: accessToken
  }

  if (isReel) {
    mediaParams.media_type = 'REELS'
    mediaParams.video_url = mediaUrl
  } else {
    mediaParams.image_url = mediaUrl
  }

  const createResponse = await fetch(createMediaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mediaParams)
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
  // Test error endpoint for Sentry verification  
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    throw new Error('Test error from queue-worker edge function - Sentry should capture this!');
  }

  try {
    console.log('Queue worker starting...')
    
    // Get posts that are ready to publish - ONLY AUTO mode posts
    const { data: scheduledPosts, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select(`
        id,
        content_id,
        user_id,
        platform,
        publish_at,
        retry_count,
        mode,
        generated_content!inner (
          caption,
          media_url
        )
      `)
      .eq('status', 'QUEUED')
      .eq('mode', 'AUTO')  // Only process AUTO mode posts
      .lte('publish_at', new Date().toISOString())
      .lt('retry_count', 3)
      .limit(20)

    if (fetchError) {
      console.error('Error fetching scheduled posts:', fetchError)
      return new Response('Error fetching posts', { status: 500 })
    }

    console.log(`Found ${scheduledPosts?.length || 0} AUTO mode posts to process`)

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response('No AUTO mode posts to process', { status: 200 })
    }

    for (const post of scheduledPosts) {
      try {
        console.log(`Processing AUTO mode post ${post.id} for platform ${post.platform}`)
        
        // Get social connection
        const { data: connection, error: connectionError } = await supabaseAdmin
          .from('social_connections')
          .select('*')
          .eq('user_id', post.user_id)
          .eq('platform', post.platform.toLowerCase())
          .eq('is_active', true)
          .single()

        if (connectionError || !connection) {
          throw new Error(`No active connection for ${post.platform}`)
        }

        // Refresh token if needed
        const accessToken = await refreshTokenIfNeeded(connection)
        
        const content = post.generated_content
        let publishedId: string

        if (post.platform === 'FB') {
          publishedId = await publishToFacebook(
            connection.page_id || connection.platform_account_id,
            accessToken,
            content.caption,
            content.media_url
          )
        } else if (post.platform === 'IG_FEED') {
          publishedId = await publishToInstagram(
            connection.platform_account_id,
            accessToken,
            content.caption,
            content.media_url,
            false
          )
        } else if (post.platform === 'IG_REEL') {
          publishedId = await publishToInstagram(
            connection.platform_account_id,
            accessToken,
            content.caption,
            content.media_url,
            true
          )
        } else {
          throw new Error(`Unsupported platform: ${post.platform}`)
        }

        // Update post as published
        await supabaseAdmin
          .from('scheduled_posts')
          .update({
            status: 'PUBLISHED',
            published_id: publishedId,
            error_message: null
          })
          .eq('id', post.id)

        // Update content status
        await supabaseAdmin
          .from('generated_content')
          .update({ status: 'PUBLISHED' })
          .eq('id', post.content_id)

        console.log(`Successfully published AUTO mode post ${post.id} with ID ${publishedId}`)

      } catch (error) {
        console.error(`Error processing AUTO mode post ${post.id}:`, error)
        
        const retryCount = (post.retry_count || 0) + 1
        const isMaxRetries = retryCount >= 3
        
        await supabaseAdmin
          .from('scheduled_posts')
          .update({
            status: isMaxRetries ? 'ERROR' : 'QUEUED',
            error_message: error.message,
            retry_count: retryCount
          })
          .eq('id', post.id)
      }
    }

    return new Response(`Processed ${scheduledPosts.length} AUTO mode posts`, { status: 200 })

  } catch (error) {
    console.error('Queue worker error:', error)
    Sentry.captureException(error);
    return new Response('Worker error', { status: 500 })
  }
}

Deno.serve(handler);
