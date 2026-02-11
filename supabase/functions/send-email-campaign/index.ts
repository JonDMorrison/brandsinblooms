import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Avoid esm.sh in production deploys: it has been intermittently returning 500s during bundling.
// Deno v2 supports npm: specifiers, which are generally more reliable.
import { createClient } from "npm:@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.1.0";
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
  sharedFooterTemplate: string,
  replyToEmail?: string
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

  // Set reply-to: prefer custom reply-to, otherwise use sender email for verified domains
  if (replyToEmail) {
    emailPayload.reply_to = replyToEmail;
  } else if (usesVerifiedDomain && senderEmail !== 'noreply@bloomsuite.app') {
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
      // IMPORTANT: PostgREST commonly caps responses at 1000 rows unless paginated.
      const PAGE_SIZE = 1000;
      const segmentCustomerIds = new Set<string>();
      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data: segmentCustomers, error: segErr } = await supabase
          .from('customer_segments')
          .select('customer_id')
          .in('segment_id', segmentIds)
          .range(from, to);

        if (segErr) {
          console.error('Error fetching customer_segments:', segErr);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch segment audience' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        (segmentCustomers || []).forEach((r: any) => {
          if (typeof r?.customer_id === 'string' && isUuidLike(r.customer_id)) {
            segmentCustomerIds.add(r.customer_id);
          }
        });

        if (!segmentCustomers || segmentCustomers.length < PAGE_SIZE) break;
      }

      const ids = Array.from(segmentCustomerIds);
      console.log(`📧 Segment audience resolved: ${ids.length} customers`);
      allowedCustomerIds = ids;
    }

    if (personaIdList.length > 0) {
      // Support both single persona_id on crm_customers and many-to-many via customer_personas.
      const personaCustomerIds = new Set<string>();

      if (personaUuidIds.length > 0) {
        const PAGE_SIZE = 1000;

        // Many-to-many via customer_personas
        for (let from = 0; ; from += PAGE_SIZE) {
          const to = from + PAGE_SIZE - 1;
          const { data: cpRows, error: cpErr } = await supabase
            .from('customer_personas')
            .select('customer_id')
            .in('persona_id', personaUuidIds)
            .range(from, to);

          if (cpErr) {
            console.error('Error fetching customer_personas by persona_id:', cpErr);
            return new Response(
              JSON.stringify({ error: 'Failed to fetch persona audience' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          (cpRows || []).forEach((r: any) => {
            if (typeof r?.customer_id === 'string' && isUuidLike(r.customer_id)) {
              personaCustomerIds.add(r.customer_id);
            }
          });

          if (!cpRows || cpRows.length < PAGE_SIZE) break;
        }

        // Legacy: crm_customers.persona_id
        for (let from = 0; ; from += PAGE_SIZE) {
          const to = from + PAGE_SIZE - 1;
          const { data: directPersonaCustomers, error: directErr } = await supabase
            .from('crm_customers')
            .select('id')
            .eq('tenant_id', campaign.tenant_id)
            .in('persona_id', personaUuidIds)
            .range(from, to);

          if (directErr) {
            console.error('Error fetching crm_customers by persona_id:', directErr);
            return new Response(
              JSON.stringify({ error: 'Failed to fetch persona audience' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          (directPersonaCustomers || []).forEach((r: any) => {
            if (typeof r?.id === 'string' && isUuidLike(r.id)) personaCustomerIds.add(r.id);
          });

          if (!directPersonaCustomers || directPersonaCustomers.length < PAGE_SIZE) break;
        }
      }

      if (personaPredefinedIds.length > 0) {
        const PAGE_SIZE = 1000;
        for (let from = 0; ; from += PAGE_SIZE) {
          const to = from + PAGE_SIZE - 1;
          const { data: cpRows, error: cpErr } = await supabase
            .from('customer_personas')
            .select('customer_id')
            .in('predefined_persona_id', personaPredefinedIds)
            .range(from, to);

          if (cpErr) {
            console.error('Error fetching customer_personas by predefined_persona_id:', cpErr);
            return new Response(
              JSON.stringify({ error: 'Failed to fetch persona audience' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          (cpRows || []).forEach((r: any) => {
            if (typeof r?.customer_id === 'string' && isUuidLike(r.customer_id)) {
              personaCustomerIds.add(r.customer_id);
            }
          });

          if (!cpRows || cpRows.length < PAGE_SIZE) break;
        }
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

    // IMPORTANT: Supabase query builders are stateful/mutating; reusing the same builder across
    // `.in(...)` chunk loops can accidentally accumulate multiple `id=in.(...)` filters, producing
    // an enormous URL (and fetch failures) like `...&id=in.(...chunk1...)&id=in.(...chunk2...)`.
    // Always create a fresh builder per request.
      const buildCustomersQuery = () =>
      supabase
        .from('crm_customers')
        .select('id, first_name, last_name, email, suppressed, suppressed_reason')
        .eq('tenant_id', campaign.tenant_id)
        .not('email', 'is', null);

    if (allowedCustomerIds) {
      console.log(`📧 Final audience after targeting: ${allowedCustomerIds.length} customers`);
      if (allowedCustomerIds.length === 0) {
        // No audience after applying targeting
        customers = [];
      } else {
        // Chunk large IN lists to avoid PostgREST URL-length limits.
        // 1000 UUIDs in an `in.(...)` filter can exceed URL size and returns 400 Bad Request.
        const IN_CHUNK = 100;
        const filteredIds = allowedCustomerIds.filter((id) => typeof id === 'string' && isUuidLike(id));
        const fetched: any[] = [];
        for (let i = 0; i < filteredIds.length; i += IN_CHUNK) {
          const chunk = filteredIds.slice(i, i + IN_CHUNK);
          const { data, error } = await buildCustomersQuery().in('id', chunk);
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
      // Fetch all customers with pagination to avoid default row caps.
      const PAGE_SIZE = 1000;
      const fetched: any[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await buildCustomersQuery().range(from, to);
        if (error) {
          console.error('Error fetching all crm_customers:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch customers' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        fetched.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
      }
      customers = fetched;
    }

    customers = (customers || []).filter((c: any) => {
      const email = c?.email?.trim();
      if (!email) return false;
      // Filter out placeholder emails from POS syncs (Square, Clover)
      if (email.toLowerCase().endsWith('@noemail.local')) return false;
      return true;
    });

    // Filter out suppressed customers unless explicitly included
    // AND log skipped recipients for transparency
    const totalBeforeSuppression = customers.length;
    let suppressedCount = 0;
    let suppressedByListCount = 0;
    const skippedRecipients: Array<{ customer_id: string; email: string; reason: string }> = [];

    const isEngagementBasedSuppression = (reason?: string | null): boolean => {
      if (!reason) return false;
      const lower = reason.toLowerCase();
      return (
        lower.includes('no email opens') ||
        lower.includes('inactivity') ||
        lower.includes('engagement') ||
        lower.includes('180 days')
      );
    };

    if (!includeSuppressed) {
      // First filter by the suppressed flag (but bypass engagement-based suppression)
      const suppressedFlagRows = customers.filter(
        (c: any) => c?.suppressed && c?.email && !isEngagementBasedSuppression(c?.suppressed_reason)
      );
      const activeCustomers = customers.filter(
        (c: any) => !c?.suppressed || isEngagementBasedSuppression(c?.suppressed_reason)
      );
      suppressedCount = suppressedFlagRows.length;

      suppressedFlagRows.forEach((c: any) => {
        if (typeof c?.id === 'string' && typeof c?.email === 'string') {
          skippedRecipients.push({ customer_id: c.id, email: c.email, reason: 'suppressed flag' });
        }
      });

      // Then check suppression_list table for additional exclusions
      const customerIds = activeCustomers.map(c => c.id);
      if (customerIds.length > 0) {
        const emailByCustomerId = new Map<string, string>();
        activeCustomers.forEach((c: any) => {
          if (typeof c?.id === 'string' && typeof c?.email === 'string') {
            emailByCustomerId.set(c.id, c.email);
          }
        });

        const suppressedSet = new Set<string>();
        const IN_CHUNK = 200;
        const filteredCustomerIds = customerIds.filter((id: any) => typeof id === 'string' && isUuidLike(id));
        for (let i = 0; i < filteredCustomerIds.length; i += IN_CHUNK) {
          const chunk = filteredCustomerIds.slice(i, i + IN_CHUNK);
          const { data: suppressedInList, error: supErr } = await supabase
            .from('suppression_list')
            .select('customer_id')
            .eq('tenant_id', campaign.tenant_id)
            .in('customer_id', chunk);
          if (supErr) {
            console.warn('⚠️ Failed to fetch suppression_list chunk (continuing):', supErr.message);
            continue;
          }
          (suppressedInList || []).forEach((s: any) => {
            if (typeof s?.customer_id === 'string') suppressedSet.add(s.customer_id);
          });
        }

        if (suppressedSet.size > 0) {
          customers = activeCustomers.filter(c => !suppressedSet.has(c.id));
          suppressedByListCount = suppressedSet.size;
          console.log(`📧 Excluded ${suppressedByListCount} contacts from suppression_list (bounced/complained/unsubscribed)`);

          suppressedSet.forEach((cid) => {
            const email = emailByCustomerId.get(cid);
            if (email) {
              skippedRecipients.push({ customer_id: cid, email, reason: 'suppression_list' });
            }
          });
        } else {
          customers = activeCustomers;
        }
      } else {
        customers = activeCustomers;
      }

      const totalSuppressed = suppressedCount + suppressedByListCount;
      if (totalSuppressed > 0) {
        console.log(`📧 Excluded ${totalSuppressed} suppressed contacts total (${totalBeforeSuppression} → ${customers.length} active)`);

        // Log skipped recipients to email_send_skips table for transparency
        if (skippedRecipients.length > 0) {
          const skipInserts = skippedRecipients.map(skip => ({
            tenant_id: campaign.tenant_id,
            campaign_id: campaignId,
            customer_id: skip.customer_id,
            email: skip.email,
            reason: skip.reason,
          }));

          // Batch insert in chunks of 500
          for (let i = 0; i < skipInserts.length; i += 500) {
            const batch = skipInserts.slice(i, i + 500);
            const { error: skipError } = await supabase
              .from('email_send_skips')
              .insert(batch);

            if (skipError) {
              console.warn(`⚠️ Failed to log skipped recipients batch ${i}-${i + batch.length}:`, skipError.message);
            }
          }
          console.log(`📧 Logged ${skippedRecipients.length} skipped recipients to email_send_skips`);
        }
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
    const originalRecipientCount = recipientCount;
    const isPartialSend = false; // Warmup truncation is currently disabled
    console.log(`📧 Found ${recipientCount} customers`);

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

    // Fetch reply-to email from domain settings
    let replyToEmail: string | undefined;
    if (activeDomainId) {
      const { data: domainData } = await supabase
        .from('email_domains')
        .select('default_reply_to')
        .eq('id', activeDomainId)
        .single();

      if (domainData?.default_reply_to) {
        replyToEmail = domainData.default_reply_to;
        console.log(`📧 Using custom reply-to: ${replyToEmail}`);
      }
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

    // Persist recipients + batch jobs only.
    // IMPORTANT: For large audiences, rendering per-recipient HTML and rewriting links here will exceed Edge CPU.
    // The queue worker sends using per-message claim; we keep message.payload minimal.
    console.log(`📧 Queuing ${recipientCount} recipients in batches of ${BATCH_SIZE_PER_JOB}...`);
    const piiWarningSet = new Set<string>();
    let queuedRecipientCount = 0;

    // ========== LINK TRACKING SETUP (campaign-level only) ==========
    // Extract unique URLs once and upsert tracked_links (no per-recipient rewriting here).
    const campaignContent = campaign.content || '';
    const extractedLinks = extractLinks(campaignContent);
    const uniqueUrls = getUniqueUrls(extractedLinks);

    console.log(`🔗 Found ${uniqueUrls.length} unique URLs to track`);
    for (const url of uniqueUrls) {
      if (hasPII(url)) {
        piiWarningSet.add(url);
        console.warn(`⚠️ PII detected in URL, will skip tracking: ${url.substring(0, 80)}...`);
      }
    }

    const urlsToTrack = uniqueUrls.filter(url => !hasPII(url));
    if (urlsToTrack.length > 0) {
      const trackedLinkInserts = urlsToTrack.map(url => ({
        tenant_id: campaign.tenant_id,
        campaign_id: campaignId,
        url,
      }));

      const { data: insertedLinks, error: linksError } = await supabase
        .from('tracked_links')
        .upsert(trackedLinkInserts, { onConflict: 'tenant_id,campaign_id,url', ignoreDuplicates: false })
        .select('id');

      if (linksError) {
        console.warn('⚠️ Error creating tracked links (non-fatal):', linksError);
      } else {
        console.log(`🔗 Created/updated ${insertedLinks?.length || 0} tracked links`);
      }
    }

    // Process recipients in batches and persist as we go to keep memory bounded.
    const totalBatches = Math.ceil(recipientCount / BATCH_SIZE_PER_JOB);
    for (let batchStart = 0; batchStart < customers.length; batchStart += BATCH_SIZE_PER_JOB) {
      const batchIndex = Math.floor(batchStart / BATCH_SIZE_PER_JOB);
      const batchCustomers = customers.slice(batchStart, batchStart + BATCH_SIZE_PER_JOB);

      const batchMessageUpserts: any[] = [];
      const batchRecipientEmails: Array<{ email: string; customerId: string }> = [];

      for (const customer of batchCustomers) {
        if (!customer?.id || !customer?.email) continue;

        batchMessageUpserts.push({
          tenant_id: campaign.tenant_id,
          campaign_id: campaignId,
          customer_id: customer.id,
          domain_id: activeDomainId,
          email: customer.email,
          // Keep payload minimal; worker will build/send.
          payload: {},
          status: 'queued',
          resend_id: null,
          claimed_at: null,
          claimed_by: null,
          claim_token: null,
          dead_lettered_at: null,
          error_message: null,
        });

        batchRecipientEmails.push({ email: customer.email, customerId: customer.id });
      }

      if (batchMessageUpserts.length === 0) continue;

      // Persist email_messages in smaller DB chunks to avoid statement timeouts when payload HTML is large.
      // Use ignoreDuplicates to avoid expensive UPDATE paths; we'll fetch IDs afterwards.
      let dbChunkSize = 200;
      for (let offset = 0; offset < batchMessageUpserts.length; ) {
        const chunk = batchMessageUpserts.slice(offset, offset + dbChunkSize);
        try {
          const resp = await supabase
            .from('email_messages')
            .upsert(chunk, { onConflict: 'campaign_id,customer_id', ignoreDuplicates: true });

          if (resp.error) {
            // If we hit statement timeout, retry with a smaller chunk.
            const code = (resp.error as any)?.code;
            const msg = (resp.error as any)?.message;
            if ((code === '57014' || String(msg || '').includes('statement timeout')) && dbChunkSize > 25) {
              dbChunkSize = Math.max(25, Math.floor(dbChunkSize / 2));
              console.warn(`⚠️ email_messages write timed out; reducing chunk size to ${dbChunkSize} and retrying (batch ${batchIndex})`);
              continue;
            }

            console.error('❌ Failed to persist email_messages batch chunk:', {
              status: resp.status,
              statusText: resp.statusText,
              err: serializeSupabaseError(resp.error),
              batchIndex,
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

          offset += chunk.length;
        } catch (e: any) {
          const msg = String(e?.message || e);
          if ((msg.includes('statement timeout') || msg.includes('57014')) && dbChunkSize > 25) {
            dbChunkSize = Math.max(25, Math.floor(dbChunkSize / 2));
            console.warn(`⚠️ email_messages write exception timed out; reducing chunk size to ${dbChunkSize} and retrying (batch ${batchIndex})`);
            continue;
          }
          console.error('❌ Exception while persisting email_messages chunk:', {
            err: serializeSupabaseError(e),
            batchIndex,
            chunkSize: chunk.length,
          });
          return new Response(
            JSON.stringify({ error: 'Failed to persist recipients (exception)', details: serializeSupabaseError(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (batchRecipientEmails.length > 0) {
        const { error: jobErr } = await supabase
          .from('email_send_jobs')
          .upsert(
            {
              campaign_id: campaignId,
              tenant_id: campaign.tenant_id,
              domain_id: activeDomainId,
              status: 'pending',
              // recipient_message_ids intentionally left empty; worker will resolve IDs from recipient_emails.
              recipient_message_ids: [],
              recipient_emails: batchRecipientEmails,
              batch_index: batchIndex,
            },
            { onConflict: 'campaign_id,batch_index', ignoreDuplicates: true }
          );

        if (jobErr) {
          console.error('❌ Failed to create batch job:', { batchIndex, err: serializeSupabaseError(jobErr) });
          return new Response(
            JSON.stringify({ error: 'Failed to queue campaign' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      queuedRecipientCount += batchRecipientEmails.length;
      if ((batchIndex + 1) % 10 === 0 || batchIndex + 1 === totalBatches) {
        console.log(`📧 Queued batch ${batchIndex + 1}/${totalBatches} (queued so far: ${queuedRecipientCount})`);
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

    if (!campaign?.tenant_id) {
      console.error('❌ Campaign tenant_id missing, cannot queue recipients', { campaignId });
      return new Response(
        JSON.stringify({ error: 'Campaign missing tenant_id' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          queued: queuedRecipientCount,
          skipped_suppressed: suppressedCount + suppressedByListCount,
          links_tracked: urlsToTrack.length,
          pii_warnings: piiWarningSet.size,
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
        total_recipients: queuedRecipientCount,
        original_recipients: isPartialSend ? originalRecipientCount : undefined,
        truncated_count: isPartialSend ? originalRecipientCount - recipientCount : undefined,
        total_batches: totalBatches,
        warmup_info: isPartialSend ? {
          daily_limit: quotaCheck.limits?.daily_limit,
          daily_used: quotaCheck.limits?.daily_used,
          warmup_stage: quotaCheck.domain?.warmup_stage
        } : undefined,
        message: isPartialSend
          ? `Campaign queued for ${queuedRecipientCount} of ${originalRecipientCount} recipients (limited by warmup)`
          : `Campaign queued for sending to ${queuedRecipientCount} recipients`
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
