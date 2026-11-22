/** Loyalty welcomes require a durable membership event, never contact-age polling. */
export function isLoyaltyEnrollmentTrigger(triggerType: unknown): boolean {
  return triggerType === "loyalty_join" || triggerType === "loyalty.signup";
}

export interface LoyaltyEventLease {
  eventId: string;
  workerId: string;
}

interface AutomationOutboxClient {
  from(table: "crm_outbox"): {
    insert(value: Record<string, unknown>): PromiseLike<{ error: unknown }>;
  };
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

// A loyalty event always reuses its original run-step message, including after
// a crash. SQL checks the current event lease and derives scope from the run.
export async function writeAutomationOutbox(
  supabase: AutomationOutboxClient,
  payload: Record<string, unknown>,
  lease?: LoyaltyEventLease,
): Promise<void> {
  if (!lease) {
    const { error } = await supabase.from("crm_outbox").insert(payload);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.rpc("enqueue_loyalty_automation_step", {
    p_event_id: lease.eventId,
    p_worker_id: lease.workerId,
    p_run_id: payload.automation_run_id,
    p_step_index: payload.step_index,
    p_message: {
      message_type: payload.message_type,
      recipient: payload.recipient ?? "",
      content: payload.content ?? "",
      subject: payload.subject ?? null,
      template_data: payload.template_data ?? {},
      scheduled_at: payload.scheduled_at,
      status: payload.status,
      skip_reason: payload.skip_reason ?? null,
      priority: payload.priority,
      automation_node_id: payload.automation_node_id,
    },
  });
  if (error) throw error;
}
