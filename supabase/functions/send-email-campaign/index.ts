import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2";
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, type MergeTagData } from "../_shared/mergeTagEngine.ts";
import { generateServerFooterHtml, type CompanyProfileData } from "../_shared/footerGenerator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
}

// Threshold for inline sending vs queue-based sending
const INLINE_SEND_THRESHOLD = 300;
const BATCH_SIZE_PER_JOB = 200;

/**
 * Strip ALL existing footer HTML from content to prevent double footers.
 */
function stripExistingFooter(html: string): string {
  let strippedHtml = html;
  
  const footerWrapperPattern = /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi;
  if (footerWrapperPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(footerWrapperPattern, '');
  }
  
  const unsubscribeFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*max-width:\s*640px[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (unsubscribeFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(unsubscribeFooterPattern, '');
  }
  
  const socialIconsFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?social-icons[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (socialIconsFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(socialIconsFooterPattern, '');
  }
  
  const legacyGreenFooterPattern = /<div[^>]*style="[^"]*background-color:\s*#283024[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (legacyGreenFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(legacyGreenFooterPattern, '');
  }
  
  const finalCleanupPattern = /<div[^>]*style="[^"]*background-color[^"]*width:\s*100%[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/div>)*\s*(<\/body>|<\/html>|$))/gi;
  strippedHtml = strippedHtml.replace(finalCleanupPattern, '');
  
  return strippedHtml;
}

/**
 * Build email payload for a single customer (OPTIMIZED - uses pre-generated footer)
 */
