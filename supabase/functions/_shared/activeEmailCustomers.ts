// Customer lifecycle is an independent, non-bypassable delivery requirement.
export interface CustomerIdentity { customer_id: string | null; tenant_id: string | null }
export async function activeEmailCustomerIds(db: any, tenantId: string, ids: string[]): Promise<Set<string>> {
  if (!tenantId) throw new Error("Customer lifecycle check requires tenant");
  const active = new Set<string>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += 200) {
    const { data, error } = await db.from("crm_customers")
      .select("id, tenant_id, deleted_at, merged_into_customer_id")
      .eq("tenant_id", tenantId).in("id", unique.slice(offset, offset + 200));
    if (error || !Array.isArray(data)) throw new Error("Customer lifecycle lookup failed");
    for (const row of data) {
      if (row.tenant_id === tenantId && row.deleted_at === null && row.merged_into_customer_id === null)
        active.add(row.id);
    }
  }
  return active;
}
export async function assertActiveEmailCustomers(db: any, identities: CustomerIdentity[]): Promise<void> {
  if (identities.some(r => !r.tenant_id || !r.customer_id)) throw new Error("Customer lifecycle identity missing");
  for (const tenant of new Set(identities.map(r => r.tenant_id!))) {
    const ids = identities.filter(r => r.tenant_id === tenant).map(r => r.customer_id!);
    const active = await activeEmailCustomerIds(db, tenant, ids);
    if (ids.some(id => !active.has(id))) throw new Error("Customer missing, deleted or merged before delivery");
  }
}

// Record the uncertain delivery boundary before contacting the provider. A crash
// or ambiguous provider response must not let a later claim reshape the batch.
export async function prepareCustomerDelivery(db: any, messages: Array<CustomerIdentity & { id: string }>, claimToken: string): Promise<void> {
  await assertActiveEmailCustomers(db, messages);
  const ids = messages.map(m => m.id);
  const { data, error } = await db.from("email_messages").update({
    delivery_reconciliation_required: true, dead_lettered_at: new Date().toISOString(), error_message: "delivery_unconfirmed_requires_reconciliation",
  }).in("id", ids).eq("claim_token", claimToken).is("resend_id", null).select("id");
  if (error || !Array.isArray(data) || new Set(data.map((r: {id: string}) => r.id)).size !== new Set(ids).size)
    throw new Error("Could not reserve customer delivery reconciliation hold");
}

export function confirmedDeliveryOutcome(result: {resendId?: string; status?: number}): boolean {
  // Validation and rate limits explicitly reject the request. Everything else
  // without a receipt remains uncertain, including malformed success bodies.
  return Boolean(result.resendId) || [400, 422, 429].includes(result.status ?? 0);
}
