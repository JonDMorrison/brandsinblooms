import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2";
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, type MergeTagData } from "../_shared/mergeTagEngine.ts";
import { generateServerFooterHtml, type CompanyProfileData } from "../_shared/footerGenerator.ts";
import { extractLinks, getUniqueUrls, rewriteLinksSync, hasPII } from "../_shared/linkRewriter.ts";
import { renderEmailForRecipient, normalizeMergeTokens, type CustomerShape, type CompanyProfileShape } from "../_shared/emailRenderer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
}

// Threshold for inline sending vs queue-based sending
const INLINE_SEND_THRESHOLD = 300;
const BATCH_SIZE_PER_JOB = 200;

function serializeSupabaseError(err: any) {
  if (!err) return null;

  let safeJson: string | null = null;
  try {
    safeJson = JSON.stringify(err);
  } catch {
    safeJson = null;
  }

  const keys = (() => {
    try {
      return typeof err === 'object' && err ? Object.keys(err) : null;
    } catch {
      return null;
    }
  })();

  return {
    type: typeof err,
    isArray: Array.isArray(err),
    keys,
    asString: (() => {
      try {
        return String(err);
      } catch {
        return null;
      }
    })(),
    json: safeJson,
    name: err?.name,
    message: err?.message,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    status: err?.status,
    statusCode: err?.statusCode,
  };
}

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

  if (usesVerifiedDomain && senderEmail !== 'noreply@bloomsuite.app') {
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

serve(async (req: Request) => {
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

    // Idempotent gate: ensures campaign is in a valid sending state.
    // Allows scheduled campaigns already in 'sending' to proceed, but blocks already-sent campaigns.
    const { data: gate, error: gateError } = await supabase.rpc('ensure_campaign_sending', {
      p_campaign_id: campaignId,
    });

    if (gateError) {
      console.error('❌ Failed to gate campaign send:', gateError);
      return new Response(
        JSON.stringify({ error: 'Failed to start campaign send' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gateRow = Array.isArray(gate) ? gate[0] : gate;
    if (!gateRow?.success) {
      return new Response(
        JSON.stringify({ error: gateRow?.error_message || 'Campaign cannot be sent' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get customers based on targeting (segments + personas)
    // This is the source of truth for whether email_send_jobs get created.
    let customers: any[] = [];

    const isUuidLike = (value: string) => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    };

    // 1) Segment targeting
    const segmentIds: string[] = [];
    if (campaign.segment_id) segmentIds.push(campaign.segment_id);

    if (segmentIds.length === 0) {
      const { data: campaignSegments, error: campaignSegmentsError } = await supabase
        .from('campaign_segments')
        .select('segment_id')
        .eq('campaign_id', campaignId);

      if (campaignSegmentsError) {
        console.error('Error fetching campaign_segments:', campaignSegmentsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch campaign segments' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      (campaignSegments || []).forEach((cs: any) => {
        if (cs?.segment_id) segmentIds.push(cs.segment_id);
      });
    }

    // 2) Persona targeting
    // Primary source: crm_campaigns.persona_ids (array)
    const personaIds = new Set<string>();
    if (Array.isArray(campaign.persona_ids)) {
      for (const pid of campaign.persona_ids) {
        if (typeof pid === 'string' && pid.trim()) personaIds.add(pid.trim());
      }
    }

    // Back-compat: campaign_personas junction table
    const { data: campaignPersonas, error: campaignPersonasError } = await supabase
      .from('campaign_personas')
      .select('persona_id')
      .eq('campaign_id', campaignId);

    if (campaignPersonasError) {
      console.error('Error fetching campaign_personas:', campaignPersonasError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch campaign personas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    (campaignPersonas || []).forEach((cp: any) => {
      if (cp?.persona_id) personaIds.add(String(cp.persona_id));
    });

    const personaIdList = Array.from(personaIds);
    const personaUuidIds = personaIdList.filter(isUuidLike);
    const personaPredefinedIds = personaIdList.filter((x) => !isUuidLike(x));

    console.log(`📧 Audience targeting: segments=${segmentIds.length}, personas=${personaIdList.length}`);

    // 3) Resolve customer IDs for segments/personas, then fetch customers
    let allowedCustomerIds: string[] | null = null;

    if (segmentIds.length > 0) {
      const { data: segmentCustomers, error: segErr } = await supabase
        .from('customer_segments')
        .select('customer_id')
        .in('segment_id', segmentIds);

      if (segErr) {
        console.error('Error fetching customer_segments:', segErr);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch segment audience' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const ids = Array.from(
        new Set<string>(
          (segmentCustomers || [])
            .map((r: any) => (typeof r?.customer_id === 'string' ? r.customer_id : null))
            .filter((x: string | null): x is string => !!x)
        )
      );
      console.log(`📧 Segment audience resolved: ${ids.length} customers`);
      allowedCustomerIds = ids;
    }

    if (personaIdList.length > 0) {
      // Support both single persona_id on crm_customers and many-to-many via customer_personas.
      const personaCustomerIds = new Set<string>();

      if (personaUuidIds.length > 0) {
        const { data: cpRows, error: cpErr } = await supabase
          .from('customer_personas')
          .select('customer_id')
          .in('persona_id', personaUuidIds);

        if (cpErr) {
          console.error('Error fetching customer_personas by persona_id:', cpErr);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch persona audience' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        (cpRows || []).forEach((r: any) => r?.customer_id && personaCustomerIds.add(r.customer_id));

        const { data: directPersonaCustomers, error: directErr } = await supabase
          .from('crm_customers')
          .select('id')
          .eq('tenant_id', campaign.tenant_id)
          .in('persona_id', personaUuidIds);

        if (directErr) {
          console.error('Error fetching crm_customers by persona_id:', directErr);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch persona audience' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        (directPersonaCustomers || []).forEach((r: any) => r?.id && personaCustomerIds.add(r.id));
      }

      if (personaPredefinedIds.length > 0) {
        const { data: cpRows, error: cpErr } = await supabase
          .from('customer_personas')
          .select('customer_id')
          .in('predefined_persona_id', personaPredefinedIds);

        if (cpErr) {
          console.error('Error fetching customer_personas by predefined_persona_id:', cpErr);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch persona audience' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        (cpRows || []).forEach((r: any) => r?.customer_id && personaCustomerIds.add(r.customer_id));
      }

      const ids = Array.from(personaCustomerIds);
      console.log(`📧 Persona audience resolved: ${ids.length} customers`);

      if (allowedCustomerIds === null) {
        allowedCustomerIds = ids;
      } else {
        // Intersection when both segment and persona targeting are present
        const segSet = new Set(allowedCustomerIds);
        allowedCustomerIds = ids.filter((id) => segSet.has(id));
      }
    }

    let customersQuery = supabase
      .from('crm_customers')
      .select('id, first_name, last_name, email, suppressed')
      .eq('tenant_id', campaign.tenant_id)
      .not('email', 'is', null);

    if (allowedCustomerIds) {
      console.log(`📧 Final audience after targeting: ${allowedCustomerIds.length} customers`);
      if (allowedCustomerIds.length === 0) {
        // No audience after applying targeting
        customers = [];
      } else {
        // Chunk large IN lists to avoid request limits
        const IN_CHUNK = 1000;
        const fetched: any[] = [];
        for (let i = 0; i < allowedCustomerIds.length; i += IN_CHUNK) {
          const chunk = allowedCustomerIds.slice(i, i + IN_CHUNK);
          const { data, error } = await customersQuery.in('id', chunk);
          if (error) {
            console.error('Error fetching targeted crm_customers:', error);
            return new Response(
              JSON.stringify({ error: 'Failed to fetch customers' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          fetched.push(...(data || []));
        }
        customers = fetched;
      }
    } else {
      const { data, error } = await customersQuery;
      if (error) {
        console.error('Error fetching all crm_customers:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch customers' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      customers = data || [];
    }

    customers = (customers || []).filter((c: any) => c?.email?.trim());

    // Filter out suppressed customers unless explicitly included
    const totalBeforeSuppression = customers.length;
    let suppressedCount = 0;
    let suppressedByListCount = 0;

    if (!includeSuppressed) {
      // First filter by the suppressed flag
      const activeCustomers = customers.filter(c => !c.suppressed);
      suppressedCount = customers.length - activeCustomers.length;

      // Then check suppression_list table for additional exclusions
      const customerIds = activeCustomers.map(c => c.id);
      if (customerIds.length > 0) {
        const { data: suppressedInList } = await supabase
          .from('suppression_list')
          .select('customer_id')
          .eq('tenant_id', campaign.tenant_id)
          .in('customer_id', customerIds);

        if (suppressedInList && suppressedInList.length > 0) {
          const suppressedSet = new Set(suppressedInList.map((s: any) => s.customer_id));
          customers = activeCustomers.filter(c => !suppressedSet.has(c.id));
          suppressedByListCount = suppressedInList.length;
          console.log(`📧 Excluded ${suppressedByListCount} contacts from suppression_list (bounced/complained/unsubscribed)`);
        } else {
          customers = activeCustomers;
        }
      } else {
        customers = activeCustomers;
      }

      const totalSuppressed = suppressedCount + suppressedByListCount;
      if (totalSuppressed > 0) {
        console.log(`📧 Excluded ${totalSuppressed} suppressed contacts total (${totalBeforeSuppression} → ${customers.length} active)`);
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

    // NOTE: Warmup/quota enforcement is handled by the worker; we still record these values for UI messaging.
    const originalRecipientCount = recipientCount;
    const isPartialSend = false;

    // Auto-select the tenant's active domain if none specified on campaign
    let domainIdToUse = campaign.from_email_domain_id;
    if (!domainIdToUse) {
      const { data: activeDomains } = await supabase
        .from('email_domains')
        .select('id, domain, status')
        .eq('tenant_id', campaign.tenant_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (activeDomains && activeDomains.length > 0) {
        domainIdToUse = activeDomains[0].id;
        console.log(`📧 Auto-selected active domain: ${activeDomains[0].domain} (${domainIdToUse})`);
      } else {
        console.log(`📧 No active domain found for tenant, will use fallback sender`);
      }
    }

    // Quota check with warmup enforcement
    const { data: quotaCheck, error: quotaError } = await supabase.rpc('check_send_quota', {
      p_tenant_id: campaign.tenant_id,
      p_domain_id: domainIdToUse || null,
      p_recipient_count: recipientCount
    });

    if (quotaError) {
      console.error('Error checking quota:', quotaError);
      return new Response(
        JSON.stringify({ error: 'Failed to check sending quota' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log quota info (no longer blocking or truncating)
    if (quotaCheck?.limits) {
      const dailyLimit = quotaCheck.limits.daily_limit || 5000;
      const dailyUsed = quotaCheck.limits.daily_used || 0;
      console.log(`📧 Domain quota info: daily_limit=${dailyLimit}, daily_used=${dailyUsed}, sending=${recipientCount}`);
    }

    if (!quotaCheck?.allowed) {
      console.warn(`📧 Quota check returned allowed=false, but proceeding anyway: ${quotaCheck?.message}`);
    }

    // Determine sender
    const companyName = companyProfile?.company_name || 'Your Garden Center';
    let senderEmail: string;
    let senderDisplayName: string;
    let deliveryMethod: string;
    let usesVerifiedDomain: boolean;
    let activeDomainId: string | null = null;

    if (quotaCheck.using_fallback) {
      senderEmail = quotaCheck.sender?.from_email || 'noreply@bloomsuite.app';
      senderDisplayName = companyName;
      deliveryMethod = 'shared_sender';
      usesVerifiedDomain = false;
    } else {
      // Use configured from_email, or construct one from the domain
      const domainName = quotaCheck.domain?.domain;
      const configuredEmail = quotaCheck.sender?.from_email;

      if (configuredEmail && configuredEmail !== 'noreply@bloomsuite.app') {
        senderEmail = configuredEmail;
      } else if (domainName) {
        // Construct default email from domain: mail@domain.com
        senderEmail = `mail@${domainName}`;
        console.log(`📧 No default_from_email set, using constructed: ${senderEmail}`);
      } else {
        senderEmail = 'noreply@bloomsuite.app';
      }

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
    let piiWarnings: string[] = [];
    let linksRewritten = 0;

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

    // ========== LINK TRACKING SETUP ==========
    // Extract unique URLs from campaign content and create tracked_links entries
    const campaignContent = campaign.content || '';
    const extractedLinks = extractLinks(campaignContent);
    const uniqueUrls = getUniqueUrls(extractedLinks);
    const urlToLinkIdMap = new Map<string, string>();

    console.log(`🔗 Found ${uniqueUrls.length} unique URLs to track`);

    // Check for PII in URLs and log warnings
    for (const url of uniqueUrls) {
      if (hasPII(url)) {
        piiWarnings.push(url);
        console.warn(`⚠️ PII detected in URL, will skip tracking: ${url.substring(0, 80)}...`);
      }
    }

    // Create tracked_links entries for each unique URL (excluding PII URLs)
    const urlsToTrack = uniqueUrls.filter(url => !hasPII(url));
    if (urlsToTrack.length > 0) {
      const trackedLinkInserts = urlsToTrack.map(url => ({
        tenant_id: campaign.tenant_id,
        campaign_id: campaignId,
        url,
      }));

      // Upsert tracked links
      const { data: insertedLinks, error: linksError } = await supabase
        .from('tracked_links')
        .upsert(trackedLinkInserts, { onConflict: 'tenant_id,campaign_id,url', ignoreDuplicates: false })
        .select('id, url');

      if (linksError) {
        console.warn('⚠️ Error creating tracked links (non-fatal):', linksError);
      } else if (insertedLinks) {
        for (const link of insertedLinks) {
          urlToLinkIdMap.set(link.url, link.id);
        }
        console.log(`🔗 Created/updated ${insertedLinks.length} tracked links`);
      }
    }

    for (const customer of customers) {
      try {
        let payload = buildEmailPayloadOptimized(
          customer, campaign, companyProfile, profileData,
          fromAddress, senderEmail, usesVerifiedDomain, activeDomainId,
          sharedFooterTemplate
        );

        // Rewrite links in the email HTML with tracking URLs
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
          linksRewritten += rewriteResult.linksRewritten;

          // Collect any additional PII warnings from this customer's email
          if (rewriteResult.piiWarnings.length > 0) {
            piiWarnings = [...new Set([...piiWarnings, ...rewriteResult.piiWarnings])];
          }
        }

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

    console.log(`🔗 Rewrote ${linksRewritten} links across all emails`);

    // Batch upsert subscriptions
    if (subscriptionUpserts.length > 0) {
      try {
        await supabase
          .from('crm_subscriptions')
          .upsert(subscriptionUpserts, { onConflict: 'email,tenant_id' });
      } catch (e) {
        console.error('Failed to upsert subscriptions:', e);
      }
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

    // ========== PERSIST RECIPIENTS (SOURCE OF TRUTH) ==========
    // Store one immutable row per (campaign, customer) so retries/resumes can never duplicate.
    const invalidRecipients = emailPayloads.filter((r) => !r?.customerId || !r?.email || !r?.payload);
    if (invalidRecipients.length > 0) {
      console.error('❌ Invalid recipient rows detected before persisting email_messages', {
        invalidCount: invalidRecipients.length,
        sample: {
          customerId: invalidRecipients[0]?.customerId,
          email: invalidRecipients[0]?.email,
          hasPayload: !!invalidRecipients[0]?.payload,
        },
      });
      return new Response(
        JSON.stringify({ error: 'Invalid recipients (missing customerId/email/payload)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!campaign?.tenant_id) {
      console.error('❌ Campaign tenant_id missing, cannot persist recipients', { campaignId });
      return new Response(
        JSON.stringify({ error: 'Campaign missing tenant_id' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageUpserts = emailPayloads.map((r) => ({
      tenant_id: campaign.tenant_id,
      campaign_id: campaignId,
      customer_id: r.customerId,
      domain_id: activeDomainId,
      email: r.email,
      payload: r.payload,
      status: 'queued',
      // Reset transient send state on rebuild so retries can proceed.
      resend_id: null,
      claimed_at: null,
      claimed_by: null,
      claim_token: null,
      dead_lettered_at: null,
      error_message: null,
    }));

    const UPSERT_CHUNK = 500;
    for (let i = 0; i < messageUpserts.length; i += UPSERT_CHUNK) {
      const chunk = messageUpserts.slice(i, i + UPSERT_CHUNK);
      try {
        const resp = await supabase
          .from('email_messages')
          .upsert(chunk, { onConflict: 'campaign_id,customer_id' });

        if (resp.error) {
          console.error('❌ Failed to persist email_messages:', {
            status: resp.status,
            statusText: resp.statusText,
            err: serializeSupabaseError(resp.error),
            chunkSize: chunk.length,
            sample: {
              tenant_id: chunk[0]?.tenant_id,
              campaign_id: chunk[0]?.campaign_id,
              customer_id: chunk[0]?.customer_id,
              domain_id: chunk[0]?.domain_id,
              email: chunk[0]?.email,
              payloadKeys: chunk[0]?.payload ? Object.keys(chunk[0].payload) : null,
            },
          });
          return new Response(
            JSON.stringify({
              error: 'Failed to persist recipients',
              status: resp.status,
              statusText: resp.statusText,
              details: serializeSupabaseError(resp.error),
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e: any) {
        console.error('❌ Exception while persisting email_messages:', {
          err: serializeSupabaseError(e),
          chunkSize: chunk.length,
          sample: {
            tenant_id: chunk[0]?.tenant_id,
            campaign_id: chunk[0]?.campaign_id,
            customer_id: chunk[0]?.customer_id,
            domain_id: chunk[0]?.domain_id,
            email: chunk[0]?.email,
            payloadKeys: chunk[0]?.payload ? Object.keys(chunk[0].payload) : null,
          },
        });
        return new Response(
          JSON.stringify({ error: 'Failed to persist recipients (exception)', details: serializeSupabaseError(e) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Load message IDs to build stable batch jobs
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
          JSON.stringify({ error: 'Failed to queue recipients' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      (rows || []).forEach((r: any) => idMap.set(r.customer_id, r.id));
    }

    const messageIdsInOrder: string[] = [];
    for (const r of emailPayloads) {
      const mid = idMap.get(r.customerId);
      if (mid) messageIdsInOrder.push(mid);
    }

    // ========== CREATE BATCH JOBS (RESUMABLE WORK UNITS) ==========
    const totalBatches = Math.ceil(messageIdsInOrder.length / BATCH_SIZE_PER_JOB);
    console.log(`📧 Campaign has ${messageIdsInOrder.length} recipients, ensuring ${totalBatches} batch jobs`);

    const jobUpserts: any[] = [];
    for (let i = 0; i < messageIdsInOrder.length; i += BATCH_SIZE_PER_JOB) {
      const batchIds = messageIdsInOrder.slice(i, i + BATCH_SIZE_PER_JOB);
      const batchRecipients = emailPayloads.slice(i, i + BATCH_SIZE_PER_JOB).map((x) => ({
        email: x.email,
        customerId: x.customerId,
      }));
      jobUpserts.push({
        campaign_id: campaignId,
        tenant_id: campaign.tenant_id,
        domain_id: activeDomainId,
        status: 'pending',
        recipient_message_ids: batchIds,
        // Keep legacy field for analytics/UI (but worker uses message IDs + email_messages)
        recipient_emails: batchRecipients,
        batch_index: Math.floor(i / BATCH_SIZE_PER_JOB),
      });
    }

    const JOB_CHUNK = 200;
    for (let i = 0; i < jobUpserts.length; i += JOB_CHUNK) {
      const chunk = jobUpserts.slice(i, i + JOB_CHUNK);
      const { error: jobErr } = await supabase
        .from('email_send_jobs')
        .upsert(chunk, { onConflict: 'campaign_id,batch_index', ignoreDuplicates: true });
      if (jobErr) {
        console.error('❌ Failed to create batch jobs:', jobErr);
        return new Response(
          JSON.stringify({ error: 'Failed to queue campaign' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mark campaign as sending (worker will complete it and set sent_at)
    const campaignStatus = isPartialSend ? 'partially_queued' : 'queued';
    await supabase
      .from('crm_campaigns')
      .update({
        status: campaignStatus,
        sent_at: new Date().toISOString(),
        send_blocked_reason: null,
        metrics: {
          ...(campaign.metrics || {}),
          queued: messageIdsInOrder.length,
          skipped_suppressed: suppressedCount + suppressedByListCount,
          links_tracked: urlToLinkIdMap.size,
          pii_warnings: piiWarnings.length,
        },
      })
      .eq('id', campaignId);

    console.log(`📧 Campaign ${campaignId} queued with ${totalBatches} batch jobs`);

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
