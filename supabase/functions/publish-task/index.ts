import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface PublishTaskRequest {
  taskId: string;
  platforms: string[];
  publishAt?: string; // If provided, schedule; otherwise publish now
  keyword?: string; // Keyword for Unsplash image search
  imageUrl?: string; // Direct image URL to use
  autoImage?: boolean; // Whether to automatically fetch Unsplash image
}

interface PublishResult {
  platform: string;
  success: boolean;
  publishedId?: string;
  error?: string;
}

async function publishToFacebook(
  pageId: string, 
  accessToken: string, 
  caption: string, 
  mediaUrl?: string,
  attribution?: string
): Promise<string> {
  const finalCaption = attribution ? `${caption}\n\n${attribution}` : caption;
  
  if (mediaUrl) {
    // First upload the image
    const uploadUrl = `https://graph.facebook.com/v19.0/${pageId}/photos`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: mediaUrl,
        published: false, // Don't publish yet, just upload
        access_token: accessToken
      })
    });

    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      throw new Error(uploadResult.error?.message || `Facebook image upload error: ${uploadResponse.status}`);
    }

    // Now create the post with the uploaded image
    const postUrl = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    const postResponse = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: finalCaption,
        attached_media: [{ media_fbid: uploadResult.id }],
        access_token: accessToken
      })
    });

    const postResult = await postResponse.json();
    
    if (!postResponse.ok) {
      throw new Error(postResult.error?.message || `Facebook post error: ${postResponse.status}`);
    }
    
    return postResult.id;
  } else {
    // Text-only post
    const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: finalCaption,
        access_token: accessToken
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error?.message || `Facebook API error: ${response.status}`);
    }
    
    return result.id;
  }
}

