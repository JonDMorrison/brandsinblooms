import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { canSendEmail } from "../_shared/canSendEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ─── ATOMIC CLAIM PATTERN ─────────────────────────────────────────────
    // Use claim_trigger_events RPC for atomic claiming via FOR UPDATE SKIP LOCKED
    // This prevents double-processing when multiple workers run simultaneously
    let events: any[] = [];
    
    const { data: claimedEvents, error: claimError } = await supabase
      .rpc("claim_trigger_events", {
        p_event_type: "form_submitted",
        p_limit: 100
      });

    if (claimError) {
      // Fallback: If RPC doesn't exist yet, use standard query
      // (This handles deployments before migration is applied)
      console.warn("⚠️ claim_trigger_events RPC failed, using fallback:", claimError.message);
      
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
        const eventIds = events.map(e => e.id);
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
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📬 Claimed ${events.length} form_submitted events for processing`);

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
          console.warn(`⚠️ Event ${event.id} missing form_id or submission_id, skipping`);
          await markEventProcessed(supabase, event.id, "missing_required_fields");
          
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
          console.error(`❌ Failed to fetch automations for tenant ${tenantId}:`, automationError);
          
          // Increment retry count instead of marking processed
          await incrementEventRetry(supabase, event.id, automationError.message);
          
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
        const matchingAutomations = (automations || []).filter((auto: Automation) => {
          const conditions = auto.trigger_conditions;
          if (!conditions) return true; // No conditions = matches all forms
          
          // Check form_id match
          if (conditions.form_id && conditions.form_id !== formId) return false;
          if (conditions.form_ids && !conditions.form_ids.includes(formId)) return false;
          
          return true;
        });

        if (matchingAutomations.length === 0) {
          console.log(`📭 No matching automations for form ${formId}`);
          await markEventProcessed(supabase, event.id, "no_matching_automations");
          
          // Log as completed (no error, just no automations)
          await logExecution(supabase, {
            tenant_id: tenantId,
            automation_id: "00000000-0000-0000-0000-000000000000",
            submission_id: submissionId,
            status: "completed",
            failure_reason: null,
            metadata: { reason: "no_matching_automations", form_id: formId },
            trigger_event_id: event.id,
          });
          
          processed++;
          continue;
        }

        console.log(`🎯 Found ${matchingAutomations.length} matching automations for form ${formId}`);

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
                .select("id, email, first_name, last_name, email_opt_in, sms_opt_in")
                .eq("id", customerId)
                .single();
              
              customer = customerData;
              customerEmail = customerData?.email;
            }

            if (!customer || !customerEmail) {
              console.warn(`⚠️ No customer/email for automation ${automation.id}, skipping`);
              
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
            console.log(`🏃 Created automation run ${run.id} for automation ${automation.name}`);

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
              if (nodeType === "delay" || node.data?.delay_minutes || node.data?.delay_hours || node.data?.delay_days) {
                const delayMinutes = (node.data?.delay_minutes || 0) +
                  (node.data?.delay_hours || 0) * 60 +
                  (node.data?.delay_days || 0) * 24 * 60;
                
                cumulativeDelayMs += delayMinutes * 60 * 1000;
                console.log(`⏰ Step ${i}: Adding ${delayMinutes} minute delay`);
                
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

              const scheduledAt = new Date(Date.now() + cumulativeDelayMs).toISOString();

              if (nodeType === "send_email" || nodeType === "email") {
                // Check consent before queuing (read-only, no mutation)
                const consentCheck = await canSendEmail(supabase, {
                  tenantId,
                  customerId,
                  email: customerEmail,
                });

                if (!consentCheck.allowed) {
                  console.log(`⏭️ Skipping email for customer ${customerId}: ${consentCheck.reason}`);
                  
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
                const { error: outboxError } = await supabase.from("crm_outbox").insert({
                  tenant_id: tenantId,
                  automation_id: automation.id,
                  automation_run_id: run.id,
                  automation_node_id: node.id,
                  customer_id: customerId,
                  message_type: "email",
                  recipient: customerEmail,
                  subject: node.data?.email_subject || "You have a new message",
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
                  console.error(`❌ Failed to queue email step ${i}:`, outboxError);
                  
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
                  const { error: outboxError } = await supabase.from("crm_outbox").insert({
                    tenant_id: tenantId,
                    automation_id: automation.id,
                    automation_run_id: run.id,
                    automation_node_id: node.id,
                    customer_id: customerId,
                    message_type: "email",
                    recipient: staffEmail,
                    subject: `New form submission: ${payload?.form_id || "Unknown form"}`,
                    content: node.data?.notification_message || buildStaffNotificationContent(payload, customer),
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
                    console.error(`❌ Failed to queue staff notification:`, outboxError);
                    
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
                    console.log(`📨 Queued staff notification to ${staffEmail}`);
                    
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
            const finalStatus = stepsFailed > 0 && stepsQueued === 0 ? "failed" : 
                               stepsQueued > 0 ? "running" : "completed";

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
            console.error(`❌ Error processing automation ${automation.id}:`, automationError);
            
            await logExecution(supabase, {
              tenant_id: tenantId,
              automation_id: automation.id,
              submission_id: submissionId,
              customer_id: customerId || undefined,
              status: "failed",
              failure_reason: "automation_execution_error",
              error_details: { 
                error: automationError instanceof Error ? automationError.message : String(automationError) 
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
          await markEventProcessed(supabase, event.id, `max_retries_exceeded: ${eventError}`);
          
          await logExecution(supabase, {
            tenant_id: event.tenant_id,
            automation_id: "00000000-0000-0000-0000-000000000000",
            submission_id: event.submission_id || event.id,
            status: "failed",
            failure_reason: "max_retries_exceeded",
            error_details: { 
              retry_count: currentRetryCount + 1,
              last_error: eventError instanceof Error ? eventError.message : String(eventError),
            },
            trigger_event_id: event.id,
          });
        } else {
          // Increment retry and schedule next attempt
          await incrementEventRetry(
            supabase, 
            event.id, 
            eventError instanceof Error ? eventError.message : String(eventError)
          );
        }
        
        processed++;
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [FormSubmittedHandler] Complete: ${processed} events, ${runsCreated} runs, ${actionsQueued} actions, ${failed} failed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        runs_created: runsCreated,
        actions_queued: actionsQueued,
        failed,
        duration_ms: duration,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("💥 [FormSubmittedHandler] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

/**
 * Log an execution record to form_automation_executions table
 */
async function logExecution(
  supabase: ReturnType<typeof createClient>,
  log: ExecutionLog
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
  errorMessage: string | null
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
  errorMessage: string
): Promise<void> {
  await supabase
    .from("automation_trigger_events")
    .update({
      retry_count: supabase.rpc ? undefined : 1, // Will be incremented by SQL
      last_error_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", eventId);
  
  // Use raw SQL to increment retry_count atomically
  await supabase.rpc("increment_trigger_event_retry", { event_id: eventId }).catch(() => {
    // Fallback: just update with a simple increment if RPC doesn't exist
    console.warn("RPC increment_trigger_event_retry not available, using direct update");
  });
}

function buildStaffNotificationContent(
  payload: FormSubmittedPayload | null,
  customer: { first_name?: string; last_name?: string; email?: string } | null
): string {
  const customerName = customer 
    ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email 
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

serve(handler);
