import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkCampaignRequest {
  campaignId: string;
  batchSize?: number;
  rateLimit?: number; // emails per minute
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, batchSize = 50, rateLimit = 20 }: BulkCampaignRequest = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('crm_campaigns')
      .select('*, campaign_segments(segment_id), campaign_personas(persona_id)')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;

    // Get recipients based on segments/personas
    let recipientsQuery = supabaseClient
      .from('crm_customers')
      .select('id, email, first_name, last_name')
      .eq('tenant_id', campaign.tenant_id)
      .eq('opt_out', false);

    // Filter by segments if specified
    if (campaign.campaign_segments && campaign.campaign_segments.length > 0) {
      const segmentIds = campaign.campaign_segments.map((cs: any) => cs.segment_id);
      const { data: segmentCustomers } = await supabaseClient
        .from('customer_segments')
        .select('customer_id')
        .in('segment_id', segmentIds);
      
      const customerIds = segmentCustomers?.map(sc => sc.customer_id) || [];
      if (customerIds.length > 0) {
        recipientsQuery = recipientsQuery.in('id', customerIds);
      }
    }

    // Filter by personas if specified
    if (campaign.persona_ids && campaign.persona_ids.length > 0) {
      recipientsQuery = recipientsQuery.in('persona_id', campaign.persona_ids);
    }

    const { data: recipients, error: recipientsError } = await recipientsQuery;
    if (recipientsError) throw recipientsError;

    console.log(`Starting bulk campaign send to ${recipients?.length || 0} recipients`);

    // Process in background with rate limiting
    const delayBetweenBatches = (60 / rateLimit) * batchSize * 1000; // ms delay to respect rate limit

    EdgeRuntime.waitUntil(
      (async () => {
        let processed = 0;
        
        for (let i = 0; i < (recipients?.length || 0); i += batchSize) {
          const batch = recipients!.slice(i, i + batchSize);
          
          // Send batch via email service
          for (const recipient of batch) {
            try {
              // Call send-campaign-email function for each recipient
              await supabaseClient.functions.invoke('send-campaign-email', {
                body: {
                  campaignId,
                  recipientId: recipient.id,
                  recipientEmail: recipient.email,
                  recipientName: `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim(),
                }
              });

              processed++;

              // Update campaign metrics
              const { data: currentMetrics } = await supabaseClient
                .from('crm_campaigns')
                .select('metrics')
                .eq('id', campaignId)
                .single();

              const metrics = (currentMetrics?.metrics as any) || {};
              await supabaseClient
                .from('crm_campaigns')
                .update({
                  metrics: {
                    ...metrics,
                    sent: processed,
                  }
                })
                .eq('id', campaignId);

            } catch (error) {
              console.error(`Failed to send to ${recipient.email}:`, error);
              
              // Log tracking event for failure
              await supabaseClient.from('email_tracking_events').insert({
                campaign_id: campaignId,
                customer_email: recipient.email,
                event_type: 'bounced',
                tenant_id: campaign.tenant_id,
              });
            }
          }

          // Rate limit delay between batches
          if (i + batchSize < (recipients?.length || 0)) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
          }

          console.log(`Progress: ${processed}/${recipients?.length || 0} (${Math.round((processed / (recipients?.length || 1)) * 100)}%)`);
        }

        // Mark campaign as sent
        await supabaseClient
          .from('crm_campaigns')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', campaignId);

        console.log(`Bulk campaign ${campaignId} completed: ${processed} sent`);
      })()
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bulk send started for ${recipients?.length || 0} recipients. Processing in background.`,
        totalRecipients: recipients?.length || 0,
        estimatedMinutes: Math.ceil((recipients?.length || 0) / rateLimit),
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error("Bulk campaign error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});