import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { action, job_id } = await req.json()

    console.log(`🎮 Migration control: ${action} for job ${job_id}`)

    // Get the job
    const { data: job, error: jobError } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let updates: any = {}
    let logMessage = ''
    let logLevel: 'info' | 'warning' | 'error' = 'info'

    switch (action) {
      case 'pause':
        if (job.status !== 'running') {
          return new Response(JSON.stringify({ error: 'Can only pause running jobs' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        updates = {
          status: 'paused',
          paused_at: new Date().toISOString(),
        }
        logMessage = 'Migration paused by user'
        break

      case 'resume':
        if (job.status !== 'paused') {
          return new Response(JSON.stringify({ error: 'Can only resume paused jobs' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        updates = {
          status: 'running',
          paused_at: null,
        }
        logMessage = 'Migration resumed by user'
        break

      case 'cancel':
        if (!['pending', 'running', 'paused'].includes(job.status)) {
          return new Response(JSON.stringify({ error: 'Cannot cancel completed or failed jobs' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        updates = {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        }
        logMessage = 'Migration cancelled by user'
        logLevel = 'warning'
        break

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Update the job
    const { error: updateError } = await supabase
      .from('migration_jobs')
      .update(updates)
      .eq('id', job_id)

    if (updateError) {
      console.error('Failed to update job:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to update job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Log the action
    await supabase
      .from('migration_job_logs')
      .insert({
        job_id,
        log_level: logLevel,
        message: logMessage,
        details: { action, user_action: true }
      })

    console.log(`✅ Migration ${action} completed for job ${job_id}`)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Migration control error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
