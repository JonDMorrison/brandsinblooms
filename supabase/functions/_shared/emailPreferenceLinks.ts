import { createClient } from "npm:@supabase/supabase-js@2";

export interface EmailPreferenceLinks {
  unsubscribeUrl: string;
  preferencesUrl: string;
}

interface PreferenceLinkCustomer {
  id?: string;
  email: string;
}

let serviceClient: ReturnType<typeof createClient> | null = null;

function getServiceClient() {
  if (!serviceClient) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Email preference link service is not configured");
    }

    serviceClient = createClient(supabaseUrl, serviceRoleKey);
  }

  return serviceClient;
}

function buildLinks(token: string): EmailPreferenceLinks {
  const appUrl = (Deno.env.get("APP_URL") || "https://bloomsuite.app").replace(
    /\/$/,
    "",
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const encodedToken = encodeURIComponent(token);

  return {
    unsubscribeUrl: `${supabaseUrl}/functions/v1/handle-unsubscribe?token=${encodedToken}`,
    preferencesUrl: `${appUrl}/email-preferences?token=${encodedToken}`,
  };
}

/**
 * Reuse a long-lived opaque token for campaign and automation footers. The
 * token contains no email address or tenant identifier and cannot be forged
 * from public customer data.
 */
export async function resolveEmailPreferenceLinks(
  tenantId: string,
  customer: PreferenceLinkCustomer,
): Promise<EmailPreferenceLinks> {
  if (!customer.id || !customer.email) {
    return {
      unsubscribeUrl: "#unsubscribe",
      preferencesUrl: "#preferences",
    };
  }

  const supabase = getServiceClient();
  const minimumExpiry = new Date();
  minimumExpiry.setDate(minimumExpiry.getDate() + 30);

  const { data: existing, error: lookupError } = await supabase
    .from("crm_email_preference_tokens")
    .select("token")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customer.id)
    .eq("purpose", "manage_preferences")
    .gt("expires_at", minimumExpiry.toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Unable to load email preference token: ${lookupError.message}`,
    );
  }

  if (existing?.token) {
    return buildLinks(existing.token);
  }

  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  const { error: insertError } = await supabase
    .from("crm_email_preference_tokens")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      email: customer.email,
      token,
      purpose: "manage_preferences",
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    throw new Error(
      `Unable to create email preference token: ${insertError.message}`,
    );
  }

  return buildLinks(token);
}
