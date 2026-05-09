import { canSendEmail, canSendEmailBatch } from "./canSendEmail.ts";

interface EligibleAudienceCustomerLike {
  id: string;
  email?: string | null;
  email_opt_in?: boolean | null;
}

function normalizeEmail(email: string | null | undefined) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export async function isCustomerEligibleForEmailAudience(
  supabase: any,
  params: {
    tenantId: string;
    customer: EligibleAudienceCustomerLike;
  },
) {
  const { tenantId, customer } = params;
  const email = normalizeEmail(customer.email);

  if (!email || customer.email_opt_in === false) {
    return false;
  }

  const result = await canSendEmail(supabase, {
    tenantId,
    customerId: customer.id,
    email,
  });

  return result.allowed;
}

export async function resolveEligibleEmailCustomerIds(
  supabase: any,
  params: {
    tenantId: string;
    customers: EligibleAudienceCustomerLike[];
  },
) {
  const { tenantId, customers } = params;
  const emailableCustomers = customers.filter((customer) => {
    const email = normalizeEmail(customer.email);
    return Boolean(email) && customer.email_opt_in !== false;
  });

  if (emailableCustomers.length === 0) {
    return new Set<string>();
  }

  const eligibility = await canSendEmailBatch(supabase, {
    tenantId,
    recipients: emailableCustomers.map((customer) => ({
      customerId: customer.id,
      email: normalizeEmail(customer.email),
    })),
  });

  const eligibleCustomerIds = new Set<string>();

  for (const customer of emailableCustomers) {
    const email = normalizeEmail(customer.email);
    const result = eligibility.get(email);
    if (result?.allowed) {
      eligibleCustomerIds.add(customer.id);
    }
  }

  return eligibleCustomerIds;
}
