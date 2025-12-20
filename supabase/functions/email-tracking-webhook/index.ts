import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, resend-signature, resend-timestamp, svix-id, svix-timestamp, svix-signature, webhook-id, webhook-timestamp, webhook-signature",
};

// Event types we track
type TrackableEventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed';

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject?: string;
    tags?: { name: string; value: string }[];
    headers?: { name: string; value: string }[];
    click?: {
      link: string;
      timestamp: string;
    };
    open?: {
      timestamp: string;
      ip_address?: string;
      user_agent?: string;
    };
    bounce?: {
      message: string;
      type?: string;
    };
    complaint?: {
      feedback_type?: string;
    };
  };
}

// ========== SIGNATURE VERIFICATION ==========
const verifyWebhookSignature = async (request: Request, body: string): Promise<boolean> => {
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.warn('⚠️ RESEND_WEBHOOK_SECRET not configured - skipping signature verification');
    console.warn('   For production, add RESEND_WEBHOOK_SECRET to secure the webhook endpoint');
    return true; // Allow through but warn
  }

  try {
    // Resend uses Svix for webhooks - check for svix headers first
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    // Also check legacy headers
    const resendSignature = request.headers.get('resend-signature');
    const resendTimestamp = request.headers.get('resend-timestamp');

    // Try Svix signature verification first (newer Resend format)
    if (svixId && svixTimestamp && svixSignature) {
      const now = Math.floor(Date.now() / 1000);
      const timestampInt = parseInt(svixTimestamp);
      const timeDiff = Math.abs(now - timestampInt);
      
      if (timeDiff > 300) {
        console.error(`Webhook timestamp too old: ${timeDiff} seconds`);
        return false;
      }

      // Svix uses "v1,{signature}" format
      const signatureParts = svixSignature.split(',');
      const signatures = signatureParts.map(s => {
        const parts = s.split(',');
        return parts[parts.length - 1]; // Get the actual signature
      });

      const payloadToSign = `${svixId}.${svixTimestamp}.${body}`;
      
      for (const sig of signatures) {
        const encoder = new TextEncoder();
        const secretBytes = base64ToBytes(webhookSecret.replace('whsec_', ''));
        const key = await crypto.subtle.importKey(
          'raw',
          secretBytes,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadToSign));
        const computedSignature = bytesToBase64(new Uint8Array(signatureBuffer));
        
        if (sig.includes(computedSignature)) {
          return true;
        }
      }
      
      console.error('Invalid Svix webhook signature');
      return false;
    }

    // Fallback to legacy Resend signature format
    if (resendSignature && resendTimestamp) {
      const now = Math.floor(Date.now() / 1000);
      const timestampInt = parseInt(resendTimestamp);
      const timeDiff = Math.abs(now - timestampInt);
      
      if (timeDiff > 300) {
        console.error(`Webhook timestamp too old: ${timeDiff} seconds`);
        return false;
      }

      const payloadToSign = `${resendTimestamp}.${body}`;
      
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
      
      if (resendSignature === expectedSignature) {
        return true;
      }
      
      console.error('Invalid legacy webhook signature');
      return false;
    }

    console.warn('⚠️ No signature headers found in webhook request');
    return true; // Allow through during initial setup

  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

// Helper functions for base64
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte)
  ).join('');
  return btoa(binString);
}

// ========== EXTRACT METADATA FROM HEADERS/TAGS ==========
const extractMetadata = (payload: ResendWebhookPayload): { campaignId?: string; tenantId?: string; domainId?: string } => {
  const result: { campaignId?: string; tenantId?: string; domainId?: string } = {};

  // Extract from headers array (Resend format: [{name, value}])
  if (payload.data.headers && Array.isArray(payload.data.headers)) {
    for (const header of payload.data.headers) {
      if (header.name === 'X-Campaign-ID' || header.name === 'x-campaign-id') {
        result.campaignId = header.value;
      }
      if (header.name === 'X-Tenant-ID' || header.name === 'x-tenant-id') {
        result.tenantId = header.value;
      }
      if (header.name === 'X-Domain-ID' || header.name === 'x-domain-id') {
        result.domainId = header.value;
      }
    }
  }

  // Extract from tags array (Resend format: [{name, value}])
  if (payload.data.tags && Array.isArray(payload.data.tags)) {
    for (const tag of payload.data.tags) {
      if (tag.name === 'campaign_id' && !result.campaignId) {
        result.campaignId = tag.value;
      }
      if (tag.name === 'tenant_id' && !result.tenantId) {
        result.tenantId = tag.value;
      }
      if (tag.name === 'domain_id' && !result.domainId) {
        result.domainId = tag.value;
      }
    }
  }

  return result;
};

