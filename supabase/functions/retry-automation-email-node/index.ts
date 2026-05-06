/**
 * Retry Failed Automation Email Node
 *
 * Retries all failed automation email executions for a specific node.
 * Only retries failures that are not suppression-related.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getFailedExecutions,
  logAutomationEmailExecution,
  checkAndLogSuppression,
  checkAlreadySent,
} from "../_shared/automationEmailExecution.ts";
import {
  renderEmailForRecipient,
  type CustomerShape,
  type CompanyProfileShape,
} from "../_shared/emailRenderer.ts";
import { resolveSender, buildFromAddress } from "../_shared/senderResolver.ts";
import { COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT } from "../_shared/resolveDesignSystem.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RetryRequest {
  automationId: string;
  automationNodeId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { automationId, automationNodeId }: RetryRequest = await req.json();

    if (!automationId || !automationNodeId) {
      return new Response(
        JSON.stringify({
          error: "automationId and automationNodeId are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log(
      `🔄 Retrying failed emails for automation ${automationId}, node ${automationNodeId}`,
    );

    // Get the automation and node details
    const { data: automation, error: automationError } = await supabase
      .from("crm_automations")
      .select("id, tenant_id, flow_state")
      .eq("id", automationId)
      .single();

    if (automationError || !automation) {
      return new Response(JSON.stringify({ error: "Automation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find the email node in flow_state
    const flowState = automation.flow_state as any;
    const nodes = flowState?.nodes || [];
    const emailNode = nodes.find(
      (n: any) => n.id === automationNodeId && n.type === "email",
    );

    if (!emailNode) {
      return new Response(
        JSON.stringify({ error: "Email node not found in automation" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const nodeData = emailNode.data || {};
    const subject = nodeData.subject || "Message from automation";
    const content = nodeData.html || nodeData.content || "";

    // Get failed executions (non-suppression failures only)
    const failedExecutions = await getFailedExecutions(
      supabase,
      automationId,
      automationNodeId,
    );

    if (failedExecutions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          retried: 0,
          sent: 0,
          skipped: 0,
          failed: 0,
          message: "No retryable failures found",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log(
      `📧 Found ${failedExecutions.length} failed executions to retry`,
    );

    // Get sender config
    const senderConfig = await resolveSender(
      supabase,
      automation.tenant_id,
      {},
    );

    // Get company profile
    const { data: tenantUser } = await supabase
      .from("users")
      .select("id")
      .eq("tenant_id", automation.tenant_id)
      .limit(1)
      .single();

    let companyProfile: CompanyProfileShape | null = null;
    if (tenantUser?.id) {
      const { data: profile } = await supabase
        .from("company_profiles")
        .select(COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT)
        .eq("user_id", tenantUser.id)
        .single();
      companyProfile = (profile as CompanyProfileShape | null) || null;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const execution of failedExecutions) {
      try {
        // Re-check suppression at retry time
        const suppressionCheck = await checkAndLogSuppression(supabase, {
          tenantId: automation.tenant_id,
          automationId,
          automationNodeId,
          customerId: execution.customer_id,
          email: execution.email,
        });

        if (!suppressionCheck.allowed) {
          console.log(
            `⏭️ Skip retry for ${execution.email}: ${suppressionCheck.reason}`,
          );
          skipped++;
          continue;
        }

        // Check if already sent since the failure
        const alreadySent = await checkAlreadySent(supabase, {
          automationId,
          automationNodeId,
          customerId: execution.customer_id,
        });

        if (alreadySent) {
          console.log(`⏭️ Skip retry for ${execution.email}: already_sent`);
          await logAutomationEmailExecution(supabase, {
            tenant_id: automation.tenant_id,
            automation_id: automationId,
            automation_node_id: automationNodeId,
            customer_id: execution.customer_id,
            email: execution.email,
            status: "skipped",
            reason: "already_sent",
          });
          skipped++;
          continue;
        }

        // Get customer for personalization
        const { data: customer } = await supabase
          .from("crm_customers")
          .select("id, email, first_name, last_name, phone")
          .eq("id", execution.customer_id)
          .single();

        const customerShape: CustomerShape | null = customer
          ? {
              id: customer.id,
              email: customer.email,
              first_name: customer.first_name,
              last_name: customer.last_name,
              phone: customer.phone,
            }
          : null;

        // Render email
        const rendered = renderEmailForRecipient({
          tenantId: automation.tenant_id,
          html: content,
          subject,
          customer: customerShape,
          companyProfile,
          mode: "send",
          includeFooter: true,
          automationId,
          automationNodeId,
        });

        // Send via transactional email with reply-to from sender settings
        const { data: sendData, error: sendError } =
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              to: execution.email,
              subject: rendered.renderedSubject,
              html_content: rendered.renderedHtml,
              from_name: companyProfile?.company_name || "Your Business",
              from_email: senderConfig.fromEmail,
              reply_to: senderConfig.replyTo || senderConfig.fromEmail,
              tags: [
                { name: "automation_id", value: automationId },
                { name: "tenant_id", value: automation.tenant_id },
                { name: "retry", value: "true" },
              ],
            },
          });

        if (sendError || !sendData?.success) {
          // Log the retry failure
          await logAutomationEmailExecution(supabase, {
            tenant_id: automation.tenant_id,
            automation_id: automationId,
            automation_node_id: automationNodeId,
            customer_id: execution.customer_id,
            email: execution.email,
            status: "failed",
            reason: "send_error",
            error: sendError?.message || sendData?.error || "Retry send failed",
          });
          failed++;
          console.error(
            `❌ Retry failed for ${execution.email}: ${sendError?.message || sendData?.error}`,
          );
        } else {
          // Log success
          await logAutomationEmailExecution(supabase, {
            tenant_id: automation.tenant_id,
            automation_id: automationId,
            automation_node_id: automationNodeId,
            customer_id: execution.customer_id,
            email: execution.email,
            status: "sent",
            resend_message_id: sendData.external_id,
          });
          sent++;
          console.log(`✅ Retry succeeded for ${execution.email}`);
        }
      } catch (err) {
        // Log exception
        await logAutomationEmailExecution(supabase, {
          tenant_id: automation.tenant_id,
          automation_id: automationId,
          automation_node_id: automationNodeId,
          customer_id: execution.customer_id,
          email: execution.email,
          status: "failed",
          reason: "send_error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        failed++;
        console.error(`❌ Retry exception for ${execution.email}:`, err);
      }
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        retried: failedExecutions.length,
        sent,
        skipped,
        failed,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("💥 Retry automation email node error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
