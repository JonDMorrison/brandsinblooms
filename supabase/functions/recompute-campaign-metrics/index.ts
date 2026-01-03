import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    if (campaign_id) {
      // Single campaign recompute
      console.log(`📊 Recomputing metrics for campaign: ${campaign_id}`);
      
      const { data, error } = await supabase.rpc('recompute_campaign_metrics', {
        p_campaign_id: campaign_id
      });

      if (error) {
        console.error(`❌ Error recomputing metrics for ${campaign_id}:`, error);
        results.push({ campaign_id, metrics: null, success: false, error: error.message });
      } else {
        console.log(`✅ Recomputed metrics for ${campaign_id}`);
        results.push({ campaign_id, metrics: data, success: true });
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
