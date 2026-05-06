import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.1.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  renderEmailForRecipient,
  type CustomerShape,
  type CompanyProfileShape,
} from "../_shared/emailRenderer.ts";
import {
  resolveCampaignEmailSource,
  type RenderableContentBlock,
} from "../_shared/campaignEmailContent.ts";
import { resolveSender, buildFromAddress } from "../_shared/senderResolver.ts";
import { COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT } from "../_shared/resolveDesignSystem.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestSendPayload {
  toEmail: string;
  subject?: string;
  previewText?: string;
  html?: string;
  contentBlocks?: RenderableContentBlock[] | null;
  customerId?: string;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  campaignId?: string;
  automationId?: string;
  automationNodeId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 send-test-email-v2 invoked");

    const payload: TestSendPayload = await req.json();
    const {
      toEmail,
      subject,
      previewText,
      html,
      contentBlocks,
      customerId,
      sampleCustomer,
      campaignId,
      automationId,
      automationNodeId,
    } = payload;

    // Return 200 for all application errors so supabase.functions.invoke()
    // passes the error message through in data instead of wrapping it in a
    // generic "non-2xx status code" FunctionsHttpError.
    const ok = (body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    if (!toEmail) {
      return ok({ success: false, error: "Missing required field: toEmail" });
    }

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return ok({
        success: false,
        error: "Missing authorization — please sign in and try again",
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return ok({
        success: false,
        error: "Session expired — please sign in again",
      });
    }

    // Get tenant
    const { data: userRecord } = await supabaseClient
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userRecord?.tenant_id;
    if (!tenantId) {
      return ok({
        success: false,
        error: "Account setup incomplete — please complete onboarding first",
      });
    }

    const typedSupabaseClient = supabaseClient as any;
    const campaignSourceClient: any = {
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => ({
            order: async (
              orderColumn: string,
              options?: { ascending?: boolean },
            ) => {
              const result = await typedSupabaseClient
                .from(table)
                .select(columns)
                .eq(column, value)
                .order(orderColumn, options);

              return {
                data: (result.data as unknown[]) ?? null,
                error: result.error,
              };
            },
          }),
        }),
      }),
    };

    let resolvedContentBlocks: RenderableContentBlock[] | null = null;
    const providedHtml = typeof html === "string" ? html.trim() : "";
    let resolvedHtml = providedHtml;
    let resolvedSubject =
      typeof subject === "string" && subject.trim().length > 0
        ? subject.trim()
        : "Test Email";
    let resolvedPreviewText =
      typeof previewText === "string" ? previewText.trim() : "";

    if (Array.isArray(contentBlocks) && contentBlocks.length > 0) {
      resolvedContentBlocks = contentBlocks;
      resolvedHtml = "";
    }

    if (campaignId) {
      const { data: campaignRecord, error: campaignError } =
        await supabaseClient
          .from("crm_campaigns")
          .select("id, metadata, content, subject_line, preheader_text")
          .eq("id", campaignId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

      if (campaignError) {
        return ok({
          success: false,
          error: "Failed to load campaign content for test send",
        });
      }

      if (campaignRecord) {
        if (!subject?.trim() && campaignRecord.subject_line?.trim()) {
          resolvedSubject = campaignRecord.subject_line.trim();
        }

        if (!resolvedPreviewText && campaignRecord.preheader_text?.trim()) {
          resolvedPreviewText = campaignRecord.preheader_text.trim();
        }

        if (!resolvedContentBlocks) {
          const source = await resolveCampaignEmailSource(
            campaignSourceClient,
            {
              id: campaignRecord.id,
              metadata: campaignRecord.metadata,
              content: campaignRecord.content,
              subject_line: campaignRecord.subject_line,
              preheader_text: campaignRecord.preheader_text,
            },
          );
          if (source.contentBlocks.length > 0) {
            resolvedContentBlocks = source.contentBlocks;
            resolvedHtml = "";
          } else if (!providedHtml && source.html.trim().length > 0) {
            resolvedHtml = source.html.trim();
          }

          if (source.warning) {
            console.warn(`[send-test-email-v2] ${source.warning}`);
          }
        }
      }
    }

    if (
      !resolvedHtml &&
      !(resolvedContentBlocks && resolvedContentBlocks.length > 0)
    ) {
      return ok({
        success: false,
        error:
          "Missing renderable campaign content. Provide html or save campaign blocks before sending a test.",
      });
    }

    // Fetch company profile
    const { data: companyProfile } = await supabaseClient
      .from("company_profiles")
      .select(COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT)
      .eq("user_id", user.id)
      .single();

    // Resolve customer data
    let customer: CustomerShape | null = null;

    if (customerId) {
      const { data: customerData } = await supabaseClient
        .from("crm_customers")
        .select(
          "id, email, first_name, last_name, phone, lifetime_value, custom_fields",
        )
        .eq("id", customerId)
        .single();

      if (customerData) {
        customer = {
          id: customerData.id,
          email: customerData.email,
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          phone: customerData.phone,
          lifetime_value: customerData.lifetime_value,
          custom_fields:
            (customerData.custom_fields as Record<string, unknown>) || {},
        };
      }
    } else if (sampleCustomer) {
      customer = {
        email: sampleCustomer.email || "sample@demo-gardens.test",
        first_name: sampleCustomer.first_name || "Jane",
        last_name: sampleCustomer.last_name || "Gardener",
        phone: sampleCustomer.phone || "(555) 123-4567",
      };
    }

    // Render using unified renderer
    const renderResult = renderEmailForRecipient({
      tenantId,
      campaignId,
      subject: resolvedSubject,
      previewText: resolvedPreviewText,
      html: resolvedHtml,
      contentBlocks: resolvedContentBlocks,
      customer,
      companyProfile: companyProfile as CompanyProfileShape,
      mode: "send",
      includeFooter: true,
    });

    console.log(
      `📧 Rendered: usedTags=${renderResult.diagnostics.usedTags.length}, missing=${renderResult.diagnostics.missingTags.length}`,
    );

    // Verify Resend API key is configured
    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error("❌ RESEND_API_KEY not configured");
      return ok({
        success: false,
        error: "Email service not configured — contact support",
      });
    }

    // Resolve sender
    const senderConfig = await resolveSender(supabaseClient, tenantId, {
      userId: user.id,
    });
    const fromAddress = senderConfig
      ? buildFromAddress(senderConfig)
      : `${companyProfile?.company_name || "BloomSuite"} <hello@notify.bloomsuite.app>`;
    // Prioritize domain reply_to, fallback to company sender or user email
    const replyTo =
      senderConfig?.replyTo ||
      companyProfile?.custom_sender_email ||
      user.email;

    // Send via Resend
    const emailResponse = await resend.emails.send({
      from: fromAddress,
      reply_to: replyTo,
      to: [toEmail],
      subject: `[TEST] ${renderResult.renderedSubject}`,
      html: renderResult.renderedHtml,
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message || "Resend error");
    }

    // Log test send
    await supabaseClient.from("email_test_sends").insert({
      tenant_id: tenantId,
      user_id: user.id,
      campaign_id: campaignId || null,
      automation_id: automationId || null,
      automation_node_id: automationNodeId || null,
      to_email: toEmail,
      subject: renderResult.renderedSubject,
      status: "sent",
      diagnostics: renderResult.diagnostics,
      customer_id: customerId || null,
    });

    console.log("✅ Test email sent:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResponse.data?.id,
        diagnostics: renderResult.diagnostics,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("❌ send-test-email-v2 error:", error);
    // Return 200 with error in body so frontend sees the actual message
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
