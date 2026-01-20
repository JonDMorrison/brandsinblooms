import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { resolveSender, buildFromAddress, type SenderConfig } from "../_shared/senderResolver.ts";
import { checkSMSAvailability, isChannelAvailable } from "../_shared/channelAvailability.ts";
import { renderEmailForRecipient, type CustomerShape, type CompanyProfileShape } from "../_shared/emailRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OutboxMessage {
  id: string;
  tenant_id: string;
  automation_id: string | null;
  automation_run_id: string | null;
  customer_id: string;
  message_type: "email" | "sms";
  recipient: string;
  subject: string | null;
  content: string;
  template_data: Record<string, any> | null;
  scheduled_at: string;
  status: string;
  step_index: number;
  priority: number;
  retry_count: number;
  max_retries: number;
  locked_until: string | null;
  locked_by: string | null;
}

const BATCH_SIZE = 50;
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

// Soft failure mode: When enabled, failed steps don't block automation - it continues to next step
const SOFT_FAILURE_MODE = true;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`📬 [${WORKER_ID}] Outbox processor starting...`);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Find all tenants with queued messages
    const { data: tenantRows, error: tenantError } = await supabase
      .from("crm_outbox")
      .select("tenant_id")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .or("locked_until.is.null,locked_until.lt." + new Date().toISOString())
      .limit(100);

    if (tenantError) {
      console.error("❌ Failed to find tenants with queued messages:", tenantError);
      throw tenantError;
    }

    const tenantIds = [...new Set((tenantRows || []).map((r: any) => r.tenant_id))];

    if (tenantIds.length === 0) {
      console.log("📭 No tenants with queued messages");
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`🏢 Found ${tenantIds.length} tenants with queued messages`);

    // 2. Claim messages for each tenant using the new tenant-scoped RPC
    let allClaimedMessages: OutboxMessage[] = [];
    for (const tenantId of tenantIds) {
      const { data: tenantMessages, error: claimError } = await supabase
        .rpc("claim_outbox_messages", {
          p_tenant_id: tenantId,
          p_limit: BATCH_SIZE,
          p_worker_id: WORKER_ID
        });

      if (claimError) {
        console.error(`❌ Failed to claim messages for tenant ${tenantId}:`, claimError);
        continue;
      }

      if (tenantMessages && tenantMessages.length > 0) {
        console.log(`📨 Claimed ${tenantMessages.length} messages for tenant ${tenantId}`);
        allClaimedMessages = allClaimedMessages.concat(tenantMessages);
      }
    }

    if (allClaimedMessages.length === 0) {
      console.log("📭 No messages claimed (all may be locked)");
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const claimedMessages = allClaimedMessages;

    console.log(`📨 Claimed ${claimedMessages.length} messages (status already set to 'processing')`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // 2. Process each claimed message
    for (const message of claimedMessages as OutboxMessage[]) {
      try {
        console.log(`🔒 Processing message ${message.id} (${message.message_type} to ${message.recipient})`);

        // 3. Check channel availability before attempting to send
        const channelStatus = isChannelAvailable(message.message_type);

        if (!channelStatus.available) {
          console.log(`⏭️ Skipping ${message.message_type} step - channel not available: ${channelStatus.reason}`);
          await skipMessage(supabase, message, channelStatus.reason || 'Channel not configured');
          if (message.automation_run_id) {
            await advanceAutomationRun(supabase, message);
          }
          skipped++;
          continue;
        }

        // 4. Send the message based on type
        let sendResult: { success: boolean; error?: string; shouldSkip?: boolean; external_id?: string; canRetry?: boolean };

        if (message.message_type === "email") {
          sendResult = await sendEmail(supabase, message);
        } else if (message.message_type === "sms") {
          sendResult = await sendSMS(supabase, message);
        } else {
          sendResult = { success: false, error: `Unknown message type: ${message.message_type}` };
        }

        // 5. Handle skip response from send functions
        if (sendResult.shouldSkip) {
          console.log(`⏭️ Skipping ${message.message_type} step - ${sendResult.error}`);
          await skipMessage(supabase, message, sendResult.error || 'Channel not available');
          if (message.automation_run_id) {
            await advanceAutomationRun(supabase, message);
          }
          skipped++;
          continue;
        }

        // 6. Update message status and log to crm_message_logs
        if (sendResult.success) {
          const sentAt = new Date().toISOString();

          // Update outbox to sent
          await supabase
            .from("crm_outbox")
            .update({
              status: "sent",
              sent_at: sentAt,
              locked_until: null,
              locked_by: null,
            })
            .eq("id", message.id);

          // Log to crm_message_logs with external_id
          const { error: logError } = await supabase.from("crm_message_logs").insert({
            outbox_id: message.id,
            tenant_id: message.tenant_id,
            message_type: message.message_type,
            recipient: message.recipient,
            status: "sent",
            external_id: sendResult.external_id || null,
            metadata: {
              automation_id: message.automation_id,
              customer_id: message.customer_id,
              step_index: message.step_index,
            },
          });

          if (logError) {
            console.error(`⚠️ Failed to log message to crm_message_logs:`, logError);
          } else {
            console.log(`📝 Logged to crm_message_logs: external_id=${sendResult.external_id}`);
          }

          // Log success in automation logs (resilient to missing unique constraint)
          if (message.automation_id) {
            await writeAutomationLog(supabase, {
              automation_id: message.automation_id,
              customer_id: message.customer_id,
              step_index: message.step_index,
              message_type: message.message_type,
              status: 'sent',
              sent_at: sentAt,
            });
          }

          // Advance automation run to next step
          if (message.automation_run_id) {
            await advanceAutomationRun(supabase, message);
          }

          sent++;
          console.log(`✅ Sent ${message.message_type} to ${message.recipient} (external_id: ${sendResult.external_id})`);
        } else {
          const newRetryCount = (message.retry_count || 0) + 1;
          const maxRetries = message.max_retries || 3;

          // If the sender tells us not to retry, treat as terminal immediately.
          const isNonRetryable = sendResult.canRetry === false;
          const effectiveRetryCount = isNonRetryable ? maxRetries : newRetryCount;

          if (effectiveRetryCount >= maxRetries) {
            // Max retries reached, mark message as failed
            await supabase
              .from("crm_outbox")
              .update({
                status: "failed",
                error_message: sendResult.error,
                retry_count: effectiveRetryCount,
                locked_until: null,
                locked_by: null,
              })
              .eq("id", message.id);

            // Log failure to crm_message_logs
            await supabase.from("crm_message_logs").insert({
              outbox_id: message.id,
              tenant_id: message.tenant_id,
              message_type: message.message_type,
              recipient: message.recipient,
              status: "failed",
              error_message: sendResult.error,
              metadata: {
                automation_id: message.automation_id,
                customer_id: message.customer_id,
                step_index: message.step_index,
                retry_count: effectiveRetryCount,
                soft_failed: SOFT_FAILURE_MODE,
                non_retryable: isNonRetryable,
              },
            });

            // Soft failure mode: Continue to next step instead of blocking entire automation
            if (SOFT_FAILURE_MODE && message.automation_run_id) {
              console.log(`⚠️ Soft failure mode: Step ${message.step_index} (${message.message_type}) failed, continuing to next step`);

              // Log as soft_failed in automation logs
              if (message.automation_id) {
                await writeAutomationLog(supabase, {
                  automation_id: message.automation_id,
                  customer_id: message.customer_id,
                  step_index: message.step_index,
                  message_type: message.message_type,
                  status: 'soft_failed',
                  error_message: sendResult.error,
                  skip_reason: isNonRetryable
                    ? 'Non-retryable failure - bypassed to continue automation'
                    : `Failed after ${effectiveRetryCount} retries - bypassed to continue automation`,
                });
              }

              // Continue to next step despite failure
              await advanceAutomationRun(supabase, message);

            } else if (message.automation_run_id) {
              // Original behavior: mark entire automation as failed
              await supabase
                .from("automation_runs")
                .update({
                  status: "failed",
                  error_message: `Step ${message.step_index} failed: ${sendResult.error}`,
                })
                .eq("id", message.automation_run_id);
            }

            failed++;
            console.error(
              `❌ Message ${message.id} failed${isNonRetryable ? ' (non-retryable)' : ''} after ${effectiveRetryCount} retries: ${sendResult.error}`
            );
          } else {
            // Schedule retry with exponential backoff
            const backoffMinutes = Math.pow(2, newRetryCount);
            const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

            await supabase
              .from("crm_outbox")
              .update({
                status: "queued", // Back to queued for retry
                retry_count: newRetryCount,
                scheduled_at: nextRetry,
                error_message: sendResult.error,
                locked_until: null,
                locked_by: null,
              })
              .eq("id", message.id);

            console.log(`🔄 Scheduled retry ${newRetryCount}/${maxRetries} for message ${message.id} at ${nextRetry}`);
          }
        }
      } catch (messageError) {
        console.error(`❌ Error processing message ${message.id}:`, messageError);

        // Unlock the message on error and set back to queued
        await supabase
          .from("crm_outbox")
          .update({
            status: "queued",
            locked_until: null,
            locked_by: null,
            error_message: messageError instanceof Error ? messageError.message : "Unknown error",
          })
          .eq("id", message.id);

        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [${WORKER_ID}] Outbox processing complete: ${sent} sent, ${skipped} skipped, ${failed} failed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: claimedMessages.length,
        sent,
        skipped,
        failed,
        worker_id: WORKER_ID,
        duration_ms: duration,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("💥 Outbox processor error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

/**
 * Mark a message as skipped and log the skip reason
 */
async function skipMessage(
  supabase: ReturnType<typeof createClient>,
  message: OutboxMessage,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();

  await supabase
    .from("crm_outbox")
    .update({
      status: "skipped",
      skip_reason: reason,
      skipped_at: now,
      locked_until: null,
      locked_by: null,
    })
    .eq("id", message.id);

  // Log skip in crm_message_logs
  await supabase.from("crm_message_logs").insert({
    outbox_id: message.id,
    tenant_id: message.tenant_id,
    message_type: message.message_type,
    recipient: message.recipient,
    status: "skipped",
    error_message: reason,
    metadata: {
      automation_id: message.automation_id,
      customer_id: message.customer_id,
      step_index: message.step_index,
    },
  });

  if (message.automation_id) {
    await supabase.from("crm_automation_logs").upsert(
      {
        automation_id: message.automation_id,
        customer_id: message.customer_id,
        step_index: message.step_index,
        message_type: message.message_type,
        status: "skipped_no_channel",
        skip_reason: reason,
      },
      { onConflict: "automation_id,customer_id,step_index" }
    );
  }

  console.log(`⏭️ Marked message ${message.id} as skipped: ${reason}`);
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  message: OutboxMessage
): Promise<{ success: boolean; error?: string; shouldSkip?: boolean; external_id?: string; canRetry?: boolean }> {
  try {
    const templateData = message.template_data || {};
    let senderConfig: SenderConfig;

    if (templateData.sender_config?.from_email) {
      senderConfig = {
        fromEmail: templateData.sender_config.from_email,
        fromName: templateData.sender_config.from_name,
        deliveryMethod: templateData.sender_config.delivery_method,
        domainId: templateData.sender_config.domain_id,
      } as SenderConfig;
      console.log(`📧 [SendEmail] Using pre-resolved sender: ${senderConfig.deliveryMethod} (${senderConfig.fromEmail})`);
    } else {
      senderConfig = await resolveSender(supabase, message.tenant_id, {});
      console.log(`📧 [SendEmail] Dynamically resolved sender: ${senderConfig.deliveryMethod} (${senderConfig.fromEmail})`);
    }

    // Get company profile for unified rendering
    const { data: tenantUser } = await supabase
      .from("users")
      .select("id")
      .eq("tenant_id", message.tenant_id)
      .limit(1)
      .single();

    let companyName = "Your Business";
    let companyProfile: CompanyProfileShape | null = null;
    if (tenantUser?.id) {
      const { data: profile } = await supabase
        .from("company_profiles")
        .select("company_name, location_info, company_email, company_phone, website_url")
        .eq("user_id", tenantUser.id)
        .single();
      companyName = profile?.company_name || "Your Business";
      companyProfile = profile;
    }

    // Fetch customer data for unified rendering
    const { data: customer } = await supabase
      .from("crm_customers")
      .select("id, email, first_name, last_name, phone")
      .eq("id", message.customer_id)
      .single();

    // Use unified renderer for consistent merge tag handling
    const customerShape: CustomerShape | null = customer ? {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
    } : null;

    const rendered = renderEmailForRecipient({
      tenantId: message.tenant_id,
      html: message.content,
      subject: message.subject || "Message from automation",
      customer: customerShape,
      companyProfile,
      mode: 'send',
      includeFooter: true,
    });

    console.log(`📧 [SendEmail] Unified renderer diagnostics: ${rendered.diagnostics.usedTags.length} tags, ${rendered.diagnostics.missingTags.length} missing`);

    // Call the transactional email function (returns external_id)
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        to: message.recipient,
        subject: rendered.renderedSubject,
        html_content: rendered.renderedHtml,
        from_name: companyName,
        from_email: senderConfig.fromEmail,
        tags: [
          { name: "automation_id", value: message.automation_id || "none" },
          { name: "tenant_id", value: message.tenant_id },
        ],
      },
    });

    if (error) {
      console.error(`❌ [SendEmail] Invoke error:`, error.message);
      return { success: false, error: error.message };
    }

    // Log full response for debugging
    console.log(`📧 [SendEmail] Response:`, JSON.stringify(data));

    if (!data?.success) {
      if (data?.skipable) {
        return { success: false, error: data.error, shouldSkip: true, canRetry: false };
      }
      return {
        success: false,
        error: data?.error || "Email send failed",
        canRetry: typeof data?.canRetry === 'boolean' ? data.canRetry : true,
      };
    }

    console.log(`✅ [SendEmail] Email sent via ${senderConfig.deliveryMethod}: ${message.recipient}, external_id: ${data.external_id}`);
    return { success: true, external_id: data.external_id };
  } catch (err) {
    console.error(`❌ [SendEmail] Exception:`, err);
    return { success: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}

async function sendSMS(
  supabase: ReturnType<typeof createClient>,
  message: OutboxMessage
): Promise<{ success: boolean; error?: string; shouldSkip?: boolean; external_id?: string; canRetry?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: {
        to: message.recipient,
        body: message.content,
      },
    });

    if (error) {
      console.error(`❌ [SendSMS] Invoke error:`, error.message);
      return { success: false, error: error.message };
    }

    // Log full response for debugging
    console.log(`📱 [SendSMS] Response:`, JSON.stringify(data));

    // Check for any skipable response (unsupported region, not configured, etc.)
    if (data?.skipable) {
      console.log(`📱 [SendSMS] Skipable SMS response: ${data.error || data.message}`);
      return {
        success: false,
        error: data.message || data.error || 'SMS skipped',
        shouldSkip: true,
        canRetry: false,
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
        canRetry: typeof data?.canRetry === 'boolean' ? data.canRetry : true,
      };
    }

    // send-sms returns { sid, status, message }
    const twilioSid = data?.sid;
    console.log(`✅ [SendSMS] SMS sent, Twilio SID: ${twilioSid}`);
    return { success: true, external_id: twilioSid };
  } catch (err) {
    console.error(`❌ [SendSMS] Exception:`, err);
    return { success: false, error: err instanceof Error ? err.message : "SMS send failed" };
  }
}

async function writeAutomationLog(
  supabase: ReturnType<typeof createClient>,
  row: {
    automation_id: string;
    customer_id: string;
    step_index: number;
    message_type: string;
    status: string;
    sent_at?: string;
    error_message?: string;
    skip_reason?: string;
  }
): Promise<void> {
  // Prefer upsert when a unique constraint exists; fall back to insert otherwise.
  const { error: upsertError } = await supabase
    .from('crm_automation_logs')
    .upsert(row as any, { onConflict: 'automation_id,customer_id,step_index' });

  if (!upsertError) return;

  const message = (upsertError as any)?.message || '';
  const code = (upsertError as any)?.code;
  const looksLikeMissingConstraint =
    code === '42P10' || message.toLowerCase().includes('no unique') || message.toLowerCase().includes('on conflict');

  if (!looksLikeMissingConstraint) {
    console.error('⚠️ Failed to upsert crm_automation_logs:', upsertError);
    return;
  }

  const { error: insertError } = await supabase.from('crm_automation_logs').insert(row as any);
  if (insertError) {
    console.error('⚠️ Failed to insert crm_automation_logs:', insertError);
  }
}

async function advanceAutomationRun(
  supabase: ReturnType<typeof createClient>,
  message: OutboxMessage
): Promise<void> {
  if (!message.automation_run_id) return;

  try {
    const { data: run } = await supabase
      .from("automation_runs")
      .select("*, automation:crm_automations(workflow_steps, tenant_id, name)")
      .eq("id", message.automation_run_id)
      .single();

    if (!run) {
      console.log(`⚠️ Automation run ${message.automation_run_id} not found`);
      return;
    }

    const workflowSteps = normalizeWorkflowSteps(run.automation?.workflow_steps || []);
    const nextStepIndex = run.current_step_index + 1;

    if (nextStepIndex >= run.total_steps) {
      await supabase
        .from("automation_runs")
        .update({
          status: "completed",
          current_step_index: run.total_steps,
          completed_at: new Date().toISOString(),
          next_step_scheduled_at: null,
        })
        .eq("id", message.automation_run_id);

      console.log(`🎉 Automation run ${message.automation_run_id} completed`);
    } else {
      const nextStep = workflowSteps[nextStepIndex];
      const delayMs = (nextStep?.delayMin || 0) * 60 * 1000;
      const nextScheduledAt = new Date(Date.now() + delayMs).toISOString();

      await supabase
        .from("automation_runs")
        .update({
          current_step_index: nextStepIndex,
          next_step_scheduled_at: nextScheduledAt,
        })
        .eq("id", message.automation_run_id);

      const { data: customer } = await supabase
        .from("crm_customers")
        .select("*")
        .eq("id", message.customer_id)
        .single();

      if (customer && nextStep) {
        const nextChannelStatus = isChannelAvailable(nextStep.type);

        // Enqueue next step with status='queued'
        const { error: insertError } = await supabase.from("crm_outbox").insert({
          tenant_id: message.tenant_id,
          automation_id: message.automation_id,
          automation_run_id: message.automation_run_id,
          customer_id: message.customer_id,
          message_type: nextStep.type,
          recipient: nextStep.type === "sms" ? customer.phone : customer.email,
          subject: nextStep.subject || null,
          content: nextStep.text,
          step_index: nextStepIndex,
          scheduled_at: nextScheduledAt,
          status: "queued",  // Standardized: always use queued
          template_data: {
            automation_name: run.automation?.name,
            step_index: nextStepIndex,
            customer_data: customer,
            channel_available: nextChannelStatus.available,
            channel_skip_reason: nextChannelStatus.reason,
          },
        });

        if (insertError) {
          console.error(`❌ Failed to enqueue step ${nextStepIndex}:`, insertError);
          return;
        }
        console.log(`📬 Enqueued next step ${nextStepIndex} for customer ${customer.email}`);
      }
    }
  } catch (err) {
    console.error(`❌ Error advancing automation run ${message.automation_run_id}:`, err);
  }
}

interface WorkflowStep {
  type: 'email' | 'sms';
  delayMin: number;
  subject?: string;
  text: string;
}

function normalizeWorkflowSteps(workflowSteps: any): WorkflowStep[] {
  if (Array.isArray(workflowSteps)) {
    console.log(`🔄 Normalizing array format (${workflowSteps.length} raw steps)`);

    // Calculate cumulative delays from delay nodes
    let cumulativeDelayFromDelayNodes = 0;
    const normalizedSteps: WorkflowStep[] = [];

    for (const step of workflowSteps) {
      // If this is a delay-type node, accumulate it for the next message step
      if (step.type === 'delay') {
        cumulativeDelayFromDelayNodes += parseStepDelay(step);
        console.log(`  ⏳ Delay node: accumulated ${cumulativeDelayFromDelayNodes} min`);
        continue;
      }

      // Only process email and sms steps
      if (step.type === 'email' || step.type === 'sms') {
        const stepDelay = parseStepDelay(step);
        const totalDelay = stepDelay + cumulativeDelayFromDelayNodes;

        normalizedSteps.push({
          type: step.type as 'email' | 'sms',
          delayMin: totalDelay,
          subject: step.subject || '',
          text: step.content || step.text || ''
        });

        console.log(`  📧 ${step.type} step: delay=${totalDelay}min, content=${(step.content || step.text || '').substring(0, 50)}...`);

        // Reset cumulative delay after applying to a message step
        cumulativeDelayFromDelayNodes = 0;
      }
    }

    console.log(`📋 Normalized ${normalizedSteps.length} message steps from ${workflowSteps.length} raw steps`);
    return normalizedSteps;
  }

  // Handle React Flow format with nodes/edges
  if (workflowSteps && typeof workflowSteps === 'object' && Array.isArray(workflowSteps.nodes)) {
    console.log(`🔄 Converting React Flow format (${workflowSteps.nodes.length} nodes)`);
    return workflowSteps.nodes
      .filter((node: any) => node.type === 'email' || node.type === 'sms')
      .map((node: any) => {
        const delayMin = node.data?.delay ? parseDelayToMinutes(node.data.delay) : 0;
        return {
          type: node.type as 'email' | 'sms',
          delayMin,
          subject: node.data?.subject || '',
          text: node.data?.content || node.data?.text || ''
        };
      });
  }

  console.log(`⚠️ Unknown workflow_steps format, returning empty array`);
  return [];
}

function parseStepDelay(step: any): number {
  // Handle direct delayMin
  if (typeof step.delayMin === 'number' && !isNaN(step.delayMin)) {
    return step.delayMin;
  }

  // Handle delayValue + delayUnit format
  if (step.delayValue !== undefined && step.delayUnit) {
    const value = parseInt(step.delayValue, 10) || 0;
    switch (step.delayUnit) {
      case 'minutes': return value;
      case 'hours': return value * 60;
      case 'days': return value * 60 * 24;
      case 'weeks': return value * 60 * 24 * 7;
      default: return 0;
    }
  }

  // Handle string delay format
  if (step.delay !== undefined) {
    return parseDelayToMinutes(step.delay);
  }

  return 0;
}

function parseDelayToMinutes(delay: string | number): number {
  if (typeof delay === 'number') return delay;
  if (!delay || delay === 'Immediate') return 0;

  const lower = delay.toLowerCase();
  const match = lower.match(/(\d+)\s*(minute|hour|day|week)/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'minute': return value;
    case 'hour': return value * 60;
    case 'day': return value * 60 * 24;
    case 'week': return value * 60 * 24 * 7;
    default: return 0;
  }
}

serve(handler);
