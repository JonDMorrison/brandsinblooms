export async function resolveLightspeedCustomerCrmId(
  supabase: any,
  tenantId: string,
  lightspeedCustomerId: string | null | undefined,
): Promise<string | null> {
  if (!lightspeedCustomerId) {
    return null;
  }

  const { data: providerRow, error: providerError } = await supabase
    .from("lightspeed_customers")
    .select("contact_id")
    .eq("tenant_id", tenantId)
    .eq("lightspeed_customer_id", lightspeedCustomerId)
    .maybeSingle();

  if (providerError) {
    console.error(
      `[resolveLightspeedCustomerCrmId] Provider lookup failed for ${lightspeedCustomerId}:`,
      providerError.message,
    );
  }

  if (
    typeof providerRow?.contact_id === "string" &&
    providerRow.contact_id.length > 0
  ) {
    return providerRow.contact_id;
  }

  const { data: crmRow, error: crmError } = await supabase
    .from("crm_customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("pos_source", "lightspeed")
    .eq("external_id", lightspeedCustomerId)
    .maybeSingle();

  if (crmError) {
    console.error(
      `[resolveLightspeedCustomerCrmId] CRM fallback lookup failed for ${lightspeedCustomerId}:`,
      crmError.message,
    );
    return null;
  }

  return typeof crmRow?.id === "string" && crmRow.id.length > 0
    ? crmRow.id
    : null;
}