function buildEmailPayloadOptimized(
  customer: any,
  campaign: any,
  companyProfile: any,
  profileData: CompanyProfileData,
  fromAddress: string,
  senderEmail: string,
  usesVerifiedDomain: boolean,
  activeDomainId: string | null,
  sharedFooterTemplate: string
): any {
  const companyName = companyProfile?.company_name || 'Your Garden Center';
  
  // Generate unsubscribe token and link for this customer
  const unsubscribeToken = btoa(`${customer.email}:${campaign.tenant_id}`);
  const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${campaign.tenant_id}&token=${unsubscribeToken}`;
  const preferencesLink = unsubscribeLink.replace('handle-unsubscribe', 'manage-preferences');

  // Replace placeholders in pre-generated footer with actual customer links
  const customerFooter = sharedFooterTemplate
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeLink)
    .replace(/\{\{PREFERENCES_URL\}\}/g, preferencesLink);

  // Create merge tag data
  const mergeTagData: MergeTagData = createMergeTagDataFromCustomer(customer, {
    company_name: companyName,
    address: companyProfile?.location_info,
    website_url: companyProfile?.custom_sender_email?.split('@')[1]
  });
  
  mergeTagData.system = {
    unsubscribe_url: unsubscribeLink,
    preferences_url: preferencesLink,
    current_year: new Date().getFullYear().toString(),
    current_date: new Date().toLocaleDateString()
  };

  // Process content
  let emailContent = convertLegacyTags(campaign.content || '');
  let emailSubject = convertLegacyTags(campaign.subject_line || 'Newsletter from your Garden Center');
  
  emailContent = renderMergeTags(emailContent, mergeTagData);
  emailSubject = renderMergeTags(emailSubject, mergeTagData);

  // Strip existing footer and append the pre-generated customer-specific footer
  emailContent = stripExistingFooter(emailContent);
  
  if (emailContent.includes('</body>')) {
    emailContent = emailContent.replace('</body>', `${customerFooter}</body>`);
  } else if (emailContent.includes('</html>')) {
    emailContent = emailContent.replace('</html>', `${customerFooter}</html>`);
  } else {
    emailContent += customerFooter;
  }

  const emailPayload: any = {
    from: fromAddress,
    to: [customer.email],
    subject: emailSubject,
    html: emailContent,
    headers: {
      'X-Campaign-ID': campaign.id,
      'X-Campaign-Type': 'bulk',
      'X-Tenant-ID': campaign.tenant_id,
      'X-Domain-ID': activeDomainId || 'fallback'
    },
    tags: [
      { name: 'campaign_id', value: campaign.id },
      { name: 'type', value: 'bulk' },
      { name: 'tenant_id', value: campaign.tenant_id }
    ]
  };

  if (usesVerifiedDomain && senderEmail !== 'noreply@bloomsuite.email') {
    emailPayload.reply_to = senderEmail;
  }

  return emailPayload;
}

/**
 * Process a batch inline (for small campaigns or immediate processing)
 */
async function processInline(
  resend: any,
  emailPayloads: any[],
  supabase: any,
  campaignId: string,
  activeDomainId: string | null,
  warmupStage: number,
  dailyLimit: number
): Promise<{ sent: number; failed: number }> {
  const BATCH_SIZE = 100;
  let emailsSent = 0;
  let failed = 0;

  for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
    const batch = emailPayloads.slice(i, i + BATCH_SIZE);
    
    try {
      const batchResponse = await resend.batch.send(batch);
      
      if (batchResponse?.data) {
        const successCount = Array.isArray(batchResponse.data) 
          ? batchResponse.data.filter((r: any) => r?.id).length 
          : 1;
        emailsSent += successCount;
      } else if (batchResponse?.error) {
        failed += batch.length;
        console.error(`Batch failed:`, batchResponse.error);
      }
    } catch (batchError: any) {
      console.warn(`Batch failed, trying individual sends:`, batchError.message);
      
      for (const payload of batch) {
        try {
          const singleResponse = await resend.emails.send(payload);
          if (singleResponse?.id) {
            emailsSent++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    }
  }

  return { sent: emailsSent, failed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, includeSuppressed = false } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Send campaign request: campaignId=${campaignId}, includeSuppressed=${includeSuppressed}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('Missing Resend API key');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);

    console.log(`📧 Starting email campaign send for campaign: ${campaignId}`);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_campaigns')
      .select(`*, crm_segments (id, name)`)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company profile
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select(`
        email_auth_status, custom_sender_email, company_name, location_info,
        street_address, city, state_province, postal_code, country,
        website_url, company_email, company_phone,
        facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
        footer_legal_text, brand_primary_color, brand_text_color, feature_flags
      `)
      .eq('user_id', campaign.user_id)
      .single();

    // Get customers based on targeting
    let customers: any[] = [];
    let customersError = null;

    if (campaign.segment_id) {
      const { data: segmentCustomers, error } = await supabase
        .from('customer_segments')
        .select(`crm_customers (id, first_name, last_name, email, suppressed)`)
        .eq('segment_id', campaign.segment_id);

      if (error) customersError = error;
      else customers = segmentCustomers?.map(sc => sc.crm_customers).filter(c => c?.email?.trim()) || [];
    } else {
      const { data: campaignSegments } = await supabase
        .from('campaign_segments')
        .select('segment_id')
        .eq('campaign_id', campaignId);

      if (campaignSegments && campaignSegments.length > 0) {
        const { data: multiSegmentCustomers, error } = await supabase
          .from('customer_segments')
          .select(`crm_customers (id, first_name, last_name, email, suppressed)`)
          .in('segment_id', campaignSegments.map(cs => cs.segment_id));

        if (error) customersError = error;
        else {
          const customerMap = new Map();
          multiSegmentCustomers?.forEach(sc => {
            const customer = sc.crm_customers;
            if (customer?.email?.trim() && !customerMap.has(customer.email)) {
              customerMap.set(customer.email, customer);
            }
          });
          customers = Array.from(customerMap.values());
        }
      } else {
        // All contacts for tenant
        const { data: allContacts, error } = await supabase
          .from('crm_customers')
          .select('id, first_name, last_name, email, suppressed')
          .eq('tenant_id', campaign.tenant_id)
          .not('email', 'is', null);
        
        if (error) customersError = error;
        else customers = (allContacts || []).filter(c => c.email?.trim());
      }
    }

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out suppressed customers unless explicitly included
    const totalBeforeSuppression = customers.length;
    let suppressedCount = 0;
    
    if (!includeSuppressed) {
      const activeCustomers = customers.filter(c => !c.suppressed);
      suppressedCount = customers.length - activeCustomers.length;
      customers = activeCustomers;
      
      if (suppressedCount > 0) {
        console.log(`📧 Excluded ${suppressedCount} suppressed contacts (${totalBeforeSuppression} total → ${customers.length} active)`);
      }
    } else {
      console.log(`⚠️ Including ${customers.filter(c => c.suppressed).length} suppressed contacts (override enabled)`);
    }

    if (!customers || customers.length === 0) {
      await supabase
        .from('crm_campaigns')
        .update({ status: 'failed', send_blocked_reason: 'No contacts found' })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ error: 'No contacts found in the selected audience' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let recipientCount = customers.length;
    console.log(`📧 Found ${recipientCount} customers`);

    // Quota check with warmup enforcement
    const { data: quotaCheck, error: quotaError } = await supabase.rpc('check_send_quota', {
      p_tenant_id: campaign.tenant_id,
      p_domain_id: campaign.from_email_domain_id || null,
      p_recipient_count: recipientCount
    });

    if (quotaError) {
      console.error('Error checking quota:', quotaError);
      return new Response(
        JSON.stringify({ error: 'Failed to check sending quota' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate remaining capacity for warmup enforcement
    let isPartialSend = false;
    let originalRecipientCount = recipientCount;
    let remainingCapacity = recipientCount;

    if (!quotaCheck?.using_fallback && quotaCheck?.limits) {
      const dailyLimit = quotaCheck.limits.daily_limit || 50;
      const dailyUsed = quotaCheck.limits.daily_used || 0;
      remainingCapacity = Math.max(0, dailyLimit - dailyUsed);
      
      console.log(`📧 Domain warmup check: daily_limit=${dailyLimit}, daily_used=${dailyUsed}, remaining=${remainingCapacity}`);
      
      if (recipientCount > remainingCapacity) {
        if (remainingCapacity === 0) {
          // No capacity left today
          await supabase
            .from('crm_campaigns')
            .update({ 
              status: 'blocked_by_warmup', 
              send_blocked_reason: `Daily sending limit (${dailyLimit}) reached. ${dailyUsed} emails already sent today. Try again tomorrow or wait for your domain to warm up.`
            })
            .eq('id', campaignId);

          return new Response(
            JSON.stringify({ 
              error: 'Send blocked by warmup limit',
              reason: 'daily_limit_reached',
              message: `Daily limit of ${dailyLimit} emails reached. Try again tomorrow.`,
              warmup_stage: quotaCheck.domain?.warmup_stage,
              daily_limit: dailyLimit,
              daily_used: dailyUsed
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Partial send: truncate to remaining capacity
        console.log(`⚠️ Truncating recipients from ${recipientCount} to ${remainingCapacity} due to warmup limits`);
        customers = customers.slice(0, remainingCapacity);
        recipientCount = customers.length;
        isPartialSend = true;
      }
    }

    if (!quotaCheck?.allowed && !isPartialSend) {
      await supabase
        .from('crm_campaigns')
        .update({ status: 'blocked', send_blocked_reason: quotaCheck?.message })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ error: 'Send blocked', reason: quotaCheck?.reason, message: quotaCheck?.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine sender
    const companyName = companyProfile?.company_name || 'Your Garden Center';
    let senderEmail: string;
    let senderDisplayName: string;
    let deliveryMethod: string;
    let usesVerifiedDomain: boolean;
    let activeDomainId: string | null = null;

    if (quotaCheck.using_fallback) {
      senderEmail = quotaCheck.sender?.from_email || 'noreply@bloomsuite.email';
      senderDisplayName = `${companyName} via BloomSuite`;
      deliveryMethod = 'shared_sender';
      usesVerifiedDomain = false;
    } else {
      senderEmail = quotaCheck.sender?.from_email || 'noreply@bloomsuite.email';
      senderDisplayName = quotaCheck.sender?.from_name || companyName;
      deliveryMethod = 'custom_domain';
      usesVerifiedDomain = true;
      activeDomainId = quotaCheck.domain?.id || null;
    }

    const fromAddress = `${senderDisplayName} <${senderEmail}>`;

    // Build profile data for footer
    const profileData: CompanyProfileData = {
      company_name: companyProfile?.company_name,
      company_email: companyProfile?.company_email,
      company_phone: companyProfile?.company_phone,
      website_url: companyProfile?.website_url,
      street_address: companyProfile?.street_address,
      city: companyProfile?.city,
      state_province: companyProfile?.state_province,
      postal_code: companyProfile?.postal_code,
      country: companyProfile?.country,
      facebook_url: companyProfile?.facebook_url,
      instagram_url: companyProfile?.instagram_url,
      tiktok_url: companyProfile?.tiktok_url,
      pinterest_url: companyProfile?.pinterest_url,
      youtube_url: companyProfile?.youtube_url,
      linkedin_url: companyProfile?.linkedin_url,
      footer_legal_text: companyProfile?.footer_legal_text,
      brand_primary_color: companyProfile?.brand_primary_color,
      brand_text_color: companyProfile?.brand_text_color,
      feature_flags: companyProfile?.feature_flags,
    };

    // Build email payloads
    console.log(`📧 Building ${recipientCount} email payloads...`);
    const emailPayloads: any[] = [];
    const subscriptionUpserts: any[] = [];

    // Pre-generate the footer ONCE since it's the same for all recipients
    // This is a critical performance optimization to avoid timeout on large campaigns
    const sampleUnsubscribeToken = btoa(`sample@example.com:${campaign.tenant_id}`);
    const sampleUnsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=PLACEHOLDER&tenant_id=${campaign.tenant_id}&token=PLACEHOLDER`;
    const sharedFooterTemplate = generateServerFooterHtml(
      profileData,
      '{{UNSUBSCRIBE_URL}}',
      '{{PREFERENCES_URL}}'
    );
    console.log(`📧 Pre-generated footer template (length: ${sharedFooterTemplate.length})`);

    for (const customer of customers) {
      try {
        const payload = buildEmailPayloadOptimized(
          customer, campaign, companyProfile, profileData,
          fromAddress, senderEmail, usesVerifiedDomain, activeDomainId,
          sharedFooterTemplate
        );
        emailPayloads.push({ email: customer.email, customerId: customer.id, payload });

        subscriptionUpserts.push({
          email: customer.email,
          tenant_id: campaign.tenant_id,
          user_id: campaign.user_id,
          customer_id: customer.id,
          opt_out: false,
          source: 'campaign'
        });
      } catch (error: any) {
        console.error(`Error building payload for ${customer.id}:`, error.message);
      }
    }

    // Batch upsert subscriptions
    if (subscriptionUpserts.length > 0) {
      await supabase
        .from('crm_subscriptions')
        .upsert(subscriptionUpserts, { onConflict: 'email,tenant_id' })
        .catch(() => {});
    }

    // Update campaign sender config
    await supabase
      .from('crm_campaigns')
      .update({
        delivery_method: deliveryMethod,
        sender_display_name: senderDisplayName,
        actual_sender_email: senderEmail,
        from_email_domain_id: activeDomainId
      })
      .eq('id', campaignId);

    // ========== QUEUE-BASED SENDING ==========
    const totalBatches = Math.ceil(emailPayloads.length / BATCH_SIZE_PER_JOB);
    console.log(`📧 Campaign has ${emailPayloads.length} recipients, creating ${totalBatches} batch jobs`);

    // Create batch jobs
    const jobInserts: any[] = [];
    for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE_PER_JOB) {
      const batch = emailPayloads.slice(i, i + BATCH_SIZE_PER_JOB);
      jobInserts.push({
        campaign_id: campaignId,
        tenant_id: campaign.tenant_id,
        domain_id: activeDomainId,
        status: 'pending',
        recipient_emails: batch,
        batch_index: Math.floor(i / BATCH_SIZE_PER_JOB)
      });
    }

    const { error: insertError } = await supabase
      .from('email_send_jobs')
      .insert(jobInserts);

    if (insertError) {
      console.error('❌ Failed to create batch jobs:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue campaign' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For small campaigns (<= threshold), process inline immediately
    if (emailPayloads.length <= INLINE_SEND_THRESHOLD) {
      console.log(`📧 Small campaign (${emailPayloads.length} recipients), processing inline...`);
      
      await supabase
        .from('crm_campaigns')
        .update({ status: 'sending', sent_at: new Date().toISOString() })
        .eq('id', campaignId);

      const payloadsOnly = emailPayloads.map(e => e.payload);
      const warmupStage = quotaCheck.domain?.warmup_stage || 0;
      const dailyLimit = quotaCheck.limits?.daily_limit || 50;
      const { sent, failed } = await processInline(resend, payloadsOnly, supabase, campaignId, activeDomainId, warmupStage, dailyLimit);

      // Log to domain_send_log for warmup tracking
      if (sent > 0 && activeDomainId) {
        await supabase
          .from('domain_send_log')
          .insert({
            domain_id: activeDomainId,
            campaign_id: campaignId,
            emails_sent: sent,
            warmup_stage: warmupStage,
            daily_limit_at_send: dailyLimit
          })
          .catch((err: any) => console.error('Failed to log domain send:', err));

        // Update daily_sent_count on the domain
        await supabase
          .from('email_domains')
          .update({ 
            daily_sent_count: supabase.rpc ? undefined : (quotaCheck.limits?.daily_used || 0) + sent,
            daily_used: (quotaCheck.limits?.daily_used || 0) + sent
          })
          .eq('id', activeDomainId)
          .catch((err: any) => console.error('Failed to update domain daily count:', err));
      }

      // Mark all jobs as completed
      await supabase
        .from('email_send_jobs')
        .update({ status: 'completed', emails_sent: sent, emails_failed: failed })
        .eq('campaign_id', campaignId);

      // Update campaign as sent
      const campaignStatus = isPartialSend ? 'partially_sent' : 'sent';
      await supabase
        .from('crm_campaigns')
        .update({ 
          status: campaignStatus,
          metrics: { 
            sent, 
            failed, 
            opens: 0, 
            clicks: 0, 
            unsubscribes: 0,
            original_recipients: isPartialSend ? originalRecipientCount : undefined,
            truncated_due_to_warmup: isPartialSend
          },
          send_blocked_reason: isPartialSend 
            ? `Sent to ${sent} of ${originalRecipientCount} recipients due to warmup limits. Remaining ${originalRecipientCount - recipientCount} will need to be sent later.`
            : null
        })
        .eq('id', campaignId);

      // Update subscription email usage
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('email_usage, user_id')
        .eq('user_id', campaign.user_id)
        .single();

      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({ email_usage: (subscription.email_usage || 0) + sent })
          .eq('user_id', campaign.user_id);
      }

      console.log(`✅ Campaign ${campaignId} sent inline: ${sent} sent, ${failed} failed${isPartialSend ? ` (partial: ${recipientCount}/${originalRecipientCount})` : ''}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          mode: 'inline',
          partial_send: isPartialSend,
          metrics: { 
            sent, 
            failed,
            original_recipients: isPartialSend ? originalRecipientCount : undefined,
            truncated_count: isPartialSend ? originalRecipientCount - recipientCount : undefined
          },
          warmup_info: isPartialSend ? {
            daily_limit: quotaCheck.limits?.daily_limit,
            daily_used: quotaCheck.limits?.daily_used,
            warmup_stage: quotaCheck.domain?.warmup_stage
          } : undefined,
          message: isPartialSend 
            ? `Email campaign sent to ${sent} of ${originalRecipientCount} customers (limited by warmup)`
            : `Email campaign sent to ${sent} customers`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For large campaigns, mark as queued and let the worker process
    const campaignStatus = isPartialSend ? 'partially_queued' : 'queued';
    await supabase
      .from('crm_campaigns')
      .update({ 
        status: campaignStatus, 
        sent_at: new Date().toISOString(),
        send_blocked_reason: isPartialSend 
          ? `Queued ${recipientCount} of ${originalRecipientCount} recipients due to warmup limits.`
          : null
      })
      .eq('id', campaignId);

    console.log(`📧 Campaign ${campaignId} queued with ${totalBatches} batch jobs${isPartialSend ? ` (partial: ${recipientCount}/${originalRecipientCount})` : ''}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        mode: 'queued',
        partial_send: isPartialSend,
        campaign_id: campaignId,
        total_recipients: emailPayloads.length,
        original_recipients: isPartialSend ? originalRecipientCount : undefined,
        truncated_count: isPartialSend ? originalRecipientCount - recipientCount : undefined,
        total_batches: totalBatches,
        warmup_info: isPartialSend ? {
          daily_limit: quotaCheck.limits?.daily_limit,
          daily_used: quotaCheck.limits?.daily_used,
          warmup_stage: quotaCheck.domain?.warmup_stage
        } : undefined,
        message: isPartialSend
          ? `Campaign queued for ${emailPayloads.length} of ${originalRecipientCount} recipients (limited by warmup)`
          : `Campaign queued for sending to ${emailPayloads.length} recipients`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ CRITICAL ERROR:', error);
    
    let userMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.message?.includes('JWT')) {
      userMessage = 'Authentication error';
      statusCode = 401;
    } else if (error.message?.includes('permission') || error.message?.includes('RLS')) {
      userMessage = 'Permission denied';
      statusCode = 403;
    } else if (error.message?.includes('timeout')) {
      userMessage = 'Request timed out';
      statusCode = 504;
    }
    
    return new Response(
      JSON.stringify({ error: userMessage, details: error.message }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
