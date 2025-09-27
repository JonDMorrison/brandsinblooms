
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Authentication required')
    }

    // Get user's scheduling preferences
    const { data: preferences, error: prefError } = await supabaseClient
      .from('scheduling_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)

    if (prefError) throw prefError

    if (!preferences || preferences.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No scheduling preferences found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get ready-to-post content
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('content_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .is('scheduled_date', null)
      .limit(10)

    if (tasksError) throw tasksError

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No ready content found to schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const scheduledTasks = []

    // Schedule tasks based on preferences
    for (const preference of preferences) {
      const platformTasks = tasks.filter(task => 
        task.post_type === preference.platform && !task.scheduled_date
      )

      for (let i = 0; i < Math.min(platformTasks.length, 5); i++) {
        const task = platformTasks[i]
        const scheduledDate = calculateOptimalScheduleTime(preference, i)

        const { error: updateError } = await supabaseClient
          .from('content_tasks')
          .update({ 
            scheduled_date: scheduledDate.toISOString(),
            status: 'scheduled'
          })
          .eq('id', task.id)

        if (!updateError) {
          scheduledTasks.push({
            id: task.id,
            platform: preference.platform,
            scheduled_date: scheduledDate.toISOString()
          })
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        scheduled_count: scheduledTasks.length,
        scheduled_tasks: scheduledTasks
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error scheduling posts:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function calculateOptimalScheduleTime(preference: any, index: number): Date {
  const now = new Date()
  const optimalTimes = preference.optimal_times || ['12:00', '18:00']
  const frequency = preference.frequency || 'daily'

  // Calculate days offset based on frequency
  let daysOffset = 0
  switch (frequency) {
    case 'daily':
      daysOffset = index
      break
    case 'every_other_day':
      daysOffset = index * 2
      break
    case 'weekly':
      daysOffset = index * 7
      break
    case 'bi_weekly':
      daysOffset = index * 14
      break
  }

  // Get random optimal time
  const randomTime = optimalTimes[Math.floor(Math.random() * optimalTimes.length)]
  const [hours, minutes] = randomTime.split(':').map(Number)

  const scheduledDate = new Date(now)
  scheduledDate.setDate(scheduledDate.getDate() + daysOffset)
  scheduledDate.setHours(hours, minutes, 0, 0)

  // Ensure we don't schedule in the past
  if (scheduledDate <= now) {
    scheduledDate.setDate(scheduledDate.getDate() + 1)
  }

  return scheduledDate
}
