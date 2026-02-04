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
    // Step 1: Atomically claim scheduled campaigns using the RPC
    // This uses FOR UPDATE SKIP LOCKED to prevent double-claiming
    console.log(`📋 [${runId}] Claiming scheduled campaigns with atomic RPC...`);
    
    const { data: claimedCampaigns, error: claimError } = await supabase
      .rpc('claim_scheduled_campaigns', { batch_size: 10 });

    if (claimError) {
      console.error(`❌ [${runId}] Failed to claim campaigns:`, claimError);
      throw new Error(`Failed to claim campaigns: ${claimError.message}`);
    }

    const campaigns = (claimedCampaigns || []) as ClaimedCampaign[];
    
    console.log(`📧 [${runId}] Claimed ${campaigns.length} campaigns for sending`);
    
    if (campaigns.length > 0) {
      console.log(`📋 [${runId}] Claimed campaign details:`);
      campaigns.forEach((c, i) => {
        console.log(`   ${i + 1}. "${c.name}" (${c.id}) - scheduled: ${c.scheduled_at}, attempts: ${c.send_attempts || 1}`);
      });
    }

    if (campaigns.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`✅ [${runId}] No campaigns ready for auto-send. Completed in ${duration}ms`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        runId,
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
      const sendAttempts = campaign.send_attempts || 1;
      
      console.log(`📨 [${runId}] Processing campaign: "${campaign.name}" (${campaign.id})`);
      console.log(`   Attempt #${sendAttempts}, Tenant: ${campaign.tenant_id}`);

      try {
        // Check if user has auto-send enabled
        const { data: userProfile } = await supabase
          .from('company_profiles')
          .select('feature_flags')
          .eq('user_id', campaign.user_id)
          .single();

        const autoSendEnabled = userProfile?.feature_flags?.auto_send_campaigns !== false;
        
        if (!autoSendEnabled) {
          console.log(`⏭️ [${runId}] Skipping campaign ${campaign.id} - auto-send disabled for user`);
          
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

        // Call the email sending service
        console.log(`🚀 [${runId}] Invoking send-email-campaign for ${campaign.id}...`);
        
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

        const sentCount = sendResult?.metrics?.sent || 0;
        const failedCount = sendResult?.metrics?.failed || 0;

        // Success: Update campaign status to sent
        await supabase
          .from('crm_campaigns')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            failure_reason: null,
            send_error: null,
            metrics: {
              sent: sentCount,
              failed: failedCount,
              delivered: 0,
              opened: 0,
              clicked: 0,
              bounced: 0,
              unsubscribed: 0,
              revenue: 0
            }
          })
          .eq('id', campaign.id);

        const campaignDuration = Date.now() - campaignStartTime;
        console.log(`✅ [${runId}] Campaign ${campaign.id} sent successfully`);
        console.log(`   Recipients: ${sentCount}, Failed: ${failedCount}, Duration: ${campaignDuration}ms`);
        
        campaignsSent++;
        results.push({
          id: campaign.id,
          name: campaign.name,
          status: 'sent',
          durationMs: campaignDuration,
          recipientCount: sentCount,
          sendAttempts
        });

        // Send success notification (async, don't wait)
        sendSuccessNotification(campaign, sentCount, runId).catch(e => 
          console.warn(`[${runId}] Failed to send success notification:`, e)
        );

      } catch (campaignError: any) {
        const campaignDuration = Date.now() - campaignStartTime;
        const errorMessage = campaignError.message || 'Unknown error';
        
        console.error(`❌ [${runId}] Error sending campaign ${campaign.id}`);
        console.error(`   Error: ${errorMessage}`);
        console.error(`   Duration: ${campaignDuration}ms, Attempts: ${sendAttempts}`);
        
        // Failure: Update campaign status to failed with detailed error
        await supabase
          .from('crm_campaigns')
          .update({ 
            status: 'failed',
            failure_reason: errorMessage,
            send_error: errorMessage,
            metadata: {
              ...campaign.metadata,
              last_error: errorMessage,
              failed_at: new Date().toISOString(),
              run_id: runId
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
    console.error(`❌ [${runId}] Critical error in auto-send-campaigns after ${duration}ms:`, error);
    
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

async function sendSuccessNotification(campaign: any, audienceSize: number, runId: string) {
  console.log(`📬 [${runId}] Sending success notification for campaign "${campaign.name}"`);
  console.log(`   Audience size: ${audienceSize}`);
}

serve(handler);
