import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioWebhookPayload {
  From: string
  Body: string
  AccountSid: string
  MessageSid: string
  To: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('SMS reply webhook received')
    
    // Parse Twilio webhook payload
    const formData = await req.formData()
    const payload: TwilioWebhookPayload = {
      From: formData.get('From') as string,
      Body: formData.get('Body') as string,
      AccountSid: formData.get('AccountSid') as string,
      MessageSid: formData.get('MessageSid') as string,
      To: formData.get('To') as string,
    }

    console.log('Webhook payload:', payload)

    if (!payload.From || !payload.Body) {
      console.error('Missing required fields in webhook payload')
      return new Response('Missing required fields', { status: 400 })
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Clean phone number (remove +1 country code if present)
    const phoneNumber = payload.From.replace(/^\+1/, '').replace(/\D/g, '')
    const messageBody = payload.Body.trim().toUpperCase()
    
    console.log('Processing SMS from:', phoneNumber, 'Message:', messageBody)

    // Find customer by phone number
    const { data: customer, error: customerError } = await supabase
      .from('crm_customers')
      .select('*')
      .or(`phone.eq.${phoneNumber},phone.eq.+1${phoneNumber},phone.eq.${payload.From}`)
      .single()

    if (customerError) {
      console.error('Customer not found:', customerError)
      return new Response('Customer not found', { status: 404 })
    }

    console.log('Found customer:', customer.id, customer.email)

    // Enhanced keyword detection with TCPA compliance
    const keywords = /^\s*(STOP|UNSTOP|HELP|START|YES|RESUME)\s*$/i;
    let responseMessage = ''
    let activityType = ''
    let newOptInStatus = customer.sms_opt_in
    let eventType = ''

    async function logComplianceEvent(eventType: string, meta?: Record<string, any>) {
      try {
        await supabase
          .from('compliance_logs')
          .insert({
            tenant_id: customer.tenant_id || '00000000-0000-0000-0000-000000000000',
            user_id: customer.user_id || '00000000-0000-0000-0000-000000000000',
            event_type: eventType,
            msisdn: phoneNumber,
            message_content: payload.Body,
            meta: meta || {}
          });
      } catch (error) {
        console.error('Failed to log compliance event:', error);
      }
    }

    if (keywords.test(payload.Body)) {
      if (messageBody === 'STOP' || messageBody === 'UNSTOP') {
        console.log('Opt-out keyword detected')
        
        // Update customer status
        const { error: updateError } = await supabase
          .from('crm_customers')
          .update({ 
            sms_opt_in: false,
            opt_out: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)

        if (updateError) {
          console.error('Error updating customer opt-out status:', updateError)
          return new Response('Database error', { status: 500 })
        }

        newOptInStatus = false
        activityType = 'sms_opt_out'
        eventType = 'opt_out'
        
        // Get company name for personalized message
        const { data: companyProfile } = await supabase
          .from('company_profiles')
          .select('company_name')
          .eq('user_id', customer.user_id)
          .single()

        const companyName = companyProfile?.company_name || 'us'
        responseMessage = `You've been opted out and will no longer receive texts from ${companyName}.`
        
      } else if (messageBody === 'START' || messageBody === 'YES' || messageBody === 'RESUME') {
        console.log('Opt-in keyword detected')
        
        // Update customer status
        const { error: updateError } = await supabase
          .from('crm_customers')
          .update({ 
            sms_opt_in: true,
            opt_out: false,
            sms_opt_in_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)

        if (updateError) {
          console.error('Error updating customer opt-in status:', updateError)
          return new Response('Database error', { status: 500 })
        }

        newOptInStatus = true
        activityType = 'sms_opt_in'
        eventType = 'opt_in'
        
        // Get company name for personalized message
        const { data: companyProfile } = await supabase
          .from('company_profiles')
          .select('company_name')
          .eq('user_id', customer.user_id)
          .single()

        const companyName = companyProfile?.company_name || 'our service'
        responseMessage = `Welcome back! You've been re-subscribed to messages from ${companyName}. Reply STOP to opt out anytime.`
        
      } else if (messageBody === 'HELP') {
        eventType = 'help_request'
        
        // Get compliance settings for help response
        const { data: complianceSettings } = await supabase
          .from('company_profiles')
          .select('compliance_settings')
          .eq('user_id', customer.user_id)
          .single()

        const helpResponse = complianceSettings?.compliance_settings?.help_response || 
          'For support, contact us at support@example.com or call 1-800-XXX-XXXX. Reply STOP to opt out.'
        
        responseMessage = helpResponse
      }

      // Log compliance event
      await logComplianceEvent(eventType, {
        twilio_sid: payload.MessageSid,
        keyword_detected: messageBody,
        response_sent: responseMessage
      });
    }

    // Log the activity in customer timeline
    if (activityType) {
      const { error: timelineError } = await supabase
        .from('customer_timeline')
        .insert({
          customer_id: customer.id,
          activity_type: activityType,
          metadata: {
            phone_number: payload.From,
            message_body: payload.Body,
            message_sid: payload.MessageSid,
            sms_opt_in_status: newOptInStatus
          }
        })

      if (timelineError) {
        console.error('Error logging to customer timeline:', timelineError)
      }
    }

    // Send confirmation SMS if we have a response message
    if (responseMessage) {
      console.log('Sending confirmation SMS:', responseMessage)
      
      const twilioResponse = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + Deno.env.get('TWILIO_ACCOUNT_SID') + '/Messages.json', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(Deno.env.get('TWILIO_ACCOUNT_SID') + ':' + Deno.env.get('TWILIO_AUTH_TOKEN')),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: payload.From,
          From: Deno.env.get('TWILIO_PHONE_NUMBER') || '',
          Body: responseMessage,
        }),
      })

      if (!twilioResponse.ok) {
        const error = await twilioResponse.text()
        console.error('Failed to send confirmation SMS:', error)
        return new Response('Failed to send confirmation', { status: 500 })
      }

      console.log('Confirmation SMS sent successfully')
    }

    // Return TwiML response (required by Twilio)
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
    
    return new Response(twimlResponse, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    })

  } catch (error) {
    console.error('Error processing SMS webhook:', error)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      }
    )
  }
})