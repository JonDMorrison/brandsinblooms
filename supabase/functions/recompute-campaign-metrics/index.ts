import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: [E36] - Add service-role-or-JWT authentication
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = serviceRoleKey!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
    }

    const { campaign_id, tenant_id, force = false } = await req.json();

    console.log(`📊 Recompute metrics request: campaign_id=${campaign_id}, tenant_id=${tenant_id}, force=${force}`);

    if (!campaign_id && !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Either campaign_id or tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { campaign_id: string; metrics: any; success: boolean; error?: string }[] = [];

    const buildLinkMetrics = async (campaignId: string) => {
      const { data: clicks, error } = await supabase
        .from('email_tracking_events')
        .select('customer_email, link_id, event_data, tracked_links(url)')
        .eq('campaign_id', campaignId)
        .in('event_type', ['click', 'clicked']);

      if (error) throw error;

      const linkMap = new Map<string, { url: string; recipients: Set<string> }>();

      for (const click of clicks || []) {
        const rawLinkId = typeof click.link_id === 'string' && click.link_id.trim()
          ? click.link_id
          : typeof click.event_data?.click_link === 'string' && click.event_data.click_link.trim()
            ? click.event_data.click_link.trim()
            : 'unknown';
        const url = typeof click.tracked_links?.url === 'string' && click.tracked_links.url.trim()
          ? click.tracked_links.url.trim()
          : typeof click.event_data?.click_link === 'string' && click.event_data.click_link.trim()
            ? click.event_data.click_link.trim()
            : 'Unknown';

        if (!linkMap.has(rawLinkId)) {
          linkMap.set(rawLinkId, { url, recipients: new Set<string>() });
        }

        linkMap.get(rawLinkId)!.recipients.add(String(click.customer_email || '').toLowerCase());
      }

      return Array.from(linkMap.entries())
        .map(([linkId, value]) => ({
          link_id: linkId,
          url: value.url,
          clicks: value.recipients.size,
        }))
        .sort((left, right) => right.clicks - left.clicks)
        .slice(0, 5);
    };

    const computeMetricsFallback = async (campaignId: string) => {
      const [{ data: messageRows, error: messageError }, { data: eventRows, error: eventError }] = await Promise.all([
        supabase
          .from('email_messages')
          .select('email, status')
          .eq('campaign_id', campaignId),
        supabase
          .from('email_tracking_events')
          .select('customer_email, event_type, is_mpp_guess, event_data')
          .eq('campaign_id', campaignId),
      ]);

      if (messageError) throw messageError;
      if (eventError) throw eventError;

      const sentFromLedger = (messageRows || []).filter((row: any) => row.status !== 'skipped').length;
      const recipientState = new Map<string, {
        sent: boolean;
        delivered: boolean;
        opened: boolean;
        clicked: boolean;
        bounced: boolean;
        hardBounced: boolean;
        complained: boolean;
        unsubscribed: boolean;
        openedNonMpp: boolean;
      }>();

      for (const event of eventRows || []) {
        const recipient = String(event.customer_email || '').trim().toLowerCase();
        if (!recipient) continue;

        const state = recipientState.get(recipient) || {
          sent: false,
          delivered: false,
          opened: false,
          clicked: false,
          bounced: false,
          hardBounced: false,
          complained: false,
          unsubscribed: false,
          openedNonMpp: false,
        };

        const eventType = String(event.event_type || '');
        const bounceSeverity = String(event.event_data?.bounce_severity || '');
        const bounceType = String(event.event_data?.bounce_type || '');

        if (eventType === 'sent') state.sent = true;
        if (eventType === 'delivered') state.delivered = true;
        if (eventType === 'open' || eventType === 'opened') {
          state.opened = true;
          if (!event.is_mpp_guess) state.openedNonMpp = true;
        }
        if (eventType === 'click' || eventType === 'clicked') state.clicked = true;
        if (eventType === 'bounce' || eventType === 'bounced') {
          state.bounced = true;
          if (bounceSeverity === 'hard' || bounceType === 'hard' || bounceType === 'hard_bounce') {
            state.hardBounced = true;
          }
        }
        if (eventType === 'complaint' || eventType === 'complained') state.complained = true;
        if (eventType === 'unsubscribed') state.unsubscribed = true;

        recipientState.set(recipient, state);
      }

      const recipients = Array.from(recipientState.values());
      const totals = {
        sent: sentFromLedger > 0 ? sentFromLedger : recipients.length,
        sent_events: recipients.filter((row) => row.sent).length,
        observed_recipients: recipients.length,
        delivered: recipients.filter((row) => row.delivered).length,
        successful_reach: Math.max(
          recipients.filter((row) => row.delivered).length - recipients.filter((row) => row.hardBounced).length,
          0,
        ),
        opens: recipients.filter((row) => row.opened).length,
        clicks: recipients.filter((row) => row.clicked).length,
        bounces: recipients.filter((row) => row.bounced).length,
        hard_bounces: recipients.filter((row) => row.hardBounced).length,
        complaints: recipients.filter((row) => row.complained).length,
        unsubscribes: recipients.filter((row) => row.unsubscribed).length,
        opens_non_mpp: recipients.filter((row) => row.openedNonMpp).length,
        unique_engaged: recipients.filter((row) => row.opened || row.clicked).length,
        skipped: (messageRows || []).filter((row: any) => row.status === 'skipped').length,
      };

      const backfilledEvents = (eventRows || []).filter(
        (event: any) => String(event.event_data?.backfilled || 'false').toLowerCase() === 'true',
      );
      const links = await buildLinkMetrics(campaignId);

      const metrics = {
        totals,
        scores: {
          reach: totals.sent > 0 ? Number(((totals.successful_reach / totals.sent) * 100).toFixed(2)) : 0,
          interaction: totals.successful_reach > 0
            ? Number(((totals.unique_engaged / totals.successful_reach) * 100).toFixed(2))
            : 0,
        },
        rates: {
          delivery: totals.sent > 0 ? Number(((totals.delivered / totals.sent) * 100).toFixed(2)) : 0,
          open_reported: totals.successful_reach > 0 ? Number(((totals.opens / totals.successful_reach) * 100).toFixed(2)) : 0,
          open_adjusted: totals.successful_reach > 0 ? Number(((totals.opens_non_mpp / totals.successful_reach) * 100).toFixed(2)) : 0,
          click: totals.successful_reach > 0 ? Number(((totals.clicks / totals.successful_reach) * 100).toFixed(2)) : 0,
          bounce: totals.sent > 0 ? Number(((totals.hard_bounces / totals.sent) * 100).toFixed(2)) : 0,
          complaint: totals.sent > 0 ? Number(((totals.complaints / totals.sent) * 100).toFixed(2)) : 0,
          click_to_open: totals.opens > 0 ? Number(((totals.clicks / totals.opens) * 100).toFixed(2)) : 0,
        },
        diagnostics: {
          opens_without_delivery: recipients.filter((row) => row.opened && !row.delivered).length,
          clicks_without_delivery: recipients.filter((row) => row.clicked && !row.delivered).length,
          missing_send_ledger: sentFromLedger === 0 && recipients.length > 0,
        },
        reconciliation: {
          backfill_applied: backfilledEvents.length > 0,
          backfilled_events: backfilledEvents.length,
          last_backfilled_at: backfilledEvents.length > 0 ? new Date().toISOString() : null,
        },
        links,
        computed_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('crm_campaigns')
        .update({
          metrics,
          total_sent: totals.sent,
          total_opens: totals.opens,
          total_clicks: totals.clicks,
          open_rate: metrics.rates.open_reported,
          click_rate: metrics.rates.click,
          rollup_refreshed_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      return metrics;
    };

    if (campaign_id) {
      // Single campaign recompute
      console.log(`📊 Recomputing metrics for campaign: ${campaign_id}`);

      try {
        const { data, error } = await supabase.rpc('recompute_campaign_metrics', {
          p_campaign_id: campaign_id
        });

        if (error) {
          console.log(`⚠️ RPC failed, using direct computation: ${error.message}`);
          const metrics = await computeMetricsFallback(campaign_id);
          console.log(`✅ Recomputed metrics for ${campaign_id}:`, metrics);
          results.push({ campaign_id, metrics, success: true });
        } else {
          console.log(`✅ Recomputed metrics for ${campaign_id}`);
          results.push({ campaign_id, metrics: data, success: true });
        }
      } catch (err: any) {
        console.error(`❌ Error recomputing metrics for ${campaign_id}:`, err);
        results.push({ campaign_id, metrics: null, success: false, error: err.message });
      }
    } else if (tenant_id) {
      // Recompute all sent campaigns for a tenant
      console.log(`📊 Recomputing metrics for all campaigns in tenant: ${tenant_id}`);

      const { data: campaigns, error: fetchError } = await supabase
        .from('crm_campaigns')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('status', 'sent');

      if (fetchError) {
        console.error('❌ Error fetching campaigns:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch campaigns' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      for (const campaign of campaigns || []) {
        const { data, error } = await supabase.rpc('recompute_campaign_metrics', {
          p_campaign_id: campaign.id
        });

        if (error) {
          console.error(`❌ Error recomputing ${campaign.id}:`, error);
          results.push({ campaign_id: campaign.id, metrics: null, success: false, error: error.message });
        } else {
          results.push({ campaign_id: campaign.id, metrics: data, success: true });
        }
      }

      console.log(`✅ Recomputed metrics for ${results.filter(r => r.success).length}/${campaigns?.length || 0} campaigns`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recomputed_count: results.filter(r => r.success).length,
        failed_count: results.filter(r => !r.success).length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in recompute-campaign-metrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
