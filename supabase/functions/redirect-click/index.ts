import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (per IP, 60 requests/min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

// Clean up old rate limit entries periodically (prevent memory leak)
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

// Hash IP address for privacy
function hashIP(ip: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'salt_for_privacy');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Validate UUID format
function isValidUUID(str: string | null): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('x-real-ip') || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';
  
  // Check rate limit
  if (!checkRateLimit(clientIP)) {
    console.warn(`🚫 Rate limit exceeded for IP: ${hashIP(clientIP)}`);
    return new Response('Rate limit exceeded', { 
      status: 429,
      headers: {
        'Retry-After': '60',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });
  }

  const url = new URL(req.url);
  const campaignId = url.searchParams.get('cid');
  const linkId = url.searchParams.get('lid');
  const recipientId = url.searchParams.get('rid');
  const tenantId = url.searchParams.get('t');
  const customerEmail = url.searchParams.get('e');

  console.log(`🔗 Click redirect: cid=${campaignId}, lid=${linkId}, rid=${recipientId}`);

  // Validate required parameters
  if (!linkId) {
    console.error('❌ Missing link ID');
    return new Response('Invalid link', { 
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });
  }

  // Validate UUID formats
  if (!isValidUUID(linkId)) {
    console.error('❌ Invalid link ID format:', linkId);
    return new Response('Invalid link', { 
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });
  }

  if (campaignId && !isValidUUID(campaignId)) {
    console.error('❌ Invalid campaign ID format:', campaignId);
    return new Response('Invalid link', { 
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });
  }

  if (recipientId && !isValidUUID(recipientId)) {
    console.error('❌ Invalid recipient ID format:', recipientId);
    return new Response('Invalid link', { 
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });
  }

  if (tenantId && !isValidUUID(tenantId)) {
    console.error('❌ Invalid tenant ID format:', tenantId);
    return new Response('Invalid link', { 
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the tracked link - ONLY fetch URL by lid, require tenant match if provided
    let query = supabase
      .from('tracked_links')
      .select('url, campaign_id, tenant_id')
      .eq('id', linkId);
    
    // Add tenant filter if provided for security
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data: link, error: linkError } = await query.single();

    if (linkError || !link) {
      console.error('❌ Link not found:', linkError);
      return new Response('Link not found', { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
          ...corsHeaders
        }
      });
    }

    const destinationUrl = link.url;
    const effectiveCampaignId = campaignId || link.campaign_id;
    const effectiveTenantId = tenantId || link.tenant_id;

    // Get User Agent for tracking
    const userAgent = req.headers.get('user-agent') || '';
    const ipHash = hashIP(clientIP);

    // Resolve customer email if we have recipient_id
    let email = customerEmail;
    if (!email && recipientId) {
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('email')
        .eq('id', recipientId)
        .single();
      email = customer?.email;
    }

    // Record the click event (upsert for idempotency)
    const eventData = {
      campaign_id: effectiveCampaignId,
      customer_email: email || 'unknown',
      event_type: 'click',
      event_data: {
        click_link: destinationUrl,
        link_id: linkId,
        clicked_at: new Date().toISOString()
      },
      tenant_id: effectiveTenantId,
      link_id: linkId,
      user_agent: userAgent,
      ip_hash: ipHash,
      provider_message_id: `click_${linkId}_${email || recipientId || 'anon'}_${Date.now()}`,
      event_ts_provider: new Date().toISOString(),
      ingested_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('email_tracking_events')
      .insert(eventData);

    if (insertError) {
      // Ignore duplicate key errors - click already recorded
      if (insertError.code !== '23505') {
        console.error('⚠️ Error recording click (non-fatal):', insertError);
      }
    } else {
      console.log(`✅ Recorded click for campaign ${effectiveCampaignId}, link ${linkId}`);
    }

    // Periodic cleanup of rate limit map
    if (Math.random() < 0.01) { // 1% chance to clean up
      cleanupRateLimitMap();
    }

    // 302 redirect to destination with security headers
    return new Response(null, {
      status: 302,
      headers: {
        'Location': destinationUrl,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('❌ Error in redirect-click:', error);
    // Still try to redirect even on error - use a safe fallback
    return new Response('Redirecting...', {
      status: 302,
      headers: {
        'Location': 'https://bloomsuite.app',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        ...corsHeaders
      }
    });
  }
});
