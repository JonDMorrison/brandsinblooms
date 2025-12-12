/**
 * SMS Campaign Enqueue Worker
 * 
 * Takes a campaign in enqueue_status='not_started' or 'enqueuing' (stale)
 * and incrementally creates sms_messages and sms_send_jobs in batches.
 * 
 * Designed to be called repeatedly until campaign is fully enqueued.
 * Safe to run multiple times - uses atomic claiming and cursor-based paging.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts'
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer } from '../_shared/mergeTagEngine.ts'
import { countSmsSegments } from '../_shared/smsSegmentCounter.ts'
import { getSmsWarmupInfoByPhoneOrMessagingService, ensureSmsWarmupRowForMessagingServiceIfNeeded } from '../_shared/smsWarmup.ts'

// Configuration constants
const ENQUEUE_PAGE_SIZE = Number(Deno.env.get("SMS_ENQUEUE_PAGE_SIZE") ?? "1000");
const JOB_BATCH_SIZE = Number(Deno.env.get("SMS_JOB_BATCH_SIZE") ?? "200");
const MAX_ENQUEUE_PAGES_PER_RUN = Number(Deno.env.get("SMS_MAX_ENQUEUE_PAGES_PER_RUN") ?? "3");
const DEFAULT_MMS_UNIT_COST = 3;
const STALE_CLAIM_MINUTES = 15;

const WORKER_ID = `enqueue-worker-${crypto.randomUUID().slice(0, 8)}`;

interface EnqueueStats {
  workerId: string
  campaignId: string
  pagesProcessed: number
  customersProcessed: number
  messagesCreated: number
  jobsCreated: number
  hasMoreCustomers: boolean
  enqueueComplete: boolean
}

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
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    const { campaignId, forceStart } = await req.json();

    if (!campaignId) {
      return corsJsonResponse({ error: 'campaignId is required' }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[sms-enqueue-worker] Starting for campaign ${campaignId}, worker=${WORKER_ID}`);

    // Step 1: Load campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_sms_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[sms-enqueue-worker] Campaign not found:', campaignError);
      return corsJsonResponse({ error: 'Campaign not found' }, { status: 404 });
    }

    // Step 2: Check if already enqueued
    if (campaign.enqueue_status === 'enqueued') {
      console.log(`[sms-enqueue-worker] Campaign ${campaignId} already fully enqueued`);
      return corsJsonResponse({
        success: true,
        alreadyEnqueued: true,
        message: 'Campaign is already fully enqueued.'
      });
    }

    // Step 3: Atomic claim
    const { data: claimed, error: claimError } = await supabase.rpc('claim_sms_campaign_enqueue', {
      p_campaign_id: campaignId,
      p_worker_id: WORKER_ID,
      p_stale_minutes: STALE_CLAIM_MINUTES
    });

    if (claimError) {
      console.error('[sms-enqueue-worker] Claim error:', claimError);
      return corsJsonResponse({ error: 'Failed to claim campaign for enqueueing' }, { status: 500 });
    }

    if (!claimed && !forceStart) {
      console.log(`[sms-enqueue-worker] Campaign ${campaignId} is being enqueued by another worker`);
      return corsJsonResponse({
        success: false,
        message: 'Campaign is already being prepared by another process.'
      }, { status: 409 });
    }

    // Step 4: Resolve sending identity
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
    
    const fromPhone = campaign.from_phone 
      ? formatPhoneForTwilio(campaign.from_phone) 
      : (twilioPhoneNumber ? formatPhoneForTwilio(twilioPhoneNumber) : null);
    
    const messagingServiceSid = twilioMessagingServiceSid || null;

    // Get warmup info
    let warmupInfo;
    try {
      if (messagingServiceSid) {
        warmupInfo = await ensureSmsWarmupRowForMessagingServiceIfNeeded(
          supabase,
          messagingServiceSid,
          campaign.tenant_id
        );
      } else if (fromPhone) {
        warmupInfo = await getSmsWarmupInfoByPhoneOrMessagingService(supabase, { fromPhone });
      } else {
        throw new Error('No sending identity configured');
      }
    } catch (warmupError) {
      console.error('[sms-enqueue-worker] Warmup lookup failed:', warmupError);
      await supabase.from('crm_sms_campaigns').update({
        enqueue_status: 'failed',
        updated_at: new Date().toISOString()
      }).eq('id', campaignId);
      return corsJsonResponse({ error: 'SMS sending identity not configured' }, { status: 500 });
    }

    // Step 5: Get company profile for merge tags
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('company_name, company_phone, company_email, compliance_settings')
      .eq('user_id', campaign.user_id)
      .maybeSingle();

    const companyInfo = companyProfile || {};
    const messageTemplate = convertLegacyTags(campaign.message || '');
    const isMms = !!(campaign.image_url || (campaign.media_urls && campaign.media_urls.length > 0));
    const smsBillingSettings = (companyProfile?.compliance_settings as any)?.sms_billing || {};
    const mmsUnitCost = smsBillingSettings.mms_unit_cost ?? DEFAULT_MMS_UNIT_COST;

    // Determine hour bucket for partition key
    const hourBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const partitionKey = `${warmupInfo.sendingIdentityId}:${hourBucket}`;

    const stats: EnqueueStats = {
      workerId: WORKER_ID,
      campaignId,
      pagesProcessed: 0,
      customersProcessed: 0,
      messagesCreated: 0,
      jobsCreated: 0,
      hasMoreCustomers: true,
      enqueueComplete: false
    };

    let cursorCustomerId = campaign.enqueue_cursor_customer_id || null;

    // Step 6: Process pages of customers
    for (let page = 0; page < MAX_ENQUEUE_PAGES_PER_RUN && stats.hasMoreCustomers; page++) {
      console.log(`[sms-enqueue-worker] Processing page ${page + 1}, cursor=${cursorCustomerId || 'start'}`);

      // Build customer query with cursor paging
      let customerQuery = supabase
        .from('crm_customers')
        .select('id, first_name, last_name, phone, email, custom_fields, lifetime_value, total_spent, tags, is_vip')
        .eq('tenant_id', campaign.tenant_id)
        .eq('sms_opt_in', true)
        .eq('opt_out', false)
        .eq('suppressed', false)
        .not('phone', 'is', null)
        .not('phone', 'eq', '');

      // Apply VIP ordering if priority mode is set
      if (campaign.priority_mode === 'vip_first') {
        customerQuery = customerQuery.order('is_vip', { ascending: false }).order('id', { ascending: true });
      } else {
        customerQuery = customerQuery.order('id', { ascending: true });
      }

      // Apply cursor if we have one
      if (cursorCustomerId) {
        customerQuery = customerQuery.gt('id', cursorCustomerId);
      }

      customerQuery = customerQuery.limit(ENQUEUE_PAGE_SIZE);

      const { data: customers, error: customersError } = await customerQuery;

      if (customersError) {
        console.error('[sms-enqueue-worker] Error fetching customers:', customersError);
        break;
      }

      // Filter valid phone numbers
      const eligibleCustomers = (customers || []).filter(c => {
        const phone = c.phone?.replace(/\D/g, '');
        return phone && phone.length >= 10;
      });

      if (eligibleCustomers.length === 0) {
        stats.hasMoreCustomers = false;
        break;
      }

      // Check if we got a full page (more customers may exist)
      stats.hasMoreCustomers = eligibleCustomers.length === ENQUEUE_PAGE_SIZE;

      // Prepare message rows
      const messageRows: any[] = [];
      let pageHasVip = false;

      for (const customer of eligibleCustomers) {
        const mergeTagData = createMergeTagDataFromCustomer(customer, companyInfo);
        const renderedContent = renderMergeTags(messageTemplate, mergeTagData);
        const formattedPhone = formatPhoneForTwilio(customer.phone);
        const segmentInfo = countSmsSegments(renderedContent);
        const billableUnits = isMms ? mmsUnitCost : segmentInfo.segments;

        if (customer.is_vip) pageHasVip = true;

        messageRows.push({
          tenant_id: campaign.tenant_id,
          campaign_id: campaign.id,
          customer_id: customer.id,
          phone: formattedPhone,
          content: renderedContent,
          status: 'queued',
          from_phone: fromPhone,
          media_url: campaign.image_url || null,
          segment_count: segmentInfo.segments,
          encoding: segmentInfo.encoding,
          is_mms: isMms,
          billable_units: billableUnits,
          attempts: 0,
          metadata: {
            campaign_name: campaign.name,
            segment_id: campaign.segment_id,
            queued_at: new Date().toISOString(),
            is_vip: customer.is_vip
          }
        });
      }

      // Insert messages in batches
      const insertedMessageIds: string[] = [];
      const messageChunks = chunkArray(messageRows, 100);

      for (const chunk of messageChunks) {
        const { data: insertedMessages, error: insertError } = await supabase
          .from('sms_messages')
          .insert(chunk)
          .select('id');

        if (insertError) {
          console.error('[sms-enqueue-worker] Failed to insert messages:', insertError);
          continue;
        }

        insertedMessageIds.push(...(insertedMessages || []).map(m => m.id));
      }

      stats.messagesCreated += insertedMessageIds.length;

      // Create send jobs in batches
      const messageIdChunks = chunkArray(insertedMessageIds, JOB_BATCH_SIZE);
      const jobRows = messageIdChunks.map((batchIds, index) => ({
        tenant_id: campaign.tenant_id,
        campaign_id: campaign.id,
        from_phone: fromPhone,
        messaging_service_sid: messagingServiceSid,
        status: 'pending',
        recipient_message_ids: batchIds,
        batch_index: stats.jobsCreated + index,
        attempts: 0,
        priority: pageHasVip && campaign.priority_mode === 'vip_first' ? 10 : 100,
        partition_key: partitionKey,
        scheduled_at: null
      }));

      if (jobRows.length > 0) {
        const { error: jobsError } = await supabase
          .from('sms_send_jobs')
          .insert(jobRows);

        if (jobsError) {
          console.error('[sms-enqueue-worker] Failed to create jobs:', jobsError);
        } else {
          stats.jobsCreated += jobRows.length;
        }
      }

      // Update cursor
      if (eligibleCustomers.length > 0) {
        cursorCustomerId = eligibleCustomers[eligibleCustomers.length - 1].id;
      }

      stats.pagesProcessed++;
      stats.customersProcessed += eligibleCustomers.length;

      // Update campaign progress
      await supabase.from('crm_sms_campaigns').update({
        enqueue_cursor_customer_id: cursorCustomerId,
        total_enqueued: (campaign.total_enqueued || 0) + insertedMessageIds.length,
        updated_at: new Date().toISOString()
      }).eq('id', campaignId);
    }

    // Step 7: Check if enqueueing is complete
    if (!stats.hasMoreCustomers) {
      stats.enqueueComplete = true;

      // Mark campaign as fully enqueued
      await supabase.from('crm_sms_campaigns').update({
        enqueue_status: 'enqueued',
        enqueue_completed_at: new Date().toISOString(),
        status: 'sending',
        sent_at: campaign.sent_at || new Date().toISOString(),
        enqueue_claimed_at: null,
        enqueue_claimed_by: null,
        updated_at: new Date().toISOString()
      }).eq('id', campaignId);

      console.log(`[sms-enqueue-worker] Campaign ${campaignId} fully enqueued: ${stats.messagesCreated} messages, ${stats.jobsCreated} jobs`);
    } else {
      console.log(`[sms-enqueue-worker] Campaign ${campaignId} partially enqueued: ${stats.messagesCreated} messages this run, more customers remain`);
    }

    const duration = Date.now() - startTime;
    console.log(`[sms-enqueue-worker] Completed in ${duration}ms`, stats);

    return corsJsonResponse({
      success: true,
      duration_ms: duration,
      stats,
      message: stats.enqueueComplete 
        ? `Campaign fully prepared. ${stats.messagesCreated} messages ready for sending.`
        : `Campaign preparation in progress. ${stats.messagesCreated} messages queued this run.`
    });

  } catch (error) {
    console.error('[sms-enqueue-worker] Fatal error:', error);
    return corsJsonResponse({ error: error.message }, { status: 500 });
  }
});
