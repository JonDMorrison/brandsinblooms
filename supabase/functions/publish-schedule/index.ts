
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduleRequest {
  contentId: string;
  caption: string;
  mediaUrl?: string;
  platforms: string[];
  publishAt: string;
}

serve(async (req) => {
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

    const body: ScheduleRequest = await req.json()
    
    // Validate input
    if (!body.contentId || !body.caption || !body.platforms?.length || !body.publishAt) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.caption.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Caption too long (max 2000 characters)' }),
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

    // Verify social connections for platforms
    for (const platform of body.platforms) {
      const { data: connection, error: connectionError } = await supabaseClient
        .from('social_connections')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .eq('platform', platform.toLowerCase())
        .eq('is_active', true)
        .single()

      if (connectionError || !connection) {
        return new Response(
          JSON.stringify({ error: `No active connection for ${platform}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check token expiration
      if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: `Token expired for ${platform}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create scheduled posts
    const scheduledPosts = body.platforms.map(platform => ({
      content_id: body.contentId,
      user_id: user.id,
      platform: platform.toUpperCase(),
      publish_at: body.publishAt,
      status: 'QUEUED'
    }))

    const { error: insertError } = await supabaseClient
      .from('scheduled_posts')
      .insert(scheduledPosts)

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to schedule posts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update content status
    await supabaseClient
      .from('generated_content')
      .update({ status: 'SCHEDULED' })
      .eq('id', body.contentId)

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error scheduling posts:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
