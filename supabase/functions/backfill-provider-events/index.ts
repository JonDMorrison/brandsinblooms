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

// Sleep utility for backoff
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch with exponential backoff
async function fetchWithBackoff(
  url: string, 
  options: RequestInit, 
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429 || response.status >= 500) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`⏳ Rate limited or server error (${response.status}), backing off ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Fetch error, backing off ${backoffMs}ms...`, error);
      await sleep(backoffMs);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
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

    // Calculate time window: default to [sent_at - 1 hour, now]
    const effectiveStartDate = startDate || (
      campaign.sent_at 
        ? new Date(new Date(campaign.sent_at).getTime() - 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    );
    const effectiveEndDate = endDate || new Date().toISOString();

    console.log(`📅 Backfill window: ${effectiveStartDate} to ${effectiveEndDate}`);

    // Store current metrics as parity snapshot (before)
    if (campaign.metrics) {
      await supabase
        .from('crm_campaigns')
        .update({ 
          metrics_parity_snapshot: campaign.metrics 
        })
        .eq('id', campaignId);
      console.log(`📸 Stored parity snapshot`);
    }

    // Count existing events before backfill
    const { count: beforeCount } = await supabase
      .from('email_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    let eventsIngested = 0;
    let duplicatesSkipped = 0;
    let eventsFetched = 0;

    // If Resend API key is available, fetch events from provider
    if (resendApiKey) {
      console.log(`📡 Fetching events from Resend for campaign ${campaignId}...`);
      
      try {
        const response = await fetchWithBackoff('https://api.resend.com/emails', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const { data: emails } = await response.json();
          
          if (emails && Array.isArray(emails)) {
            // Filter emails by campaign_id tag and time window
            const campaignEmails = emails.filter((email: any) => {
              const hasCampaignTag = email.tags?.some((tag: any) => 
                tag.name === 'campaign_id' && tag.value === campaignId
              );
              if (!hasCampaignTag) return false;
              
              // Check time window
              const emailTime = new Date(email.created_at).getTime();
              const startTime = new Date(effectiveStartDate).getTime();
              const endTime = new Date(effectiveEndDate).getTime();
              return emailTime >= startTime && emailTime <= endTime;
            });

            eventsFetched = campaignEmails.length;
            console.log(`📧 Found ${eventsFetched} emails for campaign in time window`);

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
        } else {
          console.warn(`Resend API returned ${response.status}`);
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
      timeWindow: {
        start: effectiveStartDate,
        end: effectiveEndDate,
      },
      counts: {
        fetched: eventsFetched,
        inserted: eventsIngested,
        deduped: duplicatesSkipped,
        beforeTotal: beforeCount || 0,
        afterTotal: afterCount || 0,
      },
      parity: {
        delta: eventsDelta,
        percentage: parityPercentage.toFixed(2),
        status: parityStatus,
      },
      metrics: metricsResult,
    };

    console.log(`✅ Backfill complete:`, JSON.stringify(result, null, 2));

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
