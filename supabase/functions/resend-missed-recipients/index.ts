import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.1.0";
import {
  renderMergeTags,
  convertLegacyTags,
  createMergeTagDataFromCustomer,
  type MergeTagData,
} from "../_shared/mergeTagEngine.ts";
import {
  generateServerFooterHtml,
  type CompanyProfileData,
} from "../_shared/emailFooter.ts";
import { rewriteLinksSync } from "../_shared/linkRewriter.ts";
import { canSendEmailBatch, logSkippedSends } from "../_shared/canSendEmail.ts";
import { getEmailGovernanceRuntimeConfig } from "../_shared/emailGovernanceConfig.ts";
import { systemPauseEmailCampaignSending } from "../_shared/systemPauseCampaign.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BATCH_SIZE_PER_JOB = 50;

type CampaignReputationPolicy = {
  score: number;
  tier: "normal" | "throttled" | "restricted" | "critical";
  action: "allow" | "throttle" | "restrict" | "pause";
  recipient_cap: number | null;
  job_batch_size: number | null;
  send_pacing_multiplier: number | null;
};

type TenantSuppressionBypassState = {
  suppression_bypass_active: boolean;
};

type CampaignInterventionState = {
  admin_paused: boolean;
  force_stopped: boolean;
  autopause_override_enabled: boolean;
  autopause_override_precedence: "final_override" | "automation_allowed";
  autopause_override_final: boolean;
};

