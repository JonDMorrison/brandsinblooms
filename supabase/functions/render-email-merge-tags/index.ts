/**
 * Edge Function: render-email-merge-tags
 *
 * Renders merge tags in email HTML using the shared merge tag engine.
 * Used by both preview and sending pipelines for consistent rendering.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  convertLegacyTags,
  createMergeTagDataFromCustomer,
  renderMergeTags,
} from "../_shared/mergeTagEngine.ts";
import {
  callerHasTenantPermission,
  callerTenantId,
} from "../_shared/callerTenantPermission.ts";
import { requireInternalApiKey } from "../_shared/requireInternalApiKey.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function renderEmailHtmlWithMergeTags(params: {
  tenantId: string;
  html: string;
  mode: "preview" | "send";
  customer?: Record<string, unknown>;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    custom?: Record<string, unknown>;
  };
  companyInfo?: Record<string, unknown>;
}) {
  const normalizedHtml = convertLegacyTags(params.html || "");

  const mergeData = params.customer
    ? createMergeTagDataFromCustomer(params.customer, {
        company_name:
          typeof params.companyInfo?.company_name === "string"
            ? params.companyInfo.company_name
            : undefined,
        address:
          typeof params.companyInfo?.street_address === "string"
            ? params.companyInfo.street_address
            : undefined,
        phone:
          typeof params.companyInfo?.company_phone === "string"
            ? params.companyInfo.company_phone
            : undefined,
        email:
          typeof params.companyInfo?.company_email === "string"
            ? params.companyInfo.company_email
            : undefined,
        website_url:
          typeof params.companyInfo?.website_url === "string"
            ? params.companyInfo.website_url
            : undefined,
      })
    : {
        first_name: params.sampleCustomer?.first_name || "Friend",
        last_name: params.sampleCustomer?.last_name || "Customer",
        email: params.sampleCustomer?.email || "customer@example.com",
        phone: params.sampleCustomer?.phone || "",
        company: {
          name:
            typeof params.companyInfo?.company_name === "string"
              ? params.companyInfo.company_name
              : "Your Company",
          address:
            typeof params.companyInfo?.street_address === "string"
              ? params.companyInfo.street_address
              : "",
          phone:
            typeof params.companyInfo?.company_phone === "string"
              ? params.companyInfo.company_phone
              : "",
          email:
            typeof params.companyInfo?.company_email === "string"
              ? params.companyInfo.company_email
              : "",
          website:
            typeof params.companyInfo?.website_url === "string"
              ? params.companyInfo.website_url
              : "",
        },
        system: {
          unsubscribe_url: "#",
          preferences_url: "#",
          current_year: new Date().getFullYear().toString(),
          current_date: new Date().toLocaleDateString(),
        },
      };

  return {
    renderedHtml: renderMergeTags(normalizedHtml, mergeData as any),
    diagnostics: {
      usedTags: [],
      missingTags: [],
      emptyResolvedTags: [],
      legacyTagsConverted: 0,
    },
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RenderRequest {
  tenantId?: string;
  customerId?: string;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    custom?: Record<string, unknown>;
  };
  html: string;
  mode: "preview" | "send";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // central-login 59 (crm-r2-F85): a signed-in user or an internal caller presenting a configured server key.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const trustedService = requireInternalApiKey(req) === null;

    const body: RenderRequest = await req.json();
    const {
      tenantId,
      customerId,
      sampleCustomer,
      html,
      mode = "preview",
    } = body;

    console.log(
      `[render-email-merge-tags] Request: mode=${mode}, hasCustomerId=${!!customerId}, hasSampleCustomer=${!!sampleCustomer}`,
    );

    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: "HTML content is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // A user's reads go through their own token (RLS), never the service role.
    const accessClient = trustedService
      ? supabase
      : createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

    let accessTenantId = tenantId;
    if (!trustedService) {
      const {
        data: { user },
        error: userError,
      } = await accessClient.auth.getUser();
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      // The account whose data is rendered: the requested one, else the caller's own. The caller needs newsletter
      // preview access to it (campaign.read, the rule of newsletterPreviewAccess.ts) before any customer or company
      // read; the customer itself is then read through the caller's token.
      if (customerId || tenantId) {
        accessTenantId = tenantId || (await callerTenantId(authHeader)) || undefined;
        if (
          (accessTenantId && !UUID.test(accessTenantId)) ||
          (customerId && !UUID.test(customerId))
        ) {
          return new Response(
            JSON.stringify({ success: false, error: "Select a valid account and preview contact." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (
          !accessTenantId ||
          !(await callerHasTenantPermission(authHeader, accessTenantId, "campaign.read"))
        ) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "You do not have access to preview newsletters for this account.",
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    let customer: Record<string, unknown> | undefined;
    let companyInfo: Record<string, unknown> = {};

    // Load customer if customerId provided
    if (customerId) {
      console.log(`[render-email-merge-tags] Loading customer: ${customerId}`);

      let customerQuery = accessClient
        .from("crm_customers")
        .select("*")
        .eq("id", customerId);
      if (accessTenantId) customerQuery = customerQuery.eq("tenant_id", accessTenantId);
      const { data: customerData, error: customerError } = await customerQuery.maybeSingle();

      if (customerError || !customerData) {
        console.error(
          `[render-email-merge-tags] Customer load error:`,
          customerError,
        );
        return new Response(
          JSON.stringify({ success: false, error: "Customer not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      customer = customerData;

      // Load company info for this tenant
      if (customerData?.tenant_id) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("owner_id")
          .eq("id", customerData.tenant_id)
          .single();

        if (tenantData?.owner_id) {
          const { data: companyData } = await supabase
            .from("company_profiles")
            .select(
              "company_name, company_email, company_phone, website_url, street_address, city, state_province, postal_code, country",
            )
            .eq("user_id", tenantData.owner_id)
            .single();

          if (companyData) {
            companyInfo = companyData;
          }
        }
      }
    } else if (accessTenantId) {
      // Load company info from tenant
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("owner_id")
        .eq("id", accessTenantId)
        .single();

      if (tenantData?.owner_id) {
        const { data: companyData } = await supabase
          .from("company_profiles")
          .select(
            "company_name, company_email, company_phone, website_url, street_address, city, state_province, postal_code, country",
          )
          .eq("user_id", tenantData.owner_id)
          .single();

        if (companyData) {
          companyInfo = companyData;
        }
      }
    }

    // Render the HTML with merge tags
    const result = renderEmailHtmlWithMergeTags({
      tenantId: tenantId || "",
      html,
      mode,
      customer,
      sampleCustomer,
      companyInfo,
    });

    console.log(
      `[render-email-merge-tags] Rendered: usedTags=${result.diagnostics.usedTags.length}, missing=${result.diagnostics.missingTags.length}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        renderedHtml: result.renderedHtml,
        diagnostics: result.diagnostics,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[render-email-merge-tags] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
