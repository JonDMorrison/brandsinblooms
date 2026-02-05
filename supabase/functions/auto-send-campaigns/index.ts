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
  send_attempts?: number;
  claim_token?: string;
  [key: string]: any;
}

interface CampaignResult {
  id: string;
  name: string;
  status: 'sent' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  recipientCount?: number;
  sendAttempts?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const runId = crypto.randomUUID().slice(0, 8);

  console.log(`🚀 [auto-send-campaigns][${runId}] Starting scheduled campaign processing...`);
  console.log(`📅 [${runId}] Timestamp: ${new Date().toISOString()}`);

  try {
    // Check for stuck campaigns before claiming (for logging purposes)
    const { data: stuckCampaigns } = await supabase
      .from('crm_campaigns')
      .select('id, name, sending_started_at, send_attempts')
      .eq('status', 'sending')
      .lt('sending_started_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (stuckCampaigns && stuckCampaigns.length > 0) {
      console.log(`⚠️ [${runId}] Found ${stuckCampaigns.length} stuck campaigns (sending > 15 min)`);
      stuckCampaigns.forEach(c => {
        console.log(`   - "${c.name}" (${c.id}) - attempts: ${c.send_attempts || 0}, started: ${c.sending_started_at}`);
      });
      console.log(`🔄 [${runId}] Recovery will be handled atomically by claim_scheduled_campaigns RPC`);
    }

    // Step 1: Atomically claim scheduled campaigns using the RPC
    // This uses FOR UPDATE SKIP LOCKED to prevent double-claiming
    console.log('📋 Claiming scheduled campaigns with atomic RPC...');

    const { data: claimedCampaigns, error: claimError } = await supabase
      .rpc('claim_scheduled_campaigns', { batch_size: 10 });

    if (claimError) {
      console.error(`❌ [${runId}] Failed to claim campaigns:`, claimError);
      throw new Error(`Failed to claim campaigns: ${claimError.message}`);
    }

    const campaigns = (claimedCampaigns || []) as ClaimedCampaign[];

    console.log(`📧 Claimed ${campaigns.length} campaigns for sending`);

    if (campaigns.length > 0) {
      console.log(`📋 [${runId}] Claimed campaign details:`);
      campaigns.forEach((c, i) => {
        console.log(`   ${i + 1}. "${c.name}" (${c.id}) - scheduled: ${c.scheduled_at}, attempts: ${c.send_attempts || 1}`);
      });
    }

    if (campaigns.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`✅ No campaigns ready for auto-send. Completed in ${duration}ms`);

      return new Response(JSON.stringify({
        success: true,
        message: 'No campaigns ready for auto-send',
        campaignsSent: 0,
        campaignsFailed: 0,
        campaignsClaimed: 0,
        durationMs: duration,
        processedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let campaignsSent = 0;
    let campaignsFailed = 0;
    const results: CampaignResult[] = [];

    // Process each claimed campaign
    for (const campaign of campaigns) {
      const campaignStartTime = Date.now();

      try {
        console.log(`📨 Processing campaign: "${campaign.name}" (${campaign.id})`);

      try {
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
              sending_started_at: null,
              send_started_at: null,
              failure_reason: 'Auto-send disabled for user'
            })
            .eq('id', campaign.id);

          results.push({
            id: campaign.id,
            name: campaign.name,
            status: 'skipped',
            durationMs: Date.now() - campaignStartTime,
            error: 'Auto-send disabled',
            sendAttempts
          });
          continue;
        }

        // Verify claim is still valid before sending
        if (campaign.claim_token) {
          const { data: claimValid } = await supabase.rpc('verify_campaign_claim', {
            p_campaign_id: campaign.id,
            p_claim_token: campaign.claim_token
          });

          if (!claimValid) {
            console.warn(`⚠️ [${runId}] Campaign ${campaign.id} claim invalid - skipping to prevent double-send`);
            results.push({
              id: campaign.id,
              name: campaign.name,
              status: 'skipped',
              durationMs: Date.now() - campaignStartTime,
              error: 'Claim token invalid',
              sendAttempts
            });
            continue;
          }
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
          error: errorMessage,
          sendAttempts
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    console.log(`🎉 [${runId}] Auto-send processing completed`);
    console.log(`   Duration: ${totalDuration}ms`);
    console.log(`   Claimed: ${campaigns.length}, Sent: ${campaignsSent}, Failed: ${campaignsFailed}`);

    // Log summary of results
    results.forEach(r => {
      const icon = r.status === 'sent' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
      console.log(`   ${icon} ${r.name}: ${r.status} (${r.durationMs}ms)${r.error ? ` - ${r.error}` : ''}`);
    });

    return new Response(JSON.stringify({
      success: true,
      runId,
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
      runId,
      durationMs: duration,
      processedAt: new Date().toISOString()
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
