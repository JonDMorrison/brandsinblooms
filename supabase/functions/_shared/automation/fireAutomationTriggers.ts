type WorkflowStep = {
  id?: string;
  node_id?: string;
  type?: "email" | "sms";
  delayMin?: number;
  subject?: string;
  text?: string;
};

function checkPersonaTargeting(customer: any, personaTargeting: any): boolean {
  if (!personaTargeting || Object.keys(personaTargeting).length === 0) {
    return true;
  }

  if (
    personaTargeting.persona_ids?.length > 0 &&
    (!customer.persona_id ||
      !personaTargeting.persona_ids.includes(customer.persona_id))
  ) {
    return false;
  }

  if (
    personaTargeting.required_tags?.length > 0 &&
    !personaTargeting.required_tags.every((tag: string) =>
      (customer.tags || []).includes(tag),
    )
  ) {
    return false;
  }

  if (
    personaTargeting.min_lifetime_value != null &&
    (customer.lifetime_value || 0) < personaTargeting.min_lifetime_value
  ) {
    return false;
  }

  return true;
}

function personalizeMessage(
  template: string,
  customer: any,
  eventData: Record<string, any>,
) {
  const replacements: Record<string, string> = {
    "{{first_name}}": customer.first_name || "there",
    "{{last_name}}": customer.last_name || "",
    "{{email}}": customer.email || "",
    "{{order_amount}}": eventData.order_amount
      ? `$${Number(eventData.order_amount).toFixed(2)}`
      : "",
    "{{order_id}}": eventData.order_id || "",
    "{{refund_amount}}": eventData.refund_amount
      ? `$${Number(eventData.refund_amount).toFixed(2)}`
      : "",
    "{{refund_reason}}": eventData.refund_reason || "",
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(
      new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      value,
    );
  }

  return result;
}

export async function fireAutomationTriggers(
  supabase: any,
  tenantId: string,
  customerId: string,
  triggerTypes: string[],
  eventData: Record<string, any>,
) {
  const { data: automations } = await supabase
    .from("crm_automations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("trigger_type", triggerTypes);

  if (!automations?.length) {
    return;
  }

  const { data: customer } = await supabase
    .from("crm_customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (!customer) {
    return;
  }

  for (const automation of automations) {
    if (!checkPersonaTargeting(customer, automation.persona_targeting)) {
      continue;
    }

    const { data: activeRun } = await supabase
      .from("automation_runs")
      .select("id")
      .eq("automation_id", automation.id)
      .eq("customer_id", customerId)
      .in("status", ["active", "paused"])
      .limit(1)
      .maybeSingle();

    if (activeRun) {
      continue;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentRun } = await supabase
      .from("automation_runs")
      .select("id")
      .eq("automation_id", automation.id)
      .eq("customer_id", customerId)
      .eq("status", "completed")
      .gte("completed_at", oneDayAgo)
      .limit(1)
      .maybeSingle();

    if (recentRun) {
      continue;
    }

    const workflowSteps: WorkflowStep[] = automation.workflow_steps || [];
    if (!workflowSteps.length) {
      continue;
    }

    const { data: maxSequenceRow } = await supabase
      .from("automation_runs")
      .select("run_sequence")
      .eq("automation_id", automation.id)
      .eq("customer_id", customerId)
      .order("run_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRunSequence = (maxSequenceRow?.run_sequence || 0) + 1;
    const { data: runData, error: runError } = await supabase
      .from("automation_runs")
      .insert({
        automation_id: automation.id,
        customer_id: customerId,
        tenant_id: tenantId,
        status: "active",
        current_step_index: 0,
        total_steps: workflowSteps.length,
        run_sequence: nextRunSequence,
        trigger_data: {
          trigger_type: automation.trigger_type,
          triggered_at: new Date().toISOString(),
          customer_email: customer.email,
          source: "webhook",
        },
        metadata: {
          automation_name: automation.name,
          overlap_behavior: automation.overlap_behavior || "ignore",
        },
      })
      .select("id")
      .single();

    if (runError) {
      console.error(
        "[Shopify Webhook] Failed to create automation run:",
        runError,
      );
      continue;
    }

    const runId = runData.id;
    const baseTime = new Date();
    let queued = 0;
    let skipped = 0;

    for (let index = 0; index < workflowSteps.length; index += 1) {
      const step = workflowSteps[index];
      const messageType = step.type || "email";
      const scheduledAt = new Date(
        baseTime.getTime() + (step.delayMin || 0) * 60 * 1000,
      );

      if (messageType === "sms" && customer.sms_opt_in !== true) {
        skipped += 1;
        continue;
      }

      const recipient = messageType === "sms" ? customer.phone : customer.email;
      if (!recipient) {
        skipped += 1;
        continue;
      }

      await supabase.from("crm_outbox").insert({
        tenant_id: tenantId,
        automation_id: automation.id,
        automation_run_id: runId,
        customer_id: customerId,
        automation_node_id: step.id || step.node_id || `step-${index}`,
        message_type: messageType,
        recipient,
        content: personalizeMessage(step.text || "", customer, eventData),
        subject: step.subject
          ? personalizeMessage(step.subject, customer, eventData)
          : undefined,
        template_data: {
          automation_name: automation.name,
          step_index: index,
          customer_data: customer,
          event_data: eventData,
          trigger_type: automation.trigger_type,
        },
        scheduled_at: scheduledAt.toISOString(),
        status: "queued",
      });

      await supabase.from("crm_automation_logs").insert({
        automation_id: automation.id,
        customer_id: customerId,
        step_index: index,
        message_type: messageType,
        status: "queued",
        scheduled_at: scheduledAt.toISOString(),
      });

      queued += 1;
    }

    await supabase.from("automation_events").insert({
      automation_id: automation.id,
      customer_id: customerId,
      event_type: "triggered",
      metadata: {
        trigger_types: triggerTypes,
        event_data: eventData,
        steps_scheduled: queued,
        steps_skipped: skipped,
        automation_run_id: runId,
      },
    });
  }
}
