
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const url = new URL(req.url)
    const id = url.pathname.split('/').pop()

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to delete as scheduled post first
    const { data: scheduledPost, error: scheduledError } = await supabaseClient
      .from('scheduled_posts')
      .select('id, status, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (scheduledPost && !scheduledError) {
      if (scheduledPost.status === 'PUBLISHED') {
        // Archive instead of delete for published posts
        const { error: updateError } = await supabaseClient
          .from('scheduled_posts')
          .update({ status: 'ARCHIVED' })
          .eq('id', id)

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to archive post' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        // Delete queued or error posts
        const { error: deleteError } = await supabaseClient
          .from('scheduled_posts')
          .delete()
          .eq('id', id)

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: 'Failed to delete scheduled post' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to delete as generated content
    const { data: content, error: contentError } = await supabaseClient
      .from('generated_content')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (content && !contentError) {
      // Set status to archived instead of hard delete
      const { error: updateError } = await supabaseClient
        .from('generated_content')
        .update({ status: 'ARCHIVED' })
        .eq('id', id)

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to archive content' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Item not found or access denied' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error deleting item:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
