import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, resend-signature, resend-timestamp, svix-id, svix-timestamp, svix-signature, webhook-id, webhook-timestamp, webhook-signature",
};

// Event types we track
type TrackableEventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'deferred' | 'rejected';

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject?: string;
    tags?: { name: string; value: string }[] | Record<string, string>;
    headers?: { name: string; value: string }[];
    click?: {
      link: string;
      timestamp: string;
    };
    open?: {
      timestamp: string;
      // Resend payloads can be snake_case or camelCase depending on version.
      ip_address?: string;
      user_agent?: string;
      ipAddress?: string;
      userAgent?: string;
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
  const retryToken = Deno.env.get('WEBHOOK_RETRY_TOKEN');
  const internalRetryToken = request.headers.get('x-webhook-retry-token');

  if (retryToken && internalRetryToken === retryToken) {
    return true;
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const allowInsecureWebhooks = Deno.env.get('ALLOW_INSECURE_WEBHOOKS') === 'true';

  if (!webhookSecret) {
    if (allowInsecureWebhooks) {
      console.warn('⚠️ RESEND_WEBHOOK_SECRET not configured - ALLOW_INSECURE_WEBHOOKS=true, allowing request');
      return true;
    }

    console.error('❌ RESEND_WEBHOOK_SECRET is required for webhook verification');
    return false;
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

    if (allowInsecureWebhooks) {
      console.warn('⚠️ No signature headers found - ALLOW_INSECURE_WEBHOOKS=true, allowing request');
      return true;
    }

    console.error('❌ No signature headers found in webhook request');
    return false;

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

// Hash IP address for privacy
function hashIP(ip: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'privacy_salt_v1');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function hashPayload(payload: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload + 'webhook_payload_salt_v1');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

const resolveGovernanceContext = async (
  supabase: any,
  metadata: { campaignId?: string; tenantId?: string; domainId?: string },
  providerMessageId: string,
) => {
  const isUuidLike = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    if (!v) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  };

  let tenantId = isUuidLike(metadata.tenantId) ? metadata.tenantId : null;
  let campaignId = isUuidLike(metadata.campaignId) ? metadata.campaignId : null;
  let domainId = isUuidLike(metadata.domainId) ? metadata.domainId : null;
  let emailMessageId: string | null = null;
  let customerId: string | null = null;

  if (campaignId && !tenantId) {
    const { data: campaign } = await supabase
      .from('crm_campaigns')
      .select('tenant_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (campaign?.tenant_id) {
      tenantId = campaign.tenant_id;
    }
  }

  if (providerMessageId && (!tenantId || !campaignId || !domainId || !emailMessageId)) {
    const { data: message } = await supabase
      .from('email_messages')
      .select('id, tenant_id, campaign_id, domain_id, customer_id')
      .eq('resend_id', providerMessageId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (message) {
      tenantId = tenantId || message.tenant_id || null;
      campaignId = campaignId || message.campaign_id || null;
      domainId = domainId || message.domain_id || null;
      emailMessageId = message.id || null;
      customerId = message.customer_id || null;
    }
  }

  return {
    tenantId,
    campaignId,
    domainId,
    emailMessageId,
    customerId,
  };
};

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

  // Extract from tags
  // - Older Resend format: [{ name, value }]
  // - Newer Resend format: { campaign_id, tenant_id, domain_id, ... }
  if (payload.data.tags) {
    if (Array.isArray(payload.data.tags)) {
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
    } else if (typeof payload.data.tags === 'object') {
      const tagMap = payload.data.tags as Record<string, string>;
      if (tagMap.campaign_id && !result.campaignId) result.campaignId = tagMap.campaign_id;
      if (tagMap.tenant_id && !result.tenantId) result.tenantId = tagMap.tenant_id;
      if (tagMap.domain_id && !result.domainId) result.domainId = tagMap.domain_id;
    }
  }

  return result;
};

// ========== MAP RESEND EVENT TYPES ==========
const mapEventType = (resendType: string): TrackableEventType | null => {
  const eventTypeMap: Record<string, TrackableEventType> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'deferred',
    'email.deferred': 'deferred',
    'email.rejected': 'rejected',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.unsubscribed': 'unsubscribed'
  };
  return eventTypeMap[resendType] || null;
};

const classifyBounceSeverity = (bounceType?: string | null): 'hard' | 'soft' | 'unknown' => {
  if (!bounceType) return 'unknown';

  const normalized = bounceType.toLowerCase();
  if (
    normalized.includes('hard') ||
    normalized.includes('permanent') ||
    normalized.includes('recipient_not_found') ||
    normalized.includes('user_unknown')
  ) {
    return 'hard';
  }

  if (
    normalized.includes('soft') ||
    normalized.includes('temporary') ||
    normalized.includes('mailbox_full') ||
    normalized.includes('deferred') ||
    normalized.includes('timeout')
  ) {
    return 'soft';
  }

  return 'unknown';
};

const isSpamTrapBounce = (bounceType?: string | null, bounceMessage?: string | null): boolean => {
  const haystack = `${String(bounceType || '')} ${String(bounceMessage || '')}`.toLowerCase();
  if (!haystack.trim()) return false;

  return (
    haystack.includes('spamtrap') ||
    haystack.includes('spam trap') ||
    haystack.includes('honey pot') ||
    haystack.includes('honeypot') ||
    haystack.includes('pristine trap') ||
    haystack.includes('spam_trap')
  );
};

const shouldInstantlySuppress = (eventType: TrackableEventType, bounceType?: string | null): boolean => {
  if (eventType === 'unsubscribed' || eventType === 'complained') return true;
  if (eventType !== 'bounced') return false;
  return classifyBounceSeverity(bounceType) === 'hard';
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const withExponentialBackoff = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts = 3,
  baseDelayMs = 250,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`⚠️ ${operationName} attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
};

const scheduleWebhookDeliveryRetryOrDeadLetter = async (
  supabase: any,
  deliveryId: string,
  failureStage: string,
  errorMessage: string,
) => {
  const { data: delivery, error: deliveryFetchError } = await supabase
    .from('email_governance_webhook_deliveries')
    .select('id, tenant_id, provider, delivery_id, event_type, provider_message_id, campaign_id, domain_id, retry_count, max_retries, raw_payload, headers')
    .eq('id', deliveryId)
    .single();

  if (deliveryFetchError || !delivery) {
    console.error('❌ Failed to fetch webhook delivery for retry scheduling:', deliveryFetchError);
    return;
  }

  const currentRetryCount = Number(delivery.retry_count || 0);
  const maxRetries = Number(delivery.max_retries || 8);
  const nextRetryCount = currentRetryCount + 1;

  if (nextRetryCount >= maxRetries) {
    const nowIso = new Date().toISOString();

    await supabase
      .from('email_governance_webhook_deliveries')
      .update({
        processing_status: 'dead_lettered',
        retry_count: nextRetryCount,
        dead_lettered_at: nowIso,
        dead_letter_reason: `${failureStage}: ${errorMessage}`,
        error_message: errorMessage,
        processed_at: nowIso,
        claimed_at: null,
        claimed_by: null,
        claim_token: null,
      })
      .eq('id', deliveryId);

    await supabase
      .from('email_governance_webhook_dead_letters')
      .upsert({
        tenant_id: delivery.tenant_id,
        webhook_delivery_id: delivery.id,
        provider: delivery.provider,
        delivery_id: delivery.delivery_id,
        event_type: delivery.event_type,
        provider_message_id: delivery.provider_message_id,
        campaign_id: delivery.campaign_id,
        domain_id: delivery.domain_id,
        failure_stage: failureStage,
        retry_count: nextRetryCount,
        max_retries: maxRetries,
        last_error_message: errorMessage,
        raw_payload: delivery.raw_payload || {},
        headers: delivery.headers || {},
        dead_lettered_at: nowIso,
      }, {
        onConflict: 'webhook_delivery_id',
      });

    return;
  }

  const backoffMinutes = Math.pow(2, Math.max(0, nextRetryCount - 1));
  const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

  await supabase
    .from('email_governance_webhook_deliveries')
    .update({
      processing_status: 'retrying',
      retry_count: nextRetryCount,
      next_retry_at: nextRetryAt,
      error_message: errorMessage,
      processed_at: null,
      claimed_at: null,
      claimed_by: null,
      claim_token: null,
    })
    .eq('id', deliveryId);
};

// ========== MAIN HANDLER ==========
const handler = async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  let supabase: any = null;
  let governanceWebhookId: string | null = null;

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
    supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const providerMessageId = payload.data.email_id;
    const eventTsProvider = payload.created_at;

    const governanceContext = await resolveGovernanceContext(supabase, metadata, providerMessageId);
    const isUuid = (value: unknown): value is string => {
      if (typeof value !== 'string') return false;
      const v = value.trim();
      if (!v) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    };

    const rawTenantId = governanceContext.tenantId || metadata.tenantId || null;
    const rawCampaignId = governanceContext.campaignId || metadata.campaignId || null;
    const rawDomainId = governanceContext.domainId || metadata.domainId || null;
    const rawEmailMessageId = governanceContext.emailMessageId || null;
    const rawCustomerId = governanceContext.customerId || null;

    const effectiveTenantId = isUuid(rawTenantId) ? rawTenantId : null;
    const effectiveCampaignId = isUuid(rawCampaignId) ? rawCampaignId : null;
    const effectiveDomainId = isUuid(rawDomainId) ? rawDomainId : null;
    const effectiveEmailMessageId = isUuid(rawEmailMessageId) ? rawEmailMessageId : null;
    const effectiveCustomerId = isUuid(rawCustomerId) ? rawCustomerId : null;

    console.log('📋 Extracted metadata:', {
      ...metadata,
      raw_tenant_id: rawTenantId,
      raw_campaign_id: rawCampaignId,
      raw_domain_id: rawDomainId,
      raw_email_message_id: rawEmailMessageId,
      resolved_tenant_id: effectiveTenantId,
      resolved_campaign_id: effectiveCampaignId,
      resolved_domain_id: effectiveDomainId,
      resolved_email_message_id: effectiveEmailMessageId,
    });

    const requestHeaders = Object.fromEntries(req.headers.entries());
    const webhookDeliveryId = req.headers.get('svix-id') || req.headers.get('webhook-id') || req.headers.get('x-request-id') || `${providerMessageId}:${payload.type}:${eventTsProvider}`;
    const payloadHash = hashPayload(rawBody);

    if (effectiveTenantId) {
      const { data: webhookDelivery, error: webhookDeliveryError } = await supabase
        .from('email_governance_webhook_deliveries')
        .upsert({
          tenant_id: effectiveTenantId,
          provider: 'resend',
          delivery_id: webhookDeliveryId,
          provider_event_id: null,
          provider_message_id: providerMessageId,
          event_type: eventType,
          campaign_id: effectiveCampaignId,
          domain_id: effectiveDomainId,
          signature_verified: isValidSignature,
          payload_hash: payloadHash,
          headers: requestHeaders,
          raw_payload: payload,
          processing_status: 'received',
          error_message: null,
          received_at: new Date().toISOString(),
        }, {
          onConflict: 'provider,delivery_id',
        })
        .select('id')
        .single();

      if (webhookDeliveryError) {
        console.error('⚠️ Non-fatal: Failed to record governance webhook delivery:', webhookDeliveryError);
      } else {
        governanceWebhookId = webhookDelivery?.id || null;
      }
    }

    // Skip if no campaign_id - we can't attribute the event
    if (!effectiveCampaignId) {
      if (governanceWebhookId) {
        await supabase
          .from('email_governance_webhook_deliveries')
          .update({
            processing_status: 'failed',
            error_message: 'No campaign_id available for attribution',
            processed_at: new Date().toISOString(),
          })
          .eq('id', governanceWebhookId);
      }

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

    // Build event data for storage
    const eventData: Record<string, any> = {
      email_id: payload.data.email_id,
      subject: payload.data.subject,
      from: payload.data.from,
      occurred_at: payload.created_at,
      tags: payload.data.tags || [],
      tenant_id: effectiveTenantId,
      domain_id: effectiveDomainId
    };

    // Add event-specific data
    if (eventType === 'clicked' && payload.data.click) {
      eventData.click_link = payload.data.click.link;
      eventData.click_timestamp = payload.data.click.timestamp;
    }

    // MPP Detection for opens
    let isMppGuess = false;
    if ((eventType === 'opened') && payload.data.open) {
      eventData.open_timestamp = payload.data.open.timestamp;
      const openIp = payload.data.open.ip_address || payload.data.open.ipAddress;
      const openUserAgent = payload.data.open.user_agent || payload.data.open.userAgent;
      eventData.open_ip = openIp;
      eventData.open_user_agent = openUserAgent;

      // Heuristic: Apple Mail Privacy Protection detection
      const ua = openUserAgent?.toLowerCase() || '';
      const ip = openIp || '';

      // Common MPP indicators:
      // 1. User agent contains Apple Mail
      // 2. Opens happening from Apple's proxy IPs (17.x.x.x range or known proxy ASNs)
      if (ua.includes('applemail') || ua.includes('apple mail')) {
        // If it's Apple Mail and opens very quickly after send, likely MPP
        isMppGuess = true;
      }
      // Apple Private Relay IPs typically start with 17. or use iCloud Private Relay
      if (ip.startsWith('17.') || ip.includes('apple') || ip.includes('icloud')) {
        isMppGuess = true;
      }
    }

    if (eventType === 'bounced' && payload.data.bounce) {
      eventData.bounce_message = payload.data.bounce.message;
      eventData.bounce_type = payload.data.bounce.type;
      eventData.bounce_severity = classifyBounceSeverity(payload.data.bounce.type);
      eventData.is_spam_trap = isSpamTrapBounce(payload.data.bounce.type, payload.data.bounce.message);
    }
    if (eventType === 'complained' && payload.data.complaint) {
      eventData.complaint_feedback_type = payload.data.complaint.feedback_type;
    }

    // ========== INSTANT SUPPRESSION UPDATE ==========
    if (effectiveTenantId && shouldInstantlySuppress(eventType, payload.data.bounce?.type)) {
      try {
        const suppressionReason = eventType === 'unsubscribed'
          ? 'unsubscribed'
          : eventType === 'complained'
            ? 'complaint'
            : 'bounced';

        await withExponentialBackoff(async () => {
          const { error } = await supabase
            .from('suppression_list')
            .upsert({
              tenant_id: effectiveTenantId,
              email: payload.data.to[0],
              suppression_type: suppressionReason,
              channel: 'email',
              reason: suppressionReason,
              source_event_id: null,
              auto_suppressed: true,
              suppressed_at: new Date().toISOString(),
              lifted_at: null,
            }, {
              onConflict: 'tenant_id,email,channel,suppression_type',
              ignoreDuplicates: true,
            });

          if (error) throw error;
        }, 'instant suppression upsert');
      } catch (instantSuppressionError: any) {
        console.error('⚠️ Instant suppression update failed:', instantSuppressionError);
      }
    }

    // Get client info from request
    const userAgent = req.headers.get('user-agent');
    const ipAddress = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     req.headers.get('cf-connecting-ip');

    // Hash IP for privacy
    const ipHash = ipAddress ? hashIP(ipAddress) : null;

    // ========== IDEMPOTENT UPSERT ==========
    // Use (tenant_id, provider_message_id, event_type, event_ts_provider) as unique key
    const trackingRecord = {
      campaign_id: effectiveCampaignId,
      customer_email: payload.data.to[0],
      event_type: eventType,
      event_data: {
        ...eventData,
        raw_payload: payload
      },
      user_agent: userAgent,
      // New idempotency columns
      provider_message_id: providerMessageId,
      event_ts_provider: eventTsProvider,
      ingested_at: new Date().toISOString(),
      tenant_id: effectiveTenantId || null,
      is_mpp_guess: isMppGuess,
      ip_hash: ipHash,
      webhook_delivery_id: webhookDeliveryId
    };

    let governanceEventId: string | null = null;
    if (effectiveTenantId) {
      const shouldRetryWithoutSpamTrap = (error: any) => {
        const code = String(error?.code || '').trim();
        const message = String(error?.message || '').toLowerCase();
        const details = String(error?.details || '').toLowerCase();

        // PostgREST schema cache error for unknown columns.
        if (code === 'PGRST204') return true;

        // Defensive match for older/newer error shapes.
        return (
          message.includes("could not find") &&
          (message.includes("is_spam_trap") || details.includes("is_spam_trap"))
        );
      };

      const governanceEventRecord = {
        tenant_id: effectiveTenantId,
        campaign_id: effectiveCampaignId,
        email_message_id: effectiveEmailMessageId,
        customer_id: effectiveCustomerId,
        domain_id: effectiveDomainId,
        email: payload.data.to[0],
        provider: 'resend',
        provider_message_id: providerMessageId,
        provider_event_id: null,
        event_type: eventType,
        event_ts_provider: eventTsProvider,
        ingested_at: new Date().toISOString(),
        event_data: {
          ...eventData,
          raw_payload: payload,
        },
        is_spam_trap: Boolean(eventData.is_spam_trap),
        webhook_delivery_id: webhookDeliveryId,
        is_mpp_guess: isMppGuess,
        ip_hash: ipHash,
        user_agent: userAgent,
      };

      const { data: insertedGovEvent, error: governanceEventError } = await withExponentialBackoff(async () => {
        const attemptInsert = async (record: any) => {
          return await supabase
            .from('email_governance_email_events')
            .insert(record)
            .select('id')
            .single();
        };

        let result = await attemptInsert(governanceEventRecord);

        if (result.error && result.error.code !== '23505') {
          // If the DB hasn't been migrated yet (or schema cache is stale), retry without is_spam_trap.
          if (shouldRetryWithoutSpamTrap(result.error)) {
            const { is_spam_trap: _ignored, ...withoutSpamTrap } = governanceEventRecord as any;
            result = await attemptInsert(withoutSpamTrap);
          }

          if (result.error && result.error.code !== '23505') {
            throw result.error;
          }
        }

        return result;
      }, 'governance event insert');

      if (governanceEventError) {
        if (governanceEventError.code === '23505') {
          console.log('🔄 Duplicate governance event detected');
          if (governanceWebhookId) {
            await supabase
              .from('email_governance_webhook_deliveries')
              .update({
                processing_status: 'duplicate',
                processed_at: new Date().toISOString(),
              })
              .eq('id', governanceWebhookId);
          }
        } else {
          console.error('⚠️ Non-fatal: Failed to insert governance email event:', governanceEventError);
          if (governanceWebhookId) {
            await supabase
              .from('email_governance_webhook_deliveries')
              .update({
                processing_status: 'failed',
                error_message: governanceEventError.message,
                processed_at: new Date().toISOString(),
              })
              .eq('id', governanceWebhookId);
          }
        }
      } else {
        governanceEventId = insertedGovEvent?.id || null;
      }
    }

    const { data: insertedEvent, error: insertError } = await withExponentialBackoff(async () => {
      const result = await supabase
        .from('email_tracking_events')
        .insert(trackingRecord)
        .select('id')
        .single();

      if (result.error && result.error.code !== '23505') {
        throw result.error;
      }

      return result;
    }, 'legacy event insert');

    if (insertError) {
      // Check if it's a duplicate key error (race condition)
      if (insertError.code === '23505') {
        console.log('🔄 Duplicate event (constraint violation) - already recorded', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
        });

        if (governanceWebhookId) {
          await supabase
            .from('email_governance_webhook_deliveries')
            .update({
              processing_status: 'duplicate',
              processed_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', governanceWebhookId);
        }

        // Important: acknowledge as success so providers/clients don't treat this as an error.
        return new Response(JSON.stringify({
          ok: true,
          duplicate: true,
          event_type: eventType,
          campaign_id: effectiveCampaignId,
          recipient: payload.data.to[0],
          provider_message_id: providerMessageId,
          webhook_delivery_id: webhookDeliveryId,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (governanceWebhookId) {
        await scheduleWebhookDeliveryRetryOrDeadLetter(
          supabase,
          governanceWebhookId,
          'legacy_event_insert',
          insertError.message || 'Failed to insert legacy tracking event',
        );
      }

      console.error('❌ Error inserting tracking event:', insertError);
      throw insertError;
    }

    console.log(`✅ Recorded ${eventType} event for campaign ${effectiveCampaignId} (event_id: ${insertedEvent?.id})`);

    if (governanceWebhookId) {
      await supabase
        .from('email_governance_webhook_deliveries')
        .update({
          processing_status: 'processed',
          linked_event_id: governanceEventId,
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', governanceWebhookId);
    }

    if (effectiveTenantId) {
      await supabase
        .from('email_governance_audit_logs')
        .insert({
          tenant_id: effectiveTenantId,
          actor_type: 'webhook',
          actor_id: null,
          action_type: 'email_event_ingested',
          decision: 'allow',
          reason: 'Event accepted and processed',
          policy_name: 'email_governance_ingestion',
          policy_version: 'milestone_1',
          campaign_id: effectiveCampaignId,
          domain_id: effectiveDomainId,
          customer_id: effectiveCustomerId,
          governance_message_id: null,
          metadata: {
            provider: 'resend',
            event_type: eventType,
            provider_message_id: providerMessageId,
            webhook_delivery_id: webhookDeliveryId,
            governance_event_id: governanceEventId,
            legacy_event_id: insertedEvent?.id,
          },
          occurred_at: new Date().toISOString(),
        });
    }

    // ========== UPDATE AGGREGATES (defensive - don't crash on failures) ==========

    // Update campaign metrics
    try {
      await updateCampaignMetrics(supabase, effectiveCampaignId);
    } catch (err) {
      console.error('⚠️ Non-fatal: Failed to update campaign metrics:', err);
    }

    // Update domain stats for bounces/complaints
    if (effectiveDomainId && (eventType === 'bounced' || eventType === 'complained')) {
      try {
        await updateDomainReputationStats(supabase, effectiveDomainId, eventType);

        if (effectiveTenantId) {
          await supabase
            .from('email_governance_domain_health_logs')
            .insert({
              tenant_id: effectiveTenantId,
              domain_id: effectiveDomainId,
              event_type: eventType,
              status: 'informational',
              details: {
                provider: 'resend',
                campaign_id: effectiveCampaignId,
                provider_message_id: providerMessageId,
                governance_event_id: governanceEventId,
              },
              observed_at: new Date().toISOString(),
            });
        }
      } catch (err) {
        console.error('⚠️ Non-fatal: Failed to update domain stats:', err);
      }
    }

    // Track delivered for domain delivery metrics (informational)
    if (effectiveDomainId && eventType === 'delivered') {
      try {
        await incrementDomainSentCount(supabase, effectiveDomainId);
      } catch (err) {
        console.error('⚠️ Non-fatal: Failed to increment domain sent count:', err);
      }
    }

    // ========== SUPPRESSION LIST UPDATES ==========
    // Add to suppression list for unsubscribes, bounces, and complaints
    if (eventType === 'unsubscribed' || eventType === 'complained' || (eventType === 'bounced' && shouldInstantlySuppress(eventType, payload.data.bounce?.type))) {
      try {
        const suppressionReason = eventType === 'unsubscribed' ? 'unsubscribed' :
                                  eventType === 'bounced' ? 'bounced' : 'complaint';

        // Build detailed meta for the suppression record
        const suppressionMeta: Record<string, any> = {
          event_id: insertedEvent?.id,
          provider_message_id: providerMessageId,
          occurred_at: eventTsProvider
        };

        if (eventType === 'bounced' && payload.data.bounce) {
          suppressionMeta.bounce_type = payload.data.bounce.type;
          suppressionMeta.bounce_message = payload.data.bounce.message;
        }
        if (eventType === 'complained' && payload.data.complaint) {
          suppressionMeta.complaint_type = payload.data.complaint.feedback_type;
        }

        await withExponentialBackoff(async () => {
          const { error } = await supabase
            .from('suppression_list')
            .upsert({
              tenant_id: effectiveTenantId,
              email: payload.data.to[0],
              suppression_type: suppressionReason,
              channel: 'email',
              reason: suppressionReason,
              source_event_id: insertedEvent?.id,
              auto_suppressed: true,
              suppressed_at: new Date().toISOString(),
              lifted_at: null,
            }, {
              onConflict: 'tenant_id,email,channel,suppression_type',
              ignoreDuplicates: true
            });
          if (error) throw error;
        }, 'suppression upsert');

        if (effectiveTenantId) {
          await supabase
            .from('email_governance_suppression_events')
            .insert({
              tenant_id: effectiveTenantId,
              email: payload.data.to[0],
              channel: 'email',
              suppression_type: suppressionReason,
              reason: suppressionReason,
              source: 'webhook',
              source_event_id: governanceEventId,
              is_active: true,
              metadata: suppressionMeta,
              occurred_at: new Date().toISOString(),
            });
        }

        console.log(`📝 Added ${payload.data.to[0]} to suppression list (${suppressionReason})`);
      } catch (err) {
        console.error('⚠️ Non-fatal: Failed to update suppression list:', err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Webhook processed in ${duration}ms`);

    return new Response(JSON.stringify({
      message: 'Event recorded successfully',
      event_id: insertedEvent?.id,
      campaign_id: effectiveCampaignId,
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

    if (supabase && governanceWebhookId) {
      try {
        await scheduleWebhookDeliveryRetryOrDeadLetter(
          supabase,
          governanceWebhookId,
          'unhandled_exception',
          error?.message || 'Unhandled webhook processing error',
        );
      } catch (retryScheduleError) {
        console.error('❌ Failed to schedule webhook retry/dead-letter:', retryScheduleError);
      }
    }

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

  // Normalize event type aliases before counting
  const eventTypeMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    bounced: 'bounced',
    opened: 'opened',
    open: 'opened',
    clicked: 'clicked',
    click: 'clicked',
    complained: 'complained',
    unsubscribed: 'unsubscribed',
  };

  // Count unique recipients per normalized event type
  const uniqueByType = new Map<string, Set<string>>();

  for (const event of events || []) {
    const key = eventTypeMap[event.event_type] || event.event_type;
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

  // Milestone 1: Domain reputation is informational only.
  // Never auto-pause/lock domains based on bounce/complaint thresholds.
  console.warn(
    `⚠️ Domain ${domainId} reputation event: ${eventType}. ` +
      `Bounce ${(updates.bounce_rate_30d * 100).toFixed(2)}%, ` +
      `Complaints ${(updates.complaint_rate_30d * 100).toFixed(3)}% (informational)`
  );

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

serve(handler);