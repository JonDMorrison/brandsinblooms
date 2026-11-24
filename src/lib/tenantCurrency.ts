const COUNTRY_CURRENCY: Record<string, string> = {
  ca: "CAD",
  canada: "CAD",
  us: "USD",
  usa: "USD",
  "united states": "USD",
  gb: "GBP",
  uk: "GBP",
  "united kingdom": "GBP",
  au: "AUD",
  australia: "AUD",
  nz: "NZD",
  "new zealand": "NZD",
};

/**
 * The tenant's display currency: tenants.settings.currency when set, else
 * the tenant's country, else USD. (No tenant stores a currency today.)
 */
export function resolveTenantCurrency(
  tenant: { settings?: unknown; country?: string | null } | null | undefined,
): string {
  const settings =
    tenant?.settings && typeof tenant.settings === "object"
      ? (tenant.settings as Record<string, unknown>)
      : {};
  const configured = settings.currency;
  if (typeof configured === "string" && /^[A-Za-z]{3}$/.test(configured.trim())) {
    return configured.trim().toUpperCase();
  }
  const country = (tenant?.country ?? "").trim().toLowerCase();
  return COUNTRY_CURRENCY[country] ?? "USD";
}
