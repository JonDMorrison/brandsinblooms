import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { canSendEmail } from "../_shared/canSendEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TenantSuppressionBypassState = {
  suppression_bypass_active: boolean;
  suppression_bypass_automation_mode:
    | "campaign_only"
    | "campaign_and_automation";
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
      "[process-form-submitted] Failed to fetch suppression bypass state:",
      error.message,
    );
    return {
      suppression_bypass_active: false,
      suppression_bypass_automation_mode: "campaign_only",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const mode =
    String(
      row?.suppression_bypass_automation_mode || "campaign_only",
    ).toLowerCase() === "campaign_and_automation"
      ? "campaign_and_automation"
      : "campaign_only";

  return {
    suppression_bypass_active: Boolean(row?.suppression_bypass_active),
    suppression_bypass_automation_mode: mode,
  };
}

/**
 * Process FormSubmitted trigger events and execute matching automations.
 *
 * Supported actions:
 * 1. send_email - Send email immediately
 * 2. notify_staff - Send notification to staff immediately
 * 3. delay - Wait before next action (persisted in scheduled_at)
 *
 * Rules:
 * - Automations check consent before sending (via canSendEmail)
 * - Automations never mutate customer consent
 * - Delays are persisted in crm_outbox.scheduled_at
 * - All executions are logged to form_automation_executions
 * - Failures do not retry infinitely (max 3 retries)
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes between retries

interface FormSubmittedPayload {
  form_id: string;
  submission_id: string;
  customer_id: string | null;
  tenant_id: string;
  timestamp: string;
  consent: {
    email_consent: boolean;
    email_consent_text: string | null;
    sms_consent: boolean;
    sms_consent_text: string | null;
  };
  referrer?: string;
  page_url?: string;
}

interface FormNotificationSettings {
  notification_emails?: string[];
  form_title?: string;
}

interface FormNotificationFormRecord {
  id: string;
  name: string;
  settings_json: FormNotificationSettings | null;
}

interface FormNotificationSubmissionRecord {
  id: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  submitted_at: string;
}

interface NotificationCustomerRecord {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface FormNotificationResult {
  queued: number;
  failed: number;
}

interface AutomationNode {
  id: string;
  type: string;
  data: {
    action?: string;
    delay_minutes?: number;
    delay_hours?: number;
    delay_days?: number;
    email_template_id?: string;
    email_subject?: string;
    email_content?: string;
    notification_emails?: string[];
    notification_message?: string;
  };
}

interface Automation {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: string;
  trigger_conditions: {
    form_id?: string;
    form_ids?: string[];
  } | null;
  workflow_steps: AutomationNode[];
  is_active: boolean;
}

interface ExecutionLog {
  tenant_id: string;
  automation_id: string;
  automation_run_id?: string;
  submission_id: string;
  customer_id?: string;
  status: "queued" | "running" | "completed" | "failed" | "skipped";
  step_type?: string;
  step_index?: number;
  failure_reason?: string;
  error_details?: Record<string, unknown>;
  trigger_event_id?: string;
  node_id?: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🚀 [FormSubmittedHandler] Starting event processing...");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ─── ATOMIC CLAIM PATTERN ─────────────────────────────────────────────
    // Use claim_trigger_events RPC for atomic claiming via FOR UPDATE SKIP LOCKED
    // This prevents double-processing when multiple workers run simultaneously
    let events: any[] = [];

    const { data: claimedEvents, error: claimError } = await supabase.rpc(
      "claim_trigger_events",
      {
        p_event_type: "form_submitted",
        p_limit: 100,
      },
    );

    if (claimError) {
      // Fallback: If RPC doesn't exist yet, use standard query
      // (This handles deployments before migration is applied)
      console.warn(
        "⚠️ claim_trigger_events RPC failed, using fallback:",
        claimError.message,
      );

      const { data: fallbackEvents, error: fallbackError } = await supabase
        .from("automation_trigger_events")
        .select("*")
        .eq("event_type", "form_submitted")
        .is("processed_at", null)
        .is("claimed_at", null) // Don't process claimed events
        .lt("retry_count", MAX_RETRIES)
        .order("created_at", { ascending: true })
        .limit(100);

      if (fallbackError) {
        console.error("❌ Failed to fetch trigger events:", fallbackError);
        throw fallbackError;
      }
      events = fallbackEvents || [];

      // Mark as claimed to prevent other workers from picking them up
      if (events.length > 0) {
        const eventIds = events.map((e) => e.id);
        await supabase
          .from("automation_trigger_events")
          .update({ claimed_at: new Date().toISOString() })
          .in("id", eventIds)
          .is("claimed_at", null); // Only claim if not already claimed (race-safe)
      }
    } else {
      events = claimedEvents || [];
    }

    if (events.length === 0) {
      console.log("📭 No pending form_submitted events");
      return new Response(
        JSON.stringify({ success: true, processed: 0, runs_created: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log(
      `📬 Claimed ${events.length} form_submitted events for processing`,
    );

    let processed = 0;
    let runsCreated = 0;
    let actionsQueued = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const payload = event.metadata as FormSubmittedPayload;
        const tenantId = event.tenant_id;
        const formId = event.form_id || payload?.form_id;
        const customerId = event.customer_id || payload?.customer_id;
        const submissionId = event.submission_id || payload?.submission_id;

        if (!formId || !submissionId) {
          console.warn(
            `⚠️ Event ${event.id} missing form_id or submission_id, skipping`,
          );
          await markEventProcessed(
            supabase,
            event.id,
            "missing_required_fields",
          );

          // Log the failure
          await logExecution(supabase, {
            tenant_id: tenantId,
            automation_id: "00000000-0000-0000-0000-000000000000", // placeholder
            submission_id: submissionId || event.id,
            status: "failed",
            failure_reason: "missing_required_fields",
            error_details: { form_id: formId, submission_id: submissionId },
            trigger_event_id: event.id,
          });

          processed++;
          failed++;
          continue;
        }

        // 2. Find matching automations for this form
        const { data: automations, error: automationError } = await supabase
          .from("crm_automations")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("trigger_type", "form_submitted")
          .eq("is_active", true);

        if (automationError) {
          console.error(
            `❌ Failed to fetch automations for tenant ${tenantId}:`,
            automationError,
          );

          // Increment retry count instead of marking processed
          await incrementEventRetry(
            supabase,
            event.id,
            automationError.message,
          );

          // Log the failure
          await logExecution(supabase, {
            tenant_id: tenantId,
            automation_id: "00000000-0000-0000-0000-000000000000",
            submission_id: submissionId,
            status: "failed",
            failure_reason: "automation_fetch_error",
            error_details: { error: automationError.message },
            trigger_event_id: event.id,
          });

          processed++;
          failed++;
          continue;
        }

        // Filter automations that match this specific form
        const matchingAutomations = (automations || []).filter(
          (auto: Automation) => {
            const conditions = auto.trigger_conditions;
            if (!conditions) return true; // No conditions = matches all forms

            // Check form_id match
            if (conditions.form_id && conditions.form_id !== formId)
              return false;
            if (conditions.form_ids && !conditions.form_ids.includes(formId))
              return false;

            return true;
          },
        );

        const formNotificationResult = await queueFormSettingsNotifications(
          supabase,
          {
            customerId,
            eventId: event.id,
            formId,
            payload,
            submissionId,
            tenantId,
          },
        );

        actionsQueued += formNotificationResult.queued;

        if (matchingAutomations.length === 0) {
          console.log(`📭 No matching automations for form ${formId}`);
          await markEventProcessed(
            supabase,
            event.id,
            "no_matching_automations",
          );

          // Log as completed (no error, just no automations)
          await logExecution(supabase, {
            tenant_id: tenantId,
            automation_id: "00000000-0000-0000-0000-000000000000",
            submission_id: submissionId,
            status: "completed",
            failure_reason: null,
            metadata: {
              reason: "no_matching_automations",
              form_id: formId,
              form_notifications_queued: formNotificationResult.queued,
              form_notifications_failed: formNotificationResult.failed,
            },
            trigger_event_id: event.id,
          });

          processed++;
          continue;
        }

        console.log(
          `🎯 Found ${matchingAutomations.length} matching automations for form ${formId}`,
        );

        // 3. Create automation runs and queue actions
        for (const automation of matchingAutomations as Automation[]) {
          try {
            // Log automation execution start
            await logExecution(supabase, {
              tenant_id: tenantId,
              automation_id: automation.id,
              submission_id: submissionId,
              customer_id: customerId || undefined,
              status: "running",
              trigger_event_id: event.id,
              metadata: { automation_name: automation.name },
            });

            // Get customer data for email sending
            let customer = null;
            let customerEmail = null;

            if (customerId) {
              const { data: customerData } = await supabase
                .from("crm_customers")
                .select(
                  "id, email, first_name, last_name, email_opt_in, sms_opt_in",
                )
                .eq("id", customerId)
                .single();

              customer = customerData;
              customerEmail = customerData?.email;
            }

            if (!customer || !customerEmail) {
              console.warn(
                `⚠️ No customer/email for automation ${automation.id}, skipping`,
              );

              await logExecution(supabase, {
                tenant_id: tenantId,
                automation_id: automation.id,
                submission_id: submissionId,
                customer_id: customerId || undefined,
                status: "skipped",
                failure_reason: "no_customer_email",
                trigger_event_id: event.id,
              });

              continue;
            }

            // Create automation run
            const { data: run, error: runError } = await supabase
              .from("automation_runs")
              .insert({
                tenant_id: tenantId,
                automation_id: automation.id,
                customer_id: customerId,
                status: "running",
                current_step_index: 0,
                total_steps: automation.workflow_steps?.length || 0,
                trigger_data: payload,
                started_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (runError) {
              console.error(`❌ Failed to create automation run:`, runError);

              await logExecution(supabase, {
                tenant_id: tenantId,
                automation_id: automation.id,
                submission_id: submissionId,
                customer_id: customerId,
                status: "failed",
                failure_reason: "run_creation_failed",
                error_details: { error: runError.message },
                trigger_event_id: event.id,
              });

              continue;
            }

            runsCreated++;
            console.log(
              `🏃 Created automation run ${run.id} for automation ${automation.name}`,
            );

            // 4. Queue workflow steps with proper scheduling
            const steps = automation.workflow_steps || [];
            let cumulativeDelayMs = 0;
            let stepsQueued = 0;
            let stepsSkipped = 0;
            let stepsFailed = 0;

            for (let i = 0; i < steps.length; i++) {
              const node = steps[i];
              const nodeType = node.type || node.data?.action;

              // Calculate delay for this step
              if (
                nodeType === "delay" ||
                node.data?.delay_minutes ||
                node.data?.delay_hours ||
                node.data?.delay_days
              ) {
                const delayMinutes =
                  (node.data?.delay_minutes || 0) +
                  (node.data?.delay_hours || 0) * 60 +
                  (node.data?.delay_days || 0) * 24 * 60;

                cumulativeDelayMs += delayMinutes * 60 * 1000;
                console.log(
                  `⏰ Step ${i}: Adding ${delayMinutes} minute delay`,
                );

                // Log delay step
                await logExecution(supabase, {
                  tenant_id: tenantId,
                  automation_id: automation.id,
                  automation_run_id: run.id,
                  submission_id: submissionId,
                  customer_id: customerId,
                  status: "completed",
                  step_type: "delay",
                  step_index: i,
                  node_id: node.id,
                  metadata: { delay_minutes: delayMinutes },
                });

                continue; // Delay nodes don't create outbox entries themselves
              }

              const scheduledAt = new Date(
                Date.now() + cumulativeDelayMs,
              ).toISOString();

              if (nodeType === "send_email" || nodeType === "email") {
                const bypassState = await getTenantSuppressionBypassState(
                  supabase,
                  tenantId,
                );
                const bypassSuppressionTypes =
                  bypassState.suppression_bypass_active &&
                  bypassState.suppression_bypass_automation_mode ===
                    "campaign_and_automation"
                    ? ["bounced", "hard_bounce", "complaint", "complained"]
                    : [];

                // Check consent before queuing (read-only, no mutation)
                const consentCheck = await canSendEmail(
                  supabase,
                  {
                    tenantId,
                    customerId,
                    email: customerEmail,
                  },
                  {
                    bypassSuppressionTypes,
                  },
                );

                if (!consentCheck.allowed) {
                  console.log(
                    `⏭️ Skipping email for customer ${customerId}: ${consentCheck.reason}`,
                  );

                  // Log the skip in both tables for complete visibility
                  await Promise.all([
                    supabase.from("automation_email_executions").insert({
                      tenant_id: tenantId,
                      automation_id: automation.id,
                      automation_node_id: node.id,
                      customer_id: customerId,
                      email: customerEmail,
                      status: "skipped",
                      reason: consentCheck.reason,
                    }),
                    logExecution(supabase, {
                      tenant_id: tenantId,
                      automation_id: automation.id,
                      automation_run_id: run.id,
                      submission_id: submissionId,
                      customer_id: customerId,
                      status: "skipped",
                      step_type: "email",
                      step_index: i,
                      failure_reason: consentCheck.reason,
                      node_id: node.id,
                      recipient: customerEmail,
                    }),
                  ]);

                  stepsSkipped++;
                  continue;
                }

                // Queue email to outbox
                const { error: outboxError } = await supabase
                  .from("crm_outbox")
                  .insert({
                    tenant_id: tenantId,
                    automation_id: automation.id,
                    automation_run_id: run.id,
                    automation_node_id: node.id,
                    customer_id: customerId,
                    message_type: "email",
                    recipient: customerEmail,
                    subject:
                      node.data?.email_subject || "You have a new message",
                    content: node.data?.email_content || "",
                    template_data: {
                      customer,
                      form_submission: payload,
                      email_template_id: node.data?.email_template_id,
                    },
                    scheduled_at: scheduledAt,
                    status: "queued",
                    step_index: i,
                    priority: 10,
                  });

                if (outboxError) {
                  console.error(
                    `❌ Failed to queue email step ${i}:`,
                    outboxError,
                  );

                  await logExecution(supabase, {
                    tenant_id: tenantId,
                    automation_id: automation.id,
                    automation_run_id: run.id,
                    submission_id: submissionId,
                    customer_id: customerId,
                    status: "failed",
                    step_type: "email",
                    step_index: i,
                    failure_reason: "outbox_insert_failed",
                    error_details: { error: outboxError.message },
                    node_id: node.id,
                    recipient: customerEmail,
                  });

                  stepsFailed++;
                } else {
                  actionsQueued++;
                  stepsQueued++;
                  console.log(`📧 Queued email step ${i} for ${scheduledAt}`);

                  await logExecution(supabase, {
                    tenant_id: tenantId,
                    automation_id: automation.id,
                    automation_run_id: run.id,
                    submission_id: submissionId,
                    customer_id: customerId,
                    status: "queued",
                    step_type: "email",
                    step_index: i,
                    node_id: node.id,
                    recipient: customerEmail,
                    metadata: { scheduled_at: scheduledAt },
                  });
                }
              }

              if (nodeType === "notify_staff" || nodeType === "notification") {
                // Staff notifications don't require customer consent
                const notificationEmails = node.data?.notification_emails || [];

                for (const staffEmail of notificationEmails) {
                  const { error: outboxError } = await supabase
                    .from("crm_outbox")
                    .insert({
                      tenant_id: tenantId,
                      automation_id: automation.id,
                      automation_run_id: run.id,
                      automation_node_id: node.id,
                      customer_id: customerId,
                      message_type: "email",
                      recipient: staffEmail,
                      subject: `New form submission: ${payload?.form_id || "Unknown form"}`,
                      content:
                        node.data?.notification_message ||
                        buildStaffNotificationContent(payload, customer),
                      template_data: {
                        is_staff_notification: true,
                        customer,
                        form_submission: payload,
                      },
                      scheduled_at: scheduledAt,
                      status: "queued",
                      step_index: i,
                      priority: 5, // Higher priority for staff notifications
                    });

                  if (outboxError) {
                    console.error(
                      `❌ Failed to queue staff notification:`,
                      outboxError,
                    );

                    await logExecution(supabase, {
                      tenant_id: tenantId,
                      automation_id: automation.id,
                      automation_run_id: run.id,
                      submission_id: submissionId,
                      customer_id: customerId,
                      status: "failed",
                      step_type: "notification",
                      step_index: i,
                      failure_reason: "staff_notification_failed",
                      error_details: { error: outboxError.message },
                      node_id: node.id,
                      recipient: staffEmail,
                    });

                    stepsFailed++;
                  } else {
                    actionsQueued++;
                    stepsQueued++;
                    console.log(
                      `📨 Queued staff notification to ${staffEmail}`,
                    );

                    await logExecution(supabase, {
                      tenant_id: tenantId,
                      automation_id: automation.id,
                      automation_run_id: run.id,
                      submission_id: submissionId,
                      customer_id: customerId,
                      status: "queued",
                      step_type: "notification",
                      step_index: i,
                      node_id: node.id,
                      recipient: staffEmail,
                      metadata: { scheduled_at: scheduledAt },
                    });
                  }
                }
              }
            }

            // Determine final run status
            const finalStatus =
              stepsFailed > 0 && stepsQueued === 0
                ? "failed"
                : stepsQueued > 0
                  ? "running"
                  : "completed";

            // Update run with queued step count and status
            await supabase
              .from("automation_runs")
              .update({
                status: finalStatus,
                metadata: {
                  actions_queued: stepsQueued,
                  actions_skipped: stepsSkipped,
                  actions_failed: stepsFailed,
                },
                updated_at: new Date().toISOString(),
                ...(finalStatus === "completed" || finalStatus === "failed"
                  ? { completed_at: new Date().toISOString() }
                  : {}),
              })
              .eq("id", run.id);

            // Log final automation execution status
            await logExecution(supabase, {
              tenant_id: tenantId,
              automation_id: automation.id,
              automation_run_id: run.id,
              submission_id: submissionId,
              customer_id: customerId,
              status: finalStatus === "running" ? "queued" : finalStatus,
              metadata: {
                automation_name: automation.name,
                steps_queued: stepsQueued,
                steps_skipped: stepsSkipped,
                steps_failed: stepsFailed,
                total_steps: steps.length,
              },
            });
          } catch (automationError) {
            console.error(
              `❌ Error processing automation ${automation.id}:`,
              automationError,
            );

            await logExecution(supabase, {
              tenant_id: tenantId,
              automation_id: automation.id,
              submission_id: submissionId,
              customer_id: customerId || undefined,
              status: "failed",
              failure_reason: "automation_execution_error",
              error_details: {
                error:
                  automationError instanceof Error
                    ? automationError.message
                    : String(automationError),
              },
              trigger_event_id: event.id,
            });
          }
        }

        // Mark event as processed
        await markEventProcessed(supabase, event.id, null);
        processed++;
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);

        // Increment retry count instead of immediately marking as failed
        const currentRetryCount = event.retry_count || 0;

        if (currentRetryCount + 1 >= MAX_RETRIES) {
          // Max retries reached, mark as processed with error
          await markEventProcessed(
            supabase,
            event.id,
            `max_retries_exceeded: ${eventError}`,
          );

          await logExecution(supabase, {
            tenant_id: event.tenant_id,
            automation_id: "00000000-0000-0000-0000-000000000000",
            submission_id: event.submission_id || event.id,
            status: "failed",
            failure_reason: "max_retries_exceeded",
            error_details: {
              retry_count: currentRetryCount + 1,
              last_error:
                eventError instanceof Error
                  ? eventError.message
                  : String(eventError),
            },
            trigger_event_id: event.id,
          });
        } else {
          // Increment retry and schedule next attempt
          await incrementEventRetry(
            supabase,
            event.id,
            eventError instanceof Error
              ? eventError.message
              : String(eventError),
          );
        }

        processed++;
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ [FormSubmittedHandler] Complete: ${processed} events, ${runsCreated} runs, ${actionsQueued} actions, ${failed} failed in ${duration}ms`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        runs_created: runsCreated,
        actions_queued: actionsQueued,
        failed,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("💥 [FormSubmittedHandler] Fatal error:", error);
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

/**
 * Log an execution record to form_automation_executions table
 */
