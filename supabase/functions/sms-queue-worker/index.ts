import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts'

interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

/**
 * Format phone number to E.164 format for Twilio
 * Handles US/Canada phone numbers by adding +1 country code
 */
function formatPhoneForTwilio(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If already has country code (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // If 10 digit US/Canada number
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If original phone starts with + and has valid length, return as-is
  if (phone.startsWith('+') && cleaned.length >= 10) {
    return phone;
  }
  
  // Default: assume US/Canada and prepend +1
  return `+1${cleaned}`;
}

async function sendSMS(config: TwilioConfig, to: string, body: string, mediaUrl?: string, fromPhone?: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`
  
  // Select from phone: custom fromPhone or default config
  const selectedFromPhone = fromPhone 
    ? formatPhoneForTwilio(fromPhone) 
    : formatPhoneForTwilio(config.phoneNumber);
  
  const formData = new FormData()
  formData.append('From', selectedFromPhone)
  formData.append('To', to)
  formData.append('Body', body)
  if (mediaUrl) {
    formData.append('MediaUrl', mediaUrl)
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${config.accountSid}:${config.authToken}`)
    },
    body: formData
  })

  return response.json()
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('SMS Queue Worker starting...')

    // Get Twilio configuration
    const twilioConfig: TwilioConfig = {
      accountSid: Deno.env.get('TWILIO_ACCOUNT_SID') ?? '',
      authToken: Deno.env.get('TWILIO_AUTH_TOKEN') ?? '',
      phoneNumber: Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''
    }

    if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.phoneNumber) {
      throw new Error('Missing Twilio configuration')
    }

    // Get queued SMS messages that are ready to send
    const { data: queuedMessages, error: fetchError } = await supabase
      .from('sms_messages')
      .select('id, phone, content, media_url, from_phone, campaign_id, customer_id, scheduled_at, status')
      .eq('status', 'queued')
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .limit(50) // Process in batches

    if (fetchError) {
      console.error('Error fetching queued messages:', fetchError)
      throw fetchError
    }

    console.log(`Found ${queuedMessages?.length || 0} queued SMS messages to process`)

    let processed = 0
    let sent = 0
    let failed = 0

    for (const message of queuedMessages || []) {
      try {
        // Format phone number to E.164 format
        const formattedPhone = formatPhoneForTwilio(message.phone);
        console.log(`Processing SMS to ${message.phone} (formatted: ${formattedPhone})`);
        
        // Send SMS via Twilio
        const result = await sendSMS(
          twilioConfig,
          formattedPhone,
          message.content,
          message.media_url,
          message.from_phone // Pass the from_phone from message
        )

        if (result.error_code) {
          // Failed to send
          await supabase
            .from('sms_messages')
            .update({
              status: 'failed',
              error_message: result.message || 'Unknown Twilio error',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id)
          
          failed++
          console.error(`Failed to send SMS ${message.id}:`, result.message)
        } else {
          // Successfully sent
          await supabase
            .from('sms_messages')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              twilio_sid: result.sid,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id)
          
          sent++
          console.log(`SMS ${message.id} sent successfully with SID: ${result.sid}`)
        }

        processed++
      } catch (error) {
        console.error(`Error processing SMS ${message.id}:`, error)
        
        // Mark as failed
        await supabase
          .from('sms_messages')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id)
        
        failed++
        processed++
      }
    }

    console.log(`SMS Queue Worker completed. Processed: ${processed}, Sent: ${sent}, Failed: ${failed}`)

    return corsJsonResponse({
      success: true,
      processed,
      sent,
      failed,
      message: `Processed ${processed} SMS messages`
    })

  } catch (error) {
    console.error('SMS Queue Worker error:', error)
    
    return corsJsonResponse({
      success: false,
      error: error.message
    }, { status: 500 })
  }
})