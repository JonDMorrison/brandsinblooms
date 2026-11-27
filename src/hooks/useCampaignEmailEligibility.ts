import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Who an email campaign audience can actually reach, counted on the server by
 * public.email_campaign_eligibility with the same rule send-email-campaign
 * enforces at delivery time (docs/email-eligibility.md).
 *
 * Every campaign editor surface reads this and nothing else: the audience
 * panel, the Audience step badge and summary, the readiness bar, the Schedule
 * button, the Schedule drawer and the Ready to send dialog. Nothing on the
 * client recounts eligibility.
 */
export interface CampaignEmailEligibility {
  /** False when no audience is chosen; the worker refuses to send then. */
  audienceConfigured: boolean;
  /** Audience contacts with an email address on file. */
  total: number;
  /** Unique addresses a send would go to. */
  eligible: number;
  /** email_opt_in = false while a confirmation is pending. */
  waiting: number;
  /** Opted out, unsubscribed or complained. */
  askedToStop: number;
  /** email_opt_in = false with no opt-out on record. */
  neverOptedIn: number;
  /** Bad, test or placeholder address, or on a suppression list. */
  unsendable: number;
  /** Extra contact records that share an address with an eligible one. */
  duplicates: number;
  /** Contacts that stay excluded even with every send-time override. */
  blocked: number;
  /** Unique addresses with the "I confirm these contacts opted in" override. */
  eligibleWithConsentOverride: number;
  /** Unique addresses with the "retry temporary delivery problems" override. */
  eligibleWithSoftOverride: number;
  /** Unique addresses with both overrides. */
  eligibleWithBothOverrides: number;
  /** The one address, when exactly one is eligible. */
  singleEligibleEmail: string | null;
}

export interface CampaignEmailEligibilityAudience {
  tenantId: string;
  includeAllCustomers: boolean;
  segmentIds: string[];
  personaIds: string[];
  additionalCustomerIds: string[];
}

type EligibilityRow =
  Database["public"]["Functions"]["email_campaign_eligibility"]["Returns"][number];
function toCount(value: unknown): number {
  const count = typeof value === "string" ? Number(value) : value;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("Email eligibility count is not available.");
  }
  return count;
}

/** Maps the RPC row. Counts that do not add up are rejected, never shown. */
export function toCampaignEmailEligibility(row: EligibilityRow | undefined): CampaignEmailEligibility {
  if (!row) throw new Error("Email eligibility was not returned.");
  const result: CampaignEmailEligibility = {
    audienceConfigured: row.audience_configured === true,
    total: toCount(row.total),
    eligible: toCount(row.eligible),
    waiting: toCount(row.waiting),
    askedToStop: toCount(row.asked_to_stop),
    neverOptedIn: toCount(row.never_opted_in),
    unsendable: toCount(row.unsendable),
    duplicates: toCount(row.duplicates),
    blocked: toCount(row.blocked),
    eligibleWithConsentOverride: toCount(row.eligible_with_consent_override),
    eligibleWithSoftOverride: toCount(row.eligible_with_soft_override),
    eligibleWithBothOverrides: toCount(row.eligible_with_both_overrides),
    singleEligibleEmail: row.single_eligible_email ?? null,
  };
  const parts =
    result.eligible + result.waiting + result.askedToStop + result.neverOptedIn +
    result.unsendable + result.duplicates;
  if (parts !== result.total) {
    throw new Error("Email eligibility buckets do not add up to the total.");
  }
  return result;
}

export function campaignEmailEligibilityQueryKey(audience: Partial<CampaignEmailEligibilityAudience>) {
  return [
    "campaign-email-eligibility",
    audience.tenantId ?? null,
    audience.includeAllCustomers ?? false,
    audience.segmentIds ?? [],
    audience.personaIds ?? [],
    audience.additionalCustomerIds ?? [],
  ] as const;
}

export async function fetchCampaignEmailEligibility(
  audience: CampaignEmailEligibilityAudience,
): Promise<CampaignEmailEligibility> {
  const { data, error } = await supabase.rpc("email_campaign_eligibility", {
    p_tenant_id: audience.tenantId,
    p_include_all_customers: audience.includeAllCustomers,
    p_segment_ids: audience.segmentIds,
    p_persona_ids: audience.personaIds,
    p_customer_ids: audience.additionalCustomerIds,
  });
  if (error) throw error;
  return toCampaignEmailEligibility((data ?? [])[0]);
}

/**
 * The send gate every surface shares.
 * - checking: the count for the current audience has not come back yet;
 * - error: the count could not be read (unavailable is not zero);
 * - none: the check finished and nobody can receive email;
 * - ready: the check finished and at least one address can.
 */
export type EmailEligibilityGate = "checking" | "error" | "none" | "ready";

export function deriveEmailEligibilityGate(query: {
  data: CampaignEmailEligibility | undefined;
  isError: boolean;
}): EmailEligibilityGate {
  if (query.data) return query.data.eligible > 0 ? "ready" : "none";
  return query.isError ? "error" : "checking";
}

export const CHECKING_AUDIENCE_LABEL = "Checking audience";
export const NO_ELIGIBLE_RECIPIENTS_MESSAGE = "No one in this audience can receive email";

