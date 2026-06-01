import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
