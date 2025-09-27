
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RescheduleRequest {
  scheduledId: string;
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

    const body: RescheduleRequest = await req.json()
    
    // Validate input
    if (!body.scheduledId || !body.publishAt) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify ownership and that post is not already published
    const { data: scheduledPost, error: fetchError } = await supabaseClient
      .from('scheduled_posts')
      .select('id, status, user_id')
      .eq('id', body.scheduledId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !scheduledPost) {
      return new Response(
        JSON.stringify({ error: 'Scheduled post not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (scheduledPost.status === 'PUBLISHED') {
      return new Response(
        JSON.stringify({ error: 'Cannot reschedule published post' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the publish time and reset status if it was in error
    const updates: any = {
      publish_at: body.publishAt,
      updated_at: new Date().toISOString()
    }

    if (scheduledPost.status === 'ERROR') {
      updates.status = 'QUEUED'
      updates.error_message = null
      updates.retry_count = 0
    }

    const { error: updateError } = await supabaseClient
      .from('scheduled_posts')
      .update(updates)
      .eq('id', body.scheduledId)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to reschedule post' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error rescheduling post:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
