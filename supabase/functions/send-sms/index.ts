const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioResponse {
  sid?: string
  status?: string
  error_code?: string
  message?: string
}

async function sendTwilioSMS(to: string, body: string, mediaUrls?: string[]): Promise<TwilioResponse> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const phoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error('Missing Twilio configuration')
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  
  const formData = new FormData()
  formData.append('From', phoneNumber)
  formData.append('To', to)
  formData.append('Body', body)
  
  // Support multiple media URLs (up to 3 for MMS)
  if (mediaUrls && mediaUrls.length > 0) {
    const validUrls = mediaUrls.filter(url => url && url.trim()).slice(0, 3)
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

  return {
    sid: result.sid,
    status: result.status
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, body, mediaUrl, mediaUrls } = await req.json()

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, body' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
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