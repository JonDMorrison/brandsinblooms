import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, resend-signature, resend-timestamp, traceparent, tracestate",
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
    click?: {
      link: string;
      timestamp: string;
    };
    open?: {
      timestamp: string;
    };
    bounce?: {
      message: string;
    };
  };
}

// Webhook verification for Resend
const verifyWebhookSignature = async (request: Request, body: string): Promise<boolean> => {
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.warn('RESEND_WEBHOOK_SECRET not configured - skipping signature verification');
    return true;
  }

  try {
    const signature = request.headers.get('resend-signature');
    if (!signature) {
      console.error('Missing resend-signature header');
      return false;
    }

    const timestamp = request.headers.get('resend-timestamp');
    if (!timestamp) {
      console.error('Missing resend-timestamp header');
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const timestampInt = parseInt(timestamp);
    const timeDiff = Math.abs(now - timestampInt);
    
    if (timeDiff > 300) {
      console.error(`Webhook timestamp too old: ${timeDiff} seconds`);
      return false;
    }

    const payloadToSign = `${timestamp}.${body}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadToSign));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const expectedSignature = `sha256=${computedSignature}`;
    
    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    
    const isValidSignature = await verifyWebhookSignature(req, rawBody);
    if (!isValidSignature) {
      console.error('Invalid webhook signature - rejecting request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload: ResendWebhookPayload = JSON.parse(rawBody);
    console.log('✅ Verified webhook payload:', {
      type: payload.type,
      email_id: payload.data.email_id,
      recipient: payload.data.to[0],
      timestamp: payload.created_at
    });

    // Extract campaign_id and domain_id from headers or tags
    const campaignId = payload.data.headers?.['X-Campaign-ID'] ||
                      payload.data.tags?.find(tag => tag.startsWith('campaign:'))?.replace('campaign:', '');
    
    const domainId = payload.data.headers?.['X-Domain-ID'] ||
                    payload.data.tags?.find(tag => tag.startsWith('domain:'))?.replace('domain:', '');

    if (!campaignId) {
      console.log('No campaign ID found in webhook payload - skipping analytics tracking');
      return new Response(JSON.stringify({ message: 'No campaign ID found' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, EmailTrackingEvent['event_type']> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': 'delivered',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'unsubscribed'
    };

    const eventType = eventTypeMap[payload.type];
    if (!eventType) {
      console.log(`⚠️ Unknown event type: ${payload.type} - ignoring`);
      return new Response(JSON.stringify({ message: 'Unknown event type' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check for existing event to prevent duplicates
    const { data: existingEvent } = await supabase
      .from('email_tracking_events')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('customer_email', payload.data.to[0])
      .eq('event_type', eventType)
      .eq('event_data->>email_id', payload.data.email_id)
      .single();

    if (existingEvent) {
      console.log(`🔄 Duplicate ${eventType} event detected - skipping`);
      return new Response(JSON.stringify({ message: 'Duplicate event ignored' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userAgent = req.headers.get('user-agent');
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    const eventData: Record<string, any> = {
      email_id: payload.data.email_id,
      subject: payload.data.subject,
      timestamp: payload.created_at,
      from: payload.data.from,
      tags: payload.data.tags || [],
      domain_id: domainId
    };

    if (eventType === 'clicked' && payload.data.click) {
      eventData.click_link = payload.data.click.link;
      eventData.click_timestamp = payload.data.click.timestamp;
    }

    if (eventType === 'opened' && payload.data.open) {
      eventData.open_timestamp = payload.data.open.timestamp;
    }

    if (eventType === 'bounced' && payload.data.bounce) {
      eventData.bounce_message = payload.data.bounce.message;
    }

    // Insert tracking event
    const trackingEvent: EmailTrackingEvent = {
      campaign_id: campaignId,
      customer_email: payload.data.to[0],
      event_type: eventType,
      event_data: eventData,
      user_agent: userAgent,
      ip_address: ipAddress
    };

    const { error: insertError } = await supabase
      .from('email_tracking_events')
      .insert(trackingEvent);

    if (insertError) {
      console.error('❌ Error inserting tracking event:', insertError);
      throw insertError;
    }

    console.log(`✅ Recorded ${eventType} event for campaign ${campaignId}`);

    // ========== UPDATE DOMAIN REPUTATION STATS ==========
    // Update domain stats for bounces and complaints
    if (domainId && domainId !== 'fallback' && (eventType === 'bounced' || payload.type === 'email.complained')) {
      await updateDomainReputationStats(supabase, domainId, eventType === 'bounced' ? 'bounce' : 'complaint');
    }

    // Track delivered emails for 30-day stats
    if (domainId && domainId !== 'fallback' && eventType === 'delivered') {
      await incrementDomainSentCount(supabase, domainId);
    }

    // Update campaign metrics
    await updateCampaignMetrics(supabase, campaignId);

    return new Response(JSON.stringify({ 
      message: 'Event recorded successfully',
      campaign_id: campaignId,
      event_type: eventType,
      recipient: payload.data.to[0]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error('❌ Error in email tracking webhook:', error);
    
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

// Update domain reputation stats for bounces and complaints
const updateDomainReputationStats = async (supabase: any, domainId: string, type: 'bounce' | 'complaint') => {
  try {
    const column = type === 'bounce' ? 'total_bounces_30d' : 'total_complaints_30d';
    
    // Get current stats
    const { data: domain, error: fetchError } = await supabase
      .from('email_domains')
      .select('total_sent_30d, total_bounces_30d, total_complaints_30d')
      .eq('id', domainId)
      .single();

    if (fetchError || !domain) {
      console.error('Error fetching domain for reputation update:', fetchError);
      return;
    }

    // Increment the appropriate counter
    const updates: any = {
      [column]: (domain[column] || 0) + 1
    };

    // Recalculate rates
    const totalSent = domain.total_sent_30d || 1;
    const bounces = type === 'bounce' ? (domain.total_bounces_30d || 0) + 1 : (domain.total_bounces_30d || 0);
    const complaints = type === 'complaint' ? (domain.total_complaints_30d || 0) + 1 : (domain.total_complaints_30d || 0);

    updates.bounce_rate_30d = bounces / totalSent;
    updates.complaint_rate_30d = complaints / totalSent;

    // Check if we need to auto-pause the domain
    const BOUNCE_AUTO_PAUSE = 0.08;     // 8%
    const COMPLAINT_AUTO_PAUSE = 0.005; // 0.5%

    if (updates.bounce_rate_30d >= BOUNCE_AUTO_PAUSE || updates.complaint_rate_30d >= COMPLAINT_AUTO_PAUSE) {
      updates.status = 'paused';
      updates.notes = `Auto-paused due to high ${type} rate: ${type === 'bounce' ? updates.bounce_rate_30d : updates.complaint_rate_30d}`;
      console.warn(`⚠️ Domain ${domainId} auto-paused due to high ${type} rate`);
    }

    const { error: updateError } = await supabase
      .from('email_domains')
      .update(updates)
      .eq('id', domainId);

    if (updateError) {
      console.error('Error updating domain reputation:', updateError);
    } else {
      console.log(`📊 Updated ${type} stats for domain ${domainId}`);
    }
  } catch (error) {
    console.error('Error in updateDomainReputationStats:', error);
  }
};

// Increment domain's 30-day sent count
const incrementDomainSentCount = async (supabase: any, domainId: string) => {
  try {
    const { data: domain, error: fetchError } = await supabase
      .from('email_domains')
      .select('total_sent_30d, total_bounces_30d, total_complaints_30d')
      .eq('id', domainId)
      .single();

    if (fetchError || !domain) {
      return;
    }

    const totalSent = (domain.total_sent_30d || 0) + 1;
    
    // Recalculate rates with new total
    const bounceRate = (domain.total_bounces_30d || 0) / totalSent;
    const complaintRate = (domain.total_complaints_30d || 0) / totalSent;

    await supabase
      .from('email_domains')
      .update({
        total_sent_30d: totalSent,
        bounce_rate_30d: bounceRate,
        complaint_rate_30d: complaintRate
      })
      .eq('id', domainId);
  } catch (error) {
    console.error('Error incrementing domain sent count:', error);
  }
};

// Update campaign metrics
const updateCampaignMetrics = async (supabase: any, campaignId: string) => {
  try {
    const { data: events, error: eventsError } = await supabase
      .from('email_tracking_events')
      .select('event_type, customer_email')
      .eq('campaign_id', campaignId);

    if (eventsError) {
      console.error('Error fetching events for metrics update:', eventsError);
      return;
    }

    const uniqueEvents = new Map<string, Set<string>>();
    
    events.forEach((event: any) => {
      const key = event.event_type;
      if (!uniqueEvents.has(key)) {
        uniqueEvents.set(key, new Set());
      }
      uniqueEvents.get(key)!.add(event.customer_email);
    });

    const metrics = {
      sent: uniqueEvents.get('sent')?.size || 0,
      delivered: uniqueEvents.get('delivered')?.size || 0,
      opened: uniqueEvents.get('opened')?.size || 0,
      clicked: uniqueEvents.get('clicked')?.size || 0,
      bounced: uniqueEvents.get('bounced')?.size || 0,
      unsubscribed: uniqueEvents.get('unsubscribed')?.size || 0
    };

    const totalDelivered = metrics.delivered || metrics.sent || 1;
    const openRate = Math.round((metrics.opened / totalDelivered) * 100 * 100) / 100;
    const clickRate = Math.round((metrics.clicked / totalDelivered) * 100 * 100) / 100;

    const { error: updateError } = await supabase
      .from('crm_campaigns')
      .update({
        metrics: metrics,
        total_sent: metrics.sent,
        total_opens: metrics.opened,
        total_clicks: metrics.clicked,
        open_rate: openRate,
        click_rate: clickRate
      })
      .eq('id', campaignId);

    if (updateError) {
      console.error('Error updating campaign metrics:', updateError);
    } else {
      console.log(`📊 Updated metrics for campaign ${campaignId}: ${metrics.opened} opens, ${metrics.clicked} clicks`);
    }
  } catch (error) {
    console.error('Error in updateCampaignMetrics:', error);
  }
};

serve(handler);