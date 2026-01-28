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
 */

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

    // 1. Fetch unprocessed form_submitted events
    const { data: events, error: eventsError } = await supabase
      .from("automation_trigger_events")
      .select("*")
      .eq("event_type", "form_submitted")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (eventsError) {
      console.error("❌ Failed to fetch trigger events:", eventsError);
      throw eventsError;
    }

    if (!events || events.length === 0) {
      console.log("📭 No pending form_submitted events");
      return new Response(
        JSON.stringify({ success: true, processed: 0, runs_created: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📬 Found ${events.length} pending form_submitted events`);

    let processed = 0;
    let runsCreated = 0;
    let actionsQueued = 0;

    for (const event of events) {
      try {
        const payload = event.metadata as FormSubmittedPayload;
        const tenantId = event.tenant_id;
        const formId = event.form_id || payload?.form_id;
        const customerId = event.customer_id || payload?.customer_id;

        if (!formId) {
          console.warn(`⚠️ Event ${event.id} missing form_id, skipping`);
          await markEventProcessed(supabase, event.id, "missing_form_id");
          processed++;
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
          await markEventProcessed(supabase, event.id, `error: ${automationError.message}`);
          processed++;
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
          processed++;
          continue;
        }

        console.log(`🎯 Found ${matchingAutomations.length} matching automations for form ${formId}`);

        // 3. Create automation runs and queue actions
        for (const automation of matchingAutomations as Automation[]) {
          try {
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
              continue;
            }

            runsCreated++;
            console.log(`🏃 Created automation run ${run.id} for automation ${automation.name}`);

            // 4. Queue workflow steps with proper scheduling
            const steps = automation.workflow_steps || [];
            let cumulativeDelayMs = 0;

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
                  
                  // Log the skip but continue with other steps
                  await supabase.from("automation_email_executions").insert({
                    tenant_id: tenantId,
                    automation_id: automation.id,
                    automation_node_id: node.id,
                    customer_id: customerId,
                    email: customerEmail,
                    status: "skipped",
                    reason: consentCheck.reason,
                  });
                  
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
                } else {
                  actionsQueued++;
                  console.log(`📧 Queued email step ${i} for ${scheduledAt}`);
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
                  } else {
                    actionsQueued++;
                    console.log(`📨 Queued staff notification to ${staffEmail}`);
                  }
                }
              }
            }

            // Update run with queued step count
            await supabase
              .from("automation_runs")
              .update({ 
                metadata: { actions_queued: actionsQueued },
                updated_at: new Date().toISOString(),
              })
              .eq("id", run.id);

          } catch (automationError) {
            console.error(`❌ Error processing automation ${automation.id}:`, automationError);
          }
        }

        // Mark event as processed
        await markEventProcessed(supabase, event.id, null);
        processed++;

      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
        await markEventProcessed(supabase, event.id, `error: ${eventError}`);
        processed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [FormSubmittedHandler] Complete: ${processed} events, ${runsCreated} runs, ${actionsQueued} actions in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        runs_created: runsCreated,
        actions_queued: actionsQueued,
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
