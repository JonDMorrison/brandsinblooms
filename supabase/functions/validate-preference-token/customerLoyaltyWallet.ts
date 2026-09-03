export type LoyaltyBalanceUnit = "points" | "currency" | "unknown";

export interface CustomerLoyaltyWalletEntry {
  provider: string;
  programName: string;
  balance: number;
  balanceUnit: LoyaltyBalanceUnit;
  currency: string | null;
  lastSyncedAt: string;
}

interface LoyaltyProviderAccountRow {
  provider?: unknown;
  program_name?: unknown;
  balance?: unknown;
  balance_unit?: unknown;
  currency?: unknown;
  last_synced_at?: unknown;
  status?: unknown;
}

const LEGACY_PROVIDERS = new Set(["legacy_metrics", "crm_import"]);
const BALANCE_UNITS = new Set<LoyaltyBalanceUnit>([
  "points",
  "currency",
  "unknown",
]);

function normalizeEntry(
  row: LoyaltyProviderAccountRow,
): CustomerLoyaltyWalletEntry | null {
  if (row.status !== "active" || typeof row.provider !== "string") {
    return null;
  }

  const provider = row.provider.trim().toLowerCase();
  const balance = Number(row.balance);
  const balanceUnit = row.balance_unit as LoyaltyBalanceUnit;
  const currency =
    typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency)
      ? row.currency
      : null;
  const lastSyncedAt =
    typeof row.last_synced_at === "string" ? row.last_synced_at : "";

  if (
    !provider ||
    !Number.isFinite(balance) ||
    balance < 0 ||
    !BALANCE_UNITS.has(balanceUnit) ||
    !lastSyncedAt ||
    (balanceUnit === "currency" && !currency)
  ) {
    return null;
  }

  const programName =
    typeof row.program_name === "string" && row.program_name.trim()
      ? row.program_name.trim()
      : provider === "legacy_metrics"
        ? "Loyalty points"
        : provider === "crm_import"
          ? "Loyalty rewards"
          : `${provider.charAt(0).toUpperCase()}${provider.slice(1)} Loyalty`;

  return {
    provider,
    programName,
    balance,
    balanceUnit,
    currency: balanceUnit === "currency" ? currency : null,
    lastSyncedAt,
  };
}

export function buildCustomerLoyaltyWallet(
  value: unknown,
): CustomerLoyaltyWalletEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = value
    .map((row) =>
      row && typeof row === "object"
        ? normalizeEntry(row as LoyaltyProviderAccountRow)
        : null,
    )
    .filter((entry): entry is CustomerLoyaltyWalletEntry => Boolean(entry))
    .sort(
      (left, right) =>
        Date.parse(right.lastSyncedAt) - Date.parse(left.lastSyncedAt),
    );
  const providerEntries = entries.filter(
    (entry) => !LEGACY_PROVIDERS.has(entry.provider),
  );

  if (providerEntries.length > 0) {
    return providerEntries;
  }

  const pointBaseline = entries.find(
    (entry) => entry.provider === "legacy_metrics",
  );
  if (pointBaseline) {
    return [pointBaseline];
  }

  const importedBaseline = entries.find(
    (entry) => entry.provider === "crm_import",
  );
  return importedBaseline ? [importedBaseline] : [];
}