// ========== MAP RESEND EVENT TYPES ==========
const mapEventType = (resendType: string): TrackableEventType | null => {
  const eventTypeMap: Record<string, TrackableEventType> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'delivered', // Treat delayed as delivered for now
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.unsubscribed': 'unsubscribed'
  };
  return eventTypeMap[resendType] || null;
};

// ========== MAIN HANDLER ==========
const handler = async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  
  // Handle CORS preflight
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

    // Read raw body for signature verification
    const rawBody = await req.text();
    
    console.log('📨 Incoming webhook request at', new Date().toISOString());
    
    // Verify signature
    const isValidSignature = await verifyWebhookSignature(req, rawBody);
    if (!isValidSignature) {
      console.error('❌ Invalid webhook signature - rejecting request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse payload
    const payload: ResendWebhookPayload = JSON.parse(rawBody);
    
    console.log('✅ Webhook payload received:', {
      type: payload.type,
      email_id: payload.data.email_id,
      recipient: payload.data.to?.[0],
      timestamp: payload.created_at
    });

    // Map event type
    const eventType = mapEventType(payload.type);
    if (!eventType) {
      console.log(`⚠️ Unknown/untracked event type: ${payload.type} - ignoring`);
      return new Response(JSON.stringify({ message: 'Event type not tracked' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Extract metadata (campaign_id, tenant_id, domain_id)
    const metadata = extractMetadata(payload);
    
    console.log('📋 Extracted metadata:', metadata);

    // Skip if no campaign_id - we can't attribute the event
    if (!metadata.campaignId) {
      console.log('⚠️ No campaign_id in webhook payload - cannot attribute event');
      // Still return 200 to acknowledge receipt
      return new Response(JSON.stringify({ 
        message: 'Event received but no campaign_id for attribution',
        email_id: payload.data.email_id
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ========== LOOKUP CUSTOMER BY EMAIL ==========
    const recipientEmail = payload.data.to[0];
    let customerId: string | null = null;
    
    if (metadata.tenantId && recipientEmail) {
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('id')
        .eq('tenant_id', metadata.tenantId)
        .eq('email', recipientEmail)
        .maybeSingle();
      
      if (customer) {
        customerId = customer.id;
        console.log(`📋 Found customer: ${customerId} for email: ${recipientEmail}`);
      }
    }

    // ========== CALCULATE TIME-TO-EVENT FOR OPENS/CLICKS ==========
    let timeToEventSeconds: number | null = null;
    let sentAtTimestamp: string | null = null;
    
    if ((eventType === 'opened' || eventType === 'clicked') && payload.data.email_id) {
      // Find the 'sent' event for this email to calculate time difference
      const { data: sentEvent } = await supabase
        .from('email_tracking_events')
        .select('created_at')
        .eq('campaign_id', metadata.campaignId)
        .eq('customer_email', recipientEmail)
        .eq('event_type', 'sent')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (sentEvent?.created_at) {
        sentAtTimestamp = sentEvent.created_at;
        const sentTime = new Date(sentEvent.created_at).getTime();
        const eventTime = new Date(payload.created_at).getTime();
        timeToEventSeconds = Math.floor((eventTime - sentTime) / 1000);
        console.log(`⏱️ Time to ${eventType}: ${timeToEventSeconds} seconds (${Math.round(timeToEventSeconds/60)} minutes)`);
      }
    }

    // ========== DETERMINE BOUNCE TYPE ==========
    let bounceType: string | null = null;
    if (eventType === 'bounced' && payload.data.bounce) {
      // Resend bounce types: 'hard', 'soft', or message-based detection
      const bounceMessage = payload.data.bounce.message?.toLowerCase() || '';
      const payloadBounceType = payload.data.bounce.type?.toLowerCase();
      
      if (payloadBounceType === 'hard' || bounceMessage.includes('permanent') || bounceMessage.includes('does not exist') || bounceMessage.includes('invalid')) {
        bounceType = 'hard';
      } else {
        bounceType = 'soft';
      }
      console.log(`📭 Bounce type detected: ${bounceType}`);
    }

    // Build event data for storage
    const eventData: Record<string, any> = {
      email_id: payload.data.email_id,
      subject: payload.data.subject,
      from: payload.data.from,
      occurred_at: payload.created_at,
      tags: payload.data.tags || [],
      tenant_id: metadata.tenantId,
      domain_id: metadata.domainId
    };

    // Add event-specific data
    if (eventType === 'clicked' && payload.data.click) {
      eventData.click_link = payload.data.click.link;
      eventData.click_timestamp = payload.data.click.timestamp;
    }
    if (eventType === 'opened' && payload.data.open) {
      eventData.open_timestamp = payload.data.open.timestamp;
      eventData.open_ip = payload.data.open.ip_address;
      eventData.open_user_agent = payload.data.open.user_agent;
    }
    if (eventType === 'bounced' && payload.data.bounce) {
      eventData.bounce_message = payload.data.bounce.message;
      eventData.bounce_type = bounceType;
    }
    if (eventType === 'complained' && payload.data.complaint) {
      eventData.complaint_feedback_type = payload.data.complaint.feedback_type;
    }

    // Get client info from request
    const userAgent = req.headers.get('user-agent');
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip');

    // ========== IDEMPOTENCY CHECK ==========
    // Use (campaign_id, customer_email, event_type, email_id) as unique key
    const { data: existingEvent } = await supabase
      .from('email_tracking_events')
      .select('id')
      .eq('campaign_id', metadata.campaignId)
      .eq('customer_email', recipientEmail)
      .eq('event_type', eventType)
      .eq('event_data->>email_id', payload.data.email_id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`🔄 Duplicate ${eventType} event detected for email_id=${payload.data.email_id} - skipping`);
      return new Response(JSON.stringify({ 
        message: 'Duplicate event - already recorded',
        event_id: existingEvent.id
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ========== INSERT TRACKING EVENT ==========
    const trackingRecord: Record<string, any> = {
      campaign_id: metadata.campaignId,
      customer_email: recipientEmail,
      event_type: eventType,
      event_data: {
        ...eventData,
        raw_payload: payload // Store complete raw payload for debugging
      },
      user_agent: userAgent,
      ip_address: ipAddress,
      customer_id: customerId,
      bounce_type: bounceType,
      sent_at: sentAtTimestamp,
      time_to_event_seconds: timeToEventSeconds
    };

    const { data: insertedEvent, error: insertError } = await supabase
      .from('email_tracking_events')
      .insert(trackingRecord)
      .select('id')
      .single();

    if (insertError) {
      // Check if it's a duplicate key error (race condition)
      if (insertError.code === '23505') {
        console.log(`🔄 Duplicate event (constraint violation) - already recorded`);
        return new Response(JSON.stringify({ message: 'Duplicate event' }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      console.error('❌ Error inserting tracking event:', insertError);
      throw insertError;
    }

    console.log(`✅ Recorded ${eventType} event for campaign ${metadata.campaignId} (event_id: ${insertedEvent?.id})`);

    // ========== UPDATE AGGREGATES (defensive - don't crash on failures) ==========
    
    // Update campaign metrics
    try {
      await updateCampaignMetrics(supabase, metadata.campaignId);
    } catch (err) {
      console.error('⚠️ Non-fatal: Failed to update campaign metrics:', err);
    }

    // ========== UPDATE CUSTOMER EMAIL ENGAGEMENT METRICS ==========
    if (customerId) {
      try {
        await supabase.rpc('update_customer_email_metrics', { p_customer_id: customerId });
        console.log(`📊 Updated email metrics for customer ${customerId}`);
      } catch (err) {
        console.error('⚠️ Non-fatal: Failed to update customer email metrics:', err);
      }
    }

    // Update domain stats for bounces/complaints
    if (metadata.domainId && (eventType === 'bounced' || eventType === 'complained')) {
      try {
        await updateDomainReputationStats(supabase, metadata.domainId, eventType);
      } catch (err) {
        console.error('⚠️ Non-fatal: Failed to update domain stats:', err);
      }
    }

    // Track delivered for domain warmup metrics
    if (metadata.domainId && eventType === 'delivered') {
      try {
        await incrementDomainSentCount(supabase, metadata.domainId);
      } catch (err) {
        console.error('⚠️ Non-fatal: Failed to increment domain sent count:', err);
      }
    }

    // Handle unsubscribe - update customer preference
    if (eventType === 'unsubscribed') {
      try {
        await handleUnsubscribe(supabase, payload.data.to[0], metadata.tenantId);
      } catch (err) {
        console.error('⚠️ Non-fatal: Failed to handle unsubscribe:', err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Webhook processed in ${duration}ms`);

    return new Response(JSON.stringify({ 
      message: 'Event recorded successfully',
      event_id: insertedEvent?.id,
      campaign_id: metadata.campaignId,
      event_type: eventType,
      recipient: payload.data.to[0],
      processing_time_ms: duration
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error in email tracking webhook (${duration}ms):`, error);
    
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

// ========== UPDATE CAMPAIGN METRICS ==========
const updateCampaignMetrics = async (supabase: any, campaignId: string) => {
  // Get all events for this campaign and calculate unique counts
  const { data: events, error: eventsError } = await supabase
    .from('email_tracking_events')
    .select('event_type, customer_email')
    .eq('campaign_id', campaignId);

  if (eventsError) {
    console.error('Error fetching events for metrics update:', eventsError);
    throw eventsError;
  }

  // Count unique recipients per event type
  const uniqueByType = new Map<string, Set<string>>();
  
  for (const event of events || []) {
    const key = event.event_type;
    if (!uniqueByType.has(key)) {
      uniqueByType.set(key, new Set());
    }
    uniqueByType.get(key)!.add(event.customer_email);
  }

  const metrics = {
    sent: uniqueByType.get('sent')?.size || 0,
    delivered: uniqueByType.get('delivered')?.size || 0,
    opened: uniqueByType.get('opened')?.size || 0,
    clicked: uniqueByType.get('clicked')?.size || 0,
    bounced: uniqueByType.get('bounced')?.size || 0,
    complained: uniqueByType.get('complained')?.size || 0,
    unsubscribed: uniqueByType.get('unsubscribed')?.size || 0
  };

  // Calculate rates
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
    throw updateError;
  }

  console.log(`📊 Updated campaign ${campaignId} metrics: ${metrics.sent} sent, ${metrics.opened} opens, ${metrics.clicked} clicks`);
};

// ========== UPDATE DOMAIN REPUTATION STATS ==========
const updateDomainReputationStats = async (supabase: any, domainId: string, eventType: 'bounced' | 'complained') => {
  const column = eventType === 'bounced' ? 'total_bounces_30d' : 'total_complaints_30d';
  
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

  // Increment the counter
  const updates: Record<string, any> = {
    [column]: (domain[column] || 0) + 1
  };

  // Recalculate rates
  const totalSent = domain.total_sent_30d || 1;
  const bounces = eventType === 'bounced' ? (domain.total_bounces_30d || 0) + 1 : (domain.total_bounces_30d || 0);
  const complaints = eventType === 'complained' ? (domain.total_complaints_30d || 0) + 1 : (domain.total_complaints_30d || 0);

  updates.bounce_rate_30d = bounces / totalSent;
  updates.complaint_rate_30d = complaints / totalSent;

  // Auto-pause thresholds
  const BOUNCE_THRESHOLD = 0.08;     // 8%
  const COMPLAINT_THRESHOLD = 0.005; // 0.5%

  if (updates.bounce_rate_30d >= BOUNCE_THRESHOLD || updates.complaint_rate_30d >= COMPLAINT_THRESHOLD) {
    updates.status = 'paused';
    updates.notes = `Auto-paused: ${eventType} rate exceeded threshold (${eventType === 'bounced' ? updates.bounce_rate_30d * 100 : updates.complaint_rate_30d * 100}%)`;
    console.warn(`⚠️ Domain ${domainId} AUTO-PAUSED due to high ${eventType} rate`);
  }

  const { error: updateError } = await supabase
    .from('email_domains')
    .update(updates)
    .eq('id', domainId);

  if (updateError) {
    console.error('Error updating domain reputation:', updateError);
    throw updateError;
  }

  console.log(`📊 Updated domain ${domainId} ${eventType} stats`);
};

// ========== INCREMENT DOMAIN SENT COUNT ==========
const incrementDomainSentCount = async (supabase: any, domainId: string) => {
  const { data: domain, error: fetchError } = await supabase
    .from('email_domains')
    .select('total_sent_30d, total_bounces_30d, total_complaints_30d')
    .eq('id', domainId)
    .single();

  if (fetchError || !domain) {
    return;
  }

  const totalSent = (domain.total_sent_30d || 0) + 1;
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
};

// ========== HANDLE UNSUBSCRIBE ==========
const handleUnsubscribe = async (supabase: any, email: string, tenantId?: string) => {
  // Update customer's email opt-in status
  const query = supabase
    .from('crm_customers')
    .update({ 
      email_opt_in: false,
      updated_at: new Date().toISOString()
    })
    .eq('email', email);
  
  if (tenantId) {
    query.eq('tenant_id', tenantId);
  }

  const { error } = await query;
  
  if (error) {
    console.error('Error updating customer opt-in status:', error);
    throw error;
  }

  console.log(`📧 Marked ${email} as unsubscribed`);
};

serve(handler);