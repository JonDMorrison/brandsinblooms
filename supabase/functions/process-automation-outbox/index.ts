import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { resolveSender, buildFromAddress, type SenderConfig } from "../_shared/senderResolver.ts";
import { checkSMSAvailability, isChannelAvailable } from "../_shared/channelAvailability.ts";

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
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

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

    // 1. Fetch pending messages that are due and not locked
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("crm_outbox")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .or(`locked_until.is.null,locked_until.lt.${now}`)
      .order("priority", { ascending: true })
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("❌ Failed to fetch pending messages:", fetchError);
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log("📭 No pending messages to process");
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

    console.log(`📨 Found ${pendingMessages.length} pending messages`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const lockUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();

    // 2. Process each message
    for (const message of pendingMessages as OutboxMessage[]) {
      try {
        // Try to lock the message (optimistic locking)
        const { data: lockResult, error: lockError } = await supabase
          .from("crm_outbox")
          .update({
            locked_until: lockUntil,
            locked_by: WORKER_ID,
          })
          .eq("id", message.id)
          .eq("status", "pending")
          .or(`locked_until.is.null,locked_until.lt.${now}`)
          .select()
          .single();

        if (lockError || !lockResult) {
          console.log(`⏭️ Message ${message.id} already locked by another worker`);
          continue;
        }

        console.log(`🔒 Locked message ${message.id} for ${message.message_type}`);

        // 3. Check channel availability before attempting to send
        const channelStatus = isChannelAvailable(message.message_type);
        
        if (!channelStatus.available) {
          // Channel not configured - skip this step and advance automation
          console.log(`⏭️ Skipping ${message.message_type} step - channel not available: ${channelStatus.reason}`);
          
          await skipMessage(supabase, message, channelStatus.reason || 'Channel not configured');
          
          // Advance automation run to next step
          if (message.automation_run_id) {
            await advanceAutomationRun(supabase, message);
          }
          
          skipped++;
          continue;
        }

        // 4. Send the message based on type
        let sendResult: { success: boolean; error?: string; shouldSkip?: boolean };

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
          
          // Advance automation run to next step
          if (message.automation_run_id) {
            await advanceAutomationRun(supabase, message);
          }
          
          skipped++;
          continue;
        }

        // 6. Update message status
        if (sendResult.success) {
          await supabase
            .from("crm_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              locked_until: null,
              locked_by: null,
            })
            .eq("id", message.id);

          // Log success in automation logs
          if (message.automation_id) {
            await supabase.from("crm_automation_logs").upsert(
              {
                automation_id: message.automation_id,
                customer_id: message.customer_id,
                step_index: message.step_index,
                message_type: message.message_type,
                status: "sent",
                sent_at: new Date().toISOString(),
              },
              { onConflict: "automation_id,customer_id,step_index" }
            );
          }

          // Advance automation run to next step
          if (message.automation_run_id) {
            await advanceAutomationRun(supabase, message);
          }

          sent++;
          console.log(`✅ Sent ${message.message_type} to ${message.recipient}`);
        } else {
          const newRetryCount = (message.retry_count || 0) + 1;
          const maxRetries = message.max_retries || 3;

          if (newRetryCount >= maxRetries) {
            // Max retries reached, mark as failed
            await supabase
              .from("crm_outbox")
              .update({
                status: "failed",
                error_message: sendResult.error,
                retry_count: newRetryCount,
                locked_until: null,
                locked_by: null,
              })
              .eq("id", message.id);

            // Update automation run if failed
            if (message.automation_run_id) {
              await supabase
                .from("automation_runs")
                .update({
                  status: "failed",
                  error_message: `Step ${message.step_index} failed: ${sendResult.error}`,
                })
                .eq("id", message.automation_run_id);
            }

            failed++;
            console.error(`❌ Message ${message.id} failed after ${newRetryCount} retries: ${sendResult.error}`);
          } else {
            // Schedule retry with exponential backoff
            const backoffMinutes = Math.pow(2, newRetryCount); // 2, 4, 8 minutes
            const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

            await supabase
              .from("crm_outbox")
              .update({
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

        // Unlock the message on error
        await supabase
          .from("crm_outbox")
          .update({
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
        processed: pendingMessages.length,
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
  
  // Update outbox message status to skipped
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

  // Log skip in automation logs
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
): Promise<{ success: boolean; error?: string; shouldSkip?: boolean }> {
  try {
    // Check if sender config was pre-resolved and stored in template_data
    const templateData = message.template_data || {};
    let senderConfig: SenderConfig;

    if (templateData.sender_config?.from_email) {
      // Use pre-resolved sender from template_data
      senderConfig = {
        fromEmail: templateData.sender_config.from_email,
        fromName: templateData.sender_config.from_name,
        deliveryMethod: templateData.sender_config.delivery_method,
        domainId: templateData.sender_config.domain_id,
      } as SenderConfig;
      console.log(`📧 [SendEmail] Using pre-resolved sender: ${senderConfig.deliveryMethod} (${senderConfig.fromEmail})`);
    } else {
      // Resolve sender dynamically using three-tier priority
      senderConfig = await resolveSender(supabase, message.tenant_id, {});
      console.log(`📧 [SendEmail] Dynamically resolved sender: ${senderConfig.deliveryMethod} (${senderConfig.fromEmail})`);
    }

    // Get company name for display - query via users table since company_profiles uses user_id
    const { data: tenantUser } = await supabase
      .from("users")
      .select("id")
      .eq("tenant_id", message.tenant_id)
      .limit(1)
      .single();

    let companyName = "Your Business";
    if (tenantUser?.id) {
      const { data: companyProfile } = await supabase
        .from("company_profiles")
        .select("company_name")
        .eq("user_id", tenantUser.id)
        .single();
      companyName = companyProfile?.company_name || "Your Business";
    }
    
    // Use company name directly without suffix
    const fromName = companyName;

    // Call the send-email-campaign function with resolved sender
    const { data, error } = await supabase.functions.invoke("send-email-campaign", {
      body: {
        tenant_id: message.tenant_id,
        to: message.recipient,
        subject: message.subject || "Message from automation",
        html_content: message.content,
        from_name: fromName,
        from_email: senderConfig.fromEmail,
        domain_id: senderConfig.domainId || null,
        delivery_method: senderConfig.deliveryMethod,
        automation_id: message.automation_id,
        customer_id: message.customer_id,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    console.log(`✅ [SendEmail] Email sent via ${senderConfig.deliveryMethod}: ${message.recipient}`);
    return { success: true };
  } catch (err) {
    console.error(`❌ [SendEmail] Failed:`, err);
    return { success: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}

async function sendSMS(
  supabase: ReturnType<typeof createClient>,
  message: OutboxMessage
): Promise<{ success: boolean; error?: string; shouldSkip?: boolean }> {
  try {
    // Call the send-sms function
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: {
        tenant_id: message.tenant_id,
        to: message.recipient,
        body: message.content,
        automation_id: message.automation_id,
        customer_id: message.customer_id,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Check if SMS function returned a skipable error
    if (data?.error === 'SMS_NOT_CONFIGURED' && data?.skipable) {
      console.log(`📱 [SendSMS] SMS not configured, marking as skipable`);
      return { success: false, error: data.message || 'SMS not configured', shouldSkip: true };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "SMS send failed" };
  }
}

async function advanceAutomationRun(
  supabase: ReturnType<typeof createClient>,
  message: OutboxMessage
): Promise<void> {
  if (!message.automation_run_id) return;

  try {
    // Get the automation run and its workflow steps
    const { data: run } = await supabase
      .from("automation_runs")
      .select("*, automation:crm_automations(workflow_steps, tenant_id)")
      .eq("id", message.automation_run_id)
      .single();

    if (!run) {
      console.log(`⚠️ Automation run ${message.automation_run_id} not found`);
      return;
    }

    const workflowSteps = normalizeWorkflowSteps(run.automation?.workflow_steps || []);
    const nextStepIndex = run.current_step_index + 1;

    if (nextStepIndex >= run.total_steps) {
      // All steps completed
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
      // Schedule next step
      const nextStep = workflowSteps[nextStepIndex];
      const delayMs = (nextStep?.delayMin || 0) * 60 * 1000;
      const nextScheduledAt = new Date(Date.now() + delayMs).toISOString();

      // Update run state
      await supabase
        .from("automation_runs")
        .update({
          current_step_index: nextStepIndex,
          next_step_scheduled_at: nextScheduledAt,
        })
        .eq("id", message.automation_run_id);

      // Get customer data for personalization
      const { data: customer } = await supabase
        .from("crm_customers")
        .select("*")
        .eq("id", message.customer_id)
        .single();

      if (customer && nextStep) {
        // Check if the next step's channel is available
        const nextChannelStatus = isChannelAvailable(nextStep.type);
        
        // Enqueue the next step (even if channel unavailable - it will be skipped during processing)
        await supabase.from("crm_outbox").insert({
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
          status: "pending",
          template_data: {
            automation_name: run.automation?.name,
            step_index: nextStepIndex,
            customer_data: customer,
            channel_available: nextChannelStatus.available,
            channel_skip_reason: nextChannelStatus.reason,
          },
        });

        console.log(`📅 Scheduled step ${nextStepIndex + 1} for ${nextScheduledAt}${!nextChannelStatus.available ? ' (will be skipped - channel unavailable)' : ''}`);
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

// Normalize workflow_steps from either array format or React Flow object format
function normalizeWorkflowSteps(workflowSteps: any): WorkflowStep[] {
  // If it's already an array, return as-is
  if (Array.isArray(workflowSteps)) {
    return workflowSteps;
  }
  
  // If it's React Flow format with nodes/edges
  if (workflowSteps && typeof workflowSteps === 'object' && Array.isArray(workflowSteps.nodes)) {
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
  
  return [];
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
