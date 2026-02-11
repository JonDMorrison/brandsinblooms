import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.1.0";
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, type MergeTagData } from "../_shared/mergeTagEngine.ts";
import { generateServerFooterHtml, type CompanyProfileData } from "../_shared/footerGenerator.ts";
import { rewriteLinksSync } from "../_shared/linkRewriter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE_PER_JOB = 200;

/**
 * Strip existing footer from HTML content
 */
function stripExistingFooter(html: string): string {
  let strippedHtml = html;
  const footerWrapperPattern = /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi;
  strippedHtml = strippedHtml.replace(footerWrapperPattern, '');
  const unsubscribeFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  strippedHtml = strippedHtml.replace(unsubscribeFooterPattern, '');
  return strippedHtml;
}

/**
 * Build email payload for a customer
 */
function buildEmailPayload(
  customer: any,
  campaign: any,
  companyProfile: any,
  profileData: CompanyProfileData,
  fromAddress: string,
  senderEmail: string,
  usesVerifiedDomain: boolean,
  activeDomainId: string | null,
  sharedFooterTemplate: string,
  replyToEmail?: string
): any {
  const companyName = companyProfile?.company_name || 'Your Garden Center';

  const unsubscribeToken = btoa(`${customer.email}:${campaign.tenant_id}`);
  const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${campaign.tenant_id}&token=${unsubscribeToken}`;
  const preferencesLink = unsubscribeLink.replace('handle-unsubscribe', 'manage-preferences');

  const customerFooter = sharedFooterTemplate
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeLink)
    .replace(/\{\{PREFERENCES_URL\}\}/g, preferencesLink);

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

  let emailContent = convertLegacyTags(campaign.content || '');
  let emailSubject = convertLegacyTags(campaign.subject_line || 'Newsletter');

  emailContent = renderMergeTags(emailContent, mergeTagData);
  emailSubject = renderMergeTags(emailSubject, mergeTagData);

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
      'X-Campaign-Type': 'resend',
      'X-Tenant-ID': campaign.tenant_id,
      'X-Domain-ID': activeDomainId || 'fallback'
    },
    tags: [
      { name: 'campaign_id', value: campaign.id },
      { name: 'type', value: 'resend' },
      { name: 'tenant_id', value: campaign.tenant_id }
    ]
  };

  // Reply-to: prefer explicit replyToEmail, fallback to senderEmail for verified domains
  if (replyToEmail) {
    emailPayload.reply_to = replyToEmail;
  } else if (usesVerifiedDomain && senderEmail !== 'noreply@bloomsuite.app') {
    emailPayload.reply_to = senderEmail;
  }

  return emailPayload;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, dryRun = true, maxRecipients, bypassWarmup = false } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Resend missed recipients: campaignId=${campaignId}, dryRun=${dryRun}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all customers already materialized for this campaign (source-of-truth)
    const { data: existingMessages } = await supabase
      .from('email_messages')
      .select('customer_id')
      .eq('campaign_id', campaignId);

    const alreadySentCustomerIds = new Set<string>((existingMessages || []).map((m: any) => m.customer_id));
    console.log(`📧 Found ${alreadySentCustomerIds.size} customers already queued/sent in email_messages`);

    // Also check email_tracking_events for recipients who received the email (fallback for older campaigns)
    const { data: trackingEvents } = await supabase
      .from('email_tracking_events')
      .select('customer_email')
      .eq('campaign_id', campaignId);

    const alreadySentEmails = new Set<string>(
      (trackingEvents || [])
        .map((e: any) => e.customer_email?.toLowerCase())
        .filter(Boolean)
    );
    console.log(`📧 Found ${alreadySentEmails.size} unique emails in tracking events`);

    // Get eligible customers - if campaign has a segment, filter by it
    let allCustomers: any[] = [];
    let customersError: any = null;

    if (campaign.segment_id) {
      // Get customers from the segment
      console.log(`📧 Fetching customers from segment: ${campaign.segment_id}`);
      const { data, error } = await supabase
        .from('crm_customers')
        .select('id, first_name, last_name, email, suppressed, customer_segments!inner(segment_id)')
        .eq('tenant_id', campaign.tenant_id)
        .eq('opt_out', false)
        .eq('suppressed', false)
        .eq('email_opt_in', true)
        .eq('customer_segments.segment_id', campaign.segment_id)
        .not('email', 'is', null);
      allCustomers = data || [];
      customersError = error;
    } else {
      // Get ALL eligible customers for this tenant (no segment filter)
      const { data, error } = await supabase
        .from('crm_customers')
        .select('id, first_name, last_name, email, suppressed')
        .eq('tenant_id', campaign.tenant_id)
        .eq('opt_out', false)
        .eq('suppressed', false)
        .eq('email_opt_in', true)
        .not('email', 'is', null);
      allCustomers = data || [];
      customersError = error;
    }

    console.log(`📧 Found ${allCustomers.length} eligible customers`);

    if (customersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to only missed customers (not in email_messages AND not in tracking events)
    let missedCustomers = (allCustomers || []).filter(c =>
      c.email?.trim() && 
      !alreadySentCustomerIds.has(c.id) &&
      !alreadySentEmails.has(c.email?.toLowerCase())
    );

    console.log(`📧 Found ${missedCustomers.length} missed recipients`);

    if (missedCustomers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No missed recipients found',
          alreadySent: alreadySentCustomerIds.size,
          missed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit if specified
    if (maxRecipients && maxRecipients > 0 && missedCustomers.length > maxRecipients) {
      missedCustomers = missedCustomers.slice(0, maxRecipients);
      console.log(`📧 Limited to ${maxRecipients} recipients`);
    }

    // If dry run, just return the counts
    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          message: `Found ${missedCustomers.length} missed recipients. Set dryRun=false to actually send.`,
          alreadySent: alreadySentCustomerIds.size,
          missed: missedCustomers.length,
          missedEmails: missedCustomers.slice(0, 20).map(c => c.email) // Sample of emails
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ACTUAL SEND ==========
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        footer_legal_text, brand_primary_color, brand_text_color
      `)
      .eq('user_id', campaign.user_id)
      .single();

    // Get active domain (include default_reply_to for reply-to header)
    const { data: activeDomains } = await supabase
      .from('email_domains')
      .select('id, domain, status, daily_limit, daily_sent_count, default_reply_to, default_from_email')
      .eq('tenant_id', campaign.tenant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    const activeDomain = activeDomains?.[0];
    const activeDomainId = activeDomain?.id || null;

    // Check warmup limits (can be bypassed with bypassWarmup flag)
    if (activeDomain && !bypassWarmup) {
      const remainingCapacity = Math.max(0, (activeDomain.daily_limit || 200) - (activeDomain.daily_sent_count || 0));
      if (missedCustomers.length > remainingCapacity) {
        console.log(`⚠️ Truncating to ${remainingCapacity} due to warmup limits`);
        missedCustomers = missedCustomers.slice(0, remainingCapacity);
      }

      if (missedCustomers.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Daily sending limit reached',
            daily_limit: activeDomain.daily_limit,
            daily_sent: activeDomain.daily_sent_count
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (bypassWarmup) {
      console.log(`⚠️ WARMUP BYPASS ENABLED - sending all ${missedCustomers.length} recipients`);
    }

    // Build sender info
    const companyName = companyProfile?.company_name || 'Your Garden Center';
    let senderEmail = companyProfile?.custom_sender_email || 'noreply@bloomsuite.app';
    let fromAddress = `${companyName} <noreply@bloomsuite.app>`;
    let usesVerifiedDomain = false;

    if (activeDomain && companyProfile?.custom_sender_email) {
      const customEmail = companyProfile.custom_sender_email;
      const emailDomain = customEmail.split('@')[1];
      if (emailDomain === activeDomain.domain) {
        fromAddress = `${companyName} <${customEmail}>`;
        senderEmail = customEmail;
        usesVerifiedDomain = true;
      }
    }

    // Build profile data for footer
    const profileData: CompanyProfileData = {
      company_name: companyName,
      location_info: companyProfile?.location_info,
      street_address: companyProfile?.street_address,
      city: companyProfile?.city,
      state_province: companyProfile?.state_province,
      postal_code: companyProfile?.postal_code,
      country: companyProfile?.country,
      website_url: companyProfile?.website_url,
      company_email: companyProfile?.company_email,
      company_phone: companyProfile?.company_phone,
      brand_primary_color: companyProfile?.brand_primary_color,
      brand_text_color: companyProfile?.brand_text_color,
      facebook_url: companyProfile?.facebook_url,
      instagram_url: companyProfile?.instagram_url,
      tiktok_url: companyProfile?.tiktok_url,
      pinterest_url: companyProfile?.pinterest_url,
      youtube_url: companyProfile?.youtube_url,
      linkedin_url: companyProfile?.linkedin_url,
      footer_legal_text: companyProfile?.footer_legal_text,
    };

    // Generate shared footer template
    const sharedFooterTemplate = generateServerFooterHtml(
      profileData,
      '{{UNSUBSCRIBE_URL}}',
      '{{PREFERENCES_URL}}'
    );

    // Get tracked links for this campaign
    const { data: trackedLinks } = await supabase
      .from('tracked_links')
      .select('id, url')
      .eq('campaign_id', campaignId);

    const urlToLinkIdMap = new Map<string, string>();
    if (trackedLinks) {
      for (const link of trackedLinks) {
        urlToLinkIdMap.set(link.url, link.id);
      }
    }

    // Build email payloads
    const emailPayloads: any[] = [];
    for (const customer of missedCustomers) {
      try {
        // Reply-to: prefer domain setting, fallback to sender email
        const replyToEmail = activeDomain?.default_reply_to || senderEmail;
        let payload = buildEmailPayload(
          customer, campaign, companyProfile, profileData,
          fromAddress, senderEmail, usesVerifiedDomain, activeDomainId,
          sharedFooterTemplate, replyToEmail
        );

        // Rewrite links for tracking
        if (urlToLinkIdMap.size > 0 && payload.html) {
          const rewriteResult = rewriteLinksSync(
            payload.html,
            urlToLinkIdMap,
            campaignId,
            customer.id,
            campaign.tenant_id,
            customer.email
          );
          payload.html = rewriteResult.html;
        }

        emailPayloads.push({ email: customer.email, customerId: customer.id, payload });
      } catch (error: any) {
        console.error(`Error building payload for ${customer.id}:`, error.message);
      }
    }

    console.log(`📧 Built ${emailPayloads.length} email payloads`);

    // Persist recipients to email_messages (dedupe via unique (campaign_id, customer_id))
    const messageRows = emailPayloads.map((r) => ({
      tenant_id: campaign.tenant_id,
      campaign_id: campaignId,
      customer_id: r.customerId,
      domain_id: activeDomainId,
      email: r.email,
      payload: r.payload,
      status: 'queued',
    }));

    const UPSERT_CHUNK = 500;
    for (let i = 0; i < messageRows.length; i += UPSERT_CHUNK) {
      const chunk = messageRows.slice(i, i + UPSERT_CHUNK);
      const { error: upsertErr } = await supabase
        .from('email_messages')
        .upsert(chunk, { onConflict: 'campaign_id,customer_id', ignoreDuplicates: true });
      if (upsertErr) {
        console.error('❌ Failed to persist email_messages:', upsertErr);
        return new Response(
          JSON.stringify({ error: 'Failed to persist recipients' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Load message IDs for job creation
    const customerIds = emailPayloads.map((r) => r.customerId);
    const idMap = new Map<string, string>();
    const IN_CHUNK = 800;
    for (let i = 0; i < customerIds.length; i += IN_CHUNK) {
      const idsChunk = customerIds.slice(i, i + IN_CHUNK);
      const { data: rows, error: fetchErr } = await supabase
        .from('email_messages')
        .select('id, customer_id')
        .eq('campaign_id', campaignId)
        .in('customer_id', idsChunk);
      if (fetchErr) {
        console.error('❌ Failed to fetch email_message IDs:', fetchErr);
        return new Response(
          JSON.stringify({ error: 'Failed to queue emails' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      (rows || []).forEach((r: any) => idMap.set(r.customer_id, r.id));
    }

    // Create batch jobs referencing message IDs
    const jobInserts: any[] = [];
    for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE_PER_JOB) {
      const batch = emailPayloads.slice(i, i + BATCH_SIZE_PER_JOB);
      const batchMessageIds = batch.map((r) => idMap.get(r.customerId)).filter(Boolean);
      jobInserts.push({
        campaign_id: campaignId,
        tenant_id: campaign.tenant_id,
        domain_id: activeDomainId,
        status: 'pending',
        recipient_message_ids: batchMessageIds,
        recipient_emails: batch.map((r) => ({ email: r.email, customerId: r.customerId })),
        batch_index: 1000 + Math.floor(i / BATCH_SIZE_PER_JOB) // High batch index to indicate resend
      });
    }

    const { error: insertError } = await supabase
      .from('email_send_jobs')
      .upsert(jobInserts, { onConflict: 'campaign_id,batch_index', ignoreDuplicates: true });

    if (insertError) {
      console.error('❌ Failed to create batch jobs:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue emails' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Ensured ${jobInserts.length} batch jobs for ${emailPayloads.length} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Queued ${emailPayloads.length} missed recipients for sending`,
        queued: emailPayloads.length,
        batchJobs: jobInserts.length,
        previouslySent: alreadySentCustomerIds.size
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in resend-missed-recipients:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
