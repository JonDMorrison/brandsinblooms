import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const campaignId = url.searchParams.get('cid');
  const linkId = url.searchParams.get('lid');
  const recipientId = url.searchParams.get('rid');
  const tenantId = url.searchParams.get('t');
  const customerEmail = url.searchParams.get('e');

  console.log(`🔗 Click redirect: cid=${campaignId}, lid=${linkId}, rid=${recipientId}`);

  if (!linkId) {
    console.error('❌ Missing link ID');
    return new Response('Invalid link', { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the tracked link
    const { data: link, error: linkError } = await supabase
      .from('tracked_links')
      .select('url, campaign_id, tenant_id')
      .eq('id', linkId)
      .single();

    if (linkError || !link) {
      console.error('❌ Link not found:', linkError);
      return new Response('Link not found', { status: 404 });
    }

    const destinationUrl = link.url;
    const effectiveCampaignId = campaignId || link.campaign_id;
    const effectiveTenantId = tenantId || link.tenant_id;

    // Get IP and User Agent for tracking
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
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

    // 302 redirect to destination
    return new Response(null, {
      status: 302,
      headers: {
        'Location': destinationUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error('❌ Error in redirect-click:', error);
    // Still try to redirect even on error
    return new Response('Redirecting...', {
      status: 302,
      headers: {
        'Location': 'https://bloomsuite.app',
        ...corsHeaders
      }
    });
  }
});
