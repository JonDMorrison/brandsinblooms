interface IdentityBatchResult {
  results?: unknown;
}

export interface ProviderLoyaltyCandidate {
  externalId: string;
  balance: number | null;
  hasAccount: boolean;
  observedAt: string;
  lifetimeValue?: number | null;
  externalProgramId?: string | null;
}

interface SyncProviderLoyaltyBalancesParams {
  supabase: any;
  tenantId: string;
  provider: string;
  programName: string;
  identityResult: IdentityBatchResult | null;
  candidates: ProviderLoyaltyCandidate[];
}

function getResolvedCustomerId(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;

  const record = entry as Record<string, unknown>;
  if (typeof record.customer_id === "string") return record.customer_id;

  const result = record.result;
  if (!result || typeof result !== "object") return null;
  const customerId = (result as Record<string, unknown>).customer_id;
  return typeof customerId === "string" ? customerId : null;
}

function buildIdentityMap(identityResult: IdentityBatchResult | null) {
  const resolved = new Map<string, string>();
  const results = Array.isArray(identityResult?.results)
    ? identityResult.results
    : [];

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const externalId = (entry as Record<string, unknown>).external_id;
    const customerId = getResolvedCustomerId(entry);
    if (typeof externalId === "string" && customerId) {
      resolved.set(externalId, customerId);
    }
  }

  return resolved;
}

function requireNonNegativeNumber(value: unknown, label: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return numeric;
}

export async function syncProviderLoyaltyBalances({
  supabase,
  tenantId,
  provider,
  programName,
  identityResult,
  candidates,
}: SyncProviderLoyaltyBalancesParams) {
  const resolvedCustomers = buildIdentityMap(identityResult);
  let synced = 0;
  let unresolved = 0;

  for (const candidate of candidates) {
    if (!candidate.hasAccount || candidate.balance === null) continue;

    const customerId = resolvedCustomers.get(candidate.externalId);
    if (!customerId) {
      unresolved += 1;
      continue;
    }

    const balance = requireNonNegativeNumber(
      candidate.balance,
      `${provider} loyalty balance`,
    );
    const lifetimeValue = requireNonNegativeNumber(
      candidate.lifetimeValue ?? 0,
      `${provider} loyalty lifetime value`,
    );

    const { error } = await supabase.rpc("sync_loyalty_account_snapshot", {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_provider: provider,
      p_external_account_id: candidate.externalId,
      p_external_program_id: candidate.externalProgramId ?? null,
      p_program_name: programName,
      p_balance: balance,
      p_lifetime_value: lifetimeValue,
      p_balance_unit: "unknown",
      p_currency: null,
      p_enrolled_at: null,
      p_observed_at: candidate.observedAt,
    });

    if (error) {
      throw new Error(`${provider} loyalty snapshot failed: ${error.message}`);
    }
    synced += 1;
  }

  return { synced, unresolved };
}
