/**
 * Render Email Preview Edge Function
 *
 * Server-side email rendering for previews.
 * Uses the same renderer as campaign send and automation execution.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  renderEmailForRecipient,
  type CustomerShape,
  type CompanyProfileShape,
} from "../_shared/emailRenderer.ts";
import {
  extractLinks,
  getUniqueUrls,
  hasPII,
} from "../_shared/linkRewriter.ts";
import type { RenderableContentBlock } from "../_shared/campaignEmailSource.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PreviewRequest {
  tenantId?: string;
  html?: string;
  contentBlocks?: RenderableContentBlock[] | null;
  subject?: string;
  customerId?: string;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  includeFooter?: boolean;
  campaignId?: string;
  enableLinkTracking?: boolean;
  exactSendPreview?: boolean;
}

function toCustomerShape(customerData: Record<string, any>): CustomerShape {
  return {
    id: customerData.id,
    email: customerData.email,
    first_name: customerData.first_name,
    last_name: customerData.last_name,
    phone: customerData.phone,
    lifetime_value: customerData.lifetime_value,
    total_spent: customerData.total_spent,
    first_purchase_date: customerData.first_purchase_date,
    last_purchase_date: customerData.last_purchase_date,
    custom_fields:
      customerData.custom_fields &&
      typeof customerData.custom_fields === "object"
        ? customerData.custom_fields
        : {},
  };
}

async function buildTrackedLinkMap({
  supabase,
  tenantId,
  campaignId,
  subject,
  html,
  contentBlocks,
  customer,
  companyProfile,
}: {
  supabase: any;
  tenantId: string;
  campaignId: string;
  subject: string;
  html: string;
  contentBlocks: RenderableContentBlock[] | null;
  customer: CustomerShape | null;
  companyProfile: CompanyProfileShape | null;
}): Promise<Map<string, string> | null> {
  const map = new Map<string, string>();
  const { data: existingLinks, error: existingLinksError } = await supabase
    .from("tracked_links")
    .select("id, url")
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaignId);

  if (existingLinksError) {
    console.warn(
      "⚠️ Failed to load tracked_links:",
      existingLinksError.message,
    );
  }

  (existingLinks ?? []).forEach((link) => {
    const linkId = typeof link?.id === "string" ? link.id : null;
    const linkUrl = typeof link?.url === "string" ? link.url : null;
    if (linkId && linkUrl) {
      map.set(linkUrl, linkId);
    }
  });

  if (map.size > 0) {
    return map;
  }

  const preflightRender = renderEmailForRecipient({
    tenantId,
    campaignId,
    subject,
    html,
    contentBlocks,
    customer,
    companyProfile,
    mode: "send",
    includeFooter: true,
    enableLinkTracking: false,
  });

  const uniqueUrls = getUniqueUrls(extractLinks(preflightRender.renderedHtml));
  const urlsToTrack = uniqueUrls.filter((url) => !hasPII(url));
  if (urlsToTrack.length === 0) {
    return map;
  }

  const { data: insertedLinks, error: insertError } = await supabase
    .from("tracked_links")
    .upsert(
      urlsToTrack.map((url) => ({
        tenant_id: tenantId,
        campaign_id: campaignId,
        url,
      })),
      { onConflict: "tenant_id,campaign_id,url", ignoreDuplicates: false },
    )
    .select("id, url");

  if (insertError) {
    console.warn("⚠️ Failed to upsert tracked_links:", insertError.message);
    return map;
  }

  (insertedLinks ?? []).forEach((link) => {
    const linkId = typeof link?.id === "string" ? link.id : null;
    const linkUrl = typeof link?.url === "string" ? link.url : null;
    if (linkId && linkUrl) {
      map.set(linkUrl, linkId);
    }
  });

  return map;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: [E38] - Add service-role-or-JWT authentication
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      const token = authHeader.replace("Bearer ", "");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        serviceRoleKey ?? "",
      );
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }
    }

    const body: PreviewRequest = await req.json();
    const {
      html = "",
      contentBlocks = null,
      subject,
      customerId,
      sampleCustomer,
      includeFooter = false,
      campaignId,
      enableLinkTracking = false,
      exactSendPreview = false,
    } = body;

    if (
      !html &&
      (!Array.isArray(contentBlocks) || contentBlocks.length === 0)
    ) {
      return new Response(
        JSON.stringify({
          error: "HTML content or content blocks are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get tenant ID from auth or request
    let tenantId = body.tenantId;

    // Try to get from auth header
    if (authHeader && !tenantId) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabase.auth.getUser(token);

      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        tenantId = userData?.tenant_id;
      }
    }

    if (!tenantId) {
      // Fallback - use a placeholder for preview
      tenantId = "preview-tenant";
    }

    console.log(
      `📧 Render preview: tenantId=${tenantId}, customerId=${customerId || "sample"}, campaignId=${campaignId || "n/a"}`,
    );

    // Build customer data
    let customer: CustomerShape | null = null;
    let companyProfile: CompanyProfileShape | null = null;

    // Load real customer if ID provided
    if (customerId) {
      const { data: customerData } = await supabase
        .from("crm_customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerData) {
        customer = toCustomerShape(customerData as Record<string, any>);
      }
    } else if (sampleCustomer) {
      // Use sample customer data
      customer = {
        email: sampleCustomer.email || "customer@example.com",
        first_name: sampleCustomer.first_name || "Jane",
        last_name: sampleCustomer.last_name || "Doe",
        phone: sampleCustomer.phone || "",
      };
    }

    // Load company profile for tenant
    if (tenantId && tenantId !== "preview-tenant") {
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();

      if (userData) {
        const { data: profileData } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("user_id", userData.id)
          .single();

        if (profileData) {
          companyProfile = {
            company_name: profileData.company_name,
            location_info: profileData.location_info,
            company_email: profileData.company_email,
            company_phone: profileData.company_phone,
            website_url: profileData.website_url,
            street_address: profileData.street_address,
            city: profileData.city,
            state_province: profileData.state_province,
            postal_code: profileData.postal_code,
            facebook_url: profileData.facebook_url,
            instagram_url: profileData.instagram_url,
            tiktok_url: profileData.tiktok_url,
            pinterest_url: profileData.pinterest_url,
            youtube_url: profileData.youtube_url,
            linkedin_url: profileData.linkedin_url,
            brand_primary_color: profileData.brand_primary_color,
            brand_secondary_color: profileData.brand_secondary_color,
            feature_flags:
              profileData.feature_flags as CompanyProfileShape["feature_flags"],
          };
        }
      }
    }

    const renderMode = exactSendPreview ? "send" : "preview";
    const shouldTrackLinks =
      renderMode === "send" &&
      enableLinkTracking &&
      tenantId !== "preview-tenant" &&
      typeof campaignId === "string" &&
      campaignId.length > 0;

    const trackedLinkMap = shouldTrackLinks
      ? await buildTrackedLinkMap({
          supabase,
          tenantId,
          campaignId: campaignId!,
          subject: subject || "",
          html,
          contentBlocks,
          customer,
          companyProfile,
        })
      : null;

    // Render using the unified renderer
    const result = renderEmailForRecipient({
      tenantId,
      campaignId,
      html,
      contentBlocks,
      subject: subject || "",
      customer,
      companyProfile,
      mode: renderMode,
      includeFooter: renderMode === "send" ? true : includeFooter,
      enableLinkTracking: shouldTrackLinks,
      trackedLinkMap,
    });

    console.log(
      `✅ Preview rendered: usedTags=${result.diagnostics.usedTags.length}, missing=${result.diagnostics.missingTags.length}`,
    );

    return new Response(
      JSON.stringify({
        renderedHtml: result.renderedHtml,
        renderedSubject: result.renderedSubject,
        diagnostics: result.diagnostics,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Render preview error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
