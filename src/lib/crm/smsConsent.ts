import { supabase } from "@/integrations/supabase/client";

export type SMSConsentStatus = "unknown" | "opted_in" | "opted_out";

export type SMSConsentEventType =
  | "opt_in"
  | "opt_out"
  | "keyword_start"
  | "keyword_stop"
  | "imported_unknown"
  | "updated_by_admin";

export interface SMSConsentEvent {
  id: string;
  tenant_id: string;
  customer_id: string;
  phone: string;
  event_type: SMSConsentEventType;
  source: string;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
}

/**
 * Get the SMS consent status from a customer's sms_opt_in value
 */
export function getSMSConsentStatus(customer: {
  sms_opt_in: boolean | null;
}): SMSConsentStatus {
  if (customer.sms_opt_in === true) return "opted_in";
  if (customer.sms_opt_in === false) return "opted_out";
  return "unknown";
}

/**
 * Get human-readable label for SMS consent status
 */
export function getSMSConsentStatusLabel(status: SMSConsentStatus): string {
  switch (status) {
    case "opted_in":
      return "Opted In";
    case "opted_out":
      return "Opted Out";
    case "unknown":
      return "Unknown";
  }
}

/**
 * Get badge color variant for SMS consent status
 */
export function getSMSConsentStatusColor(
  status: SMSConsentStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "opted_in":
      return "default";
    case "opted_out":
      return "destructive";
    case "unknown":
      return "secondary";
  }
}

/**
 * Record an SMS consent event in the audit log
 */
export async function recordSMSConsentEvent(params: {
  tenantId: string;
  customerId: string;
  phone: string;
  eventType: SMSConsentEventType;
  source: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("crm_sms_consent_events").insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      phone: params.phone,
      event_type: params.eventType,
      source: params.source,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });

    if (error) {
      console.error("Failed to record SMS consent event:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Error recording SMS consent event:", err);
    return { success: false, error: "Failed to record SMS consent event" };
  }
}

/**
 * Update a customer's SMS consent status and record the event
 */
export async function updateCustomerSMSConsent(params: {
  tenantId: string;
  customerId: string;
  phone: string;
  optIn: boolean;
  source: string;
  consentBasis?: "express" | "implied";
  evidence?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (
      params.optIn &&
      (!params.consentBasis || (params.evidence?.trim().length ?? 0) < 10)
    ) {
      return {
        success: false,
        error:
          "Opt-in requires a lawful basis and at least 10 characters of evidence",
      };
    }

    const source =
      params.source === "admin_panel" ? "admin_correction" : params.source;
    const { error } = await supabase.rpc(
      "set_customer_marketing_consent_authorized",
      {
        p_customer_id: params.customerId,
        p_channel: "sms",
        p_opt_in: params.optIn,
        p_source: source,
        p_consent_basis: params.optIn ? params.consentBasis : null,
        p_evidence: params.evidence?.trim() || null,
        p_ip_address: params.ipAddress ?? null,
        p_user_agent: params.userAgent ?? null,
      },
    );
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    console.error("Error updating customer SMS consent:", err);
    return { success: false, error: "Failed to update SMS consent" };
  }
}

/**
 * Get SMS consent history for a customer
 */
export async function getCustomerSMSConsentHistory(
  customerId: string,
): Promise<SMSConsentEvent[]> {
  try {
    const { data, error } = await supabase
      .from("crm_sms_consent_events")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to get SMS consent history:", error);
      return [];
    }

    return (data || []) as SMSConsentEvent[];
  } catch (err) {
    console.error("Error getting SMS consent history:", err);
    return [];
  }
}
