import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAudienceRecipientIds } from "@/lib/computeAudienceRecipientCount";

export interface TenantAudienceHealth {
  total: number;
  confirmed: number;
  pending: number;
  optedOut: number;
  suppressed: number;
  eligible: number;
}

const EMPTY_HEALTH: TenantAudienceHealth = {
  total: 0,
  confirmed: 0,
  pending: 0,
  optedOut: 0,
  suppressed: 0,
  eligible: 0,
};

function buildBaseQuery(tenantId: string) {
  return supabase
    .from("crm_customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("email", "is", null);
}

export async function fetchTenantAudienceHealth(
  tenantId: string,
): Promise<TenantAudienceHealth> {
  // Counts via head:true so we never pull row data — these are aggregate
  // numbers only and we run them in parallel.
  const [totalRes, confirmedRes, pendingRes, optedOutRes, suppressedRes] =
    await Promise.all([
      buildBaseQuery(tenantId),
      buildBaseQuery(tenantId).eq("email_opt_in", true),
      buildBaseQuery(tenantId)
        .eq("email_opt_in", false)
        .eq("email_consent_method", "pending_confirmation"),
      buildBaseQuery(tenantId)
        .eq("email_opt_in", false)
        .neq("email_consent_method", "pending_confirmation"),
      buildBaseQuery(tenantId).eq("suppressed", true),
    ]);

  const safe = (count: number | null | undefined) =>
    typeof count === "number" && Number.isFinite(count) && count >= 0
      ? count
      : 0;

  const total = safe(totalRes.count);
  const confirmed = safe(confirmedRes.count);
  const pending = safe(pendingRes.count);
  const optedOut = safe(optedOutRes.count);
  const suppressed = safe(suppressedRes.count);
  const eligible = Math.max(0, confirmed - suppressed);

  return {
    total,
    confirmed,
    pending,
    optedOut,
    suppressed,
    eligible,
  };
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

const AUDIENCE_HEALTH_CHUNK_SIZE = 500;

export async function fetchCampaignAudienceHealth(
  options: Omit<CampaignAudienceHealthOptions, "enabled"> & { tenantId: string },
): Promise<TenantAudienceHealth> {
  const hasExplicitAudience =
    options.includeAllCustomers ||
    options.additionalCustomerIds.length > 0 ||
    options.segmentIds.length > 0 ||
    options.personaIds.length > 0;

  const customerIds = await resolveAudienceRecipientIds({
    tenantId: options.tenantId,
    includeAllCustomers: options.includeAllCustomers,
    additionalCustomerIds: options.additionalCustomerIds,
    fallbackToAllCustomers: !hasExplicitAudience,
    segmentIds: options.segmentIds,
    personaIds: options.personaIds,
  });

  if (customerIds.length === 0) {
    return EMPTY_HEALTH;
  }

  const customers: Array<{
    id: string;
    email: string | null;
    email_opt_in: boolean | null;
    email_consent_method: string | null;
    suppressed: boolean | null;
  }> = [];

  for (let index = 0; index < customerIds.length; index += AUDIENCE_HEALTH_CHUNK_SIZE) {
    const chunk = customerIds.slice(index, index + AUDIENCE_HEALTH_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("crm_customers")
      .select("id, email, email_opt_in, email_consent_method, suppressed")
      .eq("tenant_id", options.tenantId)
      .is("deleted_at", null)
      .not("email", "is", null)
      .in("id", chunk);

    if (error) {
      throw error;
    }

    customers.push(...(data ?? []));
  }

  const total = customers.length;
  const confirmed = customers.filter((customer) => customer.email_opt_in === true).length;
  const pending = customers.filter(
    (customer) =>
      customer.email_opt_in === false &&
      customer.email_consent_method === "pending_confirmation",
  ).length;
  const optedOut = customers.filter(
    (customer) =>
      customer.email_opt_in === false &&
      customer.email_consent_method !== null &&
      customer.email_consent_method !== "pending_confirmation",
  ).length;
  const suppressed = customers.filter((customer) => customer.suppressed === true).length;
  const eligible = customers.filter(
    (customer) => customer.email_opt_in === true && customer.suppressed !== true,
  ).length;

  return { total, confirmed, pending, optedOut, suppressed, eligible };
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

