import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAudienceRecipientIds } from "@/lib/computeAudienceRecipientCount";

/**
 * Email reachability for a tenant or a campaign audience. Every customer in
 * scope is in exactly one bucket, so
 *   total = confirmed + pending + optedOut + neverOptedIn + suppressed.
 * Definition (one place): public.email_reachability_summary.
 */
export interface TenantAudienceHealth {
  total: number;
  /** Said yes to email and can be sent to. */
  confirmed: number;
  /** Waiting for permission (pending confirmation or not recorded). */
  pending: number;
  /** Asked us to stop: an explicit opt-out, unsubscribe or complaint. */
  optedOut: number;
  /** Never opted in: email permission is "no" with no opt-out on record. */
  neverOptedIn: number;
  /** Can't be sent to (bad address, suppressed or bounced). */
  suppressed: number;
  /** Reachable for email. Same as confirmed. */
  eligible: number;
}

const EMPTY_HEALTH: TenantAudienceHealth = {
  total: 0,
  confirmed: 0,
  pending: 0,
  optedOut: 0,
  neverOptedIn: 0,
  suppressed: 0,
  eligible: 0,
};

export interface EmailReachabilityRow {
  total: number | string | null;
  reachable: number | string | null;
  waiting: number | string | null;
  /** asked_to_stop + never_opted_in (kept for older clients). */
  stopped: number | string | null;
  unsendable: number | string | null;
  asked_to_stop: number | string | null;
  never_opted_in: number | string | null;
}

function toCount(value: number | string | null | undefined) {
  const count = typeof value === "string" ? Number(value) : value;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("Email reachability count is not available.");
  }
  return count;
}

/** Maps email_reachability_summary rows (summed across batches) to health. */
export function toAudienceHealth(rows: EmailReachabilityRow[]): TenantAudienceHealth {
  const health = { ...EMPTY_HEALTH };
  for (const row of rows) {
    const total = toCount(row.total);
    const reachable = toCount(row.reachable);
    const waiting = toCount(row.waiting);
    const stopped = toCount(row.stopped);
    const unsendable = toCount(row.unsendable);
    const askedToStop = toCount(row.asked_to_stop);
    const neverOptedIn = toCount(row.never_opted_in);
    if (
      askedToStop + neverOptedIn !== stopped ||
      reachable + waiting + askedToStop + neverOptedIn + unsendable !== total
    ) {
      throw new Error("Email reachability buckets do not add up to the total.");
    }
    health.total += total;
    health.confirmed += reachable;
    health.eligible += reachable;
    health.pending += waiting;
    health.optedOut += askedToStop;
    health.neverOptedIn += neverOptedIn;
    health.suppressed += unsendable;
  }
  return health;
}

const REACHABILITY_ID_BATCH = 1000;

/**
 * Counts email reachability for the whole tenant (customerIds = null) or for
 * the given customers. A failed read throws: unavailable is not zero.
 */
export async function fetchEmailReachability(
  tenantId: string,
  customerIds: string[] | null,
): Promise<TenantAudienceHealth> {
  const batches: Array<string[] | null> = [];
  if (customerIds === null) {
    batches.push(null);
  } else {
    const unique = Array.from(new Set(customerIds));
    for (let index = 0; index < unique.length; index += REACHABILITY_ID_BATCH) {
      batches.push(unique.slice(index, index + REACHABILITY_ID_BATCH));
    }
  }
  if (batches.length === 0) return EMPTY_HEALTH;

  const rows: EmailReachabilityRow[] = [];
  for (const batch of batches) {
    const { data, error } = await supabase.rpc("email_reachability_summary", {
      p_tenant_id: tenantId,
      ...(batch ? { p_customer_ids: batch } : {}),
    });
    if (error) throw error;
    rows.push(...((data ?? []) as EmailReachabilityRow[]));
  }
  return toAudienceHealth(rows);
}

export async function fetchTenantAudienceHealth(
  tenantId: string,
): Promise<TenantAudienceHealth> {
  return fetchEmailReachability(tenantId, null);
}

export function useTenantAudienceHealth(
  tenantId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["tenant-audience-health", tenantId],
    enabled: (options?.enabled ?? true) && Boolean(tenantId),
    staleTime: 5 * 60_000,
    queryFn: () => fetchTenantAudienceHealth(tenantId as string),
    placeholderData: EMPTY_HEALTH,
  });
}

export const EMPTY_TENANT_AUDIENCE_HEALTH = EMPTY_HEALTH;


export interface CampaignAudienceHealthOptions {
  tenantId: string | null | undefined;
  includeAllCustomers: boolean;
  additionalCustomerIds: string[];
  segmentIds: string[];
  personaIds: string[];
  enabled?: boolean;
}

const RESERVED_EMAIL_TLDS = ["invalid", "test", "localhost", "example"];
const RESERVED_EMAIL_DOMAINS = ["example.com", "example.net", "example.org"];

/**
 * RFC 2606 / 6761 reserved domains never receive mail (demo and test data).
 * Same rule as the send path (_shared/canSendEmail.ts) and
 * public.is_reserved_email_domain.
 */
export function isReservedEmailDomain(email: string): boolean {
  const domain = (email.split("@").pop() ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!domain) return false;
  if (RESERVED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  return RESERVED_EMAIL_TLDS.includes(domain.split(".").pop() ?? "");
}

/** Imported IdealPOS placeholders and reserved domains are not deliverable. */
export function hasUsableCampaignEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    !email.toLowerCase().endsWith("@noemail.local") &&
    !isReservedEmailDomain(email);
}

export async function fetchCampaignAudienceHealth(
  options: Omit<CampaignAudienceHealthOptions, "enabled"> & { tenantId: string },
): Promise<TenantAudienceHealth> {
  const hasExplicitAudience =
    options.includeAllCustomers ||
    options.additionalCustomerIds.length > 0 ||
    options.segmentIds.length > 0 ||
    options.personaIds.length > 0;

  // No audience chosen yet, or "everyone": the whole tenant, counted in SQL.
  if (!hasExplicitAudience || options.includeAllCustomers) {
    return fetchEmailReachability(options.tenantId, null);
  }

  const customerIds = await resolveAudienceRecipientIds({
    tenantId: options.tenantId,
    includeAllCustomers: false,
    additionalCustomerIds: options.additionalCustomerIds,
    fallbackToAllCustomers: false,
    segmentIds: options.segmentIds,
    personaIds: options.personaIds,
  });

  if (customerIds.length === 0) {
    return EMPTY_HEALTH;
  }

  return fetchEmailReachability(options.tenantId, customerIds);
}

export function useCampaignAudienceHealth(options: CampaignAudienceHealthOptions) {
  return useQuery({
    queryKey: [
      "campaign-audience-health",
      options.tenantId,
      options.includeAllCustomers,
      options.additionalCustomerIds,
      options.segmentIds,
      options.personaIds,
    ],
    enabled: (options.enabled ?? true) && Boolean(options.tenantId),
    staleTime: 60_000,
    queryFn: () =>
      fetchCampaignAudienceHealth({
        tenantId: options.tenantId as string,
        includeAllCustomers: options.includeAllCustomers,
        additionalCustomerIds: options.additionalCustomerIds,
        segmentIds: options.segmentIds,
        personaIds: options.personaIds,
      }),
    placeholderData: EMPTY_HEALTH,
  });
}

