import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
})