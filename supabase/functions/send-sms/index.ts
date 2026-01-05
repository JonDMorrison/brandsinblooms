import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { checkSMSAvailability } from "../_shared/channelAvailability.ts";

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, body, mediaUrl, mediaUrls, fromPhone } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message body are required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if SMS channel is available BEFORE attempting to send
    const smsStatus = checkSMSAvailability();
    if (!smsStatus.available) {
      console.log(`📱 SMS not configured: ${smsStatus.reason}`);
      return new Response(
        JSON.stringify({ 
          error: 'SMS_NOT_CONFIGURED',
          skipable: true,
          message: smsStatus.reason || 'Twilio credentials not configured. Step can be skipped.',
          canRetry: false
        }), 
        { 
          status: 200, // Return 200 so caller can handle gracefully
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format phone number to E.164 format
    const formattedTo = formatPhoneForTwilio(to);
    console.log(`Sending SMS to ${to} (formatted: ${formattedTo}): ${body.substring(0, 50)}...`);

    // Initialize Supabase client for logging
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get Twilio credentials (already validated above)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
    const statusCallbackUrl = Deno.env.get('TWILIO_STATUS_CALLBACK_URL');

    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Prepare form data
    const formData = new FormData();
    formData.append('To', formattedTo);
    formData.append('Body', body);

    // PRIORITY: Use MessagingServiceSid for toll-free compliance
    // Only fallback to From number if MessagingServiceSid is not configured
    if (messagingServiceSid) {
      formData.append('MessagingServiceSid', messagingServiceSid);
      console.log(`📱 Using MessagingServiceSid: ${messagingServiceSid}`);
    } else if (twilioPhoneNumber) {
      const selectedFromPhone = fromPhone 
        ? formatPhoneForTwilio(fromPhone) 
        : formatPhoneForTwilio(twilioPhoneNumber);
      formData.append('From', selectedFromPhone);
      console.log(`📱 Using From number: ${selectedFromPhone} (fallback - no MessagingServiceSid)`);
    } else {
      console.error('❌ No MessagingServiceSid or From number configured');
      return new Response(
        JSON.stringify({ 
          error: 'SMS_NOT_CONFIGURED',
          message: 'Neither MessagingServiceSid nor From number is configured',
          skipable: true,
          canRetry: false
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Add status callback if configured
    if (statusCallbackUrl) {
      formData.append('StatusCallback', statusCallbackUrl);
      console.log(`📱 StatusCallback: ${statusCallbackUrl}`);
    }

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
          details: twilioData.message || 'Unknown Twilio error',
          skipable: false,
          canRetry: true
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('SMS sent successfully:', twilioData.sid);
    console.log('Initial Twilio status:', twilioData.status);
    console.log('Twilio error code (if any):', twilioData.error_code);
    console.log('Twilio error message (if any):', twilioData.error_message);

    // Log the SMS send (optional - for test messages we might not want to log)
    try {
      await supabase.from('sms_messages').insert({
        phone: formattedTo,
        content: body,
        status: twilioData.status || 'queued', // Use actual Twilio status
        twilio_sid: twilioData.sid,
        media_urls: allMediaUrls.length > 0 ? allMediaUrls : null,
        sent_at: new Date().toISOString(),
        error_message: twilioData.error_message || null
      });
    } catch (logError) {
      console.warn('Failed to log SMS send:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        sid: twilioData.sid,
        status: twilioData.status,
        message: 'SMS sent successfully',
        skipable: false
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in send-sms function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        skipable: false,
        canRetry: true
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handler);
