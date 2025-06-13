
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Calculate the date 2 weeks ago
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    console.log('Cleaning up content approved before:', twoWeeksAgo.toISOString())

    // Delete content that was approved more than 2 weeks ago
    const { data: deletedTasks, error } = await supabaseClient
      .from('content_tasks')
      .delete()
      .eq('status', 'completed')
      .lt('updated_at', twoWeeksAgo.toISOString())
      .select('id, post_type')

    if (error) {
      console.error('Error cleaning up old content:', error)
      throw error
    }

    const deletedCount = deletedTasks?.length || 0
    console.log(`Successfully deleted ${deletedCount} old content items`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        message: `Cleaned up ${deletedCount} content items older than 2 weeks`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Cleanup function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
