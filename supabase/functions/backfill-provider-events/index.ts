import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BackfillRequest {
  campaignId: string;
  startDate?: string;
  endDate?: string;
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

// Detect MPP (Mail Privacy Protection) heuristically
function isMPPOpen(userAgent: string, ip: string): boolean {
  if (!userAgent) return false;
  const isAppleMail = /AppleMail|Apple Mail/i.test(userAgent);
  const isApplePrivateRelay = /17\.\d+\.\d+\.\d+/.test(ip) || ip.includes('icloud-private-relay');
  return isAppleMail && (isApplePrivateRelay || ip === 'unknown');
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, startDate, endDate }: BackfillRequest = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Backfill request for campaign: ${campaignId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_campaigns')
      .select('id, tenant_id, sent_at, metrics')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count existing events before backfill
    const { count: beforeCount } = await supabase
      .from('email_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    let eventsIngested = 0;
    let duplicatesSkipped = 0;

    // If Resend API key is available, fetch events from provider
    if (resendApiKey) {
      console.log(`📡 Fetching events from Resend for campaign ${campaignId}...`);
      
      // Note: Resend's API for fetching email events by campaign is limited
      // In production, you'd use their webhook history or events API
      // For now, we'll work with what's in our database and recompute
      
      // Attempt to fetch recent emails sent by this campaign
      // Resend doesn't have a direct "get events by campaign" endpoint,
      // but we can use tags to filter
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const { data: emails } = await response.json();
          
          if (emails && Array.isArray(emails)) {
            // Filter emails by campaign_id tag
            const campaignEmails = emails.filter((email: any) => 
              email.tags?.some((tag: any) => 
                tag.name === 'campaign_id' && tag.value === campaignId
              )
            );

            console.log(`📧 Found ${campaignEmails.length} emails for campaign`);

            // For each email, create/update tracking events
            for (const email of campaignEmails) {
              const eventBase = {
                campaign_id: campaignId,
                tenant_id: campaign.tenant_id,
                provider_message_id: email.id,
                customer_email: Array.isArray(email.to) ? email.to[0] : email.to,
              };

              // Insert sent event
              const { error: sentError } = await supabase
                .from('email_tracking_events')
                .upsert({
                  ...eventBase,
                  event_type: 'sent',
                  event_ts_provider: email.created_at,
                  ingested_at: new Date().toISOString(),
                  event_data: { backfilled: true },
                }, {
                  onConflict: 'tenant_id,provider_message_id,event_type,event_ts_provider',
                  ignoreDuplicates: true,
                });

              if (!sentError) {
                eventsIngested++;
              } else if (sentError.code === '23505') {
                duplicatesSkipped++;
              }
            }
          }
        }
      } catch (fetchError) {
        console.warn('Could not fetch from Resend API:', fetchError);
        // Continue with recompute even if fetch fails
      }
    }

    // Recompute metrics from existing events
    console.log(`🔄 Recomputing metrics for campaign ${campaignId}...`);
    
    const { data: metricsResult, error: recomputeError } = await supabase
      .rpc('recompute_campaign_metrics', { p_campaign_id: campaignId });

    if (recomputeError) {
      console.error('Recompute error:', recomputeError);
    }

    // Count events after backfill
    const { count: afterCount } = await supabase
      .from('email_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    // Calculate parity
    const eventsDelta = (afterCount || 0) - (beforeCount || 0);
    const parityPercentage = beforeCount && beforeCount > 0 
      ? Math.abs(eventsDelta / beforeCount * 100) 
      : 0;
    const parityStatus = parityPercentage <= 0.1 ? 'green' : parityPercentage <= 1 ? 'yellow' : 'red';

    const result = {
      success: true,
      campaignId,
      beforeCount: beforeCount || 0,
      afterCount: afterCount || 0,
      eventsIngested,
      duplicatesSkipped,
      parity: {
        delta: eventsDelta,
        percentage: parityPercentage.toFixed(2),
        status: parityStatus,
      },
      metrics: metricsResult,
    };

    console.log(`✅ Backfill complete:`, result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