async function getUnsplashImage(query: string): Promise<{ url: string; author_name: string } | null> {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?per_page=1&orientation=squarish&query=${encodeURIComponent(query)}`,
      { 
        headers: { 
          Authorization: `Client-ID ${Deno.env.get('UNSPLASH_ACCESS_KEY')}` 
        } 
      }
    );
    
    if (!response.ok) {
      console.error('[UNSPLASH] API error:', response.status, response.statusText);
      return null;
    }
    
    const json = await response.json();
    const image = json.results?.[0];
    
    if (!image?.urls?.regular) {
      console.warn('[UNSPLASH] No image found for query:', query);
      return null;
    }
    
    return {
      url: image.urls.regular,
      author_name: image.user?.name || 'Unknown'
    };
  } catch (error) {
    console.error('[UNSPLASH] Exception:', error);
    return null;
  }
}

async function publishToInstagram(
  accountId: string, 
  accessToken: string, 
  caption: string, 
  mediaUrl?: string,
  attribution?: string
): Promise<string> {
  const finalCaption = attribution ? `${caption}\n\n${attribution}` : caption;
  
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
      caption: finalCaption,
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
    
    // Update the connection object for use in this request
    connection.access_token = data.access_token
    connection.expires_at = newExpiresAt.toISOString()
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract user ID from JWT token (already validated by verify_jwt = true)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decode JWT to get user ID (JWT already validated by infrastructure)
    const jwt = authHeader.replace('Bearer ', '')
    let user: { id: string }
    
    try {
      // Simple JWT decode to extract user info
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      user = { id: payload.sub }
      
      console.log('🔒 Authentication check:', { 
        hasUser: !!user, 
        userId: user?.id,
        source: 'JWT decode'
      })
    } catch (jwtError) {
      console.error('❌ JWT decode failed:', jwtError)
      return new Response(
        JSON.stringify({ error: 'Invalid JWT token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body: PublishTaskRequest = await req.json()
    console.log('📝 Publish task request:', { taskId: body.taskId, platforms: body.platforms, isScheduled: !!body.publishAt })
    
    // Validate input
    if (!body.taskId || !body.platforms?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: taskId and platforms' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the content task with campaign info
    const { data: task, error: taskError } = await supabaseAdmin
      .from('content_tasks')
      .select(`
        *,
        campaigns (
          title,
          user_id,
          tenant_id
        )
      `)
      .eq('id', body.taskId)
      .single()

    if (taskError || !task) {
      console.error('❌ Task not found:', taskError)
      return new Response(
        JSON.stringify({ error: 'Content task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify ownership
    const isOwner = task.campaigns?.user_id === user.id || 
                   task.user_id === user.id || 
                   (task.campaigns?.tenant_id && task.tenant_id)

    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if task is approved
    if (task.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Content must be approved before publishing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: PublishResult[] = []
    let hasScheduled = false

    // If publishAt is provided, create scheduled posts instead of publishing immediately
    if (body.publishAt) {
      console.log('📅 Scheduling posts for:', body.publishAt)
      
      for (const platform of body.platforms) {
        try {
          // Verify social connection exists
          const { data: connection, error: connectionError } = await supabaseAdmin
            .from('social_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', platform.toLowerCase())
            .eq('is_active', true)
            .single()

          if (connectionError || !connection) {
            throw new Error(`No active connection for ${platform}`)
          }

          // Create scheduled post record
          const { error: scheduleError } = await supabaseAdmin
            .from('scheduled_posts')
            .insert({
              content_id: task.id, // Using task ID as content_id
              user_id: user.id,
              platform: platform.toUpperCase(),
              publish_at: body.publishAt,
              status: 'QUEUED'
            })

          if (scheduleError) {
            throw new Error(`Failed to schedule for ${platform}: ${scheduleError.message}`)
          }

          results.push({ platform, success: true })
          hasScheduled = true

        } catch (error) {
          console.error(`❌ Error scheduling ${platform}:`, error)
          results.push({ platform, success: false, error: error.message })
        }
      }

      // Update task status if any posts were scheduled
      if (hasScheduled) {
        await supabaseAdmin
          .from('content_tasks')
          .update({ status: 'scheduled' })
          .eq('id', body.taskId)
      }

    } else {
      // Publish immediately
      console.log('🚀 Publishing immediately to platforms:', body.platforms)
      
      for (const platform of body.platforms) {
        try {
          // Get social connection - normalize platform name
          const normalizedPlatform = platform.toLowerCase().replace('_feed', '').replace('_reel', '')
          console.log(`🔍 Looking for ${normalizedPlatform} connection for user ${user.id}`)
          
          const { data: connection, error: connectionError } = await supabaseAdmin
            .from('social_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', normalizedPlatform)
            .eq('is_active', true)
            .single()

          console.log(`🔍 Connection query result:`, { connection, connectionError })

          if (connectionError || !connection) {
            throw new Error(`No active connection for ${platform} (normalized: ${normalizedPlatform})`)
          }

          // Refresh token if needed
          await refreshTokenIfNeeded(connection, supabaseAdmin)

          let publishedId: string
          let imageUrl: string | undefined
          let attribution: string | undefined

          // Determine image source - priority: direct URL > existing attachment > auto-fetch from Unsplash
          if (body.imageUrl) {
            // Direct image URL provided
            imageUrl = body.imageUrl
          } else if (task.attachments?.image) {
            // Use existing image attachment
            const imageAttachment = task.attachments.image
            imageUrl = imageAttachment.url
            
            // Create attribution text
            if (imageAttachment.source === 'unsplash' && imageAttachment.author_name) {
              attribution = `📸 Photo by ${imageAttachment.author_name} on Unsplash`
            }
          } else if (body.autoImage !== false) {
            // Auto-fetch from Unsplash if no image provided and auto-fetch not disabled
            const searchKeyword = body.keyword || task.ai_output?.split(' ').slice(0, 3).join(' ') || task.campaigns?.title || 'garden plants';
            console.log(`[UNSPLASH] Auto-fetching image for keyword: "${searchKeyword}"`);
            
            const unsplashResult = await getUnsplashImage(searchKeyword);
            if (unsplashResult) {
              imageUrl = unsplashResult.url;
              attribution = `📸 Photo by ${unsplashResult.author_name} on Unsplash`;
              console.log(`[UNSPLASH] ✅ Found image: ${imageUrl}`);
              
              // Update task with the auto-fetched image for future reference
              await supabaseAdmin
                .from('content_tasks')
                .update({
                  attachments: {
                    image: {
                      url: imageUrl,
                      thumb: imageUrl, // Use same URL for thumb
                      alt: searchKeyword,
                      author_name: unsplashResult.author_name,
                      source: 'unsplash',
                      unsplash_id: 'auto-fetched'
                    }
                  }
                })
                .eq('id', body.taskId);
            } else {
              console.warn(`[UNSPLASH] ❌ No image found for keyword: "${searchKeyword}"`);
            }
          }

          // Validate image requirement for Instagram
          if (normalizedPlatform === 'instagram' && !imageUrl) {
            throw new Error('Instagram posts require an image. Either provide an imageUrl, enable autoImage, or attach an image to the task.')
          }

          if (normalizedPlatform === 'facebook') {
            publishedId = await publishToFacebook(
              connection.page_id || connection.platform_account_id,
              connection.access_token,
              task.ai_output || '',
              imageUrl,
              attribution
            )
          } else if (normalizedPlatform === 'instagram') {
            publishedId = await publishToInstagram(
              connection.platform_account_id,
              connection.access_token,
              task.ai_output || '',
              imageUrl,
              attribution
            )
          } else {
            throw new Error(`Unsupported platform: ${platform}`)
          }

          // Update task with success
          await supabaseAdmin
            .from('content_tasks')
            .update({
              status: 'published',
              platform_post_id: publishedId,
              platform_post_url: normalizedPlatform === 'facebook' 
                ? `https://facebook.com/${publishedId}`
                : `https://instagram.com/p/${publishedId}`,
              last_posting_error: null,
              posting_attempts: (task.posting_attempts || 0) + 1
            })
            .eq('id', body.taskId)

          // Create a record in social_posts for tracking with platform post IDs
          await supabaseAdmin
            .from('social_posts')
            .insert({
              content_id: task.id,
              user_id: user.id,
              social_connection_id: connection.id,
              platform: platform.toUpperCase(),
              published_at: new Date().toISOString(),
              platform_post_id: publishedId,
              platform_post_url: normalizedPlatform === 'facebook' 
                ? `https://facebook.com/${publishedId}`
                : `https://instagram.com/p/${publishedId}`,
              content: task.ai_output || '',
              image_url: imageUrl,
              status: 'PUBLISHED'
            })

          results.push({ platform, success: true, publishedId })
          console.log(`✅ Successfully published to ${platform}: ${publishedId}`)

        } catch (error) {
          console.error(`❌ Error publishing to ${platform}:`, error)
          
          // Update task with error
          const attempts = (task.posting_attempts || 0) + 1
          await supabaseAdmin
            .from('content_tasks')
            .update({
              last_posting_error: error.message,
              posting_attempts: attempts,
              posting_disabled_at: attempts >= 3 ? new Date().toISOString() : null
            })
            .eq('id', body.taskId)

          // Create error record in social_posts for tracking
          await supabaseAdmin
            .from('social_posts')
            .insert({
              content_id: task.id,
              user_id: user.id,
              social_connection_id: connection.id,
              platform: platform.toUpperCase(),
              published_at: new Date().toISOString(),
              content: task.ai_output || '',
              status: 'ERROR',
              error_message: error.message
            })

          results.push({ platform, success: false, error: error.message })
        }
      }
    }

    const successCount = results.filter(r => r.success).length
    const totalCount = results.length

    console.log(`📊 Publish results: ${successCount}/${totalCount} successful`)

    return new Response(
      JSON.stringify({ 
        success: successCount > 0,
        results,
        message: body.publishAt 
          ? `Scheduled ${successCount}/${totalCount} posts`
          : `Published ${successCount}/${totalCount} posts`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Critical error in publish-task:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})