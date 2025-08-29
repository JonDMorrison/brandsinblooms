import * as Sentry from "https://esm.sh/@sentry/deno@8.55.0";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Test error endpoint for Sentry verification
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    throw new Error('Test error from send-sms edge function - Sentry should capture this!');
  }

  try {
    const { to, body, mediaUrl, mediaUrls } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message body are required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Sending SMS to ${to}: ${body.substring(0, 50)}...`);

    // Initialize Supabase client for logging
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Prepare form data
    const formData = new FormData();
    formData.append('To', to);
    formData.append('From', twilioPhoneNumber);
    formData.append('Body', body);

    // Add media URLs if provided (for MMS)
    const allMediaUrls = [];
    if (mediaUrl) allMediaUrls.push(mediaUrl);
    if (mediaUrls && Array.isArray(mediaUrls)) allMediaUrls.push(...mediaUrls);
    
    allMediaUrls.forEach(url => {
      formData.append('MediaUrl', url);
    });

    // Send SMS via Twilio
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio API Error:', twilioData);
      return new Response(
        JSON.stringify({
          error: 'Failed to send SMS',
          details: twilioData.message || 'Unknown Twilio error'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('SMS sent successfully:', twilioData.sid);

    // Log the SMS send (optional - for test messages we might not want to log)
    try {
      await supabase.from('sms_messages').insert({
        phone: to,
        content: body,
        status: 'sent',
        twilio_sid: twilioData.sid,
        media_urls: allMediaUrls.length > 0 ? allMediaUrls : null,
        sent_at: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log SMS send:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        sid: twilioData.sid,
        status: twilioData.status,
        message: 'SMS sent successfully'
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in send-sms function:', error);
    Sentry.captureException(error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handler);