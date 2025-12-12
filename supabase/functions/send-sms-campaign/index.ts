import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer } from "../_shared/mergeTagEngine.ts";
import { getSmsWarmupInfoByPhoneOrMessagingService, ensureSmsWarmupRowForMessagingServiceIfNeeded } from "../_shared/smsWarmup.ts";
import { countSmsSegments, calculateBillableUnits } from "../_shared/smsSegmentCounter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 100;
const DEFAULT_MMS_UNIT_COST = 3;

/**
 * Format phone number to E.164 format
 */
function formatPhoneForTwilio(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (phone.startsWith('+') && cleaned.length >= 10) {
    return phone;
  }
  return `+1${cleaned}`;
}

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[send-sms-campaign] Starting queue-based send for campaign: ${campaignId}`);

    // Step A: Load campaign and guard against double enqueue
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_sms_campaigns')
      .select(`
        *,
        crm_segments (id, name)
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[send-sms-campaign] Campaign not found:', campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency guard: if already enqueued, return success without re-processing
    if (campaign.enqueued) {
      console.log(`[send-sms-campaign] Campaign ${campaignId} already enqueued, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          alreadyEnqueued: true,
          message: 'SMS campaign is already queued for sending.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!campaign.segment_id) {
      return new Response(
        JSON.stringify({ error: 'Campaign has no segment selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step B: Resolve sending identity and get warmup info
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
    
    const fromPhone = campaign.from_phone 
      ? formatPhoneForTwilio(campaign.from_phone) 
      : (twilioPhoneNumber ? formatPhoneForTwilio(twilioPhoneNumber) : null);
    
    const messagingServiceSid = twilioMessagingServiceSid || null;

    // Ensure warmup row exists for the sending identity
    let warmupInfo;
    try {
      if (messagingServiceSid) {
        // Ensure row exists for messaging service
        warmupInfo = await ensureSmsWarmupRowForMessagingServiceIfNeeded(
          supabase,
          messagingServiceSid,
          campaign.tenant_id
        );
      } else if (fromPhone) {
        warmupInfo = await getSmsWarmupInfoByPhoneOrMessagingService(supabase, { fromPhone });
      } else {
        throw new Error('No sending identity configured (from_phone or messaging_service_sid)');
      }
    } catch (warmupError) {
      console.error('[send-sms-campaign] Warmup lookup failed:', warmupError);
      return new Response(
        JSON.stringify({ 
          error: 'SMS sending identity not configured',
          details: warmupError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-sms-campaign] Warmup info: stage=${warmupInfo.warmupStage}, limit=${warmupInfo.dailyLimit}, sent=${warmupInfo.dailySentCount}, remaining=${warmupInfo.remainingToday}`);

    // Step C: Select eligible recipients with strict filters
    const { data: customers, error: customersError } = await supabase
      .from('crm_customers')
      .select('id, first_name, last_name, phone, email, custom_fields, lifetime_value, total_spent, tags')
      .eq('tenant_id', campaign.tenant_id)
      .eq('sms_opt_in', true)
      .eq('opt_out', false)
      .eq('suppressed', false)
      .not('phone', 'is', null)
      .not('phone', 'eq', '');

    if (customersError) {
      console.error('[send-sms-campaign] Error fetching customers:', customersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Additional filter for valid phone numbers
    const eligibleCustomers = (customers || []).filter(c => {
      const phone = c.phone?.replace(/\D/g, '');
      return phone && phone.length >= 10;
    });

    const eligibleCount = eligibleCustomers.length;
    console.log(`[send-sms-campaign] Found ${eligibleCount} eligible customers`);

    if (eligibleCount === 0) {
      await supabase
        .from('crm_sms_campaigns')
        .update({ 
          status: 'failed',
          metrics: { messages_sent: 0, delivered: 0, failed: 0, opt_outs: 0, error: 'No eligible recipients' }
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ error: 'No SMS-eligible customers found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step D: Enforce warmup limit
    const remainingToday = warmupInfo.remainingToday;

    if (eligibleCount > remainingToday) {
      console.log(`[send-sms-campaign] Warmup limit exceeded: attempted=${eligibleCount}, remaining=${remainingToday}`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'SMS_WARMUP_LIMIT',
          message: `Your SMS number is still warming up. Today's safe limit is ${remainingToday}. You attempted ${eligibleCount}. Try again tomorrow or reduce recipients.`,
          data: {
            stage: warmupInfo.warmupStage,
            dailyLimit: warmupInfo.dailyLimit,
            dailySentCount: warmupInfo.dailySentCount,
            remainingToday,
            attempted: eligibleCount
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step E: Get company profile and prepare messages with segment counting
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('company_name, company_phone, company_email, compliance_settings')
      .eq('user_id', campaign.user_id)
      .maybeSingle();

    const companyInfo = companyProfile || {};
    const messageTemplate = convertLegacyTags(campaign.message || '');
    
    // Determine if this is MMS
    const isMms = !!(campaign.image_url || (campaign.media_urls && campaign.media_urls.length > 0));
    
    // Get MMS unit cost from settings (default 3)
    const smsBillingSettings = (companyProfile?.compliance_settings as any)?.sms_billing || {};
    const mmsUnitCost = smsBillingSettings.mms_unit_cost ?? DEFAULT_MMS_UNIT_COST;
    
    // Step F: Compute estimated billable units per recipient and check quota
    let totalEstimatedUnits = 0;
    const messageRows: any[] = [];
    
    for (const customer of eligibleCustomers) {
      const mergeTagData = createMergeTagDataFromCustomer(customer, companyInfo);
      const renderedContent = renderMergeTags(messageTemplate, mergeTagData);
      const formattedPhone = formatPhoneForTwilio(customer.phone);
      
      // Calculate segments for this rendered message
      const segmentInfo = countSmsSegments(renderedContent);
      const billableUnits = isMms ? mmsUnitCost : segmentInfo.segments;
      
      totalEstimatedUnits += billableUnits;
      
      messageRows.push({
        tenant_id: campaign.tenant_id,
        campaign_id: campaign.id,
        customer_id: customer.id,
        phone: formattedPhone,
        content: renderedContent,
        status: 'queued',
        from_phone: fromPhone,
        media_url: campaign.image_url || null,
        // New billing metadata fields
        segment_count: segmentInfo.segments,
        encoding: segmentInfo.encoding,
        is_mms: isMms,
        billable_units: billableUnits,
        metadata: {
          campaign_name: campaign.name,
          segment_id: campaign.segment_id,
          queued_at: new Date().toISOString()
        }
      });
    }
    
    console.log(`[send-sms-campaign] Estimated billable units: ${totalEstimatedUnits} (${eligibleCount} messages, isMms=${isMms})`);

    // Step G: Check SMS quota before enqueuing
    const { data: quotaCheck, error: quotaError } = await supabase
      .rpc('check_sms_quota', {
        p_tenant_id: campaign.tenant_id,
        p_estimated_units: totalEstimatedUnits
      });

    if (quotaError) {
      console.error('[send-sms-campaign] Quota check failed:', quotaError);
      // Continue anyway - don't block sends on quota check failure
    } else if (quotaCheck && !quotaCheck.allowed) {
      console.log(`[send-sms-campaign] Quota exceeded: remaining=${quotaCheck.remaining}, needed=${totalEstimatedUnits}`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'SMS_QUOTA_EXCEEDED',
          message: 'Not enough SMS credits to send this campaign.',
          data: {
            quota: quotaCheck.quota,
            usage: quotaCheck.usage,
            remaining: quotaCheck.remaining,
            estimatedUnits: totalEstimatedUnits
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step H: Insert sms_messages with status='queued' (including billing metadata)
    const insertedMessageIds: string[] = [];
    const messageChunks = chunkArray(messageRows, BATCH_SIZE);

    for (const chunk of messageChunks) {
      const { data: insertedMessages, error: insertError } = await supabase
        .from('sms_messages')
        .insert(chunk)
        .select('id');

      if (insertError) {
        console.error('[send-sms-campaign] Failed to insert messages:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to queue messages', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      insertedMessageIds.push(...(insertedMessages || []).map(m => m.id));
    }

    console.log(`[send-sms-campaign] Inserted ${insertedMessageIds.length} queued messages`);

    // Step I: Create sms_send_jobs batches
    const messageIdChunks = chunkArray(insertedMessageIds, BATCH_SIZE);
    const jobRows = messageIdChunks.map((batchIds, index) => ({
      tenant_id: campaign.tenant_id,
      campaign_id: campaign.id,
      from_phone: fromPhone,
      messaging_service_sid: messagingServiceSid,
      status: 'pending',
      recipient_message_ids: batchIds,
      batch_index: index,
      attempts: 0
    }));

    const { error: jobsError } = await supabase
      .from('sms_send_jobs')
      .insert(jobRows);

    if (jobsError) {
      console.error('[send-sms-campaign] Failed to create send jobs:', jobsError);
      // Rollback: delete queued messages
      await supabase
        .from('sms_messages')
        .delete()
        .in('id', insertedMessageIds);

      return new Response(
        JSON.stringify({ error: 'Failed to create send jobs', details: jobsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-sms-campaign] Created ${jobRows.length} send jobs`);

    // Step J: Update daily_sent_count and campaign status
    // Update warmup counter
    const { error: warmupUpdateError } = await supabase
      .from('twilio_phone_numbers')
      .update({
        daily_sent_count: warmupInfo.dailySentCount + eligibleCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', warmupInfo.sendingIdentityId);

    if (warmupUpdateError) {
      console.error('[send-sms-campaign] Failed to update warmup counter:', warmupUpdateError);
    }

    // Update campaign status (DO NOT update subscription usage here - wait for actual sends)
    const { error: campaignUpdateError } = await supabase
      .from('crm_sms_campaigns')
      .update({
        status: 'queued',
        enqueued: true,
        sent_at: new Date().toISOString(),
        metrics: {
          messages_queued: eligibleCount,
          batches_created: jobRows.length,
          estimated_billable_units: totalEstimatedUnits,
          messages_sent: 0,
          delivered: 0,
          failed: 0,
          opt_outs: 0
        }
      })
      .eq('id', campaignId);

    if (campaignUpdateError) {
      console.error('[send-sms-campaign] Failed to update campaign:', campaignUpdateError);
    }

    // Step K: Return success response
    console.log(`[send-sms-campaign] Campaign ${campaignId} successfully queued: ${eligibleCount} messages in ${jobRows.length} batches, estimated ${totalEstimatedUnits} units`);

    return new Response(
      JSON.stringify({
        success: true,
        enqueued: true,
        eligibleCount,
        batchesCreated: jobRows.length,
        estimatedBillableUnits: totalEstimatedUnits,
        message: `SMS campaign queued successfully. ${eligibleCount} messages will be sent.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-sms-campaign] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

Deno.serve(handler);
