export const options = { verifyJwt: false };   // TEMP disable JWT verification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
}

interface PublishTaskRequest {
  taskId: string;
  platforms: string[];
  publishAt?: string; // If provided, schedule; otherwise publish now
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
  mediaUrl?: string
): Promise<string> {
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
    throw new Error(result.error?.message || `Facebook API error: ${response.status}`)
  }
  
  return result.id
}

async function publishToInstagram(
  accountId: string, 
  accessToken: string, 
  caption: string, 
  mediaUrl?: string
): Promise<string> {
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
    // Simplified authentication approach
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('🔐 Simplified Auth Check:', { 
      hasUser: !!user, 
      userId: user?.id,
      authError: authError?.message,
      hasAuthHeader: !!req.headers.get('Authorization'),
      authHeaderPrefix: req.headers.get('Authorization')?.substring(0, 15) + '...'
    })
    
    if (!user || authError) {
      console.error('❌ Authentication failed:', {
        authError: authError?.message,
        authHeader: req.headers.get('Authorization')?.substring(0, 30) + '...',
        allHeaders: Object.fromEntries(req.headers.entries())
      })
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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

          if (normalizedPlatform === 'facebook') {
            publishedId = await publishToFacebook(
              connection.page_id || connection.platform_account_id,
              connection.access_token,
              task.ai_output || '',
              task.image_url
            )
          } else if (normalizedPlatform === 'instagram') {
            publishedId = await publishToInstagram(
              connection.platform_account_id,
              connection.access_token,
              task.ai_output || '',
              task.image_url
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

          // Create a record in scheduled_posts for tracking
          await supabaseAdmin
            .from('scheduled_posts')
            .insert({
              content_id: task.id,
              user_id: user.id,
              platform: platform.toUpperCase(),
              publish_at: new Date().toISOString(),
              status: 'PUBLISHED',
              published_id: publishedId
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

          // Create error record in scheduled_posts for tracking
          await supabaseAdmin
            .from('scheduled_posts')
            .insert({
              content_id: task.id,
              user_id: user.id,
              platform: platform.toUpperCase(),
              publish_at: new Date().toISOString(),
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