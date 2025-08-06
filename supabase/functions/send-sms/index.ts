const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioResponse {
  sid?: string
  status?: string
  error_code?: string
  message?: string
  fallback_used?: boolean
}

async function detectCarrier(phoneNumber: string): Promise<{ supportsMms: boolean }> {
  // Simple carrier detection - in production use a proper service
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, '')
  
  // VoIP and known problematic patterns
  const unsupportedPatterns = [
    /^(\+1)?6[0-9]{9}$/, // Many Google Voice numbers
    /^(\+1)?8[0-9]{9}$/, // Some 8xx VoIP numbers
  ]
  
  for (const pattern of unsupportedPatterns) {
    if (pattern.test(cleanNumber)) {
      return { supportsMms: false }
    }
  }
  
  // International numbers - be conservative
  if (!cleanNumber.startsWith('+1') && cleanNumber.length !== 10) {
    return { supportsMms: false }
  }
  
  // Default: assume MMS support for US numbers
  return { supportsMms: true }
}

async function createFallbackMessage(body: string, mediaUrls: string[]): Promise<string> {
  if (!mediaUrls || mediaUrls.length === 0) return body
  
  const imageText = mediaUrls.length === 1 
    ? 'View image: ' 
    : `View ${mediaUrls.length} images: `
  
  // Simple URL shortening - in production use proper service
  const shortUrl = mediaUrls[0].length > 50 
    ? mediaUrls[0].substring(0, 47) + '...'
    : mediaUrls[0]
  
  return `${body}\n\n${imageText}${shortUrl}`
}

async function sendTwilioSMS(to: string, body: string, mediaUrls?: string[]): Promise<TwilioResponse> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const phoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error('Missing Twilio configuration')
  }

  // Check carrier MMS support and apply fallback if needed
  const carrierInfo = await detectCarrier(to)
  let finalBody = body
  let finalMediaUrls = mediaUrls

  if (mediaUrls && mediaUrls.length > 0 && !carrierInfo.supportsMms) {
    console.log(`Carrier doesn't support MMS for ${to}, using fallback`)
    finalBody = await createFallbackMessage(body, mediaUrls)
    finalMediaUrls = [] // Remove media for SMS-only fallback
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  
  const formData = new FormData()
  formData.append('From', phoneNumber)
  formData.append('To', to)
  formData.append('Body', finalBody)
  
  // Support multiple media URLs (up to 3 for MMS) if carrier supports it
  if (finalMediaUrls && finalMediaUrls.length > 0) {
    const validUrls = finalMediaUrls.filter(url => url && url.trim()).slice(0, 3)
    validUrls.forEach(url => {
      formData.append('MediaUrl', url)
    })
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
    },
    body: formData
  })

  const result = await response.json()
  
  if (!response.ok) {
    console.error('Twilio API error:', result)
    return {
      error_code: result.code?.toString() || 'UNKNOWN_ERROR',
      message: result.message || 'Failed to send SMS'
    }
  }

  console.log(`SMS sent successfully to ${to} - SID: ${result.sid}`)
  return {
    sid: result.sid,
    status: result.status,
    fallback_used: finalMediaUrls?.length !== mediaUrls?.length // Indicate if fallback was used
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, body, mediaUrl, mediaUrls, skipOptOutCheck = false } = await req.json()

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, body' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Pre-flight opt-out check (unless explicitly skipped for keyword responses)
    if (!skipOptOutCheck) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const cleanedPhone = to.replace(/^\+?1?/, '').replace(/\D/g, '')
      
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('opt_out, sms_opt_in')
        .eq('phone', cleanedPhone)
        .single()

      if (customer && (customer.opt_out || !customer.sms_opt_in)) {
        return new Response(
          JSON.stringify({ 
            error: 'Message blocked: recipient has opted out',
            error_code: 451,
            details: `Number ${to} is opted out of SMS communications`
          }),
          { 
            status: 451, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    console.log(`Sending SMS to ${to}`)

    // Support both single mediaUrl (legacy) and multiple mediaUrls (new)
    const finalMediaUrls = mediaUrls || (mediaUrl ? [mediaUrl] : [])
    const result = await sendTwilioSMS(to, body, finalMediaUrls)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.error_code ? 400 : 200
      }
    )

  } catch (error) {
    console.error('Send SMS error:', error)
    
    return new Response(
      JSON.stringify({
        error_code: 'INTERNAL_ERROR',
        message: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})