export function useCampaignEmailEligibility(
  audience: Omit<CampaignEmailEligibilityAudience, "tenantId"> & {
    tenantId: string | null | undefined;
    enabled?: boolean;
  },
) {
  const query = useQuery({
    queryKey: campaignEmailEligibilityQueryKey({ ...audience, tenantId: audience.tenantId ?? undefined }),
    enabled: (audience.enabled ?? true) && Boolean(audience.tenantId),
    staleTime: 60_000,
    queryFn: () =>
      fetchCampaignEmailEligibility({
        tenantId: audience.tenantId as string,
        includeAllCustomers: audience.includeAllCustomers,
        segmentIds: audience.segmentIds,
        personaIds: audience.personaIds,
        additionalCustomerIds: audience.additionalCustomerIds,
      }),
  });
  return { ...query, gate: deriveEmailEligibilityGate(query) };
}

/**
 * Whether each listed customer can receive a campaign email, and why not,
 * from public.email_campaign_customer_eligibility. That function reads the
 * same rule rows as email_campaign_eligibility
 * (private.email_campaign_audience_contacts), so a person marked "can
 * receive" here is one the campaign count would include as a direct customer.
 */
export const CUSTOMER_EMAIL_REASON_LABELS = {
  eligible: "Can receive email",
  duplicate_address: "Shares an email address with another customer",
  waiting_confirmation: "Hasn't confirmed their email address yet",
  unsubscribed: "Unsubscribed",
  complained: "Marked an email as spam",
  opted_out: "Said no to email",
  never_opted_in: "Hasn't agreed to receive email",
  undeliverable_address: "Email address can't receive mail",
  blocked: "Blocked from email",
  bounced: "Bounced",
  shared_blocked_address: "Shares an email address that is blocked",
  no_email: "No email address",
} as const;

export type CustomerEmailReason = keyof typeof CUSTOMER_EMAIL_REASON_LABELS;

/**
 * The reasons counted in the "Can't be sent to" (unsendable) bucket, in the
 * order docs/email-eligibility.md lists them, each with a one-line
 * explanation for the Audience panel.
 */
export const UNSENDABLE_EMAIL_REASONS = [
  {
    reason: "undeliverable_address",
    detail: "The address is malformed, a placeholder, or on a reserved test domain such as example.com.",
  },
  {
    reason: "blocked",
    detail: "The address is on a block list, so email to it is never sent.",
  },
  {
    reason: "bounced",
    detail: "Earlier email to this address bounced.",
  },
  {
    reason: "shared_blocked_address",
    detail: "Another contact with the same address has email turned off or is suppressed, so the address is skipped.",
  },
] as const satisfies ReadonlyArray<{ reason: CustomerEmailReason; detail: string }>;

export interface CustomerEmailEligibility {
  customerId: string;
  canReceive: boolean;
  reason: CustomerEmailReason;
  /** Plain-English reason, shown when the customer cannot receive email. */
  label: string;
}

type CustomerEligibilityRow =
  Database["public"]["Functions"]["email_campaign_customer_eligibility"]["Returns"][number];

function isCustomerEmailReason(value: string): value is CustomerEmailReason {
  return Object.prototype.hasOwnProperty.call(CUSTOMER_EMAIL_REASON_LABELS, value);
}

/** Maps the RPC rows. An unknown reason is rejected, never guessed at. */
export function toCustomerEmailEligibility(
  rows: CustomerEligibilityRow[],
): Map<string, CustomerEmailEligibility> {
  const result = new Map<string, CustomerEmailEligibility>();
  for (const row of rows) {
    if (!isCustomerEmailReason(row.reason)) {
      throw new Error(`Unknown email eligibility reason: ${row.reason}`);
    }
    result.set(row.customer_id, {
      customerId: row.customer_id,
      canReceive: row.can_receive === true,
      reason: row.reason,
      label: CUSTOMER_EMAIL_REASON_LABELS[row.reason],
    });
  }
  return result;
}

export function customerEmailEligibilityQueryKey(
  tenantId: string | null | undefined,
  customerIds: readonly string[],
) {
  return [
    "campaign-customer-email-eligibility",
    tenantId ?? null,
    [...new Set(customerIds)].sort(),
  ] as const;
}

export async function fetchCustomerEmailEligibility(
  tenantId: string,
  customerIds: readonly string[],
): Promise<Map<string, CustomerEmailEligibility>> {
  const ids = [...new Set(customerIds)].sort();
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc("email_campaign_customer_eligibility", {
    p_tenant_id: tenantId,
    p_customer_ids: ids,
  });
  if (error) throw error;
  return toCustomerEmailEligibility(data ?? []);
}

export function useCustomerEmailEligibility(params: {
  tenantId: string | null | undefined;
  customerIds: readonly string[];
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: customerEmailEligibilityQueryKey(params.tenantId, params.customerIds),
    enabled:
      (params.enabled ?? true) && Boolean(params.tenantId) && params.customerIds.length > 0,
    staleTime: 60_000,
    queryFn: () => fetchCustomerEmailEligibility(params.tenantId as string, params.customerIds),
  });
}
