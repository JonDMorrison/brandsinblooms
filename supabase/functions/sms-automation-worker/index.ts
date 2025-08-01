import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutomationStep {
  step: number
  delay_hours: number
  message: string
}

function personalizeMessage(template: string, customer: any): string {
  return template
    .replace(/\{\{first_name\}\}/g, customer.first_name || '')
    .replace(/\{\{last_name\}\}/g, customer.last_name || '')
    .replace(/\{\{email\}\}/g, customer.email || '')
    .replace(/\{\{phone\}\}/g, customer.phone || '')
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('SMS Automation Worker starting...')

    // Get all active SMS automations
    const { data: automations, error: automationError } = await supabase
      .from('sms_automations')
      .select('*')
      .eq('status', 'active')

    if (automationError) {
      console.error('Error fetching automations:', automationError)
      throw automationError
    }

    console.log(`Found ${automations?.length || 0} active SMS automations`)

    let totalProcessed = 0
    let totalScheduled = 0

    for (const automation of automations || []) {
      try {
        const flow = automation.flow as AutomationStep[]
        
        // Get customers who should receive messages for this automation
        let customersQuery = supabase
          .from('crm_customers')
          .select('*')
          .eq('tenant_id', automation.tenant_id)
          .eq('sms_opt_in', true)

        // Apply trigger-specific filters
        if (automation.trigger_type === 'signup') {
          // For signup triggers, look for recent customers
          const hoursAgo = automation.trigger_config?.hours_after_signup || 24
          const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
          customersQuery = customersQuery.gte('created_at', cutoffTime)
        }

        const { data: customers, error: customerError } = await customersQuery

        if (customerError) {
          console.error(`Error fetching customers for automation ${automation.id}:`, customerError)
          continue
        }

        console.log(`Processing ${customers?.length || 0} customers for automation: ${automation.name}`)

        // Process each customer
        for (const customer of customers || []) {
          // Check existing automation logs for this customer
          const { data: existingLogs } = await supabase
            .from('sms_automation_logs')
            .select('step_number, status, scheduled_at')
            .eq('automation_id', automation.id)
            .eq('customer_id', customer.id)
            .order('step_number', { ascending: false })

          const completedSteps = existingLogs?.filter(log => log.status === 'sent') || []
          const lastCompletedStep = completedSteps.length > 0 ? completedSteps[0].step_number : 0
          const nextStep = lastCompletedStep + 1

          // Find the next step in the flow
          const nextFlowStep = flow.find(step => step.step === nextStep)
          if (!nextFlowStep) {
            // Customer has completed all steps
            continue
          }

          // Check if this step is already scheduled
          const existingLog = existingLogs?.find(log => 
            log.step_number === nextStep && 
            ['scheduled', 'sent'].includes(log.status)
          )
          
          if (existingLog) {
            // Step already scheduled or sent
            continue
          }

          // Calculate when this step should be sent
          let scheduledAt: Date
          if (nextStep === 1) {
            // First step - schedule based on trigger
            if (automation.trigger_type === 'signup') {
              scheduledAt = new Date(new Date(customer.created_at).getTime() + nextFlowStep.delay_hours * 60 * 60 * 1000)
            } else {
              scheduledAt = new Date(Date.now() + nextFlowStep.delay_hours * 60 * 60 * 1000)
            }
          } else {
            // Subsequent steps - schedule based on previous step
            const previousLog = existingLogs?.find(log => log.step_number === lastCompletedStep)
            if (!previousLog?.scheduled_at) continue
            
            scheduledAt = new Date(new Date(previousLog.scheduled_at).getTime() + nextFlowStep.delay_hours * 60 * 60 * 1000)
          }

          // Only schedule if it's time to send (within next hour)
          const now = new Date()
          const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
          
          if (scheduledAt <= oneHourFromNow) {
            // Create the SMS message
            const personalizedMessage = personalizeMessage(nextFlowStep.message, customer)
            
            const { data: smsMessage, error: smsError } = await supabase
              .from('sms_messages')
              .insert({
                customer_id: customer.id,
                phone: customer.phone,
                content: personalizedMessage,
                status: 'queued',
                scheduled_at: scheduledAt.toISOString()
              })
              .select()
              .single()

            if (smsError) {
              console.error(`Error creating SMS message for customer ${customer.id}:`, smsError)
              continue
            }

            // Log the automation step
            await supabase
              .from('sms_automation_logs')
              .insert({
                automation_id: automation.id,
                customer_id: customer.id,
                step_number: nextStep,
                message_id: smsMessage.id,
                status: 'scheduled',
                scheduled_at: scheduledAt.toISOString()
              })

            totalScheduled++
            console.log(`Scheduled SMS automation step ${nextStep} for customer ${customer.id}`)
          }

          totalProcessed++
        }

      } catch (error) {
        console.error(`Error processing automation ${automation.id}:`, error)
      }
    }

    console.log(`SMS Automation Worker completed. Processed: ${totalProcessed}, Scheduled: ${totalScheduled}`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        scheduled: totalScheduled,
        message: `Processed ${totalProcessed} automation entries, scheduled ${totalScheduled} messages`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('SMS Automation Worker error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})