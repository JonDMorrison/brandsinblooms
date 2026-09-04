import { matchesAutomationTriggerConditions } from "./triggerConditions.ts";

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

export async function fireAutomationTriggers(
  supabase: any,
  tenantId: string,
  customerId: string,
  triggerTypes: string[],
  eventData: Record<string, any>,
) {
  const { data: automations } = await supabase
    .from("crm_automations")
    .select("id,name,trigger_type,trigger_conditions,persona_targeting")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("trigger_type", triggerTypes);

  if (!automations?.length) {
    return;
  }

  const { data: customer } = await supabase
    .from("crm_customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .single();

  if (!customer) {
    return;
  }

  for (const automation of automations) {
    if (!checkPersonaTargeting(customer, automation.persona_targeting)) {
      continue;
    }
    if (
      !matchesAutomationTriggerConditions(
        automation.trigger_conditions,
        eventData,
      )
    ) {
      continue;
    }

    const providerEventId =
      eventData.event_id ||
      eventData.refund_id ||
      eventData.order_id ||
      eventData.original_order_id ||
      eventData.loyalty_account_id;
    if (!providerEventId) {
      throw new Error(
        `Automation ${automation.name} is missing a stable provider event id`,
      );
    }
    const source = String(
      eventData.pos_source || eventData.shop_domain || "webhook",
    );
    const sourceEventKey = [
      source,
      automation.trigger_type,
      String(providerEventId),
      String(eventData.fulfillment_state || ""),
    ].join(":");
    const { error } = await supabase.from("automation_trigger_events").upsert(
      {
        automation_id: automation.id,
        customer_id: customerId,
        tenant_id: tenantId,
        event_type: automation.trigger_type,
        source_event_key: sourceEventKey,
        metadata: { source: "provider_webhook", provider_event: eventData },
      },
      {
        onConflict: "tenant_id,automation_id,source_event_key",
        ignoreDuplicates: true,
      },
    );
    if (error) {
      throw new Error(
        `Failed to queue automation ${automation.name}: ${error.message}`,
      );
    }
  }
}
