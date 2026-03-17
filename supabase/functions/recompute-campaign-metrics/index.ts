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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaign_id, tenant_id, force = false } = await req.json();

    console.log(`📊 Recompute metrics request: campaign_id=${campaign_id}, tenant_id=${tenant_id}, force=${force}`);

    if (!campaign_id && !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Either campaign_id or tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { campaign_id: string; metrics: any; success: boolean; error?: string }[] = [];

    // Helper to compute metrics from email_tracking_events
    const computeMetricsFromEvents = async (campaignId: string) => {
      const { data: events, error: eventsError } = await supabase
        .from('email_tracking_events')
        .select('event_type')
        .eq('campaign_id', campaignId);

      if (eventsError) {
        throw eventsError;
      }

      const counts = {
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        complained: 0,
        unsubscribed: 0
      };

      // Normalize event_type aliases: redirect-click stores 'click', webhook stores 'clicked'; similar for 'open'/'opened'
      const eventTypeMap: Record<string, keyof typeof counts> = {
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

      for (const event of events || []) {
        const normalizedType = eventTypeMap[event.event_type];
        if (normalizedType) {
          counts[normalizedType]++;
        }
      }

      // Update campaign with new metrics
      const { error: updateError } = await supabase
        .from('crm_campaigns')
        .update({
          total_sent: counts.sent,
          total_opens: counts.opened,
          total_clicks: counts.clicked,
          open_rate: counts.delivered > 0 ? (counts.opened / counts.delivered) * 100 : 0,
          click_rate: counts.delivered > 0 ? (counts.clicked / counts.delivered) * 100 : 0,
          metrics: counts,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) {
        throw updateError;
      }

      return counts;
    };

    if (campaign_id) {
      // Single campaign recompute
      console.log(`📊 Recomputing metrics for campaign: ${campaign_id}`);
      
      try {
        // First try RPC, fallback to direct computation
        const { data, error } = await supabase.rpc('recompute_campaign_metrics', {
          p_campaign_id: campaign_id
        });

        if (error) {
          console.log(`⚠️ RPC failed, using direct computation: ${error.message}`);
          const metrics = await computeMetricsFromEvents(campaign_id);
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
