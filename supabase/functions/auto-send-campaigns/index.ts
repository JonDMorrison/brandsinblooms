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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Processing auto-send campaigns...');

    // Get campaigns that are approved for auto-sending
    const { data: campaigns, error: campaignsError } = await supabase
      .from('crm_campaigns')
      .select(`
        *,
        campaign_segments!inner(segment_id),
        crm_segments!campaign_segments.segment_id(customer_count)
      `)
      .in('status', ['approved', 'auto-send-enabled'])
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', new Date().toISOString());

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
    }

    console.log(`📧 Found ${campaigns?.length || 0} campaigns ready for auto-send`);

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No campaigns ready for auto-send',
        campaignsSent: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let campaignsSent = 0;
    const errors: string[] = [];

    // Process each campaign
    for (const campaign of campaigns) {
      try {
        console.log(`📨 Sending campaign: ${campaign.name} (${campaign.id})`);

        // Check if user has auto-send enabled
        const { data: userProfile, error: profileError } = await supabase
          .from('company_profiles')
          .select('feature_flags')
          .eq('user_id', campaign.user_id)
          .single();

        const autoSendEnabled = userProfile?.feature_flags?.auto_send_campaigns !== false;
        
        if (!autoSendEnabled) {
          console.log(`⏭️ Skipping campaign ${campaign.id} - auto-send disabled for user`);
          continue;
        }

        // Calculate total audience size
        const totalAudience = campaign.crm_segments?.reduce((sum: number, segment: any) => {
          return sum + (segment.customer_count || 0);
        }, 0) || 0;

        if (totalAudience === 0) {
          console.log(`⚠️ Skipping campaign ${campaign.id} - no audience`);
          continue;
        }

        // Send pre-send notification (24 hours before)
        const scheduledTime = new Date(campaign.scheduled_at);
        const now = new Date();
        const hoursUntilSend = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilSend > 24) {
          // Send notification 24 hours before
          await sendPreSendNotification(campaign, totalAudience);
          continue;
        }

        // Update campaign status to sending
        await supabase
          .from('crm_campaigns')
          .update({ 
            status: 'sending',
            sent_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        // Call the email sending service
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email-campaign', {
          body: {
            campaignId: campaign.id,
            testMode: false
          }
        });

        if (sendError) {
          throw new Error(`Send failed: ${sendError.message}`);
        }

        // Update campaign status to sent
        await supabase
          .from('crm_campaigns')
          .update({ 
            status: 'sent',
            metrics: {
              sent: totalAudience,
              delivered: 0,
              opened: 0,
              clicked: 0,
              bounced: 0,
              unsubscribed: 0,
              revenue: 0
            }
          })
          .eq('id', campaign.id);

        console.log(`✅ Campaign ${campaign.id} sent successfully to ${totalAudience} recipients`);
        campaignsSent++;

        // Send success notification
        await sendSuccessNotification(campaign, totalAudience);

      } catch (campaignError) {
        console.error(`❌ Error sending campaign ${campaign.id}:`, campaignError);
        errors.push(`Campaign ${campaign.id}: ${campaignError.message}`);
        
        // Update campaign status to failed
        await supabase
          .from('crm_campaigns')
          .update({ 
            status: 'failed',
            metadata: {
              ...campaign.metadata,
              error: campaignError.message,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', campaign.id);
      }
    }

    console.log(`🎉 Auto-send processing completed. Sent ${campaignsSent} campaigns`);

    return new Response(JSON.stringify({ 
      success: true,
      campaignsSent,
      errors: errors.length > 0 ? errors : undefined,
      processedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in auto-send-campaigns function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function sendPreSendNotification(campaign: any, audienceSize: number) {
  console.log(`📬 Sending pre-send notification for campaign ${campaign.id}`);
  
  // Here you would integrate with your notification system
  // For now, we'll just log it
  console.log(`📧 Notification: Campaign "${campaign.name}" will send to ${audienceSize} recipients at ${campaign.scheduled_at}`);
}

async function sendSuccessNotification(campaign: any, audienceSize: number) {
  console.log(`🎉 Sending success notification for campaign ${campaign.id}`);
  
  // Here you would integrate with your notification system
  console.log(`✅ Notification: Campaign "${campaign.name}" sent successfully to ${audienceSize} recipients`);
}

serve(handler);