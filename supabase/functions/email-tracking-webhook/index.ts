import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailTrackingEvent {
  campaign_id: string;
  customer_email: string;
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed';
  event_data?: Record<string, any>;
  user_agent?: string;
  ip_address?: string;
}

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject: string;
    tags?: string[];
    headers?: Record<string, string>;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the webhook payload
    const payload: ResendWebhookPayload = await req.json();
    console.log('Received webhook payload:', payload);

    // Extract campaign_id from tags or headers
    const campaignId = payload.data.tags?.find(tag => tag.startsWith('campaign:'))?.replace('campaign:', '') ||
                     payload.data.headers?.['X-Campaign-ID'];

    if (!campaignId) {
      console.log('No campaign ID found in webhook payload');
      return new Response(JSON.stringify({ message: 'No campaign ID found' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, EmailTrackingEvent['event_type']> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': 'delivered', // Still count as delivered
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'unsubscribed' // Treat complaints as unsubscribes
    };

    const eventType = eventTypeMap[payload.type];
    if (!eventType) {
      console.log(`Unknown event type: ${payload.type}`);
      return new Response(JSON.stringify({ message: 'Unknown event type' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get user agent and IP from headers
    const userAgent = req.headers.get('user-agent');
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Insert tracking event
    const trackingEvent: EmailTrackingEvent = {
      campaign_id: campaignId,
      customer_email: payload.data.to[0], // Take first recipient
      event_type: eventType,
      event_data: {
        email_id: payload.data.email_id,
        subject: payload.data.subject,
        timestamp: payload.created_at,
        ...payload.data
      },
      user_agent: userAgent,
      ip_address: ipAddress
    };

    const { error: insertError } = await supabase
      .from('email_tracking_events')
      .insert(trackingEvent);

    if (insertError) {
      console.error('Error inserting tracking event:', insertError);
      throw insertError;
    }

    console.log(`Successfully recorded ${eventType} event for campaign ${campaignId}`);

    // The trigger will automatically update campaign metrics
    return new Response(JSON.stringify({ message: 'Event recorded successfully' }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in email tracking webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to process email tracking event'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);