async function logExecution(
  supabase: ReturnType<typeof createClient>,
  log: ExecutionLog,
): Promise<void> {
  try {
    await supabase.from("form_automation_executions").insert({
      tenant_id: log.tenant_id,
      automation_id: log.automation_id,
      automation_run_id: log.automation_run_id || null,
      submission_id: log.submission_id,
      customer_id: log.customer_id || null,
      status: log.status,
      step_type: log.step_type || null,
      step_index: log.step_index ?? null,
      failure_reason: log.failure_reason || null,
      error_details: log.error_details || null,
      trigger_event_id: log.trigger_event_id || null,
      node_id: log.node_id || null,
      recipient: log.recipient || null,
      metadata: log.metadata || {},
      executed_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never fail the main process due to logging errors
    console.error("⚠️ Failed to log execution:", err);
  }
}

async function markEventProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  errorMessage: string | null,
): Promise<void> {
  await supabase
    .from("automation_trigger_events")
    .update({
      processed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", eventId);
}

/**
 * Increment retry count for an event that failed processing
 */
async function incrementEventRetry(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  errorMessage: string,
): Promise<void> {
  const { error: rpcError } = await supabase.rpc(
    "increment_trigger_event_retry",
    {
      p_event_id: eventId,
      p_error_message: errorMessage,
    },
  );

  if (!rpcError) {
    await supabase
      .from("automation_trigger_events")
      .update({ error_message: errorMessage })
      .eq("id", eventId);
    return;
  }

  console.warn(
    "RPC increment_trigger_event_retry not available, using direct update",
  );

  const { data: currentEvent } = await supabase
    .from("automation_trigger_events")
    .select("retry_count, metadata")
    .eq("id", eventId)
    .maybeSingle();

  const nextRetryCount =
    typeof currentEvent?.retry_count === "number"
      ? currentEvent.retry_count + 1
      : 1;
  const nextMetadata =
    currentEvent?.metadata && typeof currentEvent.metadata === "object"
      ? {
          ...(currentEvent.metadata as Record<string, unknown>),
          last_error: errorMessage,
        }
      : { last_error: errorMessage };

  await supabase
    .from("automation_trigger_events")
    .update({
      retry_count: nextRetryCount,
      last_error_at: new Date().toISOString(),
      error_message: errorMessage,
      metadata: nextMetadata,
    })
    .eq("id", eventId);
}

function buildStaffNotificationContent(
  payload: FormSubmittedPayload | null,
  customer: NotificationCustomerRecord | null,
): string {
  const customerName = customer
    ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email
    : "Unknown";

  return `
New form submission received:

Customer: ${customerName}
Email: ${customer?.email || "N/A"}
Form ID: ${payload?.form_id || "Unknown"}
Submitted: ${payload?.timestamp || new Date().toISOString()}

Email Consent: ${payload?.consent?.email_consent ? "Yes" : "No"}
SMS Consent: ${payload?.consent?.sms_consent ? "Yes" : "No"}

Source: ${payload?.page_url || "Direct"}
Referrer: ${payload?.referrer || "None"}
  `.trim();
}

async function queueFormSettingsNotifications(
  supabase: ReturnType<typeof createClient>,
  params: {
    customerId: string | null;
    eventId: string;
    formId: string;
    payload: FormSubmittedPayload;
    submissionId: string;
    tenantId: string;
  },
): Promise<FormNotificationResult> {
  try {
    const { data: formRecord, error: formError } = await supabase
      .from("forms")
      .select("id, name, settings_json")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.formId)
      .maybeSingle<FormNotificationFormRecord>();

    if (formError) {
      console.warn(
        "[process-form-submitted] Failed to load form notification settings:",
        formError.message,
      );
      return { queued: 0, failed: 0 };
    }

    if (!formRecord) {
      return { queued: 0, failed: 0 };
    }

    const settings =
      formRecord.settings_json && typeof formRecord.settings_json === "object"
        ? formRecord.settings_json
        : {};
    const notificationRecipients = normalizeNotificationRecipients(
      settings.notification_emails,
    );

    if (notificationRecipients.invalid.length > 0) {
      console.warn(
        "[process-form-submitted] Ignoring invalid form notification emails:",
        notificationRecipients.invalid,
      );
    }

    if (notificationRecipients.valid.length === 0) {
      return { queued: 0, failed: notificationRecipients.invalid.length };
    }

    if (!params.customerId) {
      console.warn(
        "[process-form-submitted] Skipping form notifications because customer_id is missing",
      );
      return {
        queued: 0,
        failed:
          notificationRecipients.valid.length +
          notificationRecipients.invalid.length,
      };
    }

    const [
      { data: submissionRecord, error: submissionError },
      { data: customerRecord, error: customerError },
    ] = await Promise.all([
      supabase
        .from("form_submissions")
        .select("id, data, metadata, submitted_at")
        .eq("tenant_id", params.tenantId)
        .eq("id", params.submissionId)
        .maybeSingle<FormNotificationSubmissionRecord>(),
      supabase
        .from("crm_customers")
        .select("first_name, last_name, email")
        .eq("id", params.customerId)
        .maybeSingle<NotificationCustomerRecord>(),
    ]);

    if (submissionError) {
      console.warn(
        "[process-form-submitted] Failed to load submission details for form notification:",
        submissionError.message,
      );
    }

    if (customerError) {
      console.warn(
        "[process-form-submitted] Failed to load customer details for form notification:",
        customerError.message,
      );
    }

    const subject = buildFormSettingsNotificationSubject(
      formRecord.name,
      settings.form_title,
    );
    const content = buildFormSettingsNotificationContent({
      customer: customerRecord || null,
      formName: formRecord.name,
      formTitle: settings.form_title,
      payload: params.payload,
      submission: submissionRecord || null,
    });

    const { error: outboxError } = await supabase.from("crm_outbox").insert(
      notificationRecipients.valid.map((recipient) => ({
        tenant_id: params.tenantId,
        customer_id: params.customerId,
        message_type: "email",
        recipient,
        subject,
        content,
        template_data: {
          customer: customerRecord || null,
          form_id: params.formId,
          form_name: formRecord.name,
          is_form_notification: true,
          notification_source: "form_settings",
          submission_data: submissionRecord?.data || null,
          submission_id: params.submissionId,
          submission_metadata: submissionRecord?.metadata || null,
          submitted_at:
            submissionRecord?.submitted_at || params.payload.timestamp || null,
        },
        status: "queued",
        priority: 5,
      })),
    );

    if (outboxError) {
      console.warn(
        "[process-form-submitted] Failed to queue form notification emails:",
        outboxError.message,
      );

      await logExecution(supabase, {
        tenant_id: params.tenantId,
        automation_id: "00000000-0000-0000-0000-000000000000",
        submission_id: params.submissionId,
        customer_id: params.customerId || undefined,
        status: "failed",
        step_type: "notification",
        failure_reason: "form_notification_outbox_failed",
        error_details: { error: outboxError.message },
        trigger_event_id: params.eventId,
        metadata: {
          form_id: params.formId,
          invalid_recipient_count: notificationRecipients.invalid.length,
          recipient_count: notificationRecipients.valid.length,
          source: "form_settings",
        },
      });

      return {
        queued: 0,
        failed:
          notificationRecipients.valid.length +
          notificationRecipients.invalid.length,
      };
    }

    if (notificationRecipients.valid.length > 0) {
      console.log(
        `📨 Queued ${notificationRecipients.valid.length} form notification emails for form ${params.formId}`,
      );
    }

    return {
      queued: notificationRecipients.valid.length,
      failed: notificationRecipients.invalid.length,
    };
  } catch (error) {
    console.warn(
      "[process-form-submitted] Unexpected form notification error:",
      error instanceof Error ? error.message : String(error),
    );
    return { queued: 0, failed: 0 };
  }
}

function normalizeNotificationRecipients(notificationEmails: unknown): {
  invalid: string[];
  valid: string[];
} {
  if (!Array.isArray(notificationEmails)) {
    return { invalid: [], valid: [] };
  }

  const seen = new Set<string>();
  const invalid: string[] = [];
  const valid: string[] = [];

  for (const rawEmail of notificationEmails) {
    if (typeof rawEmail !== "string") {
      continue;
    }

    const email = rawEmail.trim();

    if (!email || seen.has(email)) {
      continue;
    }

    seen.add(email);

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }

  return { invalid, valid };
}

function buildFormSettingsNotificationSubject(
  formName: string,
  formTitle: string | undefined,
): string {
  const displayName =
    normalizeText(formTitle) || normalizeText(formName) || "Unknown form";
  return `New form submission: ${displayName}`;
}

function buildFormSettingsNotificationContent(params: {
  customer: NotificationCustomerRecord | null;
  formName: string;
  formTitle: string | undefined;
  payload: FormSubmittedPayload;
  submission: FormNotificationSubmissionRecord | null;
}): string {
  const submissionMetadata = params.submission?.metadata || null;
  const displayFormName =
    normalizeText(params.formTitle) ||
    normalizeText(params.formName) ||
    params.payload.form_id ||
    "Unknown form";
  const submittedAt =
    params.submission?.submitted_at ||
    params.payload.timestamp ||
    new Date().toISOString();
  const pageUrl =
    readMetadataText(submissionMetadata, "page_url") ||
    normalizeText(params.payload.page_url) ||
    "Direct";
  const referrer =
    readMetadataText(submissionMetadata, "referrer") ||
    normalizeText(params.payload.referrer) ||
    "None";
  const customerName = params.customer
    ? `${params.customer.first_name || ""} ${params.customer.last_name || ""}`.trim() ||
      params.customer.email ||
      "Unknown"
    : "Unknown";
  const submittedData = params.submission?.data || {};
  const fieldRows = Object.entries(submittedData)
    .filter(([key]) => !isSystemSubmissionField(key))
    .map(([key, value]) => {
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; vertical-align: top; width: 35%;">${escapeHtml(formatSubmissionFieldLabel(key))}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(formatSubmissionFieldValue(value))}</td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">New form submission received</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; width: 160px;">Form</td>
          <td style="padding: 8px 0;">${escapeHtml(displayFormName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Submitted</td>
          <td style="padding: 8px 0;">${escapeHtml(submittedAt)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Customer</td>
          <td style="padding: 8px 0;">${escapeHtml(customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Email</td>
          <td style="padding: 8px 0;">${escapeHtml(params.customer?.email || "N/A")}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Email Consent</td>
          <td style="padding: 8px 0;">${params.payload.consent?.email_consent ? "Yes" : "No"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">SMS Consent</td>
          <td style="padding: 8px 0;">${params.payload.consent?.sms_consent ? "Yes" : "No"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Page URL</td>
          <td style="padding: 8px 0;">${escapeHtml(pageUrl)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Referrer</td>
          <td style="padding: 8px 0;">${escapeHtml(referrer)}</td>
        </tr>
      </table>
      <h3 style="margin: 0 0 12px; font-size: 16px;">Submitted fields</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        ${fieldRows || '<tr><td style="padding: 12px;">No submission fields were captured.</td></tr>'}
      </table>
    </div>
  `.trim();
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMetadataText(
  metadata: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!metadata) {
    return null;
  }

  return normalizeText(metadata[key]);
}

function isSystemSubmissionField(key: string): boolean {
  return ["_blank", "_honeypot", "_hp", "honeypot", "hp_field"].includes(key);
}

function formatSubmissionFieldLabel(key: string): string {
  const normalized = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatSubmissionFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => formatSubmissionFieldValue(item));
    return items.length > 0 ? items.join(", ") : "Not provided";
  }

  if (typeof value === "object") {
    try {
      return truncateText(JSON.stringify(value));
    } catch {
      return "[Object]";
    }
  }

  return truncateText(String(value));
}

function truncateText(value: string, maxLength = 500): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

serve(handler);
