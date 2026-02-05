import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaimedCampaign {
  id: string;
  name: string;
  user_id: string;
  tenant_id: string;
  scheduled_at: string;
  segment_id?: string;
  [key: string]: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🚀 [auto-send-campaigns] Starting scheduled campaign processing...');

  try {
    // Step 1: Atomically claim scheduled campaigns using the RPC
    // This uses FOR UPDATE SKIP LOCKED to prevent double-claiming
    console.log('📋 Claiming scheduled campaigns with atomic RPC...');

    const { data: claimedCampaigns, error: claimError } = await supabase
      .rpc('claim_scheduled_campaigns', { batch_size: 10 });

    if (claimError) {
      console.error('❌ Failed to claim campaigns:', claimError);
      throw new Error(`Failed to claim campaigns: ${claimError.message}`);
    }

    const campaigns = (claimedCampaigns || []) as ClaimedCampaign[];

    console.log(`📧 Claimed ${campaigns.length} campaigns for sending`);

    if (campaigns.length > 0) {
      console.log('📋 Claimed campaign IDs:', campaigns.map(c => c.id).join(', '));
    }

    if (campaigns.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`✅ No campaigns ready for auto-send. Completed in ${duration}ms`);

      return new Response(JSON.stringify({
        success: true,
        message: 'No campaigns ready for auto-send',
        campaignsSent: 0,
        campaignsFailed: 0,
        durationMs: duration
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let campaignsSent = 0;
    let campaignsFailed = 0;
    const results: Array<{id: string, name: string, status: string, durationMs: number, error?: string}> = [];

    // Process each claimed campaign
    for (const campaign of campaigns) {
      const campaignStartTime = Date.now();

      try {
        console.log(`📨 Processing campaign: "${campaign.name}" (${campaign.id})`);

        // Check if user has auto-send enabled
        const { data: userProfile } = await supabase
          .from('company_profiles')
          .select('feature_flags')
          .eq('user_id', campaign.user_id)
          .single();

        const autoSendEnabled = userProfile?.feature_flags?.auto_send_campaigns !== false;

        if (!autoSendEnabled) {
          console.log(`⏭️ Skipping campaign ${campaign.id} - auto-send disabled for user`);

          // Reset to scheduled so it can be sent manually
          await supabase
            .from('crm_campaigns')
            .update({
              status: 'scheduled',
              send_started_at: null,
              send_error: 'Auto-send disabled for user'
            })
            .eq('id', campaign.id);

          results.push({
            id: campaign.id,
            name: campaign.name,
            status: 'skipped',
            durationMs: Date.now() - campaignStartTime,
            error: 'Auto-send disabled'
          });
          continue;
        }

        // Call the email sending service
        console.log(`🚀 Invoking send-email-campaign for ${campaign.id}...`);

        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email-campaign', {
          body: {
            campaignId: campaign.id,
            testMode: false
          }
        });

        if (sendError) {
          throw new Error(`Send function error: ${sendError.message}`);
        }

        if (sendResult?.error) {
          throw new Error(sendResult.error);
        }

        const queuedCount = sendResult?.total_recipients || sendResult?.metrics?.queued || 0;

        // IMPORTANT: send-email-campaign queues recipients and persists them.
        // Completion is handled by the queue worker based on the email_messages ledger.
        const campaignDuration = Date.now() - campaignStartTime;
        console.log(`✅ Campaign ${campaign.id} queued successfully (${queuedCount} recipients) in ${campaignDuration}ms`);

        campaignsSent++;
        results.push({
          id: campaign.id,
          name: campaign.name,
          status: 'queued',
          durationMs: campaignDuration
        });

        // Send success notification (async, don't wait)
        sendSuccessNotification(campaign, queuedCount).catch(e =>
          console.warn('Failed to send success notification:', e)
        );

      } catch (campaignError: any) {
        const campaignDuration = Date.now() - campaignStartTime;
        const errorMessage = campaignError.message || 'Unknown error';

        console.error(`❌ Error sending campaign ${campaign.id} after ${campaignDuration}ms:`, errorMessage);

        // Failure: Update campaign status to failed with error
        await supabase
          .from('crm_campaigns')
          .update({
            status: 'failed',
            send_error: errorMessage,
            metadata: {
              ...campaign.metadata,
              last_error: errorMessage,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', campaign.id);

        campaignsFailed++;
        results.push({
          id: campaign.id,
          name: campaign.name,
          status: 'failed',
          durationMs: campaignDuration,
          error: errorMessage
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`🎉 Auto-send processing completed in ${totalDuration}ms. Sent: ${campaignsSent}, Failed: ${campaignsFailed}`);

    return new Response(JSON.stringify({
      success: true,
      campaignsSent,
      campaignsFailed,
      campaignsClaimed: campaigns.length,
      results,
      durationMs: totalDuration,
      processedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error in auto-send-campaigns function after ${duration}ms:`, error);

    return new Response(JSON.stringify({
      error: error.message,
      success: false,
      durationMs: duration
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function sendSuccessNotification(campaign: any, audienceSize: number) {
  console.log(`🎉 Sending success notification for campaign ${campaign.id}`);

  // Here you would integrate with your notification system
  // For now, we'll just log it
  console.log(`✅ Notification: Campaign "${campaign.name}" sent successfully to ${audienceSize} recipients`);
}

serve(handler);
