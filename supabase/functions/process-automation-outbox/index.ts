import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { resolveSender, buildFromAddress, type SenderConfig } from "../_shared/senderResolver.ts";

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
          duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📨 Found ${pendingMessages.length} pending messages`);

    let sent = 0;
    let failed = 0;
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

        // 3. Send the message based on type
        let sendResult: { success: boolean; error?: string };

        if (message.message_type === "email") {
          sendResult = await sendEmail(supabase, message);
        } else if (message.message_type === "sms") {
          sendResult = await sendSMS(supabase, message);
        } else {
          sendResult = { success: false, error: `Unknown message type: ${message.message_type}` };
        }

        // 4. Update message status
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
    console.log(`✅ [${WORKER_ID}] Outbox processing complete: ${sent} sent, ${failed} failed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingMessages.length,
        sent,
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

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  message: OutboxMessage
): Promise<{ success: boolean; error?: string }> {
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
    
    // Adjust from name based on delivery method
    const fromName = senderConfig.deliveryMethod === 'custom_domain' 
      ? companyName 
      : `${companyName} via BloomSuite`;

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
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call the send-sms function
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: {
        tenant_id: message.tenant_id,
        to: message.recipient,
        message: message.content,
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
      .select("*, automation:crm_automations(workflow_steps)")
      .eq("id", message.automation_run_id)
      .single();

    if (!run) {
      console.log(`⚠️ Automation run ${message.automation_run_id} not found`);
      return;
    }

    const workflowSteps = run.automation?.workflow_steps || [];
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
        // Enqueue the next step
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
          },
        });

        console.log(`📅 Scheduled step ${nextStepIndex + 1} for ${nextScheduledAt}`);
      }
    }
  } catch (err) {
    console.error(`❌ Error advancing automation run ${message.automation_run_id}:`, err);
  }
}

serve(handler);
