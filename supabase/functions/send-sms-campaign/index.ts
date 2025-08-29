import * as Sentry from "https://deno.land/x/sentry@7.114.0/mod.js";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioResponse {
  sid: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Test error endpoint for Sentry verification
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    throw new Error('Test error from send-sms-campaign edge function - Sentry should capture this!');
  }

  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting SMS campaign send for campaign: ${campaignId}`);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_sms_campaigns')
      .select(`
        *,
        crm_segments (
          id,
          name
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!campaign.segment_id) {
      return new Response(
        JSON.stringify({ error: 'Campaign has no segment selected' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get SMS-eligible customers from the segment
    const { data: customers, error: customersError } = await supabase
      .from('crm_customers')
      .select('id, first_name, phone')
      .eq('sms_opt_in', true)
      .not('phone', 'is', null)
      .not('phone', 'eq', '');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customers' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!customers || customers.length === 0) {
      await supabase
        .from('crm_sms_campaigns')
        .update({ 
          status: 'failed',
          metrics: { messages_sent: 0, delivered: 0, failed: 1, opt_outs: 0 }
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ error: 'No SMS-eligible customers found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${customers.length} SMS-eligible customers`);

    // Update campaign status to sending
    await supabase
      .from('crm_sms_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    // Send SMS to each customer
    let messagesSent = 0;
    let delivered = 0;
    let failed = 0;

    for (const customer of customers) {
      try {
        // Clean and validate phone number
        let phone = customer.phone.replace(/\D/g, '');
        if (!phone.startsWith('1') && phone.length === 10) {
          phone = '1' + phone;
        }
        if (!phone.startsWith('+')) {
          phone = '+' + phone;
        }

        console.log(`Sending SMS to customer ${customer.id} at ${phone}`);

        // Prepare message body with personalization
        let messageBody = campaign.message;
        if (customer.first_name) {
          messageBody = `Hi ${customer.first_name}! ${messageBody}`;
        }

        // Prepare Twilio API request
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const formData = new URLSearchParams();
        formData.append('To', phone);
        formData.append('From', twilioPhoneNumber);
        formData.append('Body', messageBody);

        // Add media URL if campaign has an image
        if (campaign.image_url) {
          formData.append('MediaUrl', campaign.image_url);
        }

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        const result: TwilioResponse = await response.json();

        if (response.ok && result.sid) {
          messagesSent++;
          if (result.status === 'queued' || result.status === 'accepted') {
            delivered++;
          }
          console.log(`SMS sent successfully to ${phone}, SID: ${result.sid}`);
        } else {
          failed++;
          console.error(`Failed to send SMS to ${phone}:`, result.error_message);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        failed++;
        console.error(`Error sending SMS to customer ${customer.id}:`, error);
      }
    }

    // Update campaign with final metrics
    const metrics = {
      messages_sent: messagesSent,
      delivered: delivered,
      failed: failed,
      opt_outs: 0 // Will be updated by webhook handlers later
    };

    await supabase
      .from('crm_sms_campaigns')
      .update({ 
        status: 'sent',
        metrics: metrics
      })
      .eq('id', campaignId);

    // Update subscription SMS usage
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('sms_usage, user_id')
      .eq('user_id', campaign.user_id)
      .single();

    if (!subError && subscription) {
      await supabase
        .from('subscriptions')
        .update({ 
          sms_usage: (subscription.sms_usage || 0) + messagesSent
        })
        .eq('user_id', campaign.user_id);

      console.log(`Updated SMS usage for user ${campaign.user_id}: +${messagesSent} messages`);
    }

    console.log(`Campaign ${campaignId} completed. Sent: ${messagesSent}, Delivered: ${delivered}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metrics: metrics,
        message: `SMS campaign sent successfully to ${messagesSent} customers`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-sms-campaign function:', error);
    Sentry.captureException(error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

Deno.serve(handler);