async function getTenantSuppressionBypassState(
  supabase: any,
  tenantId: string,
): Promise<TenantSuppressionBypassState> {
  const { data, error } = await supabase.rpc(
    "get_tenant_suppression_bypass_state",
    {
      p_tenant_id: tenantId,
    },
  );

  if (error) {
    console.warn(
      "[resend-missed-recipients] Failed to fetch suppression bypass state:",
      error.message,
    );
    return { suppression_bypass_active: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { suppression_bypass_active: Boolean(row?.suppression_bypass_active) };
}

async function getCampaignReputationPolicy(
  supabase: any,
  campaignId: string,
): Promise<CampaignReputationPolicy> {
  const { data, error } = await supabase.rpc("get_campaign_reputation_policy", {
    p_campaign_id: campaignId,
  });

  if (error) {
    console.warn(
      "⚠️ Failed to fetch campaign reputation policy, defaulting to normal:",
      error.message,
    );
    return {
      score: 100,
      tier: "normal",
      action: "allow",
      recipient_cap: null,
      job_batch_size: DEFAULT_BATCH_SIZE_PER_JOB,
      send_pacing_multiplier: 1,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const rawRecipientCap = Number(row?.recipient_cap);
  const normalizedRecipientCap =
    Number.isFinite(rawRecipientCap) && rawRecipientCap > 0
      ? rawRecipientCap
      : null;
  return {
    score: Number(row?.score ?? 100),
    tier: (row?.tier || "normal") as CampaignReputationPolicy["tier"],
    action: (row?.action || "allow") as CampaignReputationPolicy["action"],
    recipient_cap: normalizedRecipientCap,
    job_batch_size: Number.isFinite(Number(row?.job_batch_size))
      ? Number(row.job_batch_size)
      : DEFAULT_BATCH_SIZE_PER_JOB,
    send_pacing_multiplier: Number.isFinite(Number(row?.send_pacing_multiplier))
      ? Number(row.send_pacing_multiplier)
      : 1,
  };
}

async function getCampaignInterventionState(
  supabase: any,
  campaignId: string,
): Promise<CampaignInterventionState> {
  const { data, error } = await supabase.rpc(
    "get_campaign_intervention_state",
    {
      p_campaign_id: campaignId,
    },
  );

  if (error) {
    console.warn(
      "⚠️ Failed to fetch campaign intervention state, defaulting to no override:",
      error.message,
    );
    return {
      admin_paused: false,
      force_stopped: false,
      autopause_override_enabled: false,
      autopause_override_precedence: "automation_allowed",
      autopause_override_final: false,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const precedence =
    String(
      row?.autopause_override_precedence || "automation_allowed",
    ).toLowerCase() === "final_override"
      ? "final_override"
      : "automation_allowed";

  return {
    admin_paused: Boolean(row?.admin_paused),
    force_stopped: Boolean(row?.force_stopped),
    autopause_override_enabled: Boolean(row?.autopause_override_enabled),
    autopause_override_precedence: precedence,
    autopause_override_final: Boolean(row?.autopause_override_final),
  };
}

function randomIntInclusive(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Strip existing footer from HTML content
 */
function stripExistingFooter(html: string): string {
  let strippedHtml = html;
  const footerWrapperPattern =
    /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi;
  strippedHtml = strippedHtml.replace(footerWrapperPattern, "");
  const unsubscribeFooterPattern =
    /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  strippedHtml = strippedHtml.replace(unsubscribeFooterPattern, "");
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
  replyToEmail?: string,
): any {
  const companyName = companyProfile?.company_name || "Your Garden Center";

  const unsubscribeToken = btoa(`${customer.email}:${campaign.tenant_id}`);
  const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${campaign.tenant_id}&token=${unsubscribeToken}`;
  const preferencesLink = unsubscribeLink.replace(
    "handle-unsubscribe",
    "manage-preferences",
  );

  const customerFooter = sharedFooterTemplate
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeLink)
    .replace(/\{\{PREFERENCES_URL\}\}/g, preferencesLink);

  const mergeTagData: MergeTagData = createMergeTagDataFromCustomer(customer, {
    company_name: companyName,
    address: companyProfile?.location_info,
    website_url: companyProfile?.custom_sender_email?.split("@")[1],
  });

  mergeTagData.system = {
    unsubscribe_url: unsubscribeLink,
    preferences_url: preferencesLink,
    current_year: new Date().getFullYear().toString(),
    current_date: new Date().toLocaleDateString(),
  };

  let emailContent = convertLegacyTags(campaign.content || "");
  let emailSubject = convertLegacyTags(campaign.subject_line || "Newsletter");

  emailContent = renderMergeTags(emailContent, mergeTagData);
  emailSubject = renderMergeTags(emailSubject, mergeTagData);

  emailContent = stripExistingFooter(emailContent);

  if (emailContent.includes("</body>")) {
    emailContent = emailContent.replace("</body>", `${customerFooter}</body>`);
  } else if (emailContent.includes("</html>")) {
    emailContent = emailContent.replace("</html>", `${customerFooter}</html>`);
  } else {
    emailContent += customerFooter;
  }

  const emailPayload: any = {
    from: fromAddress,
    to: [customer.email],
    subject: emailSubject,
    html: emailContent,
    headers: {
      "X-Campaign-ID": campaign.id,
      "X-Campaign-Type": "resend",
      "X-Tenant-ID": campaign.tenant_id,
      "X-Domain-ID": activeDomainId || "none",
    },
    tags: [
      { name: "campaign_id", value: campaign.id },
      { name: "type", value: "resend" },
      { name: "tenant_id", value: campaign.tenant_id },
    ],
  };

  // Reply-to: prefer explicit replyToEmail, fallback to senderEmail for verified domains
  if (replyToEmail) {
    emailPayload.reply_to = replyToEmail;
  } else if (usesVerifiedDomain && senderEmail) {
    emailPayload.reply_to = senderEmail;
  }

  return emailPayload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      campaignId,
      dryRun = true,
      maxRecipients,
      bypassWarmup = false,
    } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `📧 Resend missed recipients: campaignId=${campaignId}, dryRun=${dryRun}`,
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("crm_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const governanceConfig = await getEmailGovernanceRuntimeConfig(
      supabase,
      campaign.tenant_id,
    );
    const campaignIntervention = await getCampaignInterventionState(
      supabase,
      campaignId,
    );

    if (
      campaignIntervention.force_stopped ||
      campaignIntervention.admin_paused
    ) {
      return new Response(JSON.stringify({ error: "Campaign is paused." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reputationPolicy = await getCampaignReputationPolicy(
      supabase,
      campaignId,
    );
    if (
      reputationPolicy.action === "pause" &&
      !campaignIntervention.autopause_override_final
    ) {
      const pauseMessage = `Campaign auto-paused: tenant reputation score ${reputationPolicy.score} is below 60.`;
      await systemPauseEmailCampaignSending(supabase, {
        campaignId,
        blockReason: "reputation_critical_autopause",
        errorMessage: pauseMessage,
      });

      return new Response(
        JSON.stringify({ error: pauseMessage, reputation: reputationPolicy }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (reputationPolicy.action === "restrict") {
      const blockMessage = `Campaign blocked: tenant reputation score ${reputationPolicy.score} is in restricted tier (60-74).`;
      await supabase
        .from("crm_campaigns")
        .update({
          send_blocked_reason: "reputation_restricted",
          send_error: blockMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ error: blockMessage, reputation: reputationPolicy }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get all customers already materialized for this campaign (source-of-truth)
    const { data: existingMessages } = await supabase
      .from("email_messages")
      .select("customer_id")
      .eq("campaign_id", campaignId);

    const alreadySentCustomerIds = new Set<string>(
      (existingMessages || []).map((m: any) => m.customer_id),
    );
    console.log(
      `📧 Found ${alreadySentCustomerIds.size} customers already queued/sent in email_messages`,
    );

    // Also check email_tracking_events for recipients who received the email (fallback for older campaigns)
    const { data: trackingEvents } = await supabase
      .from("email_tracking_events")
      .select("customer_email")
      .eq("campaign_id", campaignId);

    const alreadySentEmails = new Set<string>(
      (trackingEvents || [])
        .map((e: any) => e.customer_email?.toLowerCase())
        .filter(Boolean),
    );
    console.log(
      `📧 Found ${alreadySentEmails.size} unique emails in tracking events`,
    );

    // Get candidate customers - suppression filtering is handled via suppression_list
    let allCustomers: any[] = [];
    let customersError: any = null;

    if (campaign.segment_id) {
      // Get customers from the segment
      console.log(`📧 Fetching customers from segment: ${campaign.segment_id}`);
      const { data, error } = await supabase
        .from("crm_customers")
        .select(
          "id, first_name, last_name, email, suppressed, customer_segments!inner(segment_id)",
        )
        .eq("tenant_id", campaign.tenant_id)
        .eq("customer_segments.segment_id", campaign.segment_id)
        .not("email", "is", null);
      allCustomers = data || [];
      customersError = error;
    } else {
      // Get ALL eligible customers for this tenant (no segment filter)
      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, first_name, last_name, email, suppressed")
        .eq("tenant_id", campaign.tenant_id)
        .not("email", "is", null);
      allCustomers = data || [];
      customersError = error;
    }

    console.log(`📧 Found ${allCustomers.length} eligible customers`);

    if (customersError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch customers" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Filter to only missed customers (not in email_messages AND not in tracking events)
    let missedCustomers = (allCustomers || []).filter(
      (c) =>
        c.email?.trim() &&
        !alreadySentCustomerIds.has(c.id) &&
        !alreadySentEmails.has(c.email?.toLowerCase()),
    );

    console.log(`📧 Found ${missedCustomers.length} missed recipients`);

    // Apply canonical suppression_list filtering
    if (missedCustomers.length > 0) {
      const bypassState = await getTenantSuppressionBypassState(
        supabase,
        campaign.tenant_id,
      );
      const bypassSuppressionTypes = bypassState.suppression_bypass_active
        ? ["bounced", "hard_bounce", "complaint", "complained"]
        : [];

      const eligibility = await canSendEmailBatch(
        supabase,
        {
          tenantId: campaign.tenant_id,
          recipients: missedCustomers
            .filter((c: any) => typeof c?.email === "string" && c.email.trim())
            .map((c: any) => ({ customerId: c.id, email: c.email })),
        },
        {
          bypassSuppressionTypes,
        },
      );

      const skips: any[] = [];
      missedCustomers = missedCustomers.filter((c: any) => {
        const email = String(c?.email || "")
          .toLowerCase()
          .trim();
        const result = eligibility.get(email);
        if (!result || result.allowed) return true;
        skips.push({
          tenantId: campaign.tenant_id,
          campaignId,
          customerId: c?.id,
          email: String(c.email),
          reason: result.reason || "unsubscribed",
        });
        return false;
      });

      if (skips.length > 0) {
        await logSkippedSends(supabase, skips);
        console.log(
          `📧 Excluded ${skips.length} recipients due to suppression_list`,
        );
      }
    }

    if (missedCustomers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No missed recipients found",
          alreadySent: alreadySentCustomerIds.size,
          missed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Limit if specified
    if (
      maxRecipients &&
      maxRecipients > 0 &&
      missedCustomers.length > maxRecipients
    ) {
      missedCustomers = missedCustomers.slice(0, maxRecipients);
      console.log(`📧 Limited to ${maxRecipients} recipients`);
    }

    const reputationCap = reputationPolicy.recipient_cap ?? null;
    if (
      reputationCap !== null &&
      reputationCap >= 0 &&
      missedCustomers.length > reputationCap
    ) {
      missedCustomers = missedCustomers.slice(0, reputationCap);
      console.log(
        `📧 Reputation tier cap applied (${reputationPolicy.tier}): limited resend audience to ${reputationCap}`,
      );
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
          missedEmails: missedCustomers.slice(0, 20).map((c) => c.email), // Sample of emails
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ========== ACTUAL SEND ==========
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get company profile
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select(
        `
        email_auth_status, custom_sender_email, company_name, location_info,
        street_address, city, state_province, postal_code, country,
        website_url, company_email, company_phone,
        facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
        footer_legal_text, brand_primary_color, brand_text_color
      `,
      )
      .eq("user_id", campaign.user_id)
      .single();

    // Milestone 7: campaign resend must use explicit campaign domain.
    const activeDomainId = campaign.from_email_domain_id;
    if (!activeDomainId) {
      const pauseMessage =
        "Campaign sending requires a configured custom domain sender.";
      await systemPauseEmailCampaignSending(supabase, {
        campaignId,
        blockReason: "sender_domain_required",
        errorMessage: pauseMessage,
      });

      return new Response(JSON.stringify({ error: pauseMessage }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activeDomain } = await supabase
      .from("email_domains")
      .select("id, domain, status, default_reply_to, default_from_email")
      .eq("id", activeDomainId)
      .eq("tenant_id", campaign.tenant_id)
      .in("status", ["active", "warming_up"])
      .maybeSingle();

    if (!activeDomain) {
      const pauseMessage =
        "Campaign domain is not operational. Please verify your selected sending domain.";
      await systemPauseEmailCampaignSending(supabase, {
        campaignId,
        blockReason: "domain_not_operational",
        errorMessage: pauseMessage,
      });

      return new Response(JSON.stringify({ error: pauseMessage }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (activeDomain) {
      console.log(
        `📧 Using domain (informational only): status=${activeDomain.status}`,
      );
    }
    if (bypassWarmup) {
      console.log(`ℹ️ bypassWarmup=true (no domain-level warmup is enforced)`);
    }

    // Build sender info
    const companyName = companyProfile?.company_name || "Your Garden Center";
    const senderEmail =
      activeDomain.default_from_email || `mail@${activeDomain.domain}`;
    const fromAddress = `${companyName} <${senderEmail}>`;
    const usesVerifiedDomain = true;

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
      "{{UNSUBSCRIBE_URL}}",
      "{{PREFERENCES_URL}}",
    );

    // Get tracked links for this campaign
    const { data: trackedLinks } = await supabase
      .from("tracked_links")
      .select("id, url")
      .eq("campaign_id", campaignId);

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
          customer,
          campaign,
          companyProfile,
          profileData,
          fromAddress,
          senderEmail,
          usesVerifiedDomain,
          activeDomainId,
          sharedFooterTemplate,
          replyToEmail,
        );

        // Rewrite links for tracking
        if (urlToLinkIdMap.size > 0 && payload.html) {
          const rewriteResult = rewriteLinksSync(
            payload.html,
            urlToLinkIdMap,
            campaignId,
            customer.id,
            campaign.tenant_id,
            customer.email,
          );
          payload.html = rewriteResult.html;
        }

        emailPayloads.push({
          email: customer.email,
          customerId: customer.id,
          payload,
        });
      } catch (error: any) {
        console.error(
          `Error building payload for ${customer.id}:`,
          error.message,
        );
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
      status: "queued",
    }));

    const UPSERT_CHUNK = 500;
    for (let i = 0; i < messageRows.length; i += UPSERT_CHUNK) {
      const chunk = messageRows.slice(i, i + UPSERT_CHUNK);
      const { error: upsertErr } = await supabase
        .from("email_messages")
        .upsert(chunk, {
          onConflict: "campaign_id,customer_id,retry_sequence",
          ignoreDuplicates: true,
        });
      if (upsertErr) {
        console.error("❌ Failed to persist email_messages:", upsertErr);
        return new Response(
          JSON.stringify({ error: "Failed to persist recipients" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
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
        .from("email_messages")
        .select("id, customer_id")
        .eq("campaign_id", campaignId)
        .in("customer_id", idsChunk);
      if (fetchErr) {
        console.error("❌ Failed to fetch email_message IDs:", fetchErr);
        return new Response(
          JSON.stringify({ error: "Failed to queue emails" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      (rows || []).forEach((r: any) => idMap.set(r.customer_id, r.id));
    }

    // Create batch jobs referencing message IDs
    const policyBatchSize = Math.max(
      1,
      Number(reputationPolicy.job_batch_size || DEFAULT_BATCH_SIZE_PER_JOB),
    );
    const batchSizePerJob = Math.min(
      policyBatchSize,
      governanceConfig.batch.max_batch_size,
    );
    const jobInserts: any[] = [];
    let nextBatchAvailableAtMs = Date.now();
    for (let i = 0; i < emailPayloads.length; i += batchSizePerJob) {
      const batch = emailPayloads.slice(i, i + batchSizePerJob);
      const batchMessageIds = batch
        .map((r) => idMap.get(r.customerId))
        .filter(Boolean);
      const batchAvailableAtIso = new Date(
        nextBatchAvailableAtMs,
      ).toISOString();
      nextBatchAvailableAtMs +=
        randomIntInclusive(
          governanceConfig.batch.delay_min_seconds,
          governanceConfig.batch.delay_max_seconds,
        ) * 1000;
      jobInserts.push({
        campaign_id: campaignId,
        tenant_id: campaign.tenant_id,
        domain_id: activeDomainId,
        status: "pending",
        available_at: batchAvailableAtIso,
        recipient_message_ids: batchMessageIds,
        recipient_emails: batch.map((r) => ({
          email: r.email,
          customerId: r.customerId,
        })),
        batch_index: 1000 + Math.floor(i / batchSizePerJob), // High batch index to indicate resend
      });
    }

    let { error: insertError } = await supabase
      .from("email_send_jobs")
      .upsert(jobInserts, {
        onConflict: "campaign_id,batch_index",
        ignoreDuplicates: true,
      });

    // If PostgREST schema cache is stale (or remote schema is behind), retry without `available_at`.
    if (
      insertError &&
      String((insertError as any)?.code || "") === "PGRST204" &&
      String((insertError as any)?.message || "").includes("'available_at'")
    ) {
      console.warn(
        "⚠️ email_send_jobs.available_at not in schema cache; retrying job upsert without available_at",
      );
      const jobInsertsWithoutAvailableAt = jobInserts.map(
        ({ available_at: _omit, ...rest }) => rest,
      );
      ({ error: insertError } = await supabase
        .from("email_send_jobs")
        .upsert(jobInsertsWithoutAvailableAt, {
          onConflict: "campaign_id,batch_index",
          ignoreDuplicates: true,
        }));
    }

    if (insertError) {
      console.error("❌ Failed to create batch jobs:", insertError);
      return new Response(JSON.stringify({ error: "Failed to queue emails" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `✅ Ensured ${jobInserts.length} batch jobs for ${emailPayloads.length} recipients`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Queued ${emailPayloads.length} missed recipients for sending`,
        queued: emailPayloads.length,
        batchJobs: jobInserts.length,
        previouslySent: alreadySentCustomerIds.size,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in resend-missed-recipients:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
