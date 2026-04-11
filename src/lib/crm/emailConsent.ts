import { supabase } from "@/integrations/supabase/client";

export type EmailConsentStatus = "unknown" | "opted_in" | "opted_out";

export type ConsentEventType =
  | "opt_in"
  | "opt_out"
  | "opt_in_request_sent"
  | "imported_unknown"
  | "updated_by_admin";

export interface ConsentEvent {
  id: string;
  tenant_id: string;
  customer_id: string;
  email: string;
  event_type: ConsentEventType;
  source: string;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface ConsentStats {
  total_customers: number;
  opted_in_count: number;
  opted_out_count: number;
  unknown_count: number;
}

/**
 * Get the consent status from a customer's email_opt_in value
 */
export function getEmailConsentStatus(customer: {
  email_opt_in: boolean | null;
}): EmailConsentStatus {
  if (customer.email_opt_in === true) return "opted_in";
  if (customer.email_opt_in === false) return "opted_out";
  return "unknown";
}

/**
 * Get human-readable label for consent status
 */
export function getConsentStatusLabel(status: EmailConsentStatus): string {
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
 * Get badge color variant for consent status
 */
export function getConsentStatusColor(
  status: EmailConsentStatus,
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
 * Record an email consent event in the audit log
 */
export async function recordEmailConsentEvent(params: {
  tenantId: string;
  customerId: string;
  email: string;
  eventType: ConsentEventType;
  source: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("crm_email_consent_events").insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      email: params.email,
      event_type: params.eventType,
      source: params.source,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });

    if (error) {
      console.error("Failed to record consent event:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Error recording consent event:", err);
    return { success: false, error: "Failed to record consent event" };
  }
}

/**
 * Update a customer's consent status and record the event
 */
// FIX: [issue #50] - TODO: Wrap consent update in a database transaction (RPC) to ensure atomicity
// Currently: suppression_list update, customer update, and consent event recording are separate calls
export async function updateCustomerConsent(params: {
  tenantId: string;
  customerId: string;
  email: string;
  optIn: boolean;
  source: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = String(params.email || "")
      .toLowerCase()
      .trim();

    // Canonical suppression_list maintenance (single source of truth for blocking)
    if (normalizedEmail) {
      if (params.optIn) {
        const { error: liftError } = await supabase
          .from("suppression_list")
          .update({
            lifted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", params.tenantId)
          .eq("email", normalizedEmail)
          .eq("channel", "email")
          .eq("suppression_type", "unsubscribed")
          .is("lifted_at", null);

        if (liftError) {
        }
      } else {
        const { error: suppressError } = await supabase
          .from("suppression_list")
          .upsert(
            {
              tenant_id: params.tenantId,
              customer_id: params.customerId,
              email: normalizedEmail,
              suppression_type: "unsubscribed",
              channel: "email",
              reason: "admin_opt_out",
              auto_suppressed: false,
              suppressed_at: new Date().toISOString(),
              lifted_at: null,
            },
            {
              onConflict: "tenant_id,email,channel,suppression_type",
              ignoreDuplicates: false,
            },
          );

        if (suppressError) {
        }
      }
    }

    // Update the customer record
    const { error: updateError } = await supabase
      .from("crm_customers")
      .update({
        email_opt_in: params.optIn,
        email_opt_in_at: params.optIn ? new Date().toISOString() : null,
        email_consent_source: params.source,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.customerId);

    if (updateError) {
      console.error("Failed to update customer consent:", updateError);
      return { success: false, error: updateError.message };
    }

    // Record the consent event
    await recordEmailConsentEvent({
      tenantId: params.tenantId,
      customerId: params.customerId,
      email: params.email,
      eventType: params.optIn ? "opt_in" : "opt_out",
      source: params.source,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { success: true };
  } catch (err) {
    console.error("Error updating customer consent:", err);
    return { success: false, error: "Failed to update consent" };
  }
}

/**
 * Get consent statistics for a tenant
 */
export async function getConsentStats(
  tenantId: string,
): Promise<ConsentStats | null> {
  try {
    const { data, error } = await supabase.rpc("get_email_consent_stats", {
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error("Failed to get consent stats:", error);
      return null;
    }

    if (data && data.length > 0) {
      return {
        total_customers: Number(data[0].total_customers) || 0,
        opted_in_count: Number(data[0].opted_in_count) || 0,
        opted_out_count: Number(data[0].opted_out_count) || 0,
        unknown_count: Number(data[0].unknown_count) || 0,
      };
    }

    return {
      total_customers: 0,
      opted_in_count: 0,
      opted_out_count: 0,
      unknown_count: 0,
    };
  } catch (err) {
    console.error("Error getting consent stats:", err);
    return null;
  }
}

/**
 * Get customers with unknown consent status
 */
export async function getUnknownConsentCustomers(
  tenantId: string,
  limit = 500,
): Promise<
  Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  }>
> {
  try {
    const { data, error } = await supabase
      .from("crm_customers")
      .select("id, email, first_name, last_name")
      .eq("tenant_id", tenantId)
      .is("email_opt_in", null)
      .not("email", "is", null)
      .limit(limit);

    if (error) {
      console.error("Failed to get unknown consent customers:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error getting unknown consent customers:", err);
    return [];
  }
}

/**
 * Get consent history for a customer
 */
export async function getCustomerConsentHistory(
  customerId: string,
): Promise<ConsentEvent[]> {
  try {
    const { data, error } = await supabase
      .from("crm_email_consent_events")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to get consent history:", error);
      return [];
    }

    return (data || []) as ConsentEvent[];
  } catch (err) {
    console.error("Error getting consent history:", err);
    return [];
  }
}

/**
 * Generate a secure preference token for a customer
 */
export async function generatePreferenceToken(params: {
  tenantId: string;
  customerId: string;
  email: string;
  purpose?: string;
  expiresInDays?: number;
}): Promise<{ token: string | null; error?: string }> {
  try {
    // Generate a secure random token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays || 30));

    const { error } = await supabase
      .from("crm_email_preference_tokens")
      .insert({
        tenant_id: params.tenantId,
        customer_id: params.customerId,
        email: params.email,
        token,
        purpose: params.purpose || "opt_in_request",
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      console.error("Failed to generate preference token:", error);
      return { token: null, error: error.message };
    }

    return { token };
  } catch (err) {
    console.error("Error generating preference token:", err);
    return { token: null, error: "Failed to generate token" };
  }
}

/**
 * Validate a preference token and get associated data
 */
export async function validatePreferenceToken(token: string): Promise<{
  valid: boolean;
  data?: {
    id: string;
    tenant_id: string;
    customer_id: string;
    email: string;
    purpose: string;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("crm_email_preference_tokens")
      .select("id, tenant_id, customer_id, email, purpose, expires_at")
      .eq("token", token)
      .single();

    if (error || !data) {
      return { valid: false, error: "Token not found" };
    }

    // Check expiration
    if (new Date(data.expires_at) < new Date()) {
      return { valid: false, error: "Token expired" };
    }

    return {
      valid: true,
      data: {
        id: data.id,
        tenant_id: data.tenant_id,
        customer_id: data.customer_id,
        email: data.email,
        purpose: data.purpose,
      },
    };
  } catch (err) {
    console.error("Error validating preference token:", err);
    return { valid: false, error: "Failed to validate token" };
  }